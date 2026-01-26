// AppNavigator.js

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import ClientDetailScreen from './src/screens/ClientDetailScreen';
import HomeScreen from './src/screens/HomeScreen';
import AgendaScreen from './src/screens/AgendaScreen';
import ClientsScreen from './src/screens/ClientsScreen';
import AddClientScreen from './src/screens/AddClientScreen';
import AddExpenseScreen from './src/screens/AddExpenseScreen';
import RevenueInsightsScreen from './src/screens/RevenueInsightsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PlanDetailsScreen from './src/screens/PlanDetailsScreen';
import { COLORS, TYPOGRAPHY } from './src/constants/theme';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const TAB_INACTIVE = COLORS.textSecondary;

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size, focused }) => {
          let iconName;
          if (route.name === 'Início') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Gráficos') {
            iconName = focused ? 'pie-chart' : 'pie-chart-outline';
          } else if (route.name === 'Agenda') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'ClientesTab') {
            iconName = focused ? 'people' : 'people-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
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
      })}
    >
      <Tab.Screen name="Início">
        {props => <HomeScreen {...props} />}
      </Tab.Screen>

      <Tab.Screen name="Gráficos" options={{ title: 'Gráficos' }}>
        {props => <RevenueInsightsScreen {...props} />}
      </Tab.Screen>

      <Tab.Screen name="Agenda">
        {props => <AgendaScreen {...props} />}
      </Tab.Screen>

      <Tab.Screen name="ClientesTab" options={{ title: 'Clientes' }}>
        {props => <ClientsScreen {...props} />}
      </Tab.Screen>

    </Tab.Navigator>
  );
};

const AppNavigator = ({ onSignOut }) => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
      <Stack.Screen
        name="PlanDetails"
        options={{ presentation: 'modal', title: 'Wallet Pro' }}
      >
        {props => (
          <PlanDetailsScreen
            {...props}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default AppNavigator;
