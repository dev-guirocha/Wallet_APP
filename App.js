// App.js

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

const APP_STATE_KEY = '@WalletA:appState';

const App = () => {
  const [appState, setAppState] = useState('loading');
  const [planTier, setPlanTier] = useState('free');
  const [pendingProfile, setPendingProfile] = useState(null);

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

  const handleUpgradePlan = () => {
    setPlanTier('pro');
    alert('Plano atualizado para PRO (Simulação)');
  };

  const handleSignOut = () => {
    persistAppState('welcome');
  };

  if (appState === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (appState !== 'main') {
    if (appState === 'welcome') {
      return <WelcomeScreen onContinue={() => persistAppState('onboarding')} />;
    }
    if (appState === 'onboarding') {
      return <OnboardingScreen onComplete={() => persistAppState('auth')} />;
    }
    if (appState === 'auth') {
      return (
        <AuthScreen
          onLoginSuccess={(profile) => {
            setPendingProfile(profile || null);
            persistAppState('profile');
          }}
        />
      );
    }
    if (appState === 'profile') {
      return (
        <ProfileSetupScreen
          initialProfile={pendingProfile}
          onComplete={handleProfileComplete}
        />
      );
    }
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <AppNavigator
        planTier={planTier}
        onUpgradePlan={handleUpgradePlan}
        onSignOut={handleSignOut}
      />
    </NavigationContainer>
  );
};

export default App;
