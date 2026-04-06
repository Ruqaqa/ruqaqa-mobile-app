package expo.modules.ffmpeg

import android.util.Log

/**
 * JNI bridge to the native FFmpeg library.
 * Native methods are implemented in cpp/ffmpeg_jni.c.
 */
object FFmpegBridge {

    private const val TAG = "FFmpegBridge"

    init {
        try {
            // Load FFmpeg shared libraries in dependency order.
            // avutil is the base, then each lib that depends on it.
            System.loadLibrary("avutil")
            System.loadLibrary("swresample")
            System.loadLibrary("avcodec")
            System.loadLibrary("swscale")
            System.loadLibrary("avformat")
            System.loadLibrary("avfilter")
            // Load our JNI bridge last (it links against all of the above)
            System.loadLibrary("ffmpeg-jni")
            Log.i(TAG, "All FFmpeg libraries loaded successfully")
        } catch (e: UnsatisfiedLinkError) {
            Log.e(TAG, "Failed to load FFmpeg native libraries", e)
            throw e
        }
    }

    /**
     * Callback interface for progress reporting from native code.
     * Called from the native thread via JNI.
     */
    interface ProgressCallback {
        fun onProgress(frame: Long, fps: Double, time: Double, speed: Double, percentage: Double)
    }

    /**
     * Execute an FFmpeg command string.
     * Supports: -i input -vf filter -c:v codec -b:v bitrate -crf N -preset P -an -threads N output
     *
     * @param command The FFmpeg command string (without the leading "ffmpeg")
     * @param progressCallback Optional callback for progress updates
     * @return FFmpeg return code (0 = success)
     */
    external fun nativeExecute(command: String, progressCallback: ProgressCallback?): Int

    /**
     * Cancel the currently running FFmpeg execution.
     */
    external fun nativeCancel()

    /**
     * Get media information for a file.
     *
     * @param path Absolute path to the media file
     * @return JSON string with duration, width, height, codec, bitrate
     */
    external fun nativeGetMediaInfo(path: String): String
}
