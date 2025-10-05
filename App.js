// App.js

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import WelcomeScreen from './src/screens/WelcomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import ProfessionScreen from './src/screens/ProfessionScreen';
import AppNavigator from './AppNavigator';
import { getMonthKey } from './src/utils/dateUtils';
import { loadAppData, saveAppData } from './src/utils/storage';

const INITIAL_MONTH_KEY = getMonthKey();

const INITIAL_CLIENTS = [];

const CLIENT_LIMIT_FREE = 3;

const App = () => {
  const [appState, setAppState] = useState('welcome');
  const [clientTerm, setClientTerm] = useState('Cliente');
  const [planTier, setPlanTier] = useState('free');
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [activeMonth, setActiveMonth] = useState(INITIAL_MONTH_KEY);
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [hasAuthenticated, setHasAuthenticated] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentKey = getMonthKey();
      setActiveMonth((prev) => (prev === currentKey ? prev : currentKey));
    }, 1000 * 60 * 60);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      let nextAppState = 'welcome';
      const saved = await loadAppData();
      if (saved) {
        if (Array.isArray(saved.clients)) {
          setClients(saved.clients);
        }
        if (saved.planTier) {
          setPlanTier(saved.planTier);
        }
        if (saved.clientTerm) {
          setClientTerm(saved.clientTerm);
        }
        if (saved.hasCompletedOnboarding) {
          setHasCompletedOnboarding(true);
          nextAppState = 'auth';
        }
        if (saved.hasAuthenticated) {
          setHasAuthenticated(true);
          nextAppState = 'main';
        }
      }

      setAppState(nextAppState);
      setIsHydrated(true);
    };

    hydrate();
  }, []);

  useEffect(() => {
    setClients((prevClients) => {
      let requiresUpdate = false;

      const updatedClients = prevClients.map((client) => {
        const payments = client.payments ?? {};

        if (payments[activeMonth]) {
          return client;
        }

        requiresUpdate = true;

        return {
          ...client,
          payments: {
            ...payments,
            [activeMonth]: {
              status: 'pending',
              updatedAt: null,
            },
          },
        };
      });

      return requiresUpdate ? updatedClients : prevClients;
    });
  }, [activeMonth]);

  const clientsForUI = useMemo(
    () =>
      clients.map((client) => {
        const payments = client.payments ?? {};
        const paymentEntry = payments[activeMonth] ?? { status: 'pending' };
        const isPaid = paymentEntry.status === 'paid';
        const dueDayLabel = client.dueDay ? `Vence dia ${client.dueDay}` : 'Pendente neste mês';

        return {
          ...client,
          value: Number(client.value || 0),
          payments,
          paymentStatus: paymentEntry.status,
          paymentUpdatedAt: paymentEntry.updatedAt,
          status: isPaid ? 'Pago' : dueDayLabel,
          statusColor: isPaid ? '#5CB85C' : '#F0AD4E',
        };
      }),
    [clients, activeMonth],
  );

  const handleAddClient = (newClientData) => {
    if (planTier === 'free' && clients.length >= CLIENT_LIMIT_FREE) {
      return false;
    }

    const normalizedValue = Number(String(newClientData.value || '0').replace(',', '.')) || 0;
    const sanitizedDays = Array.isArray(newClientData.days) ? newClientData.days : [];
    const dueDay = String(newClientData.dueDay || '').trim();

    const newClient = {
      id: uuidv4(),
      name: newClientData.name,
      location: newClientData.location,
      days: sanitizedDays,
      time: newClientData.time,
      value: normalizedValue,
      dueDay,
      payments: {
        [activeMonth]: {
          status: 'pending',
          updatedAt: null,
        },
      },
    };

    setClients((prevClients) => [...prevClients, newClient]);
    return true;
  };

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
    setAppState('auth');
  };

  const handleAuthSuccess = () => {
    setHasAuthenticated(true);
    setAppState('profession');
  };

  const handleUpdateClient = (clientId, updatedClientData) => {
    setClients((prevClients) =>
      prevClients.map((client) => {
        if (client.id !== clientId) return client;

        const normalizedValue =
          updatedClientData.value !== undefined
            ? Number(String(updatedClientData.value).replace(',', '.')) || 0
            : client.value;

        return {
          ...client,
          name: updatedClientData.name ?? client.name,
          location: updatedClientData.location ?? client.location,
          days: Array.isArray(updatedClientData.days) ? updatedClientData.days : client.days,
          time: updatedClientData.time ?? client.time,
          value: normalizedValue,
          dueDay:
            updatedClientData.dueDay !== undefined
              ? String(updatedClientData.dueDay || '').trim()
              : client.dueDay,
        };
      })
    );
  };

  const handleProfessionComplete = (term) => {
    setClientTerm(term);
    setAppState('main');
  };

  const handleToggleClientPayment = (clientId) => {
    const timestamp = new Date().toISOString();

    setClients((prevClients) =>
      prevClients.map((client) => {
        if (client.id !== clientId) return client;

        const payments = client.payments ?? {};
        const currentEntry = payments[activeMonth] ?? { status: 'pending', updatedAt: null };
        const nextStatus = currentEntry.status === 'paid' ? 'pending' : 'paid';

        return {
          ...client,
          payments: {
            ...payments,
            [activeMonth]: {
              status: nextStatus,
              updatedAt: timestamp,
            },
          },
        };
      }),
    );
  };

  useEffect(() => {
    if (!isHydrated) return;
    saveAppData({
      clients,
      planTier,
      hasCompletedOnboarding,
      hasAuthenticated,
      clientTerm,
    });
  }, [clients, planTier, hasCompletedOnboarding, hasAuthenticated, clientTerm, isHydrated]);

  if (!isHydrated) {
    return (
      <View style={appStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E1E1E" />
      </View>
    );
  }

  if (appState !== 'main') {
    if (appState === 'welcome') {
      return (
        <WelcomeScreen
          onContinue={() => setAppState(hasCompletedOnboarding ? 'auth' : 'onboarding')}
        />
      );
    }
    if (appState === 'onboarding') {
      return <OnboardingScreen onComplete={handleOnboardingComplete} />;
    }
    if (appState === 'auth') {
      return <AuthScreen onLoginSuccess={handleAuthSuccess} />;
    }
    if (appState === 'profession') return <ProfessionScreen onComplete={handleProfessionComplete} />;
  }

  return (
    <NavigationContainer>
      <AppNavigator
        clientTerm={clientTerm}
        clients={clientsForUI}
        onAddClient={handleAddClient}
        onUpdateClient={handleUpdateClient}
        planTier={planTier}
        clientLimit={CLIENT_LIMIT_FREE}
        onToggleClientPayment={handleToggleClientPayment}
        activeMonth={activeMonth}
      />
    </NavigationContainer>
  );
};

export default App;

const appStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4E2DD',
  },
});
