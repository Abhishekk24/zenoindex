const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Privy's SDK imports `jose`, whose default export is the Node build (needs
// `buffer`/`crypto`); React Native must get its browser build instead.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jose') {
    const browser = { ...context, unstable_conditionNames: ['browser'] };
    return browser.resolveRequest(browser, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
