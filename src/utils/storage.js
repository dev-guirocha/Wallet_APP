import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'walletapp:data:v1';

export async function loadAppData() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('[storage] Failed to load persisted data', error);
    return null;
  }
}

export async function saveAppData(payload) {
  try {
    if (!payload) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return true;
    }
    const serialized = JSON.stringify(payload);
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (error) {
    console.warn('[storage] Failed to persist data', error);
    return false;
  }
}
