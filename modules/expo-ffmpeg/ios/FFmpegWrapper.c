/**
 * FFmpegWrapper.c — C wrapper around FFmpeg's low-level API for iOS.
 *
 * Since we compiled FFmpeg with --disable-programs, we don't have the ffmpeg
 * CLI main(). Instead, we use the avformat/avcodec/avfilter API directly to:
 *   1. Transcode video (with optional filter graph for overlays/scaling)
 *   2. Probe media info
 *   3. Support cancellation via an atomic abort flag
 *
 * The execute() function parses a simplified FFmpeg-style command string and
 * drives a decode -> filter -> encode pipeline.
 */

#include "FFmpegWrapper.h"

#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavfilter/avfilter.h>
#include <libavfilter/buffersink.h>
#include <libavfilter/buffersrc.h>
#include <libavutil/opt.h>
#include <libavutil/pixdesc.h>
#include <libavutil/mathematics.h>
#include <libavutil/channel_layout.h>
#include <libavutil/dict.h>
#include <libavutil/error.h>
#include <libavutil/log.h>
#include <libavutil/mem.h>
#include <libavutil/avutil.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
#include <libswresample/swresample.h>

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdatomic.h>
#include <pthread.h>
#include <errno.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/stat.h>

// ─── Abort flag ──────────────────────────────────────────────────────────────

static atomic_int g_abort_flag = 0;

void ffmpeg_cancel(void) {
    atomic_store(&g_abort_flag, 1);
}

static int check_abort(void) {
    return atomic_load(&g_abort_flag);
}

// ─── Log capture ─────────────────────────────────────────────────────────────

static char *g_log_buffer = NULL;
static int g_log_buffer_size = 0;
static int g_log_buffer_pos = 0;
static pthread_mutex_t g_log_mutex = PTHREAD_MUTEX_INITIALIZER;

static void log_callback(void *avcl, int level, const char *fmt, va_list vl) {
    if (level > AV_LOG_ERROR) return;

    char line[1024];
    int len = vsnprintf(line, sizeof(line), fmt, vl);
    if (len <= 0) return;

    pthread_mutex_lock(&g_log_mutex);
    if (g_log_buffer && g_log_buffer_pos + len < g_log_buffer_size - 1) {
        memcpy(g_log_buffer + g_log_buffer_pos, line, len);
        g_log_buffer_pos += len;
        g_log_buffer[g_log_buffer_pos] = '\0';
    }
    pthread_mutex_unlock(&g_log_mutex);
}

// ─── Command parsing ─────────────────────────────────────────────────────────

/**
 * Parsed command arguments from an FFmpeg-style command string.
 */
typedef struct {
    char *input_path;
    char *output_path;
    char *overlay_path;       // -i second input (for overlay)
    char *vcodec;             // -c:v / -vcodec
    char *acodec;             // -c:a / -acodec
    char *filter_complex;     // -filter_complex
    char *vf;                 // -vf (simple video filter)
    int video_bitrate;        // -b:v in bits/sec
    int audio_bitrate;        // -b:a in bits/sec
    int crf;                  // -crf
    int width;                // from -s WxH
    int height;
    int threads;              // -threads
    int has_an;               // -an (no audio)
    int movflags_faststart;   // -movflags faststart
    char *preset;             // -preset
    char *profile;            // -profile:v
    double seek_seconds;      // -ss <seconds>
    int max_frames;           // -vframes <count>
    char *format;             // -f <format>
    // Raw argc/argv for future extensibility
    int argc;
    char **argv;
} ParsedCommand;

static char **tokenize_command(const char *command, int *out_argc) {
    // Simple shell-like tokenizer: handles quoted strings
    int capacity = 32;
    char **argv = (char **)malloc(capacity * sizeof(char *));
    int argc = 0;

    const char *p = command;
    while (*p) {
        // Skip whitespace
        while (*p == ' ' || *p == '\t') p++;
        if (!*p) break;

        // Start of token
        char token[4096];
        int ti = 0;
        char quote = 0;

        if (*p == '\'' || *p == '"') {
            quote = *p++;
        }

        while (*p) {
            if (quote) {
                if (*p == quote) { p++; break; }
            } else {
                if (*p == ' ' || *p == '\t') break;
                // Handle embedded quotes
                if (*p == '\'' || *p == '"') {
                    quote = *p++;
                    continue;
                }
            }
            if (ti < (int)sizeof(token) - 1) {
                token[ti++] = *p;
            }
            p++;
        }
        token[ti] = '\0';

        if (argc >= capacity) {
            capacity *= 2;
            argv = (char **)realloc(argv, capacity * sizeof(char *));
        }
        argv[argc] = strdup(token);
        argc++;
    }

    *out_argc = argc;
    return argv;
}

static void free_argv(int argc, char **argv) {
    for (int i = 0; i < argc; i++) {
        free(argv[i]);
    }
    free(argv);
}

static ParsedCommand parse_command(const char *command) {
    ParsedCommand cmd;
    memset(&cmd, 0, sizeof(cmd));
    cmd.crf = -1;
    cmd.threads = -1;

    int argc;
    char **argv = tokenize_command(command, &argc);
    cmd.argc = argc;
    cmd.argv = argv;

    int input_count = 0;
    for (int i = 0; i < argc; i++) {
        if (strcmp(argv[i], "-i") == 0 && i + 1 < argc) {
            if (input_count == 0) {
                cmd.input_path = argv[i + 1];
            } else if (input_count == 1) {
                cmd.overlay_path = argv[i + 1];
            }
            input_count++;
            i++;
        } else if (strcmp(argv[i], "-y") == 0) {
            // overwrite flag — ignore, we always overwrite
        } else if ((strcmp(argv[i], "-c:v") == 0 || strcmp(argv[i], "-vcodec") == 0) && i + 1 < argc) {
            cmd.vcodec = argv[++i];
        } else if ((strcmp(argv[i], "-c:a") == 0 || strcmp(argv[i], "-acodec") == 0) && i + 1 < argc) {
            cmd.acodec = argv[++i];
        } else if (strcmp(argv[i], "-filter_complex") == 0 && i + 1 < argc) {
            cmd.filter_complex = argv[++i];
        } else if (strcmp(argv[i], "-vf") == 0 && i + 1 < argc) {
            cmd.vf = argv[++i];
        } else if (strcmp(argv[i], "-b:v") == 0 && i + 1 < argc) {
            cmd.video_bitrate = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-b:a") == 0 && i + 1 < argc) {
            cmd.audio_bitrate = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-crf") == 0 && i + 1 < argc) {
            cmd.crf = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-threads") == 0 && i + 1 < argc) {
            cmd.threads = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-an") == 0) {
            cmd.has_an = 1;
        } else if (strcmp(argv[i], "-movflags") == 0 && i + 1 < argc) {
            if (strstr(argv[i + 1], "faststart")) {
                cmd.movflags_faststart = 1;
            }
            i++;
        } else if (strcmp(argv[i], "-preset") == 0 && i + 1 < argc) {
            cmd.preset = argv[++i];
        } else if (strcmp(argv[i], "-profile:v") == 0 && i + 1 < argc) {
            cmd.profile = argv[++i];
        } else if (strcmp(argv[i], "-s") == 0 && i + 1 < argc) {
            sscanf(argv[++i], "%dx%d", &cmd.width, &cmd.height);
        } else if (strcmp(argv[i], "-ss") == 0 && i + 1 < argc) {
            cmd.seek_seconds = atof(argv[++i]);
        } else if (strcmp(argv[i], "-vframes") == 0 && i + 1 < argc) {
            cmd.max_frames = atoi(argv[++i]);
        } else if (strcmp(argv[i], "-f") == 0 && i + 1 < argc) {
            cmd.format = argv[++i];
        } else if (argv[i][0] != '-' && i == argc - 1) {
            // Last non-flag argument is the output
            cmd.output_path = argv[i];
        }
    }

    return cmd;
}

// ─── Filter graph path escaping ─────────────────────────────────────────────

/**
 * Escape a file path for use inside an FFmpeg filter graph string.
 * Characters ; [ ] ' : \ need to be backslash-escaped.
 * Returns a malloc'd string the caller must free.
 */
static char *escape_filter_path(const char *path) {
    // Worst case: every char needs escaping -> 2x + 1
    size_t len = strlen(path);
    char *escaped = (char *)malloc(len * 2 + 1);
    if (!escaped) return NULL;

    size_t j = 0;
    for (size_t i = 0; i < len; i++) {
        char c = path[i];
        if (c == '\\' || c == '\'' || c == ':' || c == ';' || c == '[' || c == ']') {
            escaped[j++] = '\\';
        }
        escaped[j++] = c;
    }
    escaped[j] = '\0';
    return escaped;
}

// ─── Transcoding engine ──────────────────────────────────────────────────────

typedef struct {
    AVFormatContext *ifmt_ctx;
    AVFormatContext *overlay_fmt_ctx;
    AVFormatContext *ofmt_ctx;
    AVCodecContext *dec_ctx;
    AVCodecContext *enc_ctx;
    AVFilterGraph *filter_graph;
    AVFilterContext *buffersrc_ctx;
    AVFilterContext *buffersink_ctx;
    AVFilterContext *overlay_src_ctx;  // second buffer source for overlay
    AVFrame *overlay_frame;           // decoded overlay image (single frame, reused)
    int video_stream_idx;
    int audio_stream_idx;
    int64_t total_duration_us; // for progress calculation
    int output_fd;             // pre-opened output fd, or -1
} TranscodeContext;

// ─── Custom AVIO callbacks for fd-based output ─────────────────────────────

static int64_t g_fd_bytes_written = 0;

static int ffmpeg_fd_write(void *opaque, const uint8_t *buf, int buf_size) {
    int fd = (int)(intptr_t)opaque;
    ssize_t total = 0;
    while (total < buf_size) {
        ssize_t n = write(fd, buf + total, buf_size - total);
        if (n < 0) {
            if (errno == EINTR) continue;
            return (int)n;
        }
        total += n;
    }
    g_fd_bytes_written += total;
    return (int)total;
}

static int64_t ffmpeg_fd_seek(void *opaque, int64_t offset, int whence) {
    int fd = (int)(intptr_t)opaque;
    if (whence == AVSEEK_SIZE) {
        // Return file size via fstat
        struct stat st;
        if (fstat(fd, &st) == 0) return st.st_size;
        return -1;
    }
    off_t result = lseek(fd, offset, whence);
    return result;
}

static int open_input(TranscodeContext *tc, const char *path) {
    int ret = avformat_open_input(&tc->ifmt_ctx, path, NULL, NULL);
    if (ret < 0) return ret;

    ret = avformat_find_stream_info(tc->ifmt_ctx, NULL);
    if (ret < 0) return ret;

    tc->video_stream_idx = -1;
    tc->audio_stream_idx = -1;
    for (unsigned i = 0; i < tc->ifmt_ctx->nb_streams; i++) {
        if (tc->ifmt_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO && tc->video_stream_idx < 0) {
            tc->video_stream_idx = i;
        } else if (tc->ifmt_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_AUDIO && tc->audio_stream_idx < 0) {
            tc->audio_stream_idx = i;
        }
    }

    if (tc->video_stream_idx < 0) return AVERROR(EINVAL);

    tc->total_duration_us = tc->ifmt_ctx->duration;

    return 0;
}

static int open_decoder(TranscodeContext *tc, const ParsedCommand *cmd) {
    AVStream *stream = tc->ifmt_ctx->streams[tc->video_stream_idx];
    const AVCodec *codec = avcodec_find_decoder(stream->codecpar->codec_id);
    if (!codec) return AVERROR_DECODER_NOT_FOUND;

    // Note: VideoToolbox hwaccel decoding is NOT used here because it outputs
    // frames in GPU memory (AV_PIX_FMT_VIDEOTOOLBOX) requiring an expensive
    // av_hwframe_transfer_data copy back to CPU for the filter graph.
    // Unlike Android's MediaCodec (which outputs NV12 in CPU memory directly),
    // this transfer negates any decode speedup.  Software decoding on Apple
    // Silicon is fast enough that the GPU encode step is where the real win is.
    (void)cmd; // unused — kept in signature for future use

    tc->dec_ctx = avcodec_alloc_context3(codec);
    if (!tc->dec_ctx) return AVERROR(ENOMEM);

    int ret = avcodec_parameters_to_context(tc->dec_ctx, stream->codecpar);
    if (ret < 0) return ret;

    tc->dec_ctx->pkt_timebase = stream->time_base;

    ret = avcodec_open2(tc->dec_ctx, codec, NULL);
    return ret;
}

static int open_encoder(TranscodeContext *tc, const ParsedCommand *cmd) {
    // Try hardware encoder first, then software fallback
    const char *encoder_name = cmd->vcodec;
    const AVCodec *codec = NULL;

    if (encoder_name) {
        codec = avcodec_find_encoder_by_name(encoder_name);
    }

    // Auto-detect encoder for image output formats (image2 muxer)
    if (!codec && cmd->format && strcmp(cmd->format, "image2") == 0 && cmd->output_path) {
        const char *ext = strrchr(cmd->output_path, '.');
        if (ext) {
            if (strcasecmp(ext, ".jpg") == 0 || strcasecmp(ext, ".jpeg") == 0) {
                codec = avcodec_find_encoder_by_name("mjpeg");
                av_log(NULL, AV_LOG_ERROR, "[FFW] image2 output: auto-selected mjpeg encoder\n");
            } else if (strcasecmp(ext, ".png") == 0) {
                codec = avcodec_find_encoder_by_name("png");
                av_log(NULL, AV_LOG_ERROR, "[FFW] image2 output: auto-selected png encoder\n");
            }
        }
    }

    // If no encoder specified or not found, try VideoToolbox then libx264
    if (!codec) {
        codec = avcodec_find_encoder_by_name("h264_videotoolbox");
    }
    if (!codec) {
        codec = avcodec_find_encoder_by_name("libx264");
    }
    if (!codec) {
        return AVERROR_ENCODER_NOT_FOUND;
    }

    tc->enc_ctx = avcodec_alloc_context3(codec);
    if (!tc->enc_ctx) return AVERROR(ENOMEM);

    // Get dimensions from filter output or decoder
    int width, height;
    if (tc->buffersink_ctx) {
        width = av_buffersink_get_w(tc->buffersink_ctx);
        height = av_buffersink_get_h(tc->buffersink_ctx);
        tc->enc_ctx->pix_fmt = av_buffersink_get_format(tc->buffersink_ctx);
    } else {
        width = tc->dec_ctx->width;
        height = tc->dec_ctx->height;
        tc->enc_ctx->pix_fmt = tc->dec_ctx->pix_fmt;
    }

    if (cmd->width > 0 && cmd->height > 0) {
        width = cmd->width;
        height = cmd->height;
    }

    tc->enc_ctx->width = width;
    tc->enc_ctx->height = height;
    tc->enc_ctx->time_base = (AVRational){1, 30};
    tc->enc_ctx->framerate = (AVRational){30, 1};

    // Copy framerate from input if available
    AVStream *in_stream = tc->ifmt_ctx->streams[tc->video_stream_idx];
    if (in_stream->avg_frame_rate.num > 0) {
        tc->enc_ctx->framerate = in_stream->avg_frame_rate;
        tc->enc_ctx->time_base = av_inv_q(in_stream->avg_frame_rate);
    } else if (in_stream->r_frame_rate.num > 0) {
        tc->enc_ctx->framerate = in_stream->r_frame_rate;
        tc->enc_ctx->time_base = av_inv_q(in_stream->r_frame_rate);
    }

    // Bitrate / CRF
    if (cmd->video_bitrate > 0) {
        tc->enc_ctx->bit_rate = cmd->video_bitrate;
    }

    // VideoToolbox doesn't support CRF — use bitrate or quality instead
    if (strcmp(codec->name, "h264_videotoolbox") == 0) {
        // Ensure pixel format is compatible with VideoToolbox
        tc->enc_ctx->pix_fmt = AV_PIX_FMT_NV12;
        if (cmd->video_bitrate <= 0 && cmd->crf < 0) {
            // Default to reasonable bitrate for VideoToolbox
            tc->enc_ctx->bit_rate = 4000000; // 4 Mbps
        }
        if (cmd->profile) {
            av_opt_set(tc->enc_ctx->priv_data, "profile", cmd->profile, 0);
        }
    } else if (strcmp(codec->name, "libx264") == 0) {
        // Ensure pixel format is compatible with libx264
        tc->enc_ctx->pix_fmt = AV_PIX_FMT_YUV420P;
        if (cmd->crf >= 0) {
            char crf_str[16];
            snprintf(crf_str, sizeof(crf_str), "%d", cmd->crf);
            av_opt_set(tc->enc_ctx->priv_data, "crf", crf_str, 0);
        } else if (cmd->video_bitrate <= 0) {
            av_opt_set(tc->enc_ctx->priv_data, "crf", "23", 0);
        }
        if (cmd->preset) {
            av_opt_set(tc->enc_ctx->priv_data, "preset", cmd->preset, 0);
        } else {
            av_opt_set(tc->enc_ctx->priv_data, "preset", "medium", 0);
        }
        if (cmd->profile) {
            av_opt_set(tc->enc_ctx->priv_data, "profile", cmd->profile, 0);
        }
    } else if (strcmp(codec->name, "mjpeg") == 0) {
        tc->enc_ctx->pix_fmt = AV_PIX_FMT_YUVJ420P;
    } else if (strcmp(codec->name, "png") == 0) {
        tc->enc_ctx->pix_fmt = AV_PIX_FMT_RGBA;
    }

    if (cmd->threads > 0) {
        tc->enc_ctx->thread_count = cmd->threads;
    }

    // Global header flag for mp4
    if (tc->ofmt_ctx && tc->ofmt_ctx->oformat->flags & AVFMT_GLOBALHEADER) {
        tc->enc_ctx->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
    }

    int open_ret = avcodec_open2(tc->enc_ctx, codec, NULL);
    if (open_ret == 0) {
        av_log(NULL, AV_LOG_ERROR, "[FFW] Encoder opened: %s, pix_fmt=%s, %dx%d, bitrate=%lld\n",
               codec->name, av_get_pix_fmt_name(tc->enc_ctx->pix_fmt),
               tc->enc_ctx->width, tc->enc_ctx->height, (long long)tc->enc_ctx->bit_rate);
    }
    return open_ret;
}

static int init_filter_graph(TranscodeContext *tc, const char *filter_descr, const char *overlay_path) {
    int ret;
    char args[512];

    tc->filter_graph = avfilter_graph_alloc();
    if (!tc->filter_graph) return AVERROR(ENOMEM);

    const AVFilter *buffersrc = avfilter_get_by_name("buffer");
    const AVFilter *buffersink = avfilter_get_by_name("buffersink");
    if (!buffersrc || !buffersink) return AVERROR_FILTER_NOT_FOUND;

    // Buffer source for main video input
    snprintf(args, sizeof(args),
             "video_size=%dx%d:pix_fmt=%d:time_base=%d/%d:pixel_aspect=%d/%d",
             tc->dec_ctx->width, tc->dec_ctx->height, tc->dec_ctx->pix_fmt,
             tc->dec_ctx->pkt_timebase.num, tc->dec_ctx->pkt_timebase.den,
             tc->dec_ctx->sample_aspect_ratio.num,
             tc->dec_ctx->sample_aspect_ratio.den > 0 ? tc->dec_ctx->sample_aspect_ratio.den : 1);

    ret = avfilter_graph_create_filter(&tc->buffersrc_ctx, buffersrc, "in0", args, NULL, tc->filter_graph);
    if (ret < 0) return ret;

    ret = avfilter_graph_create_filter(&tc->buffersink_ctx, buffersink, "out", NULL, NULL, tc->filter_graph);
    if (ret < 0) return ret;

    if (filter_descr && !overlay_path) {
        // Simple video filter (-vf): single input "in" -> filter -> "out"
        AVFilterInOut *inputs = avfilter_inout_alloc();
        AVFilterInOut *outputs = avfilter_inout_alloc();

        outputs->name = av_strdup("in");
        outputs->filter_ctx = tc->buffersrc_ctx;
        outputs->pad_idx = 0;
        outputs->next = NULL;

        inputs->name = av_strdup("out");
        inputs->filter_ctx = tc->buffersink_ctx;
        inputs->pad_idx = 0;
        inputs->next = NULL;

        ret = avfilter_graph_parse_ptr(tc->filter_graph, filter_descr, &inputs, &outputs, NULL);
        avfilter_inout_free(&inputs);
        avfilter_inout_free(&outputs);
        if (ret < 0) return ret;
    } else if (overlay_path) {
        // Multi-input filter_complex with two buffer sources:
        //   [0:v] = main video (tc->buffersrc_ctx)
        //   [1:v] = overlay image (tc->overlay_src_ctx)
        // Open the overlay image, decode one frame, create a second buffer source.

        AVFormatContext *overlay_fmt = NULL;
        ret = avformat_open_input(&overlay_fmt, overlay_path, NULL, NULL);
        if (ret < 0) {
            av_log(NULL, AV_LOG_ERROR, "[FFW] Cannot open overlay '%s': %s\n", overlay_path, av_err2str(ret));
            return ret;
        }
        ret = avformat_find_stream_info(overlay_fmt, NULL);
        if (ret < 0) { avformat_close_input(&overlay_fmt); return ret; }

        int overlay_vidx = -1;
        for (unsigned i = 0; i < overlay_fmt->nb_streams; i++) {
            if (overlay_fmt->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
                overlay_vidx = i; break;
            }
        }
        if (overlay_vidx < 0) { avformat_close_input(&overlay_fmt); return AVERROR(EINVAL); }

        // Decode the overlay image (single frame)
        AVCodecParameters *opar = overlay_fmt->streams[overlay_vidx]->codecpar;
        const AVCodec *odec = avcodec_find_decoder(opar->codec_id);
        if (!odec) { avformat_close_input(&overlay_fmt); return AVERROR_DECODER_NOT_FOUND; }
        AVCodecContext *odec_ctx = avcodec_alloc_context3(odec);
        avcodec_parameters_to_context(odec_ctx, opar);
        ret = avcodec_open2(odec_ctx, odec, NULL);
        if (ret < 0) { avcodec_free_context(&odec_ctx); avformat_close_input(&overlay_fmt); return ret; }

        AVPacket *opkt = av_packet_alloc();
        AVFrame *oframe = av_frame_alloc();
        int decoded = 0;
        while (!decoded) {
            ret = av_read_frame(overlay_fmt, opkt);
            if (ret < 0) break;
            if (opkt->stream_index == overlay_vidx) {
                avcodec_send_packet(odec_ctx, opkt);
                ret = avcodec_receive_frame(odec_ctx, oframe);
                if (ret == 0) decoded = 1;
            }
            av_packet_unref(opkt);
        }
        av_packet_free(&opkt);

        if (!decoded) {
            av_frame_free(&oframe);
            avcodec_free_context(&odec_ctx);
            avformat_close_input(&overlay_fmt);
            av_log(NULL, AV_LOG_ERROR, "[FFW] Failed to decode overlay image\n");
            return AVERROR(EINVAL);
        }

        // Store the decoded overlay frame for reuse in the transcode loop
        tc->overlay_frame = oframe;
        tc->overlay_fmt_ctx = overlay_fmt;

        // Create second buffer source for overlay [1:v]
        AVRational overlay_tb = overlay_fmt->streams[overlay_vidx]->time_base;
        char overlay_args[512];
        snprintf(overlay_args, sizeof(overlay_args),
                 "video_size=%dx%d:pix_fmt=%d:time_base=%d/%d:pixel_aspect=%d/%d",
                 odec_ctx->width, odec_ctx->height, odec_ctx->pix_fmt,
                 overlay_tb.num, overlay_tb.den,
                 odec_ctx->sample_aspect_ratio.num,
                 odec_ctx->sample_aspect_ratio.den > 0 ? odec_ctx->sample_aspect_ratio.den : 1);

        avcodec_free_context(&odec_ctx);

        ret = avfilter_graph_create_filter(&tc->overlay_src_ctx, buffersrc, "in1",
                                           overlay_args, NULL, tc->filter_graph);
        if (ret < 0) return ret;

        // Build outputs linked list: [0:v] -> main buffersrc, [1:v] -> overlay buffersrc
        AVFilterInOut *out0 = avfilter_inout_alloc();
        out0->name = av_strdup("0:v");
        out0->filter_ctx = tc->buffersrc_ctx;
        out0->pad_idx = 0;

        AVFilterInOut *out1 = avfilter_inout_alloc();
        out1->name = av_strdup("1:v");
        out1->filter_ctx = tc->overlay_src_ctx;
        out1->pad_idx = 0;
        out1->next = NULL;
        out0->next = out1;

        AVFilterInOut *inputs = avfilter_inout_alloc();
        inputs->name = av_strdup("out");
        inputs->filter_ctx = tc->buffersink_ctx;
        inputs->pad_idx = 0;
        inputs->next = NULL;

        av_log(NULL, AV_LOG_ERROR, "[FFW] overlay filter_complex: %s\n", filter_descr ? filter_descr : "(default overlay)");

        const char *fdesc = filter_descr ? filter_descr : "[0:v][1:v]overlay=0:0";
        ret = avfilter_graph_parse_ptr(tc->filter_graph, fdesc, &inputs, &out0, NULL);
        avfilter_inout_free(&inputs);
        avfilter_inout_free(&out0);
        if (ret < 0) {
            av_log(NULL, AV_LOG_ERROR, "[FFW] filter parse failed: %s\n", av_err2str(ret));
            return ret;
        }
    }

    ret = avfilter_graph_config(tc->filter_graph, NULL);
    return ret;
}

static int open_output(TranscodeContext *tc, const char *path, const ParsedCommand *cmd) {
    int ret = avformat_alloc_output_context2(&tc->ofmt_ctx, NULL, cmd->format, path);
    if (ret < 0) {
        av_log(NULL, AV_LOG_ERROR, "[FFW] open_output: alloc_output_context2 failed ret=%d\n", ret);
        return ret;
    }
    av_log(NULL, AV_LOG_ERROR, "[FFW] open_output: format=%s\n", tc->ofmt_ctx->oformat->name);

    // Add video stream
    AVStream *out_stream = avformat_new_stream(tc->ofmt_ctx, NULL);
    if (!out_stream) return AVERROR(ENOMEM);

    // We'll copy encoder params after encoder is opened
    // For now, set the stream time_base
    out_stream->time_base = (AVRational){1, 90000};

    // Add audio stream if present and not disabled
    if (tc->audio_stream_idx >= 0 && !cmd->has_an) {
        // Check if audio codec is "copy" — only add audio stream for stream copy
        AVStream *audio_out = avformat_new_stream(tc->ofmt_ctx, NULL);
        if (!audio_out) return AVERROR(ENOMEM);
        ret = avcodec_parameters_copy(audio_out->codecpar, tc->ifmt_ctx->streams[tc->audio_stream_idx]->codecpar);
        if (ret < 0) return ret;
        audio_out->time_base = tc->ifmt_ctx->streams[tc->audio_stream_idx]->time_base;
    }

    if (cmd->movflags_faststart) {
        av_opt_set(tc->ofmt_ctx->priv_data, "movflags", "faststart", 0);
    }

    if (!(tc->ofmt_ctx->oformat->flags & AVFMT_NOFILE)) {
        // Try avio_open first (works when Foundation pre-created the file)
        ret = avio_open(&tc->ofmt_ctx->pb, path, AVIO_FLAG_WRITE);
        if (ret < 0) {
            av_log(NULL, AV_LOG_ERROR, "[FFW] avio_open failed (ret=%d), trying fd=%d\n", ret, tc->output_fd);
            if (tc->output_fd >= 0) {
                // Fallback: use pre-opened file descriptor
                int buf_size = 32 * 1024;
                uint8_t *io_buf = av_malloc(buf_size);
                if (!io_buf) return AVERROR(ENOMEM);

                tc->ofmt_ctx->pb = avio_alloc_context(
                    io_buf, buf_size,
                    1,                          // write_flag = 1
                    (void *)(intptr_t)tc->output_fd,  // opaque = fd
                    NULL,                       // read_packet
                    ffmpeg_fd_write,            // write_packet
                    ffmpeg_fd_seek              // seek
                );
                if (!tc->ofmt_ctx->pb) {
                    av_free(io_buf);
                    return AVERROR(ENOMEM);
                }
                av_log(NULL, AV_LOG_ERROR, "[FFW] using fd-based AVIOContext fd=%d\n", tc->output_fd);
                ret = 0;
            } else {
                return ret;
            }
        } else {
            // avio_open succeeded — close the pre-opened fd since we don't need it
            if (tc->output_fd >= 0) {
                close(tc->output_fd);
                tc->output_fd = -1;
            }
            av_log(NULL, AV_LOG_ERROR, "[FFW] avio_open succeeded for %s\n", path);
        }
    }

    return 0;
}

static void cleanup_transcode(TranscodeContext *tc) {
    if (tc->dec_ctx) avcodec_free_context(&tc->dec_ctx);
    if (tc->enc_ctx) avcodec_free_context(&tc->enc_ctx);
    if (tc->filter_graph) avfilter_graph_free(&tc->filter_graph);
    if (tc->overlay_frame) av_frame_free(&tc->overlay_frame);
    if (tc->ifmt_ctx) avformat_close_input(&tc->ifmt_ctx);
    if (tc->overlay_fmt_ctx) avformat_close_input(&tc->overlay_fmt_ctx);
    if (tc->ofmt_ctx) {
        if (tc->ofmt_ctx->pb && !(tc->ofmt_ctx->oformat->flags & AVFMT_NOFILE)) {
            if (tc->output_fd >= 0) {
                // Custom AVIOContext backed by fd — flush, free buffer, close fd
                avio_flush(tc->ofmt_ctx->pb);
                av_free(tc->ofmt_ctx->pb->buffer);
                avio_context_free(&tc->ofmt_ctx->pb);
                fsync(tc->output_fd);
                close(tc->output_fd);
                tc->output_fd = -1;
            } else {
                avio_closep(&tc->ofmt_ctx->pb);
            }
        }
        avformat_free_context(tc->ofmt_ctx);
        tc->ofmt_ctx = NULL;
    }
}

// ─── Main execute function ───────────────────────────────────────────────────

int ffmpeg_execute(const char *command,
                   ffmpeg_progress_callback progress_cb,
                   char *output_log,
                   int output_log_size,
                   int output_fd) {
    int ret = 0;

    // Reset abort flag
    atomic_store(&g_abort_flag, 0);

    // Set up log capture
    pthread_mutex_lock(&g_log_mutex);
    g_log_buffer = output_log;
    g_log_buffer_size = output_log_size;
    g_log_buffer_pos = 0;
    if (output_log && output_log_size > 0) {
        output_log[0] = '\0';
    }
    pthread_mutex_unlock(&g_log_mutex);

    av_log_set_callback(log_callback);

    ParsedCommand cmd = parse_command(command);

    g_fd_bytes_written = 0;

    if (!cmd.input_path || !cmd.output_path) {
        av_log(NULL, AV_LOG_ERROR, "Missing input or output path\n");
        free_argv(cmd.argc, cmd.argv);
        av_log_set_callback(av_log_default_callback);
        return AVERROR(EINVAL);
    }

    TranscodeContext tc;
    memset(&tc, 0, sizeof(tc));
    tc.video_stream_idx = -1;
    tc.audio_stream_idx = -1;
    tc.output_fd = output_fd;

    // Pixel format conversion context (filter path)
    struct SwsContext *sws_filt_ctx = NULL;
    AVFrame *conv_frame = NULL;

    // 1. Open input
    ret = open_input(&tc, cmd.input_path);
    if (ret < 0) {
        av_log(NULL, AV_LOG_ERROR, "[FFW] open_input failed: %s\n", av_err2str(ret));
        goto cleanup;
    }

    // 2. Open decoder (tries VideoToolbox hw decoding when GPU encode is requested)
    ret = open_decoder(&tc, &cmd);
    if (ret < 0) {
        av_log(NULL, AV_LOG_ERROR, "[FFW] open_decoder failed: %s\n", av_err2str(ret));
        goto cleanup;
    }

    // 2b. Seek if -ss was specified
    if (cmd.seek_seconds > 0) {
        int64_t seek_ts = (int64_t)(cmd.seek_seconds * AV_TIME_BASE);
        ret = av_seek_frame(tc.ifmt_ctx, -1, seek_ts, AVSEEK_FLAG_BACKWARD);
        if (ret < 0) {
            av_log(NULL, AV_LOG_ERROR, "[FFW] seek to %.1fs failed, continuing\n", cmd.seek_seconds);
        } else {
            avcodec_flush_buffers(tc.dec_ctx);
        }
        ret = 0;
    }

    // 3. Open output container
    ret = open_output(&tc, cmd.output_path, &cmd);
    if (ret < 0) {
        av_log(NULL, AV_LOG_ERROR, "[FFW] open_output failed: %s\n", av_err2str(ret));
        goto cleanup;
    }

    // 4. Set up filter graph if needed
    const char *filter = cmd.filter_complex ? cmd.filter_complex : cmd.vf;
    if (filter || cmd.overlay_path) {
        ret = init_filter_graph(&tc, filter, cmd.overlay_path);
        if (ret < 0) {
            av_log(NULL, AV_LOG_ERROR, "[FFW] init_filter_graph failed: %s\n", av_err2str(ret));
            goto cleanup;
        }
    }

    // 5. Open encoder
    ret = open_encoder(&tc, &cmd);
    if (ret < 0) {
        av_log(NULL, AV_LOG_ERROR, "[FFW] open_encoder failed: %s\n", av_err2str(ret));
        goto cleanup;
    }

    // 5b. Setup pixel format conversion if filter output differs from encoder input
    if (tc.buffersink_ctx) {
        enum AVPixelFormat filt_pix_fmt = av_buffersink_get_format(tc.buffersink_ctx);
        if (filt_pix_fmt != tc.enc_ctx->pix_fmt) {
            sws_filt_ctx = sws_getContext(
                tc.enc_ctx->width, tc.enc_ctx->height, filt_pix_fmt,
                tc.enc_ctx->width, tc.enc_ctx->height, tc.enc_ctx->pix_fmt,
                SWS_BILINEAR, NULL, NULL, NULL);
            if (!sws_filt_ctx) {
                ret = AVERROR(ENOMEM);
                goto cleanup;
            }
            conv_frame = av_frame_alloc();
            if (!conv_frame) { ret = AVERROR(ENOMEM); goto cleanup; }
            conv_frame->format = tc.enc_ctx->pix_fmt;
            conv_frame->width = tc.enc_ctx->width;
            conv_frame->height = tc.enc_ctx->height;
            ret = av_frame_get_buffer(conv_frame, 0);
            if (ret < 0) goto cleanup;
        }
    }

    // Copy encoder params to output stream
    ret = avcodec_parameters_from_context(tc.ofmt_ctx->streams[0]->codecpar, tc.enc_ctx);
    if (ret < 0) goto cleanup;
    tc.ofmt_ctx->streams[0]->time_base = tc.enc_ctx->time_base;

    // Write header
    ret = avformat_write_header(tc.ofmt_ctx, NULL);
    if (ret < 0) {
        av_log(NULL, AV_LOG_ERROR, "[FFW] write_header failed: %s\n", av_err2str(ret));
        goto cleanup;
    }

    // 6. Decode -> Filter -> Encode -> Mux loop
    AVPacket *pkt = av_packet_alloc();
    AVFrame *frame = av_frame_alloc();
    AVFrame *filt_frame = av_frame_alloc();
    AVPacket *enc_pkt = av_packet_alloc();

    if (!pkt || !frame || !filt_frame || !enc_pkt) {
        ret = AVERROR(ENOMEM);
        goto loop_cleanup;
    }

    int64_t frame_count = 0;
    int64_t last_progress_time = 0;

    while (1) {
        if (check_abort()) {
            ret = AVERROR_EXIT;
            break;
        }

        ret = av_read_frame(tc.ifmt_ctx, pkt);
        if (ret < 0) {
            if (ret == AVERROR_EOF) {
                // Flush decoder
                avcodec_send_packet(tc.dec_ctx, NULL);
            } else {
                break;
            }
        }

        if (ret != AVERROR_EOF && pkt->stream_index == tc.video_stream_idx) {
            ret = avcodec_send_packet(tc.dec_ctx, pkt);
            av_packet_unref(pkt);
            if (ret < 0 && ret != AVERROR(EAGAIN)) break;
        } else if (ret != AVERROR_EOF && pkt->stream_index == tc.audio_stream_idx && !cmd.has_an) {
            // Copy audio packets directly (stream copy)
            AVStream *in_st = tc.ifmt_ctx->streams[tc.audio_stream_idx];
            // Audio is output stream index 1
            if (tc.ofmt_ctx->nb_streams > 1) {
                AVStream *out_st = tc.ofmt_ctx->streams[1];
                pkt->stream_index = 1;
                av_packet_rescale_ts(pkt, in_st->time_base, out_st->time_base);
                pkt->pos = -1;
                av_interleaved_write_frame(tc.ofmt_ctx, pkt);
            }
            av_packet_unref(pkt);
            continue;
        } else if (ret != AVERROR_EOF) {
            av_packet_unref(pkt);
            continue;
        }

        // Read decoded frames
        while (1) {
            if (check_abort()) { ret = AVERROR_EXIT; break; }

            ret = avcodec_receive_frame(tc.dec_ctx, frame);
            if (ret == AVERROR(EAGAIN)) { ret = 0; break; }
            if (ret == AVERROR_EOF) {
                // Flush filter
                if (tc.buffersrc_ctx) {
                    if (tc.overlay_src_ctx) {
                        av_buffersrc_add_frame(tc.overlay_src_ctx, NULL);
                    }
                    av_buffersrc_add_frame(tc.buffersrc_ctx, NULL);
                }
                // Flush encoder
                avcodec_send_frame(tc.enc_ctx, NULL);
                goto flush_encoder;
            }
            if (ret < 0) break;

            AVFrame *encode_frame = frame;
            int64_t decoded_pts = frame->pts; // Save before av_frame_unref clears it

            // Apply filter if present
            if (tc.buffersrc_ctx) {
                // For overlay: push the overlay frame into the second buffer source
                // with the same PTS as the main video frame
                if (tc.overlay_src_ctx && tc.overlay_frame) {
                    tc.overlay_frame->pts = frame->pts;
                    av_buffersrc_add_frame_flags(tc.overlay_src_ctx, tc.overlay_frame, AV_BUFFERSRC_FLAG_KEEP_REF);
                }

                ret = av_buffersrc_add_frame_flags(tc.buffersrc_ctx, frame, AV_BUFFERSRC_FLAG_KEEP_REF);
                if (ret < 0) { av_frame_unref(frame); break; }

                while (1) {
                    ret = av_buffersink_get_frame(tc.buffersink_ctx, filt_frame);
                    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) { ret = 0; break; }
                    if (ret < 0) break;

                    encode_frame = filt_frame;

                    // Convert pixel format if filter output differs from encoder
                    if (sws_filt_ctx && conv_frame) {
                        sws_scale(sws_filt_ctx,
                                  (const uint8_t *const *)filt_frame->data, filt_frame->linesize,
                                  0, filt_frame->height,
                                  conv_frame->data, conv_frame->linesize);
                        conv_frame->pts = filt_frame->pts;
                        conv_frame->pict_type = AV_PICTURE_TYPE_NONE;
                        encode_frame = conv_frame;
                    }

                    // Encode
                    ret = avcodec_send_frame(tc.enc_ctx, encode_frame);
                    if (ret < 0 && ret != AVERROR(EAGAIN)) {
                        av_frame_unref(filt_frame);
                        break;
                    }

                    while (1) {
                        ret = avcodec_receive_packet(tc.enc_ctx, enc_pkt);
                        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) { ret = 0; break; }
                        if (ret < 0) break;

                        enc_pkt->stream_index = 0;
                        av_packet_rescale_ts(enc_pkt, tc.enc_ctx->time_base, tc.ofmt_ctx->streams[0]->time_base);
                        ret = av_interleaved_write_frame(tc.ofmt_ctx, enc_pkt);
                        if (ret < 0) break;

                        frame_count++;
                    }
                    av_frame_unref(filt_frame);
                    if (ret < 0) break;
                }
                av_frame_unref(frame);
                if (ret < 0) break;
            } else {
                // No filter — encode directly
                // Convert pixel format if needed via swscale
                if (frame->format != tc.enc_ctx->pix_fmt) {
                    // Need pixel format conversion
                    struct SwsContext *sws = sws_getContext(
                        frame->width, frame->height, frame->format,
                        tc.enc_ctx->width, tc.enc_ctx->height, tc.enc_ctx->pix_fmt,
                        SWS_BILINEAR, NULL, NULL, NULL);
                    if (sws) {
                        av_frame_unref(filt_frame);
                        filt_frame->format = tc.enc_ctx->pix_fmt;
                        filt_frame->width = tc.enc_ctx->width;
                        filt_frame->height = tc.enc_ctx->height;
                        av_frame_get_buffer(filt_frame, 0);
                        sws_scale(sws, (const uint8_t *const *)frame->data, frame->linesize, 0,
                                  frame->height, filt_frame->data, filt_frame->linesize);
                        filt_frame->pts = frame->pts;
                        filt_frame->duration = frame->duration;
                        encode_frame = filt_frame;
                        sws_freeContext(sws);
                    }
                }

                ret = avcodec_send_frame(tc.enc_ctx, encode_frame);
                if (encode_frame == filt_frame) av_frame_unref(filt_frame);
                av_frame_unref(frame);
                if (ret < 0 && ret != AVERROR(EAGAIN)) break;

                while (1) {
                    ret = avcodec_receive_packet(tc.enc_ctx, enc_pkt);
                    if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) { ret = 0; break; }
                    if (ret < 0) break;

                    enc_pkt->stream_index = 0;
                    av_packet_rescale_ts(enc_pkt, tc.enc_ctx->time_base, tc.ofmt_ctx->streams[0]->time_base);
                    ret = av_interleaved_write_frame(tc.ofmt_ctx, enc_pkt);
                    if (ret < 0) break;

                    frame_count++;
                }
                if (ret < 0) break;
            }

            // Stop after -vframes limit
            if (cmd.max_frames > 0 && frame_count >= cmd.max_frames) {
                av_log(NULL, AV_LOG_INFO, "Reached frame limit (%d frames)\n", cmd.max_frames);
                // Flush encoder
                avcodec_send_frame(tc.enc_ctx, NULL);
                goto flush_encoder;
            }

            // Progress callback (uses decoded_pts saved before av_frame_unref)
            if (progress_cb && tc.total_duration_us > 0 && decoded_pts != AV_NOPTS_VALUE) {
                AVStream *in_stream = tc.ifmt_ctx->streams[tc.video_stream_idx];
                int64_t time_us = av_rescale_q(decoded_pts, in_stream->time_base, AV_TIME_BASE_Q);
                if (time_us - last_progress_time > 100000 || time_us < last_progress_time) { // every 100ms
                    double speed = 0.0;
                    // Pass percentage (0-100) via total_size parameter
                    int64_t percentage = (time_us * 100) / tc.total_duration_us;
                    if (percentage > 100) percentage = 100;
                    if (percentage < 0) percentage = 0;
                    progress_cb(frame_count, 0.0, percentage, time_us, speed);
                    last_progress_time = time_us;
                }
            }
        }

        if (ret < 0 && ret != AVERROR_EOF) break;
        if (ret == AVERROR_EOF) break;
    }

flush_encoder:
    // Drain encoder
    while (ret != AVERROR_EXIT) {
        ret = avcodec_receive_packet(tc.enc_ctx, enc_pkt);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) { ret = 0; break; }
        if (ret < 0) break;

        enc_pkt->stream_index = 0;
        av_packet_rescale_ts(enc_pkt, tc.enc_ctx->time_base, tc.ofmt_ctx->streams[0]->time_base);
        av_interleaved_write_frame(tc.ofmt_ctx, enc_pkt);
    }

    // Write trailer
    if (ret >= 0 || ret == AVERROR_EOF) {
        int trailer_ret = av_write_trailer(tc.ofmt_ctx);
        av_log(NULL, AV_LOG_ERROR, "[FFW] av_write_trailer ret=%d frames=%lld\n", trailer_ret, (long long)frame_count);
        ret = 0;
    }

loop_cleanup:
    av_packet_free(&pkt);
    av_frame_free(&frame);
    av_frame_free(&filt_frame);
    av_packet_free(&enc_pkt);

cleanup:
    // Log output file size for debugging
    {
        struct stat st;
        if (cmd.output_path && stat(cmd.output_path, &st) == 0) {
            av_log(NULL, AV_LOG_ERROR, "[FFW] output_path=%s size=%lld ret=%d\n",
                   cmd.output_path, (long long)st.st_size, ret);
        } else if (cmd.output_path) {
            av_log(NULL, AV_LOG_ERROR, "[FFW] output_path=%s stat_failed errno=%d ret=%d\n",
                   cmd.output_path, errno, ret);
        }
    }
    if (output_fd >= 0) {
        struct stat st;
        int64_t file_size = -1;
        if (fstat(output_fd, &st) == 0) file_size = st.st_size;
        av_log(NULL, AV_LOG_ERROR, "[FFW] fd_bytes_written=%lld file_size=%lld ret=%d\n",
               (long long)g_fd_bytes_written, (long long)file_size, ret);
    }

    if (sws_filt_ctx) sws_freeContext(sws_filt_ctx);
    av_frame_free(&conv_frame);
    cleanup_transcode(&tc);
    free_argv(cmd.argc, cmd.argv);

    // Reset log capture
    pthread_mutex_lock(&g_log_mutex);
    g_log_buffer = NULL;
    g_log_buffer_size = 0;
    pthread_mutex_unlock(&g_log_mutex);
    av_log_set_callback(av_log_default_callback);

    // Normalize: AVERROR_EOF is success
    if (ret == AVERROR_EOF) ret = 0;

    return ret;
}

// ─── Media info ──────────────────────────────────────────────────────────────

char* ffmpeg_get_media_info(const char *path) {
    AVFormatContext *fmt_ctx = NULL;
    int ret = avformat_open_input(&fmt_ctx, path, NULL, NULL);
    if (ret < 0) return NULL;

    ret = avformat_find_stream_info(fmt_ctx, NULL);
    if (ret < 0) {
        avformat_close_input(&fmt_ctx);
        return NULL;
    }

    double duration = 0.0;
    int width = 0, height = 0;
    int64_t bitrate = 0;
    const char *codec_name = "";

    // Find the first video stream
    for (unsigned i = 0; i < fmt_ctx->nb_streams; i++) {
        AVCodecParameters *par = fmt_ctx->streams[i]->codecpar;
        if (par->codec_type == AVMEDIA_TYPE_VIDEO) {
            width = par->width;
            height = par->height;
            bitrate = par->bit_rate;
            const AVCodec *codec = avcodec_find_decoder(par->codec_id);
            if (codec) {
                codec_name = codec->name;
            }
            break;
        }
    }

    if (fmt_ctx->duration != AV_NOPTS_VALUE) {
        duration = (double)fmt_ctx->duration / AV_TIME_BASE;
    }

    if (bitrate <= 0 && fmt_ctx->bit_rate > 0) {
        bitrate = fmt_ctx->bit_rate;
    }

    // Build JSON manually (no dependency on JSON library)
    char *json = (char *)malloc(512);
    if (!json) {
        avformat_close_input(&fmt_ctx);
        return NULL;
    }

    snprintf(json, 512,
             "{\"duration\":%.3f,\"width\":%d,\"height\":%d,\"codec\":\"%s\",\"bitrate\":%lld}",
             duration, width, height, codec_name, (long long)bitrate);

    avformat_close_input(&fmt_ctx);
    return json;
}
