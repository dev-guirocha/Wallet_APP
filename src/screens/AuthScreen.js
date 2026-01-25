// /src/screens/AuthScreen.js

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { Feather as Icon, FontAwesome } from '@expo/vector-icons';
import { COLORS as THEME, TYPOGRAPHY } from '../constants/theme';

const COLORS = {
  background: THEME.background,
  surface: THEME.surface,
  text: THEME.textPrimary,
  placeholder: THEME.textSecondary,
  primary: THEME.primary,
  border: THEME.border,
  textOnPrimary: THEME.textOnPrimary,
};

const AuthScreen = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const buildProfilePayload = () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert('Campo obrigatório', 'Informe um e-mail válido.');
      return null;
    }

    const trimmedName = name.trim();
    const profile = { email: trimmedEmail };

    if (!isLogin && trimmedName.length > 0) {
      profile.name = trimmedName;
    }

    if (!isLogin) {
      profile.isNewUser = true;
    }

    return profile;
  };

  const triggerSuccess = () => {
    if (!onLoginSuccess) return;
    const profile = buildProfilePayload();
    if (!profile) return;
    const maybePromise = onLoginSuccess(profile);
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.catch(() => {});
    }
  };

  const handlePrimaryAction = () => {
    // A lógica de validação do Firebase virá aqui no futuro.
    triggerSuccess();
  };

  const handleQuickAccess = () => {
    if (!onLoginSuccess) return;
    const profile = buildProfilePayload();
    if (!profile) return;
    const maybePromise = onLoginSuccess(profile);
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.catch(() => {});
    }
  };

  const toggleMode = () => {
    if (!isLogin) {
      setName('');
    }
    setIsLogin(!isLogin);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.content}>
            <Icon name={isLogin ? "user" : "user-plus"} size={60} color={COLORS.text} style={styles.mainIcon} />
            
            <Text style={styles.title}>{isLogin ? 'Bem-vindo de volta!' : 'Crie sua conta'}</Text>
            
            {!isLogin && (
              <TextInput
                style={styles.input}
                placeholder="Nome Completo"
                placeholderTextColor={COLORS.placeholder}
                autoCapitalize="words"
                value={name}
                onChangeText={setName}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor={COLORS.placeholder}
              secureTextEntry
            />
            
            {!isLogin && (
              <TextInput
                style={styles.input}
                placeholder="Confirmar Senha"
                placeholderTextColor={COLORS.placeholder}
                secureTextEntry
              />
            )}

            {/* ======================================================= */}
            {/* NOVO BOTÃO DE LOGIN TESTE ADICIONADO AQUI              */}
            {/* ======================================================= */}
            <TouchableOpacity style={styles.testButton} onPress={handleQuickAccess}>
              <Text style={styles.testButtonText}>Acesso Rápido (Login Teste)</Text>
            </TouchableOpacity>
            {/* ======================================================= */}
            
            <TouchableOpacity style={styles.primaryButton} onPress={handlePrimaryAction}>
              <Text style={styles.primaryButtonText}>{isLogin ? 'Entrar' : 'Criar conta'}</Text>
            </TouchableOpacity>
            
            <Text style={styles.dividerText}>OU</Text>

            <View style={styles.socialLoginContainer}>
              <TouchableOpacity style={styles.socialButton}>
                <FontAwesome name="google" size={24} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton}>
                <FontAwesome name="apple" size={24} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton}>
                <FontAwesome name="facebook-f" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity onPress={toggleMode} style={styles.toggleButton}>
            <Text style={styles.toggleText}>
              {isLogin ? 'Não tem uma conta? ' : 'Já tem uma conta? '}
              <Text style={styles.toggleLink}>{isLogin ? 'Cadastre-se' : 'Faça login'}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    paddingTop: 60,
  },
  mainIcon: {
    marginBottom: 30,
  },
  title: {
    ...TYPOGRAPHY.display,
    color: COLORS.text,
    marginBottom: 30,
  },
  input: {
    width: '100%',
    backgroundColor: COLORS.surface,
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 15,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    marginBottom: 15,
    fontFamily: 'System',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  // Estilo para o novo botão de teste
  testButton: {
    width: '100%',
    paddingVertical: 10, // Menor que o principal
    marginBottom: 15,
  },
  testButtonText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.placeholder, textAlign: 'center' },
  primaryButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 30,
    // Removi a margem superior para o botão de teste controlar o espaçamento
  },
  primaryButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.textOnPrimary,
    textAlign: 'center',
  },
  dividerText: { ...TYPOGRAPHY.caption, color: COLORS.placeholder, marginVertical: 25 },
  socialLoginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  socialButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleButton: {
    padding: 20,
    paddingBottom: 30,
  },
  toggleText: {
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    textAlign: 'center',
  },
  toggleLink: {
    fontWeight: 'bold',
  },
});

export default AuthScreen;
