const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const DEBUG_ICON_BG = "#FF6B35"; // orange — distinguishes dev launcher icon from prod white

const ADAPTIVE_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/debug_icon_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;

const COLORS_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="debug_icon_background">${DEBUG_ICON_BG}</color>
</resources>
`;

/**
 * Overrides the debug variant's adaptive icon background with a solid
 * orange color, so the dev launcher icon is easy to spot next to the
 * white prod icon. Release build is untouched.
 */
module.exports = function withDebugIconTint(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      const debugMipmapDir = path.join(platformRoot, "app/src/debug/res/mipmap-anydpi-v26");
      const debugValuesDir = path.join(platformRoot, "app/src/debug/res/values");

      fs.mkdirSync(debugMipmapDir, { recursive: true });
      fs.mkdirSync(debugValuesDir, { recursive: true });

      fs.writeFileSync(path.join(debugMipmapDir, "ic_launcher.xml"), ADAPTIVE_ICON_XML);
      fs.writeFileSync(path.join(debugMipmapDir, "ic_launcher_round.xml"), ADAPTIVE_ICON_XML);
      fs.writeFileSync(path.join(debugValuesDir, "colors.xml"), COLORS_XML);

      return config;
    },
  ]);
};
