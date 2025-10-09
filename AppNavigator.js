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
import RevenueInsightsScreen from './src/screens/RevenueInsightsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PlanDetailsScreen from './src/screens/PlanDetailsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
};

const TabNavigator = ({
  clientTerm,
  clients,
  planTier,
  clientLimit,
  activeMonth,
  onTogglePayment,
  onDeleteClient,
  scheduleOverrides,
  onMarkAppointmentStatus,
  onClearAppointmentStatus,
  onRescheduleAppointment,
  adsEnabled,
  onSignOut,
  notificationsEnabled,
  canAskNotifications,
  onRequestNotifications,
  onToggleNotifications,
  notificationPermissionGranted,
  onUpgradePlan,
  userName,
  userProfession,
  onEditClient,
}) => {
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
          } else if (route.name === 'Configurações') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
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
        {props => (
          <HomeScreen
            {...props}
            clientTerm={clientTerm}
            clients={clients}
            planTier={planTier}
            clientLimit={clientLimit}
            activeMonth={activeMonth}
            scheduleOverrides={scheduleOverrides}
            onMarkAppointmentStatus={onMarkAppointmentStatus}
            onClearAppointmentStatus={onClearAppointmentStatus}
            onRescheduleAppointment={onRescheduleAppointment}
            adsEnabled={adsEnabled}
            userName={userName}
            userProfession={userProfession}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Gráficos" options={{ title: 'Gráficos' }}>
        {props => (
          <RevenueInsightsScreen
            {...props}
            clients={clients}
            activeMonth={activeMonth}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Agenda">
        {props => <AgendaScreen {...props} clients={clients} scheduleOverrides={scheduleOverrides} />}
      </Tab.Screen>

      <Tab.Screen name="ClientesTab" options={{ title: 'Clientes' }}>
        {props => (
          <ClientsScreen
            {...props}
            clientTerm={clientTerm}
            clients={clients}
            onTogglePayment={onTogglePayment}
            onDeleteClient={onDeleteClient}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Configurações">
        {props => (
          <SettingsScreen
            {...props}
            planTier={planTier}
            clientLimit={clientLimit}
            clientCount={clients.length}
            notificationsEnabled={notificationsEnabled}
            canAskNotifications={canAskNotifications}
            onRequestNotifications={onRequestNotifications}
            onToggleNotifications={onToggleNotifications}
            notificationPermissionGranted={notificationPermissionGranted}
            onSignOut={onSignOut}
            onUpgradePlan={onUpgradePlan}
            userName={userName}
            userProfession={userProfession}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

const AppNavigator = ({ clientTerm, clients, onAddClient, onTogglePayment, onDeleteClient, onEditClient }) => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs">
        {props => (
          <TabNavigator
            {...props}
            clientTerm={clientTerm}
            clients={clients}
            onTogglePayment={onTogglePayment}
            onDeleteClient={onDeleteClient}
            onEditClient={onEditClient} // Passa para as Tabs
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AddClient" options={{ presentation: 'modal' }}>
        {props => <AddClientScreen {...props} onAddClient={onAddClient} onEditClient={onEditClient} />}
      </Stack.Screen>
      <Stack.Screen name="ClientDetail">
        {props => <ClientDetailScreen {...props} onEditClient={onEditClient} onDeleteClient={onDeleteClient}/>}
      </Stack.Screen>
      <Stack.Screen
        name="PlanDetails"
        options={{ presentation: 'modal', title: 'Wallet Pro' }}
      >
        {props => (
          <PlanDetailsScreen
            {...props}
            planTier={planTier}
            onUpgradePlan={onUpgradePlan}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default AppNavigator;
