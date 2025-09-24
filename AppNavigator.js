// AppNavigator.js

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Feather';

import HomeScreen from './src/screens/HomeScreen';
import AgendaScreen from './src/screens/AgendaScreen';
import ClientsScreen from './src/screens/ClientsScreen';
import AddClientScreen from './src/screens/AddClientScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
};

const TabNavigator = ({ clientTerm, clients }) => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Início') iconName = 'home';
          else if (route.name === 'Agenda') iconName = 'calendar';
          else if (route.name === 'ClientesTab') iconName = 'users';
          
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.placeholder,
        tabBarShowLabel: true, 
        tabBarStyle: { 
          backgroundColor: COLORS.background,
          borderTopWidth: 0,
          elevation: 0,
          height: 90,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          paddingBottom: 10, 
        },
      })}
    >
      <Tab.Screen name="Início">
        {props => <HomeScreen {...props} clientTerm={clientTerm} clients={clients} />}
      </Tab.Screen>

      {/* ======================================================= */}
      {/* A CORREÇÃO ESTÁ AQUI                                    */}
      {/* ======================================================= */}
      {/* A tela da Agenda agora recebe a lista 'clients' corretamente */}
      <Tab.Screen name="Agenda">
        {props => <AgendaScreen {...props} clients={clients} />}
      </Tab.Screen>
      {/* ======================================================= */}
      
      <Tab.Screen name="ClientesTab" options={{ title: 'Clientes' }}>
        {props => <ClientsScreen {...props} clientTerm={clientTerm} clients={clients} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const AppNavigator = ({ clientTerm, clients, onAddClient }) => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs">
        {props => <TabNavigator {...props} clientTerm={clientTerm} clients={clients} />}
      </Stack.Screen>
      <Stack.Screen 
        name="AddClient"
        options={{ presentation: 'modal' }}
      >
         {/* A tela de adicionar recebe a função onAddClient */}
        {props => <AddClientScreen {...props} onAddClient={onAddClient} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default AppNavigator;