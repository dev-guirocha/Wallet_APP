// Simple registry to allow the app to render ad banners without directly importing
// the AdMob SDK. When you are ready to enable ads, install `expo-ads-admob` and
// call `registerAdProvider({ Banner: AdMobBanner })` during app bootstrap.
let bannerProvider = null;
const listeners = new Set();

export const registerAdProvider = ({ Banner }) => {
  if (Banner && typeof Banner === 'function') {
    bannerProvider = Banner;
    listeners.forEach((notify) => {
      try {
        notify(bannerProvider);
      } catch (error) {
        // swallow listener errors to avoid breaking registration flow
      }
    });
  }
};

export const getRegisteredBanner = () => bannerProvider;

export const subscribeToBannerProvider = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
