import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import {
  deleteClientFromFirestore,
  deleteExpenseFromFirestore,
  upsertClient,
  upsertExpense,
  upsertReceivableForClient,
  upsertReceivableForMonth,
} from '../utils/firestoreService';

const normalizePaymentStatus = (entry) => {
  if (!entry) return 'pending';
  const rawStatus = typeof entry === 'string' ? entry : entry?.status;
  if (!rawStatus) return 'pending';
  return rawStatus === 'paid' || rawStatus === 'pago' ? 'paid' : 'pending';
};

const normalizePayments = (payments) => {
  if (!payments || typeof payments !== 'object') return {};
  return Object.entries(payments).reduce((acc, [monthKey, entry]) => {
    const status = normalizePaymentStatus(entry);
    acc[monthKey] = {
      ...(typeof entry === 'object' && entry ? entry : {}),
      status,
      updatedAt: entry?.updatedAt || new Date().toISOString(),
    };
    return acc;
  }, {});
};

const normalizeClient = (client) => {
  if (!client || typeof client !== 'object') return client;
  const valueNumber = Number(client.value || 0);
  const dueDayNumber = Number(client.dueDay || 0);
  return {
    ...client,
    value: Number.isFinite(valueNumber) ? valueNumber : 0,
    dueDay: Number.isFinite(dueDayNumber) ? dueDayNumber : 0,
    days: Array.isArray(client.days) ? client.days : [],
    payments: normalizePayments(client.payments),
  };
};

const normalizeClients = (clients) =>
  Array.isArray(clients) ? clients.map(normalizeClient) : [];

const normalizeExpense = (expense) => {
  if (!expense || typeof expense !== 'object') return expense;
  const valueNumber = Number(expense.value || 0);
  return {
    ...expense,
    value: Number.isFinite(valueNumber) ? valueNumber : 0,
  };
};

const normalizeExpenses = (expenses) =>
  Array.isArray(expenses) ? expenses.map(normalizeExpense) : [];

const normalizeBirthdate = (value) => {
  if (!value) return '';
  const dateKey = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : '';
};

const getAgeFromBirthdate = (dateKey) => {
  if (!dateKey) return null;
  const parts = String(dateKey).split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  const hasBirthdayPassed =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!hasBirthdayPassed) age -= 1;
  return age;
};

export const useClientStore = create(
  persist(
    (set, get) => ({
      clients: [],
      expenses: [],
      clientTerm: 'Cliente',
      userName: '',
      userEmail: '',
      userPhone: '',
      userAge: null,
      userBirthdate: '',
      userProfession: '',
      userPhotoURL: '',
      privacyHideBalances: false,
      templates: {
        confirmMsg: '',
        chargeMsg: '',
      },
      scheduleOverrides: {},
      currentUserId: null,
      planTier: 'free',
      notificationsEnabled: false,
      isLoading: false,

      setCurrentUserId: (uid) => set({ currentUserId: uid || null }),
      setScheduleOverrides: (overrides) => set({ scheduleOverrides: overrides || {} }),
      setClients: (clients) => set({ clients: normalizeClients(clients) }),
      setExpenses: (expenses) => set({ expenses: normalizeExpenses(expenses) }),

      setClientTerm: (term) => set({ clientTerm: term }),

      setUserProfession: (profession) => set({ userProfession: profession }),
      setUserProfile: (profile) =>
        set({
          userName: profile?.name || '',
          userEmail: profile?.email || '',
          userPhone: profile?.phone || '',
          userBirthdate: normalizeBirthdate(profile?.birthdate),
          userAge: Number.isFinite(profile?.age)
            ? profile.age
            : getAgeFromBirthdate(profile?.birthdate) ?? null,
          userProfession: profile?.profession || '',
        }),
      setUserDoc: (data) =>
        set((state) => ({
          userName: data?.name ?? state.userName,
          userEmail: data?.email ?? state.userEmail,
          userPhone: data?.phone ?? state.userPhone,
          userBirthdate: data?.birthdate ?? state.userBirthdate,
          userProfession: data?.profession ?? state.userProfession,
          userPhotoURL: data?.photoURL ?? state.userPhotoURL,
          privacyHideBalances:
            data?.privacy?.hideBalances !== undefined
              ? Boolean(data?.privacy?.hideBalances)
              : state.privacyHideBalances,
          templates: {
            confirmMsg: data?.templates?.confirmMsg ?? state.templates?.confirmMsg ?? '',
            chargeMsg: data?.templates?.chargeMsg ?? state.templates?.chargeMsg ?? '',
          },
        })),
      setPrivacyHideBalances: (hideBalances) =>
        set({ privacyHideBalances: Boolean(hideBalances) }),
      setTemplates: (templates) =>
        set({
          templates: {
            confirmMsg: templates?.confirmMsg || '',
            chargeMsg: templates?.chargeMsg || '',
          },
        }),
      setPlanTier: (tier) => set({ planTier: tier === 'pro' ? 'pro' : 'free' }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: Boolean(enabled) }),

      addClient: async (clientData) => {
        const newClient = normalizeClient({
          id: uuidv4(),
          payments: {},
          ...clientData,
        });
        set((state) => ({ clients: [...state.clients, newClient] }));
        const uid = get().currentUserId;
        if (uid) {
          try {
            await upsertClient({ uid, client: newClient });
            await upsertReceivableForClient({ uid, client: newClient });
          } catch (error) {
            // ignore firestore sync errors
          }
        }
      },

      updateClient: async (id, data) => {
        let updatedClient = null;
        set((state) => ({
          clients: state.clients.map((client) =>
            client.id === id
              ? (() => {
                  updatedClient = normalizeClient({ ...client, ...data, id: client.id });
                  return updatedClient;
                })()
              : client
          ),
        }));
        const uid = get().currentUserId;
        if (uid && updatedClient) {
          try {
            await upsertClient({ uid, client: updatedClient });
            await upsertReceivableForClient({ uid, client: updatedClient });
          } catch (error) {
            // ignore firestore sync errors
          }
        }
      },

      deleteClient: async (id) => {
        set((state) => ({
          clients: state.clients.filter((client) => client.id !== id),
        }));
        const uid = get().currentUserId;
        if (uid) {
          try {
            await deleteClientFromFirestore({ uid, clientId: id });
          } catch (error) {
            // ignore firestore sync errors
          }
        }
      },

      togglePayment: async (clientId, monthKey) => {
        let updatedClient = null;
        let paymentEntry = null;
        let isPaidNow = false;

        set((state) => ({
          clients: state.clients.map((client) => {
            if (client.id !== clientId) return client;

            const newPayments = { ...client.payments };
            const current = newPayments[monthKey];
            const isPaid = normalizePaymentStatus(current) === 'paid';

            if (isPaid) {
              paymentEntry = {
                status: 'pending',
                updatedAt: new Date().toISOString(),
              };
              isPaidNow = false;
            } else {
              paymentEntry = {
                status: 'paid',
                date: new Date().toISOString(),
                value: client.value,
                updatedAt: new Date().toISOString(),
              };
              isPaidNow = true;
            }

            newPayments[monthKey] = paymentEntry;
            updatedClient = {
              ...client,
              payments: newPayments,
            };

            return updatedClient;
          }),
        }));

        const uid = get().currentUserId;
        if (uid && updatedClient) {
          try {
            await upsertClient({ uid, client: updatedClient });
            await upsertReceivableForMonth({
              uid,
              client: updatedClient,
              monthKey,
              paid: isPaidNow,
            });
            if (isPaidNow) {
              await upsertReceivableForClient({ uid, client: updatedClient });
            }
          } catch (error) {
            // ignore firestore sync errors
          }
        }
      },

      addExpense: async (expenseData) => {
        const newExpense = normalizeExpense({
          id: uuidv4(),
          ...expenseData,
        });
        set((state) => ({ expenses: [...state.expenses, newExpense] }));
        const uid = get().currentUserId;
        if (uid) {
          try {
            await upsertExpense({ uid, expense: newExpense });
          } catch (error) {
            // ignore firestore sync errors
          }
        }
      },

      deleteExpense: async (id) => {
        set((state) => ({
          expenses: state.expenses.filter((expense) => expense.id !== id),
        }));
        const uid = get().currentUserId;
        if (uid) {
          try {
            await deleteExpenseFromFirestore({ uid, expenseId: id });
          } catch (error) {
            // ignore firestore sync errors
          }
        }
      },
    }),
    {
      name: 'wallet-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 6,
      migrate: (persistedState) => {
        try {
          if (!persistedState || typeof persistedState !== 'object') {
            return {
              clients: [],
              expenses: [],
              clientTerm: 'Cliente',
              userName: '',
              userEmail: '',
              userPhone: '',
              userAge: null,
              userBirthdate: '',
              userProfession: '',
              userPhotoURL: '',
              privacyHideBalances: false,
              templates: {
                confirmMsg: '',
                chargeMsg: '',
              },
              scheduleOverrides: {},
              currentUserId: null,
              planTier: 'free',
              notificationsEnabled: false,
              isLoading: false,
            };
          }
          return {
            clients: normalizeClients(persistedState.clients),
            expenses: normalizeExpenses(persistedState.expenses),
            clientTerm: persistedState.clientTerm || 'Cliente',
            userName: persistedState.userName || '',
            userEmail: persistedState.userEmail || '',
            userPhone: persistedState.userPhone || '',
            userBirthdate: normalizeBirthdate(persistedState.userBirthdate),
            userAge: Number.isFinite(persistedState.userAge)
              ? persistedState.userAge
              : (() => {
                  const derivedAge = getAgeFromBirthdate(persistedState.userBirthdate);
                  if (Number.isFinite(derivedAge)) {
                    return derivedAge;
                  }
                  const legacyAge = Number(persistedState.userAge);
                  return Number.isFinite(legacyAge) ? legacyAge : null;
                })(),
            userProfession: persistedState.userProfession || '',
            userPhotoURL: persistedState.userPhotoURL || '',
            privacyHideBalances: Boolean(persistedState.privacyHideBalances),
            templates: {
              confirmMsg: persistedState.templates?.confirmMsg || '',
              chargeMsg: persistedState.templates?.chargeMsg || '',
            },
            scheduleOverrides: persistedState.scheduleOverrides || {},
            currentUserId: persistedState.currentUserId || null,
            planTier: persistedState.planTier === 'pro' ? 'pro' : 'free',
            notificationsEnabled: Boolean(persistedState.notificationsEnabled),
            isLoading: false,
          };
        } catch (error) {
          return {
            clients: [],
            expenses: [],
            clientTerm: 'Cliente',
            userName: '',
            userEmail: '',
            userPhone: '',
            userAge: null,
            userBirthdate: '',
            userProfession: '',
            userPhotoURL: '',
            privacyHideBalances: false,
            templates: {
              confirmMsg: '',
              chargeMsg: '',
            },
            scheduleOverrides: {},
            currentUserId: null,
            planTier: 'free',
            notificationsEnabled: false,
            isLoading: false,
          };
        }
      },
    }
  )
);
