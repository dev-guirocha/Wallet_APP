import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from '@firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

const firebaseConfig = {
  apiKey:
    Config.EXPO_PUBLIC_FIREBASE_API_KEY ||
    Config.FIREBASE_API_KEY,
  authDomain:
    Config.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    Config.FIREBASE_AUTH_DOMAIN,
  projectId:
    Config.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    Config.FIREBASE_PROJECT_ID,
  storageBucket:
    Config.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    Config.FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    Config.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    Config.FIREBASE_MESSAGING_SENDER_ID,
  appId:
    Config.EXPO_PUBLIC_FIREBASE_APP_ID ||
    Config.FIREBASE_APP_ID,
  measurementId:
    Config.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID ||
    Config.FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

const hasApps = getApps().length > 0;
const app = hasApps ? getApps()[0] : initializeApp(firebaseConfig);

let auth;
if (hasApps) {
  auth = getAuth(app);
} else {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
