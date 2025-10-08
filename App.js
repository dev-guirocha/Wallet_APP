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
import { getDateKey, getMonthKey } from './src/utils/dateUtils';
import { loadAppData, saveAppData, loadLastEmail, saveLastEmail } from './src/utils/storage';
import {
  configureNotificationHandling,
  requestNotificationPermissionAsync,
  shouldAskForNotificationPermission,
  rescheduleAllNotificationsAsync,
} from './src/utils/notifications';

const INITIAL_MONTH_KEY = getMonthKey();

const INITIAL_CLIENTS = [];

const CLIENT_LIMIT_FREE = 10;
const ADS_ENABLED = false;

configureNotificationHandling();

const App = () => {
  const [appState, setAppState] = useState('welcome');
  const [clientTerm, setClientTerm] = useState('Cliente');
  const [userName, setUserName] = useState('');
  const [userProfession, setUserProfession] = useState('');
  const [planTier, setPlanTier] = useState('free');
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [activeMonth, setActiveMonth] = useState(INITIAL_MONTH_KEY);
  const [scheduleOverrides, setScheduleOverrides] = useState({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);
  const [canAskNotifications, setCanAskNotifications] = useState(true);
  const [notificationRegistry, setNotificationRegistry] = useState({});
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [hasAuthenticated, setHasAuthenticated] = useState(false);
  const [currentEmail, setCurrentEmail] = useState(null);

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

      const lastEmail = await loadLastEmail();
      let saved = null;

      if (lastEmail) {
        saved = await loadAppData(lastEmail);
        if (saved) {
          setCurrentEmail(lastEmail);
        }
      }

      if (!saved) {
        saved = await loadAppData(null);
      }

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
        if (saved.userName) {
          setUserName(saved.userName);
        }
        if (saved.userProfession) {
          setUserProfession(saved.userProfession);
        }
        if (saved.scheduleOverrides) {
          setScheduleOverrides(saved.scheduleOverrides);
        }
        if (typeof saved.notificationsEnabled === 'boolean') {
          setNotificationsEnabled(saved.notificationsEnabled);
        }
        if (typeof saved.notificationPermissionGranted === 'boolean') {
          setNotificationPermissionGranted(saved.notificationPermissionGranted);
        }
        if (saved.notificationRegistry) {
          setNotificationRegistry(saved.notificationRegistry);
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
      setNotificationPermissionGranted(granted);
      if (!granted) {
        setNotificationsEnabled(false);
      }
      const canAsk = settings?.canAskAgain && !granted;
      setCanAskNotifications(canAsk);

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
          notificationsPaymentOptIn: client.notificationsPaymentOptIn !== false,
          notificationsScheduleOptIn: client.notificationsScheduleOptIn !== false,
          dayTimes: client.dayTimes || {},
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
      dayTimes: newClientData.dayTimes ? { ...newClientData.dayTimes } : {},
      notificationsPaymentOptIn:
        newClientData.notificationsPaymentOptIn !== undefined
          ? newClientData.notificationsPaymentOptIn
          : true,
      notificationsScheduleOptIn:
        newClientData.notificationsScheduleOptIn !== undefined
          ? newClientData.notificationsScheduleOptIn
          : true,
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

  const handleAuthSuccess = useCallback(
    async (profile = {}) => {
      const rawEmail = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
      if (!rawEmail) {
        return false;
      }

      let stored = await loadAppData(rawEmail);
      let isNewUser = profile?.isNewUser === true || !stored;

      if (!stored) {
        const legacy = await loadAppData(null);
        const hasLegacyData =
          legacy &&
          ((Array.isArray(legacy.clients) && legacy.clients.length > 0) ||
            (legacy.scheduleOverrides && Object.keys(legacy.scheduleOverrides).length > 0) ||
            (legacy.notificationRegistry && Object.keys(legacy.notificationRegistry).length > 0) ||
            !!legacy.hasCompletedOnboarding ||
            !!legacy.hasAuthenticated ||
            (legacy.userName && legacy.userName.trim().length > 0));

        if (hasLegacyData) {
          stored = { ...legacy };
          isNewUser = false;
          await saveAppData(null, null);
        } else {
          stored = {};
        }
      }

      const trimmedName = typeof profile.name === 'string' ? profile.name.trim() : '';
      if (trimmedName.length > 0) {
        stored.userName = trimmedName;
      }

      if (isNewUser) {
        stored.clients = [];
        stored.planTier = 'free';
        stored.clientTerm = 'Cliente';
        stored.scheduleOverrides = {};
        stored.notificationsEnabled = false;
        stored.notificationRegistry = {};
        stored.hasCompletedOnboarding = false;
        stored.hasAuthenticated = false;
        stored.userProfession = '';
        setNotificationsEnabled(false);
        shouldAskForNotificationPermission().then(setCanAskNotifications).catch(() => {});
        Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      }

      stored.hasAuthenticated = true;

      setCurrentEmail(rawEmail);
      setClients(Array.isArray(stored.clients) ? stored.clients : []);
      setPlanTier(stored.planTier || 'free');
      setClientTerm(stored.clientTerm || 'Cliente');
      setScheduleOverrides(stored.scheduleOverrides || {});
      setNotificationsEnabled(stored.notificationsEnabled ?? false);
      setNotificationRegistry(stored.notificationRegistry || {});
      setHasCompletedOnboarding(!!stored.hasCompletedOnboarding);
      setHasAuthenticated(true);
      setUserName(stored.userName || '');
      setUserProfession(stored.userProfession || '');
      setActiveMonth(getMonthKey());

      const nextAppState = isNewUser
        ? 'profession'
        : stored.hasCompletedOnboarding
          ? 'main'
          : 'onboarding';

      setAppState(nextAppState);

      await saveLastEmail(rawEmail);
      await saveAppData(
        {
          ...stored,
          clients: Array.isArray(stored.clients) ? stored.clients : [],
          planTier: stored.planTier || 'free',
          clientTerm: stored.clientTerm || 'Cliente',
          scheduleOverrides: stored.scheduleOverrides || {},
          notificationsEnabled: stored.notificationsEnabled ?? false,
          notificationRegistry: stored.notificationRegistry || {},
          hasCompletedOnboarding: !!stored.hasCompletedOnboarding,
          hasAuthenticated: true,
          userName: stored.userName || '',
          userProfession: stored.userProfession || '',
          notificationPermissionGranted,
        },
        rawEmail,
      );

      return true;
    },
    [notificationPermissionGranted],
  );

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
          dayTimes:
            updatedClientData.dayTimes !== undefined
              ? { ...updatedClientData.dayTimes }
              : client.dayTimes,
          notificationsPaymentOptIn:
            updatedClientData.notificationsPaymentOptIn !== undefined
              ? updatedClientData.notificationsPaymentOptIn
              : client.notificationsPaymentOptIn,
          notificationsScheduleOptIn:
            updatedClientData.notificationsScheduleOptIn !== undefined
              ? updatedClientData.notificationsScheduleOptIn
              : client.notificationsScheduleOptIn,
        };
      })
    );
  };

  const handleProfessionComplete = (payload) => {
    const nextTerm =
      typeof payload === 'string'
        ? payload
        : payload && typeof payload.term === 'string'
          ? payload.term
          : 'Cliente';

    const professionLabel =
      payload && typeof payload === 'object' && typeof payload.profession === 'string'
        ? payload.profession.trim()
        : '';

    setClientTerm(nextTerm);
    setUserProfession(professionLabel);
    setHasCompletedOnboarding(true);
    setAppState('main');
  };

  const handleToggleClientPayment = (clientId) => {
    const timestamp = new Date().toISOString();
    let updated = false;

    setClients((prevClients) =>
      prevClients.map((client) => {
        if (client.id !== clientId) return client;

        const payments = client.payments ?? {};
        const currentEntry = payments[activeMonth] ?? { status: 'pending', updatedAt: null };
        const nextStatus = currentEntry.status === 'paid' ? 'pending' : 'paid';
        updated = currentEntry.status !== nextStatus;

        if (!updated) {
          return client;
        }

        return {
          ...client,
          payments: {
            ...payments,
            [activeMonth]: {
              status: nextStatus,
              updatedAt: nextStatus === 'paid' ? timestamp : null,
            },
          },
        };
      }),
    );

    return updated;
  };

  const handleUpgradePlan = () => {
    setPlanTier('premium');
  };

  const handleSignOut = () => {
    setHasAuthenticated(false);
    setAppState('auth');
  };

  const updateScheduleOverrideEntry = (dateKey, clientId, updater) => {
    setScheduleOverrides((prev) => {
      const previous = prev[dateKey] ?? {};
      const currentValue = previous[clientId];
      const nextValue = typeof updater === 'function' ? updater(currentValue) : updater;

      const nextForDate = { ...previous };
      if (!nextValue || Object.keys(nextValue).length === 0) {
        delete nextForDate[clientId];
      } else {
        nextForDate[clientId] = nextValue;
      }

      const nextOverrides = { ...prev };
      if (Object.keys(nextForDate).length === 0) {
        delete nextOverrides[dateKey];
      } else {
        nextOverrides[dateKey] = nextForDate;
      }

      return nextOverrides;
    });
  };

  const handleMarkAppointmentStatus = ({ dateKey, clientId, status }) => {
    const timestamp = new Date().toISOString();
    updateScheduleOverrideEntry(dateKey, clientId, (current) => ({
      ...(current || {}),
      status,
      statusUpdatedAt: timestamp,
    }));
  };

  const handleClearAppointmentStatus = ({ dateKey, clientId }) => {
    updateScheduleOverrideEntry(dateKey, clientId, (current) => {
      if (!current) return null;
      const { status, statusUpdatedAt, ...rest } = current;
      if (Object.keys(rest).length === 0) return null;
      return rest;
    });
  };

  const handleRescheduleAppointment = ({
    client,
    originalDateKey,
    targetDate,
    newTime,
  }) => {
    if (!client || !originalDateKey || !targetDate) return;

    const targetDateKey = getDateKey(targetDate);

    // Remove from original date
    updateScheduleOverrideEntry(originalDateKey, client.id, (current) => ({
      ...(current || {}),
      action: 'remove',
      status: 'rescheduled',
      statusUpdatedAt: new Date().toISOString(),
    }));

    // Add entry on new date
    updateScheduleOverrideEntry(targetDateKey, client.id, (current) => ({
      ...(current || {}),
      action: 'add',
      name: client.name,
      location: client.location,
      time: newTime,
      status: 'rescheduled',
      statusUpdatedAt: new Date().toISOString(),
    }));
  };

  const handleDeleteClient = (clientId) => {
    setClients((prevClients) => prevClients.filter((client) => client.id !== clientId));

    setScheduleOverrides((prev) => {
      const next = {};
      Object.entries(prev).forEach(([dateKey, overrides]) => {
        if (!overrides) return;
        const { [clientId]: _removed, ...rest } = overrides;
        if (Object.keys(rest).length > 0) {
          next[dateKey] = rest;
        }
      });
      return next;
    });
  };

  const handleRequestNotificationPermission = useCallback(async () => {
    const granted = await requestNotificationPermissionAsync();
    setNotificationPermissionGranted(granted);
    const canAsk = await shouldAskForNotificationPermission();
    setCanAskNotifications(canAsk);

    if (granted) {
      setNotificationsEnabled(true);
      const registry = await rescheduleAllNotificationsAsync(clients, scheduleOverrides);
      if (registry) {
        setNotificationRegistry(registry);
      }
    } else {
      setNotificationsEnabled(false);
    }

    return granted;
  }, [clients, scheduleOverrides]);

  const handleToggleNotifications = useCallback(
    async (nextEnabled) => {
      if (nextEnabled) {
        if (!notificationPermissionGranted) {
          const granted = await handleRequestNotificationPermission();
          return granted;
        }
        setNotificationsEnabled(true);
        return true;
      }

      setNotificationsEnabled(false);
      return true;
    },
    [handleRequestNotificationPermission, notificationPermissionGranted],
  );

  useEffect(() => {
    if (!isHydrated) return;

    let isMounted = true;

    const syncNotifications = async () => {
      if (!notificationsEnabled || !notificationPermissionGranted) {
        await Notifications.cancelAllScheduledNotificationsAsync();
        if (isMounted) {
          setNotificationRegistry({});
        }
        return;
      }

      const registry = await rescheduleAllNotificationsAsync(clients, scheduleOverrides);
      if (isMounted && registry) {
        setNotificationRegistry(registry);
      }
    };

    syncNotifications();

    return () => {
      isMounted = false;
    };
  }, [clients, scheduleOverrides, notificationsEnabled, notificationPermissionGranted, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (currentEmail) {
      saveLastEmail(currentEmail);
    }
    saveAppData(
      {
        clients,
        planTier,
        hasCompletedOnboarding,
        hasAuthenticated,
        clientTerm,
        userName,
        userProfession,
        scheduleOverrides,
        notificationsEnabled,
        notificationRegistry,
        notificationPermissionGranted,
      },
      currentEmail,
    );
  }, [
    clients,
    planTier,
    hasCompletedOnboarding,
    hasAuthenticated,
    clientTerm,
    userName,
    userProfession,
    scheduleOverrides,
    notificationsEnabled,
    notificationPermissionGranted,
    notificationRegistry,
    isHydrated,
    currentEmail,
  ]);

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
        />
      );
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
        onDeleteClient={handleDeleteClient}
        activeMonth={activeMonth}
        scheduleOverrides={scheduleOverrides}
        onMarkAppointmentStatus={handleMarkAppointmentStatus}
        onClearAppointmentStatus={handleClearAppointmentStatus}
        onRescheduleAppointment={handleRescheduleAppointment}
        adsEnabled={ADS_ENABLED}
        onSignOut={handleSignOut}
        notificationsEnabled={notificationsEnabled}
        canAskNotifications={canAskNotifications}
        onRequestNotifications={handleRequestNotificationPermission}
        onToggleNotifications={handleToggleNotifications}
        notificationPermissionGranted={notificationPermissionGranted}
        onUpgradePlan={handleUpgradePlan}
        userName={userName}
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
