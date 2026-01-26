import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

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
      planTier: 'free',
      notificationsEnabled: false,
      isLoading: false,

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
      setPlanTier: (tier) => set({ planTier: tier === 'pro' ? 'pro' : 'free' }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: Boolean(enabled) }),

      addClient: (clientData) => {
        const newClient = normalizeClient({
          id: uuidv4(),
          payments: {},
          ...clientData,
        });
        set((state) => ({ clients: [...state.clients, newClient] }));
      },

      updateClient: (id, data) => {
        set((state) => ({
          clients: state.clients.map((client) =>
            client.id === id ? normalizeClient({ ...client, ...data, id: client.id }) : client
          ),
        }));
      },

      deleteClient: (id) => {
        set((state) => ({
          clients: state.clients.filter((client) => client.id !== id),
        }));
      },

      togglePayment: (clientId, monthKey) => {
        set((state) => ({
          clients: state.clients.map((client) => {
            if (client.id !== clientId) return client;

            const newPayments = { ...client.payments };
            const current = newPayments[monthKey];
            const isPaid = normalizePaymentStatus(current) === 'paid';

            if (isPaid) {
              newPayments[monthKey] = {
                status: 'pending',
                updatedAt: new Date().toISOString(),
              };
            } else {
              newPayments[monthKey] = {
                status: 'paid',
                date: new Date().toISOString(),
                value: client.value,
                updatedAt: new Date().toISOString(),
              };
            }

            return {
              ...client,
              payments: newPayments,
            };
          }),
        }));
      },

      addExpense: (expenseData) => {
        const newExpense = normalizeExpense({
          id: uuidv4(),
          ...expenseData,
        });
        set((state) => ({ expenses: [...state.expenses, newExpense] }));
      },

      deleteExpense: (id) => {
        set((state) => ({
          expenses: state.expenses.filter((expense) => expense.id !== id),
        }));
      },
    }),
    {
      name: 'wallet-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 5,
      migrate: (persistedState) => {
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
          planTier: persistedState.planTier === 'pro' ? 'pro' : 'free',
          notificationsEnabled: Boolean(persistedState.notificationsEnabled),
          isLoading: false,
        };
      },
    }
  )
);
