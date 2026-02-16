import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PREFIX = 'flowdesk:data:v1';
const LEGACY_STORAGE_KEY_PREFIX = 'walletapp:data:v1';
const LAST_EMAIL_KEY = 'flowdesk:last-email';
const LEGACY_LAST_EMAIL_KEY = 'walletapp:last-email';

const buildStorageKey = (email) =>
  email && typeof email === 'string' && email.length > 0
    ? `${STORAGE_KEY_PREFIX}:${email}`
    : STORAGE_KEY_PREFIX;

const buildLegacyStorageKey = (email) =>
  email && typeof email === 'string' && email.length > 0
    ? `${LEGACY_STORAGE_KEY_PREFIX}:${email}`
    : LEGACY_STORAGE_KEY_PREFIX;

export async function loadAppData(email) {
  try {
    const key = buildStorageKey(email);
    let raw = await AsyncStorage.getItem(key);
    if (!raw) {
      raw = await AsyncStorage.getItem(buildLegacyStorageKey(email));
      if (raw) {
        await AsyncStorage.setItem(key, raw);
      }
    }
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
    let value = await AsyncStorage.getItem(LAST_EMAIL_KEY);
    if (!value) {
      value = await AsyncStorage.getItem(LEGACY_LAST_EMAIL_KEY);
      if (value) {
        await AsyncStorage.setItem(LAST_EMAIL_KEY, value);
      }
    }
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
