// AppNavigator.js

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Feather as Icon, MaterialIcons } from '@expo/vector-icons';
import ClientDetailScreen from './src/screens/ClientDetailScreen';
import HomeScreen from './src/screens/HomeScreen';
import AgendaScreen from './src/screens/AgendaScreen';
import ClientsScreen from './src/screens/ClientsScreen';
import AddClientScreen from './src/screens/AddClientScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import ClientReportScreen from './src/screens/ClientReportScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PlanDetailsScreen from './src/screens/PlanDetailsScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import ChangePhotoScreen from './src/screens/ChangePhotoScreen';
import PrivacyScreen from './src/screens/PrivacyScreen';
import ChargesTodayScreen from './src/screens/ChargesTodayScreen';
import ChargesScreen from './src/screens/ChargesScreen';
import FeedScreen from './src/screens/FeedScreen';
import MessageTemplatesScreen from './src/screens/MessageTemplatesScreen';
import { COLORS, TYPOGRAPHY } from './src/constants/theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const TAB_INACTIVE = COLORS.textSecondary;

const TabNavigator = () => {
  return (
    <Tab.Navigator
      detachInactiveScreens
      screenOptions={{
        headerShown: false,
        tabBarShowIcon: true,
        tabBarActiveTintColor: COLORS.textPrimary,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarShowLabel: true, 
        tabBarStyle: { 
          backgroundColor: COLORS.surface,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          elevation: 0,
          height: 90,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          ...TYPOGRAPHY.caption,
          paddingBottom: 10, 
        },
      }}
    >
      <Tab.Screen
        name="Início"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="home" size={size || 22} color={color || TAB_INACTIVE} />
          ),
        }}
      >
        {props => <HomeScreen {...props} />}
      </Tab.Screen>

      <Tab.Screen
        name="Gráficos"
        options={{
          title: 'Gráficos',
          tabBarIcon: ({ color, size }) => (
            <Icon name="bar-chart-2" size={size || 22} color={color || TAB_INACTIVE} />
          ),
        }}
      >
        {props => <ReportsScreen {...props} />}
      </Tab.Screen>

      <Tab.Screen
        name="Agenda"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="calendar" size={size || 22} color={color || TAB_INACTIVE} />
          ),
        }}
      >
        {props => <AgendaScreen {...props} />}
      </Tab.Screen>

      <Tab.Screen
        name="ClientesTab"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="groups" size={size || 22} color={color || TAB_INACTIVE} />
          ),
        }}
      >
        {props => <ClientsScreen {...props} />}
      </Tab.Screen>

    </Tab.Navigator>
  );
};

const AppNavigator = ({ onSignOut }) => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, detachInactiveScreens: true }}>
      <Stack.Screen name="MainTabs">
        {props => (
          <TabNavigator {...props} />
        )}
      </Stack.Screen>
      <Stack.Screen name="AddClient" options={{ presentation: 'modal' }}>
        {props => <AddClientScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen name="ClientDetail">
        {props => <ClientDetailScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen name="AddExpense" options={{ presentation: 'modal' }}>
        {props => <AddExpenseScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen name="Configurações">
        {props => (
          <SettingsScreen
            {...props}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Editar Perfil">
        {props => <EditProfileScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen name="Alterar Foto">
        {props => <ChangePhotoScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen name="Privacidade">
        {props => <PrivacyScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen name="Preferências de mensagens">
        {props => <MessageTemplatesScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen name="CobrancasHoje">
        {props => <ChargesTodayScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen name="Cobrancas">
        {props => <ChargesScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen name="FeedScreen">
        {props => <FeedScreen {...props} />}
      </Stack.Screen>
      <Stack.Screen
        name="PlanDetails"
        options={{ presentation: 'modal', title: 'Flowdesk Pro' }}
      >
        {props => (
          <PlanDetailsScreen
            {...props}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ClientReport">
        {props => <ClientReportScreen {...props} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default AppNavigator;
