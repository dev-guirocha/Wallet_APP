import 'react-native-gesture-handler';

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
import { getDocs, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { endOfDay, formatCurrency, getDateKey, parseTimeLabelParts, startOfDay } from './src/utils/dateUtils';
import { getAppointmentsForDate } from './src/utils/schedule';
import WidgetBridge from './src/native/WidgetBridge';
import {
  cancelChargeNotifications,
  configureChargeNotifications,
  scheduleChargeNotifications,
} from './src/services/notificationService';
import {
  ensureUserDefaults,
  ensureReceivablesForClients,
  migrateLocalDataToFirestore,
} from './src/utils/firestoreService';
import {
  userAppointmentsCollection,
  userClientsCollection,
  userDocRef,
  userExpensesCollection,
  userReceivablesCollection,
} from './src/utils/firestoreRefs';

const APP_STATE_KEY = '@WalletA:appState';
const PREMIUM_EMAIL = 'dev.guirocha@gmail.com';

const buildUpcomingAppointmentsForWidget = ({ clients = [], overrides = {} }) => {
  const now = new Date();
  const appointments = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    const daily = getAppointmentsForDate({ date, clients, overrides });
    daily.forEach((appointment) => {
      const { hour, minute } = parseTimeLabelParts(appointment.time, 0, 0);
      const startAt = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        hour,
        minute,
        0,
        0
      );
      if (offset === 0 && startAt < now) return;
      appointments.push({ startAt, name: appointment.name });
    });
  }

  appointments.sort((a, b) => a.startAt - b.startAt);
  return appointments.slice(0, 3).map((item) => ({
    time: item.startAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    name: item.name,
  }));
};

const App = () => {
  const [appState, setAppState] = useState('loading');
  const [pendingProfile, setPendingProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const clients = useClientStore((state) => state.clients);
  const scheduleOverrides = useClientStore((state) => state.scheduleOverrides);
  const notificationsEnabled = useClientStore((state) => state.notificationsEnabled);
  const setPlanTier = useClientStore((state) => state.setPlanTier);
  const userEmail = useClientStore((state) => state.userEmail);
  const userName = useClientStore((state) => state.userName);
  const userPhone = useClientStore((state) => state.userPhone);
  const userProfession = useClientStore((state) => state.userProfession);
  const userBirthdate = useClientStore((state) => state.userBirthdate);
  const setCurrentUserId = useClientStore((state) => state.setCurrentUserId);
  const setClients = useClientStore((state) => state.setClients);
  const setExpenses = useClientStore((state) => state.setExpenses);
  const setUserDoc = useClientStore((state) => state.setUserDoc);
  const setScheduleOverrides = useClientStore((state) => state.setScheduleOverrides);

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
    try {
      configureNotificationHandling();
    } catch (error) {
      // ignore notification handler setup errors
    }
    try {
      configureChargeNotifications();
    } catch (error) {
      // ignore charge notification setup errors
    }
  }, []);

  useEffect(() => {
    let active = true;

    const syncNotifications = async () => {
      try {
        const { granted } = await getNotificationPermissionStatus();
        if (!active) return;
        if (!notificationsEnabled || !granted) {
          await cancelAllNotificationsAsync();
          return;
        }
        await rescheduleAllNotificationsAsync(clients, scheduleOverrides);
      } catch (error) {
        // ignore notification scheduling errors
      }
    };

    syncNotifications();

    return () => {
      active = false;
    };
  }, [clients, notificationsEnabled, scheduleOverrides]);

  useEffect(() => {
    if (!authUser?.uid) return;
    if (!notificationsEnabled) {
      cancelChargeNotifications();
      return;
    }

    scheduleChargeNotifications({ uid: authUser.uid }).catch(() => {});
  }, [authUser, notificationsEnabled]);

  useEffect(() => {
    if (!authUser?.uid) return;

    let active = true;
    const updateWidgetData = async () => {
      try {
        const uid = authUser.uid;
        const today = new Date();
        const rangeStart = startOfDay(today);
        const rangeEnd = endOfDay(today);

        const receivablesQuery = query(
          userReceivablesCollection(uid),
          where('paid', '==', false),
          where('dueDate', '>=', Timestamp.fromDate(rangeStart)),
          where('dueDate', '<=', Timestamp.fromDate(rangeEnd)),
          orderBy('dueDate', 'asc')
        );
        const snapshot = await getDocs(receivablesQuery);
        const total = snapshot.docs.reduce((sum, doc) => {
          const amount = Number(doc.data()?.amount || 0);
          return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);

        if (!active) return;
        const appointments = buildUpcomingAppointmentsForWidget({
          clients,
          overrides: scheduleOverrides,
        });

        WidgetBridge.updateWidget({
          totalToday: formatCurrency(total),
          appointments,
        });
      } catch (error) {
        // ignore widget update errors
      }
    };

    updateWidgetData();

    return () => {
      active = false;
    };
  }, [authUser, clients, scheduleOverrides]);

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
    if (!authUser?.uid) {
      setCurrentUserId(null);
      setClients([]);
      setExpenses([]);
      setScheduleOverrides({});
      return;
    }

    let unsubscribeUser = () => {};
    let unsubscribeClients = () => {};
    let unsubscribeExpenses = () => {};
    let unsubscribeAppointments = () => {};
    let active = true;

    const bootstrapFirestore = async () => {
      const uid = authUser.uid;
      setCurrentUserId(uid);

      const localState = useClientStore.getState();
      try {
        await migrateLocalDataToFirestore({ uid, localState });
        await ensureUserDefaults({
          uid,
          profile: {
            name: localState.userName,
            email: localState.userEmail,
            phone: localState.userPhone,
            birthdate: localState.userBirthdate,
            profession: localState.userProfession,
            privacy: { hideBalances: localState.privacyHideBalances },
            templates: localState.templates,
          },
        });
      } catch (error) {
        // ignore bootstrap errors
      }

      if (!active) return;

      unsubscribeUser = onSnapshot(
        userDocRef(uid),
        (snapshot) => {
          if (!snapshot.exists()) return;
          setUserDoc(snapshot.data());
        },
        () => {}
      );

      unsubscribeClients = onSnapshot(
        userClientsCollection(uid),
        (snapshot) => {
          const items = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((client) => !client.deletedAt);
          setClients(items);
          ensureReceivablesForClients({ uid, clients: items }).catch(() => {});
        },
        () => {}
      );

      unsubscribeExpenses = onSnapshot(
        userExpensesCollection(uid),
        (snapshot) => {
          const items = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((expense) => !expense.deletedAt);
          setExpenses(items);
        },
        () => {}
      );

      const today = new Date();
      const rangeStart = startOfDay(today);
      const rangeEnd = endOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90));

      const appointmentQuery = query(
        userAppointmentsCollection(uid),
        where('startAt', '>=', Timestamp.fromDate(rangeStart)),
        where('startAt', '<=', Timestamp.fromDate(rangeEnd)),
        orderBy('startAt', 'asc')
      );

      unsubscribeAppointments = onSnapshot(
        appointmentQuery,
        (snapshot) => {
          const overrides = {};
          const latestOverrideByKey = {};

          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            const startAtDate = data.startAt?.toDate?.() || null;
            const startAtMs = startAtDate ? startAtDate.getTime() : 0;
            const dateKey = data.dateKey || (startAtDate ? getDateKey(startAtDate) : null);
            const clientId = data.clientId;
            if (!dateKey || !clientId) return;

            const action = data.action;
            const status = data.status;
            const hasPendingWrites = doc.metadata.hasPendingWrites;
            const updatedAtDate =
              data.updatedAt?.toDate?.() ||
              (data.updatedAt ? new Date(data.updatedAt) : null) ||
              startAtDate;
            const updatedAtMs = updatedAtDate ? updatedAtDate.getTime() : 0;
            const overrideKey = `${dateKey}:${clientId}`;

            const priority =
              action === 'skip' || action === 'cancel' || action === 'remove'
                ? 3
                : status === 'rescheduled'
                  ? 1
                  : 2;

            const existing = latestOverrideByKey[overrideKey];
            const shouldReplace = (() => {
              if (!existing) return true;
              if (hasPendingWrites && !existing.hasPendingWrites) return true;
              if (!hasPendingWrites && existing.hasPendingWrites) return false;
              if (priority > existing.priority) return true;
              if (priority < existing.priority) return false;
              if (updatedAtMs > existing.updatedAtMs) return true;
              if (updatedAtMs < existing.updatedAtMs) return false;
              return startAtMs > existing.startAtMs;
            })();

            if (!shouldReplace) return;

            latestOverrideByKey[overrideKey] = {
              priority,
              updatedAtMs,
              startAtMs,
              hasPendingWrites,
            };

            if (!overrides[dateKey]) overrides[dateKey] = {};
            overrides[dateKey][clientId] = {
              action: data.action,
              name: data.name,
              time: data.time,
              location: data.location,
              note: data.note,
              status: data.status,
              statusUpdatedAt: data.statusUpdatedAt?.toDate?.() || data.statusUpdatedAt || null,
              rescheduledTo: data.rescheduledTo?.toDate?.() || data.rescheduledTo || null,
              confirmationSentAt:
                data.confirmationSentAt?.toDate?.() || data.confirmationSentAt || null,
            };
          });

          setScheduleOverrides(overrides);
        },
        () => {}
      );
    };

    bootstrapFirestore();

    return () => {
      active = false;
      unsubscribeUser();
      unsubscribeClients();
      unsubscribeExpenses();
      unsubscribeAppointments();
    };
  }, [authUser, setClients, setCurrentUserId, setExpenses, setScheduleOverrides, setUserDoc]);

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

  const linking = {
    prefixes: ['myapp://'],
    config: {
      screens: {
        MainTabs: {
          screens: {
            Agenda: 'agenda',
          },
        },
        CobrancasHoje: 'charges',
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <AppNavigator onSignOut={handleSignOut} />
    </NavigationContainer>
  );
};

export default App;
