const {
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
  createRunOncePlugin,
} = require('@expo/config-plugins');

const pkg = require('./package.json');

function ensurePluginOptions(options = {}) {
  const warnings = [];
  if (!options || typeof options !== 'object') {
    warnings.push('plugin options must be an object');
    return { warnings, options: {} };
  }
  const normalized = {};
  if (options.iosAppId) {
    normalized.iosAppId = String(options.iosAppId);
  } else {
    warnings.push('iosAppId was not provided; ads will crash on iOS.');
  }
  if (options.androidAppId) {
    normalized.androidAppId = String(options.androidAppId);
  } else {
    warnings.push('androidAppId was not provided; ads will crash on Android.');
  }
  return { warnings, options: normalized };
}

const withGoogleMobileAdsConfig = (config, options) => {
  const { warnings, options: normalized } = ensurePluginOptions(options);
  warnings.forEach((warning) => {
    console.warn(`[google-mobile-ads config] ${warning}`);
  });

  if (normalized.iosAppId) {
    config = withInfoPlist(config, (config) => {
      config.modResults.GADApplicationIdentifier = normalized.iosAppId;
      return config;
    });
  }

  if (normalized.androidAppId) {
    config = withAndroidManifest(config, (config) => {
      const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);

      AndroidConfig.Manifest.removeMetaDataItemFromMainApplication(
        mainApplication,
        'com.google.android.gms.ads.APPLICATION_ID'
      );

      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApplication,
        'com.google.android.gms.ads.APPLICATION_ID',
        normalized.androidAppId
      );

      return config;
    });
  }

  return config;
};

module.exports = createRunOncePlugin(withGoogleMobileAdsConfig, pkg.name, pkg.version);
