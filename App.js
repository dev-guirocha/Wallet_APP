// App.js

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import * as Notifications from 'expo-notifications';

import WelcomeScreen from './src/screens/WelcomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import ProfessionScreen from './src/screens/ProfessionScreen';
import AppNavigator from './AppNavigator';
import SubscriptionCheckoutScreen from './src/screens/SubscriptionCheckoutScreen';
import { getMonthKey } from './src/utils/dateUtils';
import {
  configureNotificationHandling,
  requestNotificationPermissionAsync,
  rescheduleAllNotificationsAsync,
  shouldAskForNotificationPermission,
} from './src/utils/notifications';
import { loadAppData, saveAppData } from './src/utils/storage';

configureNotificationHandling();

const INITIAL_MONTH_KEY = getMonthKey();

const INITIAL_CLIENTS = [];

const CLIENT_LIMIT_FREE = 3;

const App = () => {
  const [appState, setAppState] = useState('welcome');
  const [clientTerm, setClientTerm] = useState('Cliente');
  const [planTier, setPlanTier] = useState('free');
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [activeMonth, setActiveMonth] = useState(INITIAL_MONTH_KEY);
  const [financialAdjustments, setFinancialAdjustments] = useState([]);
  const [scheduleOverrides, setScheduleOverrides] = useState({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [canAskNotifications, setCanAskNotifications] = useState(true);
  const [notificationRegistry, setNotificationRegistry] = useState({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [shouldShowCheckoutAfterAuth, setShouldShowCheckoutAfterAuth] = useState(false);
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
        if (Array.isArray(saved.adjustments)) {
          setFinancialAdjustments(saved.adjustments);
        }
        if (saved.scheduleOverrides) {
          setScheduleOverrides(saved.scheduleOverrides);
        }
        if (typeof saved.notificationsEnabled === 'boolean') {
          setNotificationsEnabled(saved.notificationsEnabled);
        }
        if (saved.notificationRegistry) {
          setNotificationRegistry(saved.notificationRegistry);
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

      const settings = await Notifications.getPermissionsAsync();
      const granted = settings?.granted || settings?.status === 'granted';
      setNotificationsEnabled(granted);
      setCanAskNotifications(settings?.canAskAgain && !granted);
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
          notificationsOptIn: client.notificationsOptIn !== false,
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
      notificationsOptIn:
        newClientData.notificationsOptIn !== undefined
          ? newClientData.notificationsOptIn
          : true,
    };

    setClients((prevClients) => [...prevClients, newClient]);
    return true;
  };

  const handleUpgradePlan = () => {
    setPlanTier('premium');
  };

  const handleDowngradePlan = () => {
    setPlanTier('free');
  };

  const handlePlanSelection = (tier) => {
    const wantsPremium = tier === 'premium';
    setShouldShowCheckoutAfterAuth(wantsPremium && planTier !== 'premium');
  };

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
    setAppState('auth');
  };

  const handleAuthSuccess = () => {
    setHasAuthenticated(true);
    setAppState(shouldShowCheckoutAfterAuth ? 'subscriptionCheckout' : 'profession');
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
          notificationsOptIn:
            updatedClientData.notificationsOptIn !== undefined
              ? updatedClientData.notificationsOptIn
              : client.notificationsOptIn,
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

  const handleRecordAdjustment = ({ amount, type, note }) => {
    const numericAmount = Number(amount);
    if (!numericAmount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      return;
    }

    const newAdjustment = {
      id: uuidv4(),
      amount: numericAmount,
      type,
      note: note?.trim() || '',
      month: activeMonth,
      createdAt: new Date().toISOString(),
    };

    setFinancialAdjustments((prev) => [newAdjustment, ...prev]);
  };

  const handleSaveOverride = (dateKey, clientId, override) => {
    setScheduleOverrides((prev) => {
      const existingForDate = prev[dateKey] ?? {};
      const updatedForDate = { ...existingForDate };

      if (!override || override.action === 'clear') {
        delete updatedForDate[clientId];
      } else {
        updatedForDate[clientId] = override;
      }

      const nextOverrides = { ...prev };
      if (Object.keys(updatedForDate).length === 0) {
        delete nextOverrides[dateKey];
      } else {
        nextOverrides[dateKey] = updatedForDate;
      }

      return nextOverrides;
    });
  };

  const handleDeleteClient = (clientId) => {
    setClients((prevClients) => prevClients.filter((client) => client.id !== clientId));

    setScheduleOverrides((prevOverrides) => {
      let changed = false;
      const nextOverrides = Object.entries(prevOverrides).reduce((acc, [dateKey, overrides]) => {
        if (overrides[clientId]) {
          changed = true;
          const { [clientId]: _removed, ...rest } = overrides;
          if (Object.keys(rest).length > 0) {
            acc[dateKey] = rest;
          }
        } else {
          acc[dateKey] = overrides;
        }
        return acc;
      }, {});

      return changed ? nextOverrides : prevOverrides;
    });

    setNotificationRegistry((prev) => {
      if (!prev || !prev[clientId]) return prev;
      prev[clientId].forEach((notificationId) => {
        Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
      });
      const { [clientId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  useEffect(() => {
    let isMounted = true;

    const syncNotifications = async () => {
      if (!notificationsEnabled) {
        await Notifications.cancelAllScheduledNotificationsAsync();
        if (isMounted) {
          setNotificationRegistry({});
        }
        return;
      }

      const registry = await rescheduleAllNotificationsAsync(clients, scheduleOverrides);
      if (isMounted) {
        setNotificationRegistry(registry || {});
      }
    };

    syncNotifications();

    return () => {
      isMounted = false;
    };
  }, [clients, scheduleOverrides, notificationsEnabled]);

  const handleRequestNotificationPermission = useCallback(async () => {
    const granted = await requestNotificationPermissionAsync();
    setNotificationsEnabled(granted);
    const canAsk = await shouldAskForNotificationPermission();
    setCanAskNotifications(canAsk);

    if (granted) {
      const registry = await rescheduleAllNotificationsAsync(clients, scheduleOverrides);
      setNotificationRegistry(registry);
    }

    return granted;
  }, [clients, scheduleOverrides]);

  useEffect(() => {
    if (!isHydrated) return;
    saveAppData({
      clients,
      adjustments: financialAdjustments,
      scheduleOverrides,
      notificationsEnabled,
      notificationRegistry,
      planTier,
      hasCompletedOnboarding,
      hasAuthenticated,
      clientTerm,
    });
  }, [clients, financialAdjustments, scheduleOverrides, notificationsEnabled, notificationRegistry, planTier, hasCompletedOnboarding, hasAuthenticated, clientTerm, isHydrated]);

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
      return (
        <OnboardingScreen
          onComplete={handleOnboardingComplete}
          onRequestNotifications={handleRequestNotificationPermission}
          notificationsEnabled={notificationsEnabled}
          canAskNotifications={canAskNotifications}
          clientLimit={CLIENT_LIMIT_FREE}
          planTier={planTier}
          onPlanSelection={handlePlanSelection}
        />
      );
    }
    if (appState === 'auth') {
      return <AuthScreen onLoginSuccess={handleAuthSuccess} />;
    }
    if (appState === 'subscriptionCheckout') {
      return (
        <SubscriptionCheckoutScreen
          onConfirm={() => {
            setShouldShowCheckoutAfterAuth(false);
            handleUpgradePlan();
            setAppState('profession');
          }}
          onCancel={() => {
            setShouldShowCheckoutAfterAuth(false);
            handleDowngradePlan();
            setAppState('profession');
          }}
        />
      );
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
        onDeleteClient={handleDeleteClient}
        onUpgradePlan={handleUpgradePlan}
        onDowngradePlan={handleDowngradePlan}
        planTier={planTier}
        clientLimit={CLIENT_LIMIT_FREE}
        onToggleClientPayment={handleToggleClientPayment}
        activeMonth={activeMonth}
        adjustments={financialAdjustments}
        scheduleOverrides={scheduleOverrides}
        onRecordAdjustment={handleRecordAdjustment}
        onSaveOverride={handleSaveOverride}
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
