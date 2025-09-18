import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const STORAGE_KEYS = {
  clients: 'walleta_clients',
  payments: 'walleta_payments',
  onboarding: 'walleta_onboarding_done',
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState({});
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const [clientsRaw, paymentsRaw, onboardingRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.clients),
          AsyncStorage.getItem(STORAGE_KEYS.payments),
          AsyncStorage.getItem(STORAGE_KEYS.onboarding),
        ]);

        if (clientsRaw) {
          setClients(JSON.parse(clientsRaw));
        }
        if (paymentsRaw) {
          setPayments(JSON.parse(paymentsRaw));
        }
        if (onboardingRaw === '1') {
          setOnboardingDone(true);
        }
      } catch (error) {
        console.warn('Falha ao carregar dados persistidos', error);
      } finally {
        setHydrated(true);
      }
    };

    loadPersistedData();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients)).catch((error) =>
      console.warn('Erro ao salvar clientes', error),
    );
  }, [hydrated, clients]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(payments)).catch((error) =>
      console.warn('Erro ao salvar pagamentos', error),
    );
  }, [hydrated, payments]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.onboarding, onboardingDone ? '1' : '0').catch((error) =>
      console.warn('Erro ao salvar onboarding', error),
    );
  }, [hydrated, onboardingDone]);

  const addClient = (client) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newClient = { id, ...client };
    setClients((prev) => [...prev, newClient]);
  };

  const togglePaid = (clientId) => {
    setPayments((prev) => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  const markOnboardingDone = () => {
    setOnboardingDone(true);
  };

  const totals = useMemo(() => {
    const totalPaid = clients.reduce(
      (acc, client) => acc + (payments[client.id] ? Number(client.price) : 0),
      0,
    );
    const totalToReceive = clients.reduce(
      (acc, client) => acc + (!payments[client.id] ? Number(client.price) : 0),
      0,
    );
    return { totalPaid, totalToReceive };
  }, [clients, payments]);

  const value = {
    clients,
    addClient,
    payments,
    togglePaid,
    totals,
    onboardingDone,
    markOnboardingDone,
    hydrated,
  };

  return (
    <AppContext.Provider value={value}>
      {hydrated ? children : (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp só pode ser usado dentro de AppProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
});
