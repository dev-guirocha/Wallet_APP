import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from '@firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readEnv } from './env';

const firebaseConfig = {
  apiKey:
    readEnv('EXPO_PUBLIC_FIREBASE_API_KEY', 'FIREBASE_API_KEY'),
  authDomain:
    readEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN'),
  projectId:
    readEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID'),
  storageBucket:
    readEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET'),
  messagingSenderId:
    readEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_MESSAGING_SENDER_ID'),
  appId:
    readEnv('EXPO_PUBLIC_FIREBASE_APP_ID', 'FIREBASE_APP_ID'),
  measurementId:
    readEnv('EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID', 'FIREBASE_MEASUREMENT_ID'),
};

const hasRequiredFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let firebaseInitError = null;
let app = null;
let auth = null;
let db = null;
let storage = null;

if (hasRequiredFirebaseConfig) {
  try {
    const hasApps = getApps().length > 0;
    app = hasApps ? getApps()[0] : initializeApp(firebaseConfig);

    if (hasApps) {
      auth = getAuth(app);
    } else {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }

    try {
      db = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      });
    } catch (firestoreInitError) {
      db = getFirestore(app);
    }
    storage = getStorage(app);
  } catch (error) {
    firebaseInitError = error;
  }
}

export const isFirebaseConfigured = Boolean(
  hasRequiredFirebaseConfig && !firebaseInitError && app && auth && db && storage,
);
export { app, auth, db, storage, firebaseInitError };
