/*
 * JNI bridge for FFmpeg — exposes execute, cancel, and getMediaInfo to Kotlin.
 *
 * Uses the lower-level FFmpeg C API (avformat/avcodec/avfilter) for a
 * demux -> decode -> filter -> encode -> mux pipeline.
 *
 * Supports:
 * - Single input with -vf (simple filter graph)
 * - Multiple inputs with -filter_complex (e.g., watermark overlay)
 * - Video re-encoding with selectable codec (h264_mediacodec, libx264)
 * - Audio passthrough (-c:a copy) or re-encoding
 * - Progress reporting via JNI callback
 * - Cancellation via atomic flag
 */

#include <jni.h>
#include <string.h>
#include <stdlib.h>
#include <stdatomic.h>
#include <android/log.h>

#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libavcodec/jni.h>
#include <libavfilter/avfilter.h>
#include <libavfilter/buffersrc.h>
#include <libavfilter/buffersink.h>
#include <libavutil/opt.h>
#include <libavutil/channel_layout.h>
#include <libavutil/imgutils.h>
#include <libavutil/dict.h>
#include <libavutil/error.h>
#include <libavutil/avutil.h>
#include <libavutil/time.h>
#include <libavutil/hwcontext.h>
#include <libswscale/swscale.h>
#include <libswresample/swresample.h>

#define LOG_TAG "FFmpegJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, LOG_TAG, __VA_ARGS__)

#define MAX_INPUTS 8

/* -------------------------------------------------------------------------- */
static atomic_int g_cancel_flag = 0;
static JavaVM *g_jvm = NULL;
static jobject g_progress_obj = NULL;
static jmethodID g_progress_method = NULL;

/* --------------------------------------------------------------------------
 * JNI_OnLoad
 * -------------------------------------------------------------------------- */
JNIEXPORT jint JNI_OnLoad(JavaVM *vm, void *reserved) {
    g_jvm = vm;
    JNIEnv *env;
    if ((*vm)->GetEnv(vm, (void **)&env, JNI_VERSION_1_6) != JNI_OK)
        return JNI_ERR;
    av_jni_set_java_vm(vm, NULL);
    LOGI("FFmpeg JNI loaded");
    return JNI_VERSION_1_6;
}

/* --------------------------------------------------------------------------
 * Progress helper
 * -------------------------------------------------------------------------- */
static void send_progress(int64_t frame, double fps, double time_s,
                          double speed, double percentage) {
    if (!g_jvm || !g_progress_obj || !g_progress_method) return;
    JNIEnv *env;
    int attached = 0;
    if ((*g_jvm)->GetEnv(g_jvm, (void **)&env, JNI_VERSION_1_6) != JNI_OK) {
        if ((*g_jvm)->AttachCurrentThread(g_jvm, &env, NULL) != JNI_OK) return;
        attached = 1;
    }
    (*env)->CallVoidMethod(env, g_progress_obj, g_progress_method,
                           (jlong)frame, fps, time_s, speed, percentage);
    if (attached) (*g_jvm)->DetachCurrentThread(g_jvm);
}

/* --------------------------------------------------------------------------
 * Log callback
 * -------------------------------------------------------------------------- */
static void ffmpeg_log_callback(void *ptr, int level, const char *fmt, va_list vl) {
    if (level > av_log_get_level()) return;
    int al = (level <= AV_LOG_ERROR) ? ANDROID_LOG_ERROR :
             (level <= AV_LOG_WARNING) ? ANDROID_LOG_WARN :
             (level <= AV_LOG_INFO) ? ANDROID_LOG_INFO : ANDROID_LOG_DEBUG;
    char buf[1024];
    vsnprintf(buf, sizeof(buf), fmt, vl);
    __android_log_print(al, "FFmpeg", "%s", buf);
}

/* --------------------------------------------------------------------------
 * Command tokenizer (handles single/double quotes)
 * -------------------------------------------------------------------------- */
typedef struct { int argc; char **argv; } ParsedArgs;

static ParsedArgs parse_command(const char *command) {
    ParsedArgs r = {0, NULL};
    int cap = 16;
    r.argv = malloc(cap * sizeof(char *));
    const char *p = command;
    while (*p) {
        while (*p == ' ' || *p == '\t') p++;
        if (!*p) break;
        char tok[4096];
        int ti = 0;
        char q = 0;
        while (*p && (q || (*p != ' ' && *p != '\t'))) {
            if (!q && (*p == '"' || *p == '\'')) { q = *p; p++; }
            else if (q && *p == q) { q = 0; p++; }
            else { if (ti < (int)sizeof(tok)-1) tok[ti++] = *p; p++; }
        }
        tok[ti] = '\0';
        if (ti > 0) {
            if (r.argc >= cap) { cap *= 2; r.argv = realloc(r.argv, cap * sizeof(char *)); }
            r.argv[r.argc++] = strdup(tok);
        }
    }
    return r;
}

static void free_parsed_args(ParsedArgs *a) {
    for (int i = 0; i < a->argc; i++) free(a->argv[i]);
    free(a->argv);
    a->argv = NULL; a->argc = 0;
}

/* --------------------------------------------------------------------------
 * Parsed command options
 * -------------------------------------------------------------------------- */
typedef struct {
    const char *inputs[MAX_INPUTS];
    int num_inputs;
    const char *output_path;
    const char *video_filter;       /* -vf */
    const char *filter_complex;     /* -filter_complex */
    const char *video_codec;        /* -c:v */
    const char *audio_codec;        /* -c:a */
    const char *preset;
    const char *crf;
    const char *video_bitrate;
    const char *audio_bitrate;
    const char *pixel_format;
    int no_audio;
    int threads;
    int overwrite;
    double seek_seconds;           /* -ss */
    int max_frames;                /* -vframes */
    const char *format;            /* -f */
} CommandOptions;

static CommandOptions parse_options(ParsedArgs *args) {
    CommandOptions o;
    memset(&o, 0, sizeof(o));
    for (int i = 0; i < args->argc; i++) {
        const char *a = args->argv[i];
        if (!strcmp(a, "-i") && i+1 < args->argc) {
            if (o.num_inputs < MAX_INPUTS) o.inputs[o.num_inputs++] = args->argv[++i];
        } else if (!strcmp(a, "-y")) o.overwrite = 1;
        else if (!strcmp(a, "-an")) o.no_audio = 1;
        else if ((!strcmp(a, "-vf") || !strcmp(a, "-filter:v")) && i+1 < args->argc)
            o.video_filter = args->argv[++i];
        else if (!strcmp(a, "-filter_complex") && i+1 < args->argc)
            o.filter_complex = args->argv[++i];
        else if ((!strcmp(a, "-c:v") || !strcmp(a, "-vcodec")) && i+1 < args->argc)
            o.video_codec = args->argv[++i];
        else if ((!strcmp(a, "-c:a") || !strcmp(a, "-acodec")) && i+1 < args->argc)
            o.audio_codec = args->argv[++i];
        else if (!strcmp(a, "-preset") && i+1 < args->argc) o.preset = args->argv[++i];
        else if (!strcmp(a, "-crf") && i+1 < args->argc)    o.crf = args->argv[++i];
        else if (!strcmp(a, "-b:v") && i+1 < args->argc)    o.video_bitrate = args->argv[++i];
        else if (!strcmp(a, "-b:a") && i+1 < args->argc)    o.audio_bitrate = args->argv[++i];
        else if (!strcmp(a, "-pix_fmt") && i+1 < args->argc) o.pixel_format = args->argv[++i];
        else if (!strcmp(a, "-threads") && i+1 < args->argc) o.threads = atoi(args->argv[++i]);
        else if (!strcmp(a, "-ss") && i+1 < args->argc) o.seek_seconds = atof(args->argv[++i]);
        else if (!strcmp(a, "-vframes") && i+1 < args->argc) o.max_frames = atoi(args->argv[++i]);
        else if (!strcmp(a, "-f") && i+1 < args->argc) o.format = args->argv[++i];
        else if (a[0] != '-' && i == args->argc - 1) o.output_path = a;
    }
    return o;
}

/* --------------------------------------------------------------------------
 * Parse bitrate string with K/M suffix
 * -------------------------------------------------------------------------- */
static int64_t parse_bitrate(const char *s) {
    double v = atof(s);
    size_t len = strlen(s);
    if (len > 0) {
        char c = s[len-1];
        if (c == 'M' || c == 'm') return (int64_t)(v * 1000000);
        if (c == 'K' || c == 'k') return (int64_t)(v * 1000);
    }
    return (int64_t)v;
}

/* --------------------------------------------------------------------------
 * Setup filter graph — handles both single-input (-vf) and multi-input
 * (-filter_complex) filter graphs.
 *
 * For multi-input: creates a buffersrc per video input, names them [0:v], [1:v], etc.
 * -------------------------------------------------------------------------- */
static int init_filters(
    AVFilterGraph **graph_out,
    AVFilterContext ***src_ctxs_out, int *num_src,
    AVFilterContext **sink_ctx_out,
    AVCodecContext **dec_ctxs,
    AVRational *time_bases,
    int num_video_inputs,
    const char *filter_descr)
{
    int ret;
    AVFilterGraph *graph = avfilter_graph_alloc();
    if (!graph) return AVERROR(ENOMEM);

    const AVFilter *buffersrc = avfilter_get_by_name("buffer");
    const AVFilter *buffersink = avfilter_get_by_name("buffersink");
    if (!buffersrc || !buffersink) {
        LOGE("buffer/buffersink filters not found");
        avfilter_graph_free(&graph);
        return AVERROR_FILTER_NOT_FOUND;
    }

    AVFilterContext **src_ctxs = calloc(num_video_inputs, sizeof(AVFilterContext *));
    AVFilterInOut *outputs_head = NULL;
    AVFilterInOut *outputs_tail = NULL;

    for (int i = 0; i < num_video_inputs; i++) {
        char args[512];
        snprintf(args, sizeof(args),
                 "video_size=%dx%d:pix_fmt=%d:time_base=%d/%d:pixel_aspect=%d/%d",
                 dec_ctxs[i]->width, dec_ctxs[i]->height, dec_ctxs[i]->pix_fmt,
                 time_bases[i].num, time_bases[i].den,
                 dec_ctxs[i]->sample_aspect_ratio.num,
                 dec_ctxs[i]->sample_aspect_ratio.den > 0 ?
                     dec_ctxs[i]->sample_aspect_ratio.den : 1);

        char name[32];
        snprintf(name, sizeof(name), "in%d", i);
        ret = avfilter_graph_create_filter(&src_ctxs[i], buffersrc, name, args, NULL, graph);
        if (ret < 0) {
            LOGE("Cannot create buffer source %d: %s", i, av_err2str(ret));
            free(src_ctxs);
            avfilter_graph_free(&graph);
            return ret;
        }

        AVFilterInOut *out = avfilter_inout_alloc();
        /* For -filter_complex, the pad names are "0:v", "1:v", etc. */
        char pad_name[32];
        if (num_video_inputs > 1)
            snprintf(pad_name, sizeof(pad_name), "%d:v", i);
        else
            snprintf(pad_name, sizeof(pad_name), "in");
        out->name = av_strdup(pad_name);
        out->filter_ctx = src_ctxs[i];
        out->pad_idx = 0;
        out->next = NULL;

        if (!outputs_head) { outputs_head = out; outputs_tail = out; }
        else { outputs_tail->next = out; outputs_tail = out; }
    }

    AVFilterContext *sink_ctx = NULL;
    ret = avfilter_graph_create_filter(&sink_ctx, buffersink, "out", NULL, NULL, graph);
    if (ret < 0) {
        LOGE("Cannot create buffer sink: %s", av_err2str(ret));
        free(src_ctxs);
        avfilter_graph_free(&graph);
        return ret;
    }

    AVFilterInOut *inputs = avfilter_inout_alloc();
    inputs->name = av_strdup("out");
    inputs->filter_ctx = sink_ctx;
    inputs->pad_idx = 0;
    inputs->next = NULL;

    ret = avfilter_graph_parse_ptr(graph, filter_descr, &inputs, &outputs_head, NULL);
    if (ret < 0) {
        LOGE("Cannot parse filter graph '%s': %s", filter_descr, av_err2str(ret));
        avfilter_inout_free(&inputs);
        avfilter_inout_free(&outputs_head);
        free(src_ctxs);
        avfilter_graph_free(&graph);
        return ret;
    }

    ret = avfilter_graph_config(graph, NULL);
    if (ret < 0) {
        LOGE("Cannot configure filter graph: %s", av_err2str(ret));
        free(src_ctxs);
        avfilter_graph_free(&graph);
        return ret;
    }

    avfilter_inout_free(&inputs);
    avfilter_inout_free(&outputs_head);

    *graph_out = graph;
    *src_ctxs_out = src_ctxs;
    *num_src = num_video_inputs;
    *sink_ctx_out = sink_ctx;
    return 0;
}

/* --------------------------------------------------------------------------
 * Send a frame to the encoder, converting pixel format if needed.
 * If sws_ctx is non-NULL, converts src_frame into conv_frame before encoding.
 * Passing src_frame == NULL flushes the encoder (no conversion needed).
 * -------------------------------------------------------------------------- */
static void encode_frame(AVCodecContext *enc_ctx, AVFrame *src_frame,
                         struct SwsContext *sws_ctx, AVFrame *conv_frame) {
    AVFrame *send = src_frame;
    if (src_frame && sws_ctx && conv_frame) {
        sws_scale(sws_ctx,
                  (const uint8_t *const *)src_frame->data, src_frame->linesize,
                  0, src_frame->height,
                  conv_frame->data, conv_frame->linesize);
        conv_frame->pts = src_frame->pts;
        conv_frame->pict_type = AV_PICTURE_TYPE_NONE;
        send = conv_frame;
    }
    avcodec_send_frame(enc_ctx, send);
}

/* --------------------------------------------------------------------------
 * Core transcode pipeline
 * -------------------------------------------------------------------------- */
static int transcode(CommandOptions *opts, char *out_buf, int out_buf_size) {
    int ret = 0;
    int64_t frame_count = 0;
    int64_t total_duration_us = 0;
    int64_t start_time = av_gettime_relative();

    /* Input contexts — one per -i */
    AVFormatContext *ifmt_ctxs[MAX_INPUTS] = {0};
    AVCodecContext  *video_dec_ctxs[MAX_INPUTS] = {0};
    int             video_stream_idxs[MAX_INPUTS];
    AVRational      video_time_bases[MAX_INPUTS];

    /* Only first input's audio is used */
    int audio_stream_idx = -1;
    AVCodecContext *audio_dec_ctx = NULL;

    /* Output */
    AVFormatContext *ofmt_ctx = NULL;
    AVCodecContext *video_enc_ctx = NULL;
    AVCodecContext *audio_enc_ctx = NULL;

    /* Filter */
    AVFilterGraph *filter_graph = NULL;
    AVFilterContext **buffersrc_ctxs = NULL;
    int num_buffersrc = 0;
    AVFilterContext *buffersink_ctx = NULL;

    /* Hardware device context (for h264_mediacodec GPU encoding) */
    AVBufferRef *hw_device_ctx = NULL;

    /* Video pixel format conversion (e.g. YUV420P -> NV12 for mediacodec) */
    struct SwsContext *sws_video_ctx = NULL;
    AVFrame *conv_frame = NULL;

    SwrContext *swr_ctx = NULL;
    AVPacket *pkt = NULL, *enc_pkt = NULL;
    AVFrame *frame = NULL, *filt_frame = NULL, *audio_frame = NULL;

    int has_filter = (opts->video_filter || opts->filter_complex);
    int audio_copy = (opts->audio_codec && !strcmp(opts->audio_codec, "copy"));

    /* ---- Open all inputs ---- */
    for (int i = 0; i < opts->num_inputs; i++) {
        ret = avformat_open_input(&ifmt_ctxs[i], opts->inputs[i], NULL, NULL);
        if (ret < 0) {
            snprintf(out_buf, out_buf_size, "Cannot open input %d '%s': %s",
                     i, opts->inputs[i], av_err2str(ret));
            goto cleanup;
        }
        ret = avformat_find_stream_info(ifmt_ctxs[i], NULL);
        if (ret < 0) {
            snprintf(out_buf, out_buf_size, "Cannot find stream info for input %d: %s",
                     i, av_err2str(ret));
            goto cleanup;
        }

        /* Find video stream */
        video_stream_idxs[i] = -1;
        for (unsigned s = 0; s < ifmt_ctxs[i]->nb_streams; s++) {
            if (ifmt_ctxs[i]->streams[s]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
                video_stream_idxs[i] = s;
                break;
            }
        }
        if (video_stream_idxs[i] < 0) {
            /* Image inputs (like PNG logo) might be demuxed differently */
            /* Try the first stream */
            if (ifmt_ctxs[i]->nb_streams > 0 &&
                ifmt_ctxs[i]->streams[0]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
                video_stream_idxs[i] = 0;
            }
        }

        if (video_stream_idxs[i] >= 0) {
            AVCodecParameters *cp = ifmt_ctxs[i]->streams[video_stream_idxs[i]]->codecpar;
            const AVCodec *dec = NULL;
            int hw_dec_ok = 0;

            /* Try hardware decoder for primary video input (index 0) when GPU
               encoding is selected.  Secondary inputs (e.g. PNG logo for
               watermark overlay) always use the software decoder. */
            if (i == 0 && opts->video_codec &&
                strstr(opts->video_codec, "mediacodec") != NULL &&
                cp->codec_id == AV_CODEC_ID_H264) {

                dec = avcodec_find_decoder_by_name("h264_mediacodec");
                if (dec) {
                    video_dec_ctxs[i] = avcodec_alloc_context3(dec);
                    avcodec_parameters_to_context(video_dec_ctxs[i], cp);
                    if (opts->threads > 0) video_dec_ctxs[i]->thread_count = opts->threads;
                    ret = avcodec_open2(video_dec_ctxs[i], dec, NULL);
                    if (ret < 0) {
                        LOGI("h264_mediacodec decoder failed (%s), falling back to software",
                             av_err2str(ret));
                        avcodec_free_context(&video_dec_ctxs[i]);
                        dec = NULL;  /* trigger software fallback below */
                    } else {
                        hw_dec_ok = 1;
                        LOGI("Using hardware decoder: h264_mediacodec for input %d", i);
                    }
                } else {
                    LOGI("h264_mediacodec decoder not found, using software decoder");
                }
            }

            /* Software decoder (default path, or fallback from failed hw decoder) */
            if (!hw_dec_ok) {
                dec = avcodec_find_decoder(cp->codec_id);
                if (!dec) {
                    snprintf(out_buf, out_buf_size, "No decoder for input %d codec %s",
                             i, avcodec_get_name(cp->codec_id));
                    ret = AVERROR(EINVAL);
                    goto cleanup;
                }
                video_dec_ctxs[i] = avcodec_alloc_context3(dec);
                avcodec_parameters_to_context(video_dec_ctxs[i], cp);
                if (opts->threads > 0) video_dec_ctxs[i]->thread_count = opts->threads;
                ret = avcodec_open2(video_dec_ctxs[i], dec, NULL);
                if (ret < 0) {
                    snprintf(out_buf, out_buf_size, "Cannot open decoder for input %d: %s",
                             i, av_err2str(ret));
                    goto cleanup;
                }
                LOGI("Using software decoder: %s for input %d", dec->name, i);
            }

            video_time_bases[i] = ifmt_ctxs[i]->streams[video_stream_idxs[i]]->time_base;
        }

        /* Seek if -ss is specified (only for first input) */
        if (i == 0 && opts->seek_seconds > 0) {
            int64_t seek_ts = (int64_t)(opts->seek_seconds * AV_TIME_BASE);
            ret = av_seek_frame(ifmt_ctxs[i], -1, seek_ts, AVSEEK_FLAG_BACKWARD);
            if (ret < 0) {
                LOGI("Seek to %.1fs failed: %s, continuing from start", opts->seek_seconds, av_err2str(ret));
            } else {
                LOGI("Seeked to %.1fs", opts->seek_seconds);
                if (video_dec_ctxs[i]) avcodec_flush_buffers(video_dec_ctxs[i]);
            }
        }

        /* Get total duration from first input */
        if (i == 0) {
            total_duration_us = ifmt_ctxs[i]->duration > 0 ? ifmt_ctxs[i]->duration : 0;
            /* Find audio in first input */
            for (unsigned s = 0; s < ifmt_ctxs[i]->nb_streams; s++) {
                if (ifmt_ctxs[i]->streams[s]->codecpar->codec_type == AVMEDIA_TYPE_AUDIO) {
                    audio_stream_idx = s;
                    break;
                }
            }
        }
    }

    /* ---- Open audio decoder (from first input) ---- */
    if (audio_stream_idx >= 0 && !opts->no_audio && !audio_copy) {
        AVCodecParameters *cp = ifmt_ctxs[0]->streams[audio_stream_idx]->codecpar;
        const AVCodec *dec = avcodec_find_decoder(cp->codec_id);
        if (dec) {
            audio_dec_ctx = avcodec_alloc_context3(dec);
            avcodec_parameters_to_context(audio_dec_ctx, cp);
            ret = avcodec_open2(audio_dec_ctx, dec, NULL);
            if (ret < 0) {
                LOGE("Cannot open audio decoder, skipping audio: %s", av_err2str(ret));
                avcodec_free_context(&audio_dec_ctx);
                audio_stream_idx = -1;
            }
        } else {
            audio_stream_idx = -1;
        }
    }

    /* ---- Create output ---- */
    ret = avformat_alloc_output_context2(&ofmt_ctx, NULL, opts->format, opts->output_path);
    if (ret < 0) {
        snprintf(out_buf, out_buf_size, "Cannot create output context: %s", av_err2str(ret));
        goto cleanup;
    }

    /* ---- Setup filter graph ---- */
    if (has_filter) {
        const char *fdesc = opts->filter_complex ? opts->filter_complex : opts->video_filter;
        int nvi = opts->filter_complex ? opts->num_inputs : 1;

        /* Ensure all video inputs have decoders */
        for (int i = 0; i < nvi; i++) {
            if (!video_dec_ctxs[i]) {
                snprintf(out_buf, out_buf_size,
                         "Input %d has no video stream for filter", i);
                ret = AVERROR(EINVAL);
                goto cleanup;
            }
        }

        ret = init_filters(&filter_graph, &buffersrc_ctxs, &num_buffersrc,
                           &buffersink_ctx, video_dec_ctxs, video_time_bases,
                           nvi, fdesc);
        if (ret < 0) {
            snprintf(out_buf, out_buf_size, "Cannot setup filter: %s", av_err2str(ret));
            goto cleanup;
        }
    }

    /* ---- Setup video encoder ---- */
    {
        /* Auto-detect encoder: use mjpeg/png for image outputs, libx264 for video */
        const char *enc_name = opts->video_codec;
        if (!enc_name) {
            enum AVCodecID default_codec = ofmt_ctx->oformat->video_codec;
            if (default_codec != AV_CODEC_ID_NONE) {
                const AVCodec *def = avcodec_find_encoder(default_codec);
                enc_name = def ? def->name : "libx264";
            } else {
                enc_name = "libx264";
            }
        }
        const AVCodec *enc = avcodec_find_encoder_by_name(enc_name);
        if (!enc) {
            LOGE("Encoder '%s' not found, falling back to libx264", enc_name);
            enc = avcodec_find_encoder_by_name("libx264");
        }
        if (!enc) {
            snprintf(out_buf, out_buf_size, "No video encoder found");
            ret = AVERROR(EINVAL);
            goto cleanup;
        }
        LOGI("Using video encoder: %s", enc->name);

        int is_mediacodec = strstr(enc->name, "mediacodec") != NULL;

        AVStream *ost = avformat_new_stream(ofmt_ctx, NULL);
        if (!ost) { ret = AVERROR(ENOMEM); goto cleanup; }

        video_enc_ctx = avcodec_alloc_context3(enc);

        if (filter_graph) {
            video_enc_ctx->width  = av_buffersink_get_w(buffersink_ctx);
            video_enc_ctx->height = av_buffersink_get_h(buffersink_ctx);
        } else {
            video_enc_ctx->width  = video_dec_ctxs[0]->width;
            video_enc_ctx->height = video_dec_ctxs[0]->height;
        }

        video_enc_ctx->time_base = video_time_bases[0];
        video_enc_ctx->framerate = av_guess_frame_rate(
            ifmt_ctxs[0], ifmt_ctxs[0]->streams[video_stream_idxs[0]], NULL);
        if (opts->threads > 0) video_enc_ctx->thread_count = opts->threads;

        if (opts->pixel_format) {
            video_enc_ctx->pix_fmt = av_get_pix_fmt(opts->pixel_format);
        } else if (is_mediacodec) {
            /*
             * h264_mediacodec pix_fmts = {MEDIACODEC, YUV420P, NV12, NONE}.
             * AV_PIX_FMT_MEDIACODEC (index 0) requires a Surface via hw_device_ctx
             * which is not available in headless encoding. Use NV12 for buffer-based
             * hardware encoding — MediaCodec still uses the GPU encoder chip, frames
             * are just delivered via CPU buffers instead of zero-copy surfaces.
             */
            video_enc_ctx->pix_fmt = AV_PIX_FMT_NV12;
            LOGI("MediaCodec encoder: using NV12 buffer-based hardware encoding");
        } else if (enc->pix_fmts) {
            video_enc_ctx->pix_fmt = enc->pix_fmts[0];
        } else {
            video_enc_ctx->pix_fmt = AV_PIX_FMT_YUV420P;
        }

        if (opts->video_bitrate) video_enc_ctx->bit_rate = parse_bitrate(opts->video_bitrate);
        if (opts->crf) av_opt_set(video_enc_ctx->priv_data, "crf", opts->crf, 0);
        if (opts->preset) av_opt_set(video_enc_ctx->priv_data, "preset", opts->preset, 0);

        if (ofmt_ctx->oformat->flags & AVFMT_GLOBALHEADER)
            video_enc_ctx->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;

        ret = avcodec_open2(video_enc_ctx, enc, NULL);

        /* Fallback: if mediacodec encoder fails, try libx264 */
        if (ret < 0 && is_mediacodec) {
            LOGE("Cannot open MediaCodec encoder: %s — falling back to libx264", av_err2str(ret));
            avcodec_free_context(&video_enc_ctx);

            enc = avcodec_find_encoder_by_name("libx264");
            if (!enc) {
                snprintf(out_buf, out_buf_size, "No video encoder found (mediacodec + libx264 both failed)");
                ret = AVERROR(EINVAL);
                goto cleanup;
            }
            is_mediacodec = 0;
            video_enc_ctx = avcodec_alloc_context3(enc);
            if (filter_graph) {
                video_enc_ctx->width  = av_buffersink_get_w(buffersink_ctx);
                video_enc_ctx->height = av_buffersink_get_h(buffersink_ctx);
            } else {
                video_enc_ctx->width  = video_dec_ctxs[0]->width;
                video_enc_ctx->height = video_dec_ctxs[0]->height;
            }
            video_enc_ctx->time_base = video_time_bases[0];
            video_enc_ctx->framerate = av_guess_frame_rate(
                ifmt_ctxs[0], ifmt_ctxs[0]->streams[video_stream_idxs[0]], NULL);
            if (opts->threads > 0) video_enc_ctx->thread_count = opts->threads;
            video_enc_ctx->pix_fmt = enc->pix_fmts ? enc->pix_fmts[0] : AV_PIX_FMT_YUV420P;
            if (opts->video_bitrate) video_enc_ctx->bit_rate = parse_bitrate(opts->video_bitrate);
            if (opts->crf) av_opt_set(video_enc_ctx->priv_data, "crf", opts->crf, 0);
            if (opts->preset) av_opt_set(video_enc_ctx->priv_data, "preset", opts->preset, 0);
            if (ofmt_ctx->oformat->flags & AVFMT_GLOBALHEADER)
                video_enc_ctx->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;

            ret = avcodec_open2(video_enc_ctx, enc, NULL);
            if (ret < 0) {
                snprintf(out_buf, out_buf_size, "Cannot open fallback encoder libx264: %s", av_err2str(ret));
                goto cleanup;
            }
            LOGI("Fallback: using libx264 CPU encoder");
        } else if (ret < 0) {
            snprintf(out_buf, out_buf_size, "Cannot open encoder '%s': %s",
                     enc->name, av_err2str(ret));
            goto cleanup;
        }

        avcodec_parameters_from_context(ost->codecpar, video_enc_ctx);
        ost->time_base = video_enc_ctx->time_base;

        /*
         * Setup pixel format conversion if the filter graph / decoder output
         * format differs from what the encoder expects.
         * Common case: filter outputs YUV420P, mediacodec wants NV12.
         */
        {
            enum AVPixelFormat src_pix_fmt;
            if (filter_graph)
                src_pix_fmt = av_buffersink_get_format(buffersink_ctx);
            else
                src_pix_fmt = video_dec_ctxs[0]->pix_fmt;

            if (src_pix_fmt != video_enc_ctx->pix_fmt) {
                LOGI("Pixel format conversion: %s -> %s",
                     av_get_pix_fmt_name(src_pix_fmt),
                     av_get_pix_fmt_name(video_enc_ctx->pix_fmt));
                sws_video_ctx = sws_getContext(
                    video_enc_ctx->width, video_enc_ctx->height, src_pix_fmt,
                    video_enc_ctx->width, video_enc_ctx->height, video_enc_ctx->pix_fmt,
                    SWS_BILINEAR, NULL, NULL, NULL);
                if (!sws_video_ctx) {
                    LOGE("Cannot create pixel format conversion context");
                    ret = AVERROR(ENOMEM);
                    goto cleanup;
                }
                conv_frame = av_frame_alloc();
                if (!conv_frame) { ret = AVERROR(ENOMEM); goto cleanup; }
                conv_frame->format = video_enc_ctx->pix_fmt;
                conv_frame->width  = video_enc_ctx->width;
                conv_frame->height = video_enc_ctx->height;
                ret = av_frame_get_buffer(conv_frame, 0);
                if (ret < 0) {
                    LOGE("Cannot allocate conversion frame buffer: %s", av_err2str(ret));
                    goto cleanup;
                }
            }
        }
    }

    /* ---- Audio output stream ---- */
    int audio_out_idx = -1;
    if (audio_stream_idx >= 0 && !opts->no_audio) {
        AVStream *aost = avformat_new_stream(ofmt_ctx, NULL);
        if (!aost) { ret = AVERROR(ENOMEM); goto cleanup; }
        audio_out_idx = aost->index;

        if (audio_copy) {
            /* Passthrough: copy codec parameters directly */
            avcodec_parameters_copy(aost->codecpar,
                                    ifmt_ctxs[0]->streams[audio_stream_idx]->codecpar);
            aost->codecpar->codec_tag = 0;
            aost->time_base = ifmt_ctxs[0]->streams[audio_stream_idx]->time_base;
        } else if (audio_dec_ctx) {
            const char *aenc_name = opts->audio_codec ? opts->audio_codec : "aac";
            const AVCodec *aenc = avcodec_find_encoder_by_name(aenc_name);
            if (!aenc) aenc = avcodec_find_encoder(AV_CODEC_ID_AAC);
            if (aenc) {
                audio_enc_ctx = avcodec_alloc_context3(aenc);
                audio_enc_ctx->sample_rate = audio_dec_ctx->sample_rate;
                av_channel_layout_copy(&audio_enc_ctx->ch_layout, &audio_dec_ctx->ch_layout);
                audio_enc_ctx->time_base = (AVRational){1, audio_dec_ctx->sample_rate};
                audio_enc_ctx->sample_fmt = aenc->sample_fmts ? aenc->sample_fmts[0] : AV_SAMPLE_FMT_FLTP;
                audio_enc_ctx->bit_rate = opts->audio_bitrate ? atoi(opts->audio_bitrate) : 128000;
                if (ofmt_ctx->oformat->flags & AVFMT_GLOBALHEADER)
                    audio_enc_ctx->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
                ret = avcodec_open2(audio_enc_ctx, aenc, NULL);
                if (ret < 0) {
                    LOGE("Cannot open audio encoder: %s", av_err2str(ret));
                    avcodec_free_context(&audio_enc_ctx);
                    audio_stream_idx = -1;
                } else {
                    avcodec_parameters_from_context(aost->codecpar, audio_enc_ctx);
                    aost->time_base = audio_enc_ctx->time_base;
                    if (audio_dec_ctx->sample_fmt != audio_enc_ctx->sample_fmt ||
                        audio_dec_ctx->sample_rate != audio_enc_ctx->sample_rate) {
                        swr_alloc_set_opts2(&swr_ctx,
                            &audio_enc_ctx->ch_layout, audio_enc_ctx->sample_fmt, audio_enc_ctx->sample_rate,
                            &audio_dec_ctx->ch_layout, audio_dec_ctx->sample_fmt, audio_dec_ctx->sample_rate,
                            0, NULL);
                        if (swr_init(swr_ctx) < 0) { swr_free(&swr_ctx); }
                    }
                }
            }
        }
    }

    /* ---- Open output file ---- */
    if (!(ofmt_ctx->oformat->flags & AVFMT_NOFILE)) {
        ret = avio_open(&ofmt_ctx->pb, opts->output_path, AVIO_FLAG_WRITE);
        if (ret < 0) {
            snprintf(out_buf, out_buf_size, "Cannot open output '%s': %s",
                     opts->output_path, av_err2str(ret));
            goto cleanup;
        }
    }

    AVDictionary *mux_opts = NULL;
    av_dict_set(&mux_opts, "movflags", "faststart", 0);
    ret = avformat_write_header(ofmt_ctx, &mux_opts);
    av_dict_free(&mux_opts);
    if (ret < 0) {
        snprintf(out_buf, out_buf_size, "Cannot write header: %s", av_err2str(ret));
        goto cleanup;
    }

    /* ---- Alloc packets/frames ---- */
    pkt = av_packet_alloc();
    enc_pkt = av_packet_alloc();
    frame = av_frame_alloc();
    filt_frame = av_frame_alloc();
    audio_frame = av_frame_alloc();
    if (!pkt || !enc_pkt || !frame || !filt_frame || !audio_frame) {
        ret = AVERROR(ENOMEM); goto cleanup;
    }

    /* For multi-input: we need to decode all secondary inputs fully first
     * (e.g., the watermark image) and feed them to the filter graph,
     * then process the primary (first) input frame by frame.
     *
     * For image inputs (like PNG logos), we decode one frame and feed it
     * once — the overlay filter will hold it.
     */

    /* Feed secondary inputs (inputs 1..N) into filter graph if multi-input */
    if (filter_graph && num_buffersrc > 1) {
        for (int i = 1; i < opts->num_inputs && i < num_buffersrc; i++) {
            if (video_stream_idxs[i] < 0 || !video_dec_ctxs[i]) continue;

            AVPacket *spkt = av_packet_alloc();
            AVFrame *sframe = av_frame_alloc();
            int fed = 0;

            while (av_read_frame(ifmt_ctxs[i], spkt) >= 0) {
                if (spkt->stream_index != video_stream_idxs[i]) {
                    av_packet_unref(spkt);
                    continue;
                }
                avcodec_send_packet(video_dec_ctxs[i], spkt);
                av_packet_unref(spkt);

                while (avcodec_receive_frame(video_dec_ctxs[i], sframe) >= 0) {
                    av_buffersrc_add_frame_flags(buffersrc_ctxs[i], sframe,
                                                  AV_BUFFERSRC_FLAG_KEEP_REF);
                    av_frame_unref(sframe);
                    fed++;
                }
            }

            /* Flush decoder */
            avcodec_send_packet(video_dec_ctxs[i], NULL);
            while (avcodec_receive_frame(video_dec_ctxs[i], sframe) >= 0) {
                av_buffersrc_add_frame_flags(buffersrc_ctxs[i], sframe,
                                              AV_BUFFERSRC_FLAG_KEEP_REF);
                av_frame_unref(sframe);
                fed++;
            }

            /* Signal EOF to this buffer source */
            av_buffersrc_add_frame(buffersrc_ctxs[i], NULL);

            LOGI("Fed %d frames from input %d to filter", fed, i);
            av_packet_free(&spkt);
            av_frame_free(&sframe);
        }
    }

    /* ---- Main loop: process first input ---- */
    int64_t last_progress_us = 0;
    int primary_video_idx = video_stream_idxs[0];

    while (av_read_frame(ifmt_ctxs[0], pkt) >= 0) {
        if (atomic_load(&g_cancel_flag)) {
            snprintf(out_buf, out_buf_size, "Cancelled by user");
            ret = AVERROR_EXIT;
            goto cleanup;
        }

        if (pkt->stream_index == primary_video_idx) {
            ret = avcodec_send_packet(video_dec_ctxs[0], pkt);
            av_packet_unref(pkt);
            if (ret < 0 && ret != AVERROR(EAGAIN) && ret != AVERROR_EOF) continue;

            while (1) {
                ret = avcodec_receive_frame(video_dec_ctxs[0], frame);
                if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) break;
                if (ret < 0) break;

                /* Capture PTS before the frame is unref'd */
                int64_t cur_pts = frame->best_effort_timestamp;

                /* Encode (with or without filter) */
                if (filter_graph) {
                    av_buffersrc_add_frame_flags(buffersrc_ctxs[0], frame,
                                                  AV_BUFFERSRC_FLAG_KEEP_REF);
                    av_frame_unref(frame);

                    while (1) {
                        ret = av_buffersink_get_frame(buffersink_ctx, filt_frame);
                        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) break;
                        if (ret < 0) break;

                        filt_frame->pict_type = AV_PICTURE_TYPE_NONE;
                        encode_frame(video_enc_ctx, filt_frame,
                                     sws_video_ctx, conv_frame);

                        while (avcodec_receive_packet(video_enc_ctx, enc_pkt) >= 0) {
                            enc_pkt->stream_index = 0;
                            av_packet_rescale_ts(enc_pkt, video_enc_ctx->time_base,
                                                 ofmt_ctx->streams[0]->time_base);
                            av_interleaved_write_frame(ofmt_ctx, enc_pkt);
                            av_packet_unref(enc_pkt);
                        }
                        av_frame_unref(filt_frame);
                    }
                } else {
                    frame->pict_type = AV_PICTURE_TYPE_NONE;
                    encode_frame(video_enc_ctx, frame,
                                 sws_video_ctx, conv_frame);
                    av_frame_unref(frame);

                    while (avcodec_receive_packet(video_enc_ctx, enc_pkt) >= 0) {
                        enc_pkt->stream_index = 0;
                        av_packet_rescale_ts(enc_pkt, video_enc_ctx->time_base,
                                             ofmt_ctx->streams[0]->time_base);
                        av_interleaved_write_frame(ofmt_ctx, enc_pkt);
                        av_packet_unref(enc_pkt);
                    }
                }

                frame_count++;

                /* Stop after -vframes limit */
                if (opts->max_frames > 0 && frame_count >= opts->max_frames) {
                    LOGI("Reached frame limit (%d frames)", opts->max_frames);
                    av_packet_unref(pkt);
                    goto flush_encoder;
                }

                /* Progress reporting (throttled to every 250ms) */
                int64_t now = av_gettime_relative();
                if (total_duration_us > 0 && (now - last_progress_us > 250000)) {
                    int64_t pts = cur_pts;
                    double time_s = 0;
                    if (pts != AV_NOPTS_VALUE)
                        time_s = pts * av_q2d(video_time_bases[0]);
                    double total_s = total_duration_us / 1000000.0;
                    double pct = total_s > 0 ? (time_s / total_s * 100.0) : 0;
                    if (pct > 100.0) pct = 100.0;
                    double elapsed = (now - start_time) / 1000000.0;
                    double fps_val = elapsed > 0 ? frame_count / elapsed : 0;
                    double speed = elapsed > 0 && total_s > 0 ? time_s / elapsed : 0;
                    send_progress(frame_count, fps_val, time_s, speed, pct);
                    last_progress_us = now;
                }
            }
            ret = 0;

        } else if (pkt->stream_index == audio_stream_idx && audio_out_idx >= 0 && !opts->no_audio) {
            if (audio_copy) {
                /* Passthrough */
                pkt->stream_index = audio_out_idx;
                av_packet_rescale_ts(pkt,
                    ifmt_ctxs[0]->streams[audio_stream_idx]->time_base,
                    ofmt_ctx->streams[audio_out_idx]->time_base);
                pkt->pos = -1;
                av_interleaved_write_frame(ofmt_ctx, pkt);
            } else if (audio_dec_ctx && audio_enc_ctx) {
                avcodec_send_packet(audio_dec_ctx, pkt);
                while (avcodec_receive_frame(audio_dec_ctx, audio_frame) >= 0) {
                    AVFrame *enc_af = audio_frame;
                    if (swr_ctx) {
                        AVFrame *r = av_frame_alloc();
                        r->sample_rate = audio_enc_ctx->sample_rate;
                        av_channel_layout_copy(&r->ch_layout, &audio_enc_ctx->ch_layout);
                        r->format = audio_enc_ctx->sample_fmt;
                        r->nb_samples = swr_get_out_samples(swr_ctx, audio_frame->nb_samples);
                        av_frame_get_buffer(r, 0);
                        int conv = swr_convert(swr_ctx, r->data, r->nb_samples,
                                               (const uint8_t **)audio_frame->data,
                                               audio_frame->nb_samples);
                        r->nb_samples = conv;
                        r->pts = audio_frame->pts;
                        enc_af = r;
                    }
                    avcodec_send_frame(audio_enc_ctx, enc_af);
                    if (enc_af != audio_frame) av_frame_free(&enc_af);
                    while (avcodec_receive_packet(audio_enc_ctx, enc_pkt) >= 0) {
                        enc_pkt->stream_index = audio_out_idx;
                        av_packet_rescale_ts(enc_pkt, audio_enc_ctx->time_base,
                                             ofmt_ctx->streams[audio_out_idx]->time_base);
                        av_interleaved_write_frame(ofmt_ctx, enc_pkt);
                        av_packet_unref(enc_pkt);
                    }
                    av_frame_unref(audio_frame);
                }
            }
            av_packet_unref(pkt);
        } else {
            av_packet_unref(pkt);
        }
    }

flush_encoder:
    /* Flush primary video source into filter */
    if (filter_graph) {
        av_buffersrc_add_frame(buffersrc_ctxs[0], NULL);
        while (av_buffersink_get_frame(buffersink_ctx, filt_frame) >= 0) {
            filt_frame->pict_type = AV_PICTURE_TYPE_NONE;
            encode_frame(video_enc_ctx, filt_frame,
                         sws_video_ctx, conv_frame);
            while (avcodec_receive_packet(video_enc_ctx, enc_pkt) >= 0) {
                enc_pkt->stream_index = 0;
                av_packet_rescale_ts(enc_pkt, video_enc_ctx->time_base,
                                     ofmt_ctx->streams[0]->time_base);
                av_interleaved_write_frame(ofmt_ctx, enc_pkt);
                av_packet_unref(enc_pkt);
            }
            av_frame_unref(filt_frame);
        }
    }

    /* Flush video encoder */
    encode_frame(video_enc_ctx, NULL, NULL, NULL);
    while (avcodec_receive_packet(video_enc_ctx, enc_pkt) >= 0) {
        enc_pkt->stream_index = 0;
        av_packet_rescale_ts(enc_pkt, video_enc_ctx->time_base,
                             ofmt_ctx->streams[0]->time_base);
        av_interleaved_write_frame(ofmt_ctx, enc_pkt);
        av_packet_unref(enc_pkt);
    }

    /* Flush audio encoder */
    if (audio_enc_ctx) {
        avcodec_send_frame(audio_enc_ctx, NULL);
        while (avcodec_receive_packet(audio_enc_ctx, enc_pkt) >= 0) {
            enc_pkt->stream_index = audio_out_idx;
            av_packet_rescale_ts(enc_pkt, audio_enc_ctx->time_base,
                                 ofmt_ctx->streams[audio_out_idx]->time_base);
            av_interleaved_write_frame(ofmt_ctx, enc_pkt);
            av_packet_unref(enc_pkt);
        }
    }

    ret = av_write_trailer(ofmt_ctx);
    if (ret < 0) {
        snprintf(out_buf, out_buf_size, "Error writing trailer: %s", av_err2str(ret));
        goto cleanup;
    }

    send_progress(frame_count, 0, total_duration_us / 1000000.0, 0, 100.0);
    snprintf(out_buf, out_buf_size, "Success: %lld frames", (long long)frame_count);
    ret = 0;

cleanup:
    /* If ret is non-zero but no message was set, produce a structured error */
    if (ret != 0 && out_buf[0] == '\0') {
        if (ret == AVERROR_EXIT)
            snprintf(out_buf, out_buf_size, "Cancelled by user");
        else if (ret == AVERROR(ENOMEM))
            snprintf(out_buf, out_buf_size, "Out of memory");
        else if (ret == AVERROR(EINVAL))
            snprintf(out_buf, out_buf_size, "Invalid argument");
        else if (ret == AVERROR(EIO))
            snprintf(out_buf, out_buf_size, "I/O error");
        else if (ret == AVERROR_EOF)
            snprintf(out_buf, out_buf_size, "End of file");
        else
            snprintf(out_buf, out_buf_size, "FFmpeg error: %s", av_err2str(ret));
    }

    av_packet_free(&pkt);
    av_packet_free(&enc_pkt);
    av_frame_free(&frame);
    av_frame_free(&filt_frame);
    av_frame_free(&audio_frame);
    av_frame_free(&conv_frame);
    sws_freeContext(sws_video_ctx);
    av_buffer_unref(&hw_device_ctx);
    swr_free(&swr_ctx);
    free(buffersrc_ctxs);
    avfilter_graph_free(&filter_graph);
    avcodec_free_context(&video_enc_ctx);
    avcodec_free_context(&audio_enc_ctx);
    avcodec_free_context(&audio_dec_ctx);
    for (int i = 0; i < opts->num_inputs; i++) {
        avcodec_free_context(&video_dec_ctxs[i]);
        avformat_close_input(&ifmt_ctxs[i]);
    }
    if (ofmt_ctx && !(ofmt_ctx->oformat->flags & AVFMT_NOFILE))
        avio_closep(&ofmt_ctx->pb);
    avformat_free_context(ofmt_ctx);
    return ret;
}

/* ==========================================================================
 * JNI EXPORTS
 * ========================================================================== */

JNIEXPORT jint JNICALL
Java_expo_modules_ffmpeg_FFmpegBridge_nativeExecute(
    JNIEnv *env, jobject thiz, jstring command, jobject progressCallback) {

    av_log_set_callback(ffmpeg_log_callback);
    av_log_set_level(AV_LOG_INFO);
    atomic_store(&g_cancel_flag, 0);

    if (progressCallback) {
        g_progress_obj = (*env)->NewGlobalRef(env, progressCallback);
        jclass cls = (*env)->GetObjectClass(env, progressCallback);
        g_progress_method = (*env)->GetMethodID(env, cls, "onProgress", "(JDDDD)V");
        (*env)->DeleteLocalRef(env, cls);
    }

    const char *cmd = (*env)->GetStringUTFChars(env, command, NULL);
    LOGI("Executing: %s", cmd);

    ParsedArgs args = parse_command(cmd);
    CommandOptions opts = parse_options(&args);

    char out_buf[2048] = {0};
    int ret;

    /* Default thread count to 2 for low-end device safety */
    if (opts.threads == 0) opts.threads = 2;

    if (opts.num_inputs == 0 || !opts.output_path) {
        snprintf(out_buf, sizeof(out_buf), "Missing input (-i) or output path");
        ret = AVERROR(EINVAL);
    } else {
        ret = transcode(&opts, out_buf, sizeof(out_buf));
    }

    (*env)->ReleaseStringUTFChars(env, command, cmd);
    free_parsed_args(&args);

    if (g_progress_obj) {
        (*env)->DeleteGlobalRef(env, g_progress_obj);
        g_progress_obj = NULL;
        g_progress_method = NULL;
    }

    LOGI("Finished with code %d: %s", ret, out_buf);
    return ret;
}

JNIEXPORT void JNICALL
Java_expo_modules_ffmpeg_FFmpegBridge_nativeCancel(JNIEnv *env, jobject thiz) {
    LOGI("Cancel requested");
    atomic_store(&g_cancel_flag, 1);
}

JNIEXPORT jstring JNICALL
Java_expo_modules_ffmpeg_FFmpegBridge_nativeGetMediaInfo(
    JNIEnv *env, jobject thiz, jstring path) {

    av_log_set_callback(ffmpeg_log_callback);
    av_log_set_level(AV_LOG_WARNING);

    const char *fp = (*env)->GetStringUTFChars(env, path, NULL);

    AVFormatContext *ctx = NULL;
    int ret = avformat_open_input(&ctx, fp, NULL, NULL);
    if (ret < 0) {
        char buf[256];
        snprintf(buf, sizeof(buf), "{\"error\":\"Cannot open: %s\"}", av_err2str(ret));
        (*env)->ReleaseStringUTFChars(env, path, fp);
        return (*env)->NewStringUTF(env, buf);
    }

    avformat_find_stream_info(ctx, NULL);

    double duration = ctx->duration > 0 ? ctx->duration / (double)AV_TIME_BASE : 0;
    int width = 0, height = 0;
    int64_t bitrate = ctx->bit_rate;
    const char *codec = "unknown";

    for (unsigned i = 0; i < ctx->nb_streams; i++) {
        if (ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
            AVCodecParameters *cp = ctx->streams[i]->codecpar;
            width = cp->width;
            height = cp->height;
            const AVCodec *c = avcodec_find_decoder(cp->codec_id);
            if (c) codec = c->name;
            if (cp->bit_rate > 0) bitrate = cp->bit_rate;
            break;
        }
    }

    char json[1024];
    snprintf(json, sizeof(json),
             "{\"duration\":%.3f,\"width\":%d,\"height\":%d,"
             "\"codec\":\"%s\",\"bitrate\":%lld}",
             duration, width, height, codec, (long long)bitrate);

    avformat_close_input(&ctx);
    (*env)->ReleaseStringUTFChars(env, path, fp);
    return (*env)->NewStringUTF(env, json);
}
