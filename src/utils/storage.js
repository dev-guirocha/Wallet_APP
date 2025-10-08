import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PREFIX = 'walletapp:data:v1';
const LAST_EMAIL_KEY = 'walletapp:last-email';

const buildStorageKey = (email) =>
  email && typeof email === 'string' && email.length > 0
    ? `${STORAGE_KEY_PREFIX}:${email}`
    : STORAGE_KEY_PREFIX;

export async function loadAppData(email) {
  try {
    const raw = await AsyncStorage.getItem(buildStorageKey(email));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('[storage] Failed to load persisted data', error);
    return null;
  }
}

export async function saveAppData(payload, email) {
  try {
    if (!payload) {
      await AsyncStorage.removeItem(buildStorageKey(email));
      return true;
    }
    const serialized = JSON.stringify(payload);
    await AsyncStorage.setItem(buildStorageKey(email), serialized);
    return true;
  } catch (error) {
    console.warn('[storage] Failed to persist data', error);
    return false;
  }
}

export async function loadLastEmail() {
  try {
    const value = await AsyncStorage.getItem(LAST_EMAIL_KEY);
    return value || null;
  } catch (error) {
    console.warn('[storage] Failed to load last email', error);
    return null;
  }
}

export async function saveLastEmail(email) {
  try {
    if (!email) {
      await AsyncStorage.removeItem(LAST_EMAIL_KEY);
    } else {
      await AsyncStorage.setItem(LAST_EMAIL_KEY, email);
    }
    return true;
  } catch (error) {
    console.warn('[storage] Failed to persist last email', error);
    return false;
  }
}
