// /src/screens/WelcomeScreen.js

import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
};

const WelcomeScreen = ({ onContinue }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Image 
            source={require('../assets/images/logo.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <Text style={styles.title}>Seu assistente financeiro pessoal.</Text>
          <Text style={styles.description}>
            Controle seus contratos, agenda e pagamentos de forma simples e inteligente.
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
  logo: {
    width: 280,
    height: 120,
    marginBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'System',
  },
  description: {
    fontSize: 17,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 25,
    opacity: 0.7,
    fontFamily: 'System',
  },
  continueButton: {
    backgroundColor: COLORS.text,
    paddingVertical: 16,
    width: '100%',
    borderRadius: 30,
    marginBottom: 20,
  },
  continueButtonText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'System',
  },
});

export default WelcomeScreen;