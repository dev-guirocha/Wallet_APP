// App.js

import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

import WelcomeScreen from './src/screens/WelcomeScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import ProfessionScreen from './src/screens/ProfessionScreen';
import AppNavigator from './AppNavigator';

// =======================================================
// DADOS DE TESTE PARA GARANTIR QUE O APP NÃO ABRA VAZIO
// =======================================================
const INITIAL_CLIENTS = [
  {
    id: '1',
    name: 'Guilherme',
    location: 'Condominio Caete Serigy',
    days: ['Seg', 'Qua', 'Sex'],
    time: '15h',
    value: '500',
    dueDay: '25',
    phone: '79998357214',
    status: 'Vence dia 25',
    statusColor: '#F0AD4E',
  }
];
// =======================================================

const App = () => {
  const [appState, setAppState] = useState('welcome');
  const [clientTerm, setClientTerm] = useState('Cliente');
  
  // O estado agora começa com os dados de teste
  const [clients, setClients] = useState(INITIAL_CLIENTS);

  const handleAddClient = (newClientData) => {
    const newClient = {
      id: uuidv4(),
      ...newClientData,
      status: `Vence dia ${newClientData.dueDay}`,
      statusColor: '#F0AD4E',
    };
    setClients(prevClients => [...prevClients, newClient]);
  };

  const handleProfessionComplete = (term) => {
    setClientTerm(term);
    setAppState('main');
  };

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
      />
    </NavigationContainer>
  );
};

export default App;