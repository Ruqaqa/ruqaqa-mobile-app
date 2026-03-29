const { withAndroidManifest } = require("expo/config-plugins");

function withShareIntent(config) {
  return withAndroidManifest(config, (config) => {
    const mainActivity =
      config.modResults.manifest.application[0].activity?.find(
        (a) => a.$["android:name"] === ".MainActivity"
      );

    if (!mainActivity) return config;

    if (!mainActivity["intent-filter"]) {
      mainActivity["intent-filter"] = [];
    }

    const intentFilters = mainActivity["intent-filter"];

    // Single image share
    intentFilters.push({
      action: [{ $: { "android:name": "android.intent.action.SEND" } }],
      category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
      data: [{ $: { "android:mimeType": "image/*" } }],
    });

    // Multiple image share
    intentFilters.push({
      action: [{ $: { "android:name": "android.intent.action.SEND_MULTIPLE" } }],
      category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
      data: [{ $: { "android:mimeType": "image/*" } }],
    });

    // Single PDF share
    intentFilters.push({
      action: [{ $: { "android:name": "android.intent.action.SEND" } }],
      category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
      data: [{ $: { "android:mimeType": "application/pdf" } }],
    });

    // Multiple PDF share
    intentFilters.push({
      action: [{ $: { "android:name": "android.intent.action.SEND_MULTIPLE" } }],
      category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
      data: [{ $: { "android:mimeType": "application/pdf" } }],
    });

    return config;
  });
}

module.exports = withShareIntent;
