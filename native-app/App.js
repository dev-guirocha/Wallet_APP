import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/context/AppContext';
import Shell from './src/screens/Shell';

export default function App() {
  return (
    <AppProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea}>
        <Shell />
      </SafeAreaView>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
});
