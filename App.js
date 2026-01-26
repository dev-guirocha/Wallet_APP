// App.js

import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import WelcomeScreen from './src/screens/WelcomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import AppNavigator from './AppNavigator';
import { COLORS } from './src/constants/theme';
import { useClientStore } from './src/store/useClientStore';
import { auth } from './src/utils/firebase';
import {
  cancelAllNotificationsAsync,
  configureNotificationHandling,
  getNotificationPermissionStatus,
  rescheduleAllNotificationsAsync,
} from './src/utils/notifications';
import { getRememberMePreference } from './src/utils/authStorage';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const APP_STATE_KEY = '@WalletA:appState';
const PREMIUM_EMAIL = 'dev.guirocha@gmail.com';

const App = () => {
  const [appState, setAppState] = useState('loading');
  const [pendingProfile, setPendingProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const clients = useClientStore((state) => state.clients);
  const notificationsEnabled = useClientStore((state) => state.notificationsEnabled);
  const setPlanTier = useClientStore((state) => state.setPlanTier);
  const userEmail = useClientStore((state) => state.userEmail);
  const userName = useClientStore((state) => state.userName);
  const userPhone = useClientStore((state) => state.userPhone);
  const userProfession = useClientStore((state) => state.userProfession);
  const userBirthdate = useClientStore((state) => state.userBirthdate);

  useEffect(() => {
    const initApp = async () => {
      try {
        const savedAppState = await AsyncStorage.getItem(APP_STATE_KEY);
        if (savedAppState === 'profession') {
          setAppState('profile');
        } else {
          setAppState(savedAppState || 'welcome');
        }
      } catch (e) {
        console.error('Erro na inicialização', e);
        setAppState('welcome');
      }
    };

    initApp();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const rememberMe = await getRememberMePreference();
      if (!rememberMe && user) {
        await signOut(auth);
        setAuthUser(null);
        setAuthReady(true);
        return;
      }
      setAuthUser(user);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    configureNotificationHandling();
  }, []);

  useEffect(() => {
    let active = true;

    const syncNotifications = async () => {
      const { granted } = await getNotificationPermissionStatus();
      if (!active) return;
      if (!notificationsEnabled || !granted) {
        await cancelAllNotificationsAsync();
        return;
      }
      await rescheduleAllNotificationsAsync(clients);
    };

    syncNotifications();

    return () => {
      active = false;
    };
  }, [clients, notificationsEnabled]);

  const persistAppState = async (nextState) => {
    setAppState(nextState);
    try {
      await AsyncStorage.setItem(APP_STATE_KEY, nextState);
    } catch (e) {
      // ignore persistence errors for state flow
    }
  };

  const handleProfileComplete = () => {
    setPendingProfile(null);
    persistAppState('main');
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      // ignore sign out errors
    }
    setPendingProfile(null);
    persistAppState('auth');
  };

  const hasStoredProfile = Boolean(
    userName && userEmail && userPhone && userProfession && userBirthdate
  );
  const authEmail = authUser?.email?.toLowerCase();
  const storedEmail = userEmail?.toLowerCase();
  const emailMatches = authEmail && storedEmail && authEmail === storedEmail;
  const needsProfile = Boolean(authUser && (!hasStoredProfile || !emailMatches));

  useEffect(() => {
    if (!authUser?.email) return;
    if (authUser.email.toLowerCase() === PREMIUM_EMAIL) {
      setPlanTier('pro');
    }
  }, [authUser, setPlanTier]);

  useEffect(() => {
    if (authUser && needsProfile) {
      setPendingProfile((prev) => ({
        email: prev?.email || authUser.email || '',
        name: prev?.name || authUser.displayName || '',
      }));
    }
  }, [authUser, needsProfile]);

  if (appState === 'loading' || !authReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (appState === 'welcome') {
    return <WelcomeScreen onContinue={() => persistAppState('onboarding')} />;
  }
  if (appState === 'onboarding') {
    return <OnboardingScreen onComplete={() => persistAppState('auth')} />;
  }
  if (!authUser) {
    return (
      <AuthScreen
        onLoginSuccess={(profile) => {
          setPendingProfile(profile || null);
          persistAppState('main');
        }}
      />
    );
  }
  if (needsProfile) {
    return (
      <ProfileSetupScreen
        initialProfile={pendingProfile}
        onComplete={handleProfileComplete}
      />
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <AppNavigator onSignOut={handleSignOut} />
    </NavigationContainer>
  );
};

export default App;
