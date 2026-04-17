const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const DEBUG_SCHEME = "ruqaqa-dev";

/**
 * Adds a debug-only intent-filter for ruqaqa-dev:// on MainActivity via
 * android/app/src/debug/AndroidManifest.xml. The release build keeps only
 * ruqaqa://. The debug JS uses the ruqaqa-dev scheme for OAuth so the
 * callback is routed to the dev app exclusively (no chooser when prod is
 * installed alongside).
 *
 * The main manifest is untouched so Expo CLI can launch the dev client via
 * the ruqaqa:// scheme it reads from app.json.
 */
module.exports = function withDebugScheme(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const debugManifestDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/debug"
      );
      fs.mkdirSync(debugManifestDir, { recursive: true });

      // Keep usesCleartextTraffic="true" so Metro over HTTP works — Expo's
      // default debug manifest sets this, and writing our own here would
      // otherwise clobber it and break dev bundle loading on Android 9+.
      const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          xmlns:tools="http://schemas.android.com/tools">
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
    <application
        android:usesCleartextTraffic="true"
        tools:targetApi="28"
        tools:ignore="GoogleAppIndexingWarning"
        tools:replace="android:usesCleartextTraffic">
        <activity android:name=".MainActivity" tools:node="merge">
            <intent-filter>
                <action android:name="android.intent.action.VIEW"/>
                <category android:name="android.intent.category.DEFAULT"/>
                <category android:name="android.intent.category.BROWSABLE"/>
                <data android:scheme="${DEBUG_SCHEME}"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
`;

      fs.writeFileSync(path.join(debugManifestDir, "AndroidManifest.xml"), manifest);
      return config;
    },
  ]);
};
