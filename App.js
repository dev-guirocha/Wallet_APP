// App.js

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

import WelcomeScreen from './src/screens/WelcomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import ProfessionScreen from './src/screens/ProfessionScreen';
import AppNavigator from './AppNavigator';

const CLIENTS_STORAGE_KEY = '@WalletA:clients';
// Função para obter a chave do mês atual no formato 'AAAA-MM'
const getCurrentMonthKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

const CLIENT_TERM_KEY = '@WalletA:clientTerm';
const APP_STATE_KEY = '@WalletA:appState';

const INITIAL_CLIENTS = [
  {
    id: '1',
    name: 'Guilherme (Exemplo)',
    location: 'Condominio Caete Serigy',
    days: ['Seg', 'Qua', 'Sex'],
    time: '15:00',
    value: '500',
    dueDay: '25',
    phone: '79998357214',
    status: 'Vence dia 25',
    statusColor: '#F0AD4E',
    paid: false,
  },
];

const App = () => {
  const [appState, setAppState] = useState('welcome');
  const [clientTerm, setClientTerm] = useState('Cliente');
  const [clients, setClients] = useState([]);

  // =======================================================
  // CHECKPOINT 7: ESTADO DE CARREGAMENTO
  // =======================================================
  const [isLoading, setIsLoading] = useState(true);
  // =======================================================

  // =======================================================
  // CHECKPOINT 7: CARREGAR DADOS AO INICIAR O APP
  // =======================================================
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [savedClients, savedTerm, savedAppState] = await Promise.all([
          AsyncStorage.getItem(CLIENTS_STORAGE_KEY),
          AsyncStorage.getItem(CLIENT_TERM_KEY),
          AsyncStorage.getItem(APP_STATE_KEY),
        ]);

        if (savedClients !== null) {
          setClients(JSON.parse(savedClients));
        } else {
          setClients(INITIAL_CLIENTS);
        }

        if (savedTerm) {
          try {
            const maybeObj = JSON.parse(savedTerm);
            setClientTerm(
              typeof maybeObj === 'string'
                ? maybeObj
                : (maybeObj?.label || maybeObj?.value || 'Cliente')
            );
          } catch {
            setClientTerm(savedTerm);
          }
        }
        if (savedAppState) setAppState(savedAppState);
      } catch (e) {
        console.error('Falha ao carregar os dados.', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadAll();
  }, []);
  // =======================================================

  // =======================================================
  // CHECKPOINT 7: SALVAR DADOS A CADA ALTERAÇÃO
  // =======================================================
  useEffect(() => {
    const saveClients = async () => {
      try {
        if (!isLoading) {
          await AsyncStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
        }
      } catch (e) {
        console.error('Falha ao salvar os clientes.', e);
      }
    };

    saveClients();
  }, [clients, isLoading]);
  // =======================================================

  useEffect(() => {
    const saveMeta = async () => {
      try {
        if (!isLoading) {
          await Promise.all([
            AsyncStorage.setItem(CLIENT_TERM_KEY, String(clientTerm ?? 'Cliente')),
            AsyncStorage.setItem(APP_STATE_KEY, String(appState ?? 'welcome')),
          ]);
        }
      } catch (e) {
        console.error('Falha ao salvar metadados.', e);
      }
    };
    saveMeta();
  }, [clientTerm, appState, isLoading]);

  // ===== LÓGICA DE CLIENTES (simples) =====
  const handleAddClient = (newClientData) => {
    const newClient = {
      id: uuidv4(),
      ...newClientData,
      payments: {}, // histórico mensal
    };
    setClients((prev) => [...prev, newClient]);
  };

  const handleEditClient = (updatedClientData) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updatedClientData.id ? { ...c, ...updatedClientData } : c))
    );
  };

  const handleToggleClientPayment = (clientId) => {
    const currentMonthKey = getCurrentMonthKey();
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== clientId) return c;
        const newPayments = { ...(c.payments || {}) };
        const currentStatus = newPayments[currentMonthKey];
        newPayments[currentMonthKey] = currentStatus === 'pago' ? 'pendente' : 'pago';
        return { ...c, payments: newPayments };
      })
    );
  };

  const handleDeleteClient = (clientId) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId));
  };

  const handleProfessionComplete = (term) => {
    const text = typeof term === 'string' ? term : term?.label || term?.value || 'Cliente';
    setClientTerm(text);
    setAppState('main');
  };

  // Tela de loading
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E4E2DD' }}>
        <ActivityIndicator size="large" color="#1E1E1E" />
      </View>
    );
  }

  // Fluxo de configuração (bem simples)
  if (appState !== 'main') {
    if (appState === 'welcome') return <WelcomeScreen onContinue={() => setAppState('onboarding')} />;
    if (appState === 'onboarding') return <OnboardingScreen onComplete={() => setAppState('auth')} />;
    if (appState === 'auth') return <AuthScreen onLoginSuccess={() => setAppState('profession')} />;
    if (appState === 'profession') return <ProfessionScreen onComplete={handleProfessionComplete} />;
  }

  return (
    <NavigationContainer>
      <AppNavigator
        clientTerm={clientTerm}
        clients={clients}
        onAddClient={handleAddClient}
        onTogglePayment={handleToggleClientPayment}
        onDeleteClient={handleDeleteClient}
        onEditClient={handleEditClient}
      />
    </NavigationContainer>
  );
};

export default App;