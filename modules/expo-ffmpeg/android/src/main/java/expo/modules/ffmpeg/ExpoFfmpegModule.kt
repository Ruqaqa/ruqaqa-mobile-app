package expo.modules.ffmpeg

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class ExpoFfmpegModule : Module() {

    companion object {
        private const val PROGRESS_EVENT = "onProgress"
    }

    override fun definition() = ModuleDefinition {
        Name("ExpoFfmpeg")

        Events(PROGRESS_EVENT)

        // Expo's AsyncFunction already dispatches on a background coroutine (modulesQueue),
        // so blocking JNI calls here won't block the main/UI thread.
        AsyncFunction("execute") { command: String ->
            val startTime = System.currentTimeMillis()

            val callback = object : FFmpegBridge.ProgressCallback {
                override fun onProgress(
                    frame: Long,
                    fps: Double,
                    time: Double,
                    speed: Double,
                    percentage: Double
                ) {
                    this@ExpoFfmpegModule.sendEvent(PROGRESS_EVENT, mapOf(
                        "frame" to frame.toInt(),
                        "fps" to fps,
                        "time" to time,
                        "speed" to speed,
                        "percentage" to percentage
                    ))
                }
            }

            val returnCode = FFmpegBridge.nativeExecute(command, callback)
            val duration = System.currentTimeMillis() - startTime
            val output = if (returnCode == 0) "Success" else "Failed with code $returnCode"

            mapOf(
                "returnCode" to returnCode,
                "output" to output,
                "duration" to duration
            )
        }

        Function("cancel") {
            FFmpegBridge.nativeCancel()
        }

        AsyncFunction("getMediaInfo") { path: String ->
            val jsonStr = FFmpegBridge.nativeGetMediaInfo(path)
            val json = JSONObject(jsonStr)

            if (json.has("error")) {
                throw Exception(json.getString("error"))
            }

            mapOf(
                "duration" to json.getDouble("duration"),
                "width" to json.getInt("width"),
                "height" to json.getInt("height"),
                "codec" to json.getString("codec"),
                "bitrate" to json.getLong("bitrate")
            )
        }
    }
}
