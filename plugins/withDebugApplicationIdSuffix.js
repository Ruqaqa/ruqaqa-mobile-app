const { withAppBuildGradle } = require("expo/config-plugins");

const SUFFIX = '.dev';
const SUFFIX_MARKER = `applicationIdSuffix "${SUFFIX}"`;
const DEV_IP_MARKER = `resValue "string", "react_native_dev_server_ip"`;

/**
 * Adds applicationIdSuffix ".dev" to the Android debug buildType so debug
 * builds install as sa.ruqaqa.app.dev and coexist with prod.
 *
 * Also pins the debug dev-server IP to "localhost". The RN gradle plugin
 * auto-picks the first non-loopback IPv4 address, which on some hosts ends
 * up being a virtual interface the device can't reach. With USB + adb
 * reverse, localhost always works.
 */
module.exports = function withDebugApplicationIdSuffix(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes(SUFFIX_MARKER) && contents.includes(DEV_IP_MARKER)) {
      return config;
    }

    const debugBlock = /(debug\s*\{\s*\n)(\s*)(signingConfig signingConfigs\.debug)/;
    if (!debugBlock.test(contents)) {
      throw new Error(
        "withDebugApplicationIdSuffix: could not locate debug buildType in android/app/build.gradle"
      );
    }
    contents = contents.replace(
      debugBlock,
      `$1$2${SUFFIX_MARKER}\n$2resValue "string", "react_native_dev_server_ip", "localhost"\n$2$3`
    );

    config.modResults.contents = contents;
    return config;
  });
};
