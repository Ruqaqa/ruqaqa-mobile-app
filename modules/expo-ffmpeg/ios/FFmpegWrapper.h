#ifndef FFmpegWrapper_h
#define FFmpegWrapper_h

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Progress callback type.
 * Parameters: frame, fps, total_size, time_us (microseconds), speed
 */
typedef void (*ffmpeg_progress_callback)(int64_t frame, double fps, int64_t total_size, int64_t time_us, double speed);

/**
 * Execute an FFmpeg command string (space-separated arguments, like the CLI).
 * Returns 0 on success, negative on error.
 * The output_log buffer receives captured log output.
 * output_log_size is the size of the buffer.
 * output_fd: if >= 0, use this pre-opened file descriptor for the output
 * instead of opening the file via avio_open. Pass -1 to use normal avio_open.
 */
int ffmpeg_execute(const char *command,
                   ffmpeg_progress_callback progress_cb,
                   char *output_log,
                   int output_log_size,
                   int output_fd);

/**
 * Cancel the currently running FFmpeg command.
 * Safe to call from any thread.
 */
void ffmpeg_cancel(void);

/**
 * Get media info as a JSON string.
 * Caller must free() the returned string.
 * Returns NULL on error.
 *
 * JSON format:
 * {
 *   "duration": 10.5,
 *   "width": 1920,
 *   "height": 1080,
 *   "codec": "h264",
 *   "bitrate": 5000000
 * }
 */
char* ffmpeg_get_media_info(const char *path);

#ifdef __cplusplus
}
#endif

#endif /* FFmpegWrapper_h */
