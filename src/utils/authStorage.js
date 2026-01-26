import AsyncStorage from '@react-native-async-storage/async-storage';

const REMEMBER_ME_KEY = '@WalletA:rememberMe';

export const getRememberMePreference = async () => {
  try {
    const value = await AsyncStorage.getItem(REMEMBER_ME_KEY);
    if (value === null) return true;
    return value === 'true';
  } catch (error) {
    return true;
  }
};

export const setRememberMePreference = async (enabled) => {
  try {
    await AsyncStorage.setItem(REMEMBER_ME_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    // ignore persistence errors
  }
};
