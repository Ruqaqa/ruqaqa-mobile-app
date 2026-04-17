const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const DEBUG_APP_NAME = "Ruqaqa Dev";

/**
 * Writes android/app/src/debug/res/values/strings.xml so the debug build
 * overrides app_name. The launcher label becomes "Ruqaqa Dev" for debug
 * and stays "Ruqaqa" for release — easy to tell them apart on the home screen.
 */
module.exports = function withDebugAppName(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const debugResDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/debug/res/values"
      );
      fs.mkdirSync(debugResDir, { recursive: true });
      fs.writeFileSync(
        path.join(debugResDir, "strings.xml"),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name" translatable="false">${DEBUG_APP_NAME}</string>
</resources>
`
      );
      return config;
    },
  ]);
};
