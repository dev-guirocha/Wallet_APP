// /src/screens/WelcomeScreen.js

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS as THEME, TYPOGRAPHY } from '../theme/legacy';

const COLORS = {
  background: THEME.background,
  text: THEME.textPrimary,
  secondary: THEME.textSecondary,
  primary: THEME.primary,
  textOnPrimary: THEME.textOnPrimary,
};

const WelcomeScreen = ({ onContinue }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Flowdesk</Text>
          <Text style={styles.description}>
            Intelligent financial workspace for service professionals.
          </Text>
        </View>
        <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
          <Text style={styles.continueButtonText}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 30,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  title: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    ...TYPOGRAPHY.body,
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 25,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    width: '100%',
    borderRadius: 30,
    marginBottom: 20,
  },
  continueButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.textOnPrimary,
    textAlign: 'center',
  },
});

export default WelcomeScreen;
