// /src/screens/AuthScreen.js

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { Feather as Icon } from '@expo/vector-icons';
import { FontAwesome } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';

import { auth, isFirebaseConfigured } from '../utils/firebase';
import { getRememberMePreference, setRememberMePreference } from '../utils/authStorage';
import { COLORS as THEME, TYPOGRAPHY } from '../theme/legacy';
import { readEnv } from '../utils/env';

WebBrowser.maybeCompleteAuthSession();

const COLORS = {
  background: THEME.background,
  surface: THEME.surface,
  text: THEME.textPrimary,
  placeholder: THEME.textSecondary,
  primary: THEME.primary,
  border: THEME.border,
  textOnPrimary: THEME.textOnPrimary,
  danger: THEME.danger,
  success: THEME.success,
};

const AuthScreen = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const googleClientIds = useMemo(
    () => ({
      expo: readEnv('EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID', 'GOOGLE_EXPO_CLIENT_ID'),
      ios: readEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'GOOGLE_IOS_CLIENT_ID'),
      android: readEnv('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID', 'GOOGLE_ANDROID_CLIENT_ID'),
      web: readEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'GOOGLE_WEB_CLIENT_ID'),
    }),
    [],
  );
  const hasGoogleConfig = useMemo(
    () => Object.values(googleClientIds).some(Boolean),
    [googleClientIds],
  );
  const hasAuthAvailable = Boolean(isFirebaseConfigured && auth);

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: googleClientIds.expo,
    iosClientId: googleClientIds.ios,
    androidClientId: googleClientIds.android,
    webClientId: googleClientIds.web,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    getRememberMePreference().then((value) => setRememberMe(value));
  }, []);

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type !== 'success') return;
      if (!hasAuthAvailable) {
        Alert.alert('Configuração pendente', 'Configure o Firebase para continuar.');
        return;
      }

      const idToken = response.authentication?.idToken;
      const accessToken = response.authentication?.accessToken;
      if (!idToken) {
        Alert.alert('Google', 'Não foi possível obter o token de login.');
        return;
      }

      setIsSubmitting(true);
      try {
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const result = await signInWithCredential(auth, credential);
        await setRememberMePreference(rememberMe);
        onLoginSuccess?.({
          email: result.user.email || '',
          name: result.user.displayName || '',
          isNewUser: !result?.additionalUserInfo?.isNewUser ? false : true,
        });
      } catch (error) {
        Alert.alert('Google', 'Não foi possível entrar com o Google.');
      } finally {
        setIsSubmitting(false);
      }
    };

    handleGoogleResponse();
  }, [response, rememberMe, onLoginSuccess, hasAuthAvailable]);

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
    if (!hasAuthAvailable) {
      Alert.alert('Configuração pendente', 'Configure o Firebase para continuar.');
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert('Campo obrigatório', 'Informe um e-mail válido.');
      return;
    }
    if (!password) {
      Alert.alert('Campo obrigatório', 'Informe sua senha.');
      return;
    }
    if (!isLogin && !name.trim()) {
      Alert.alert('Campo obrigatório', 'Informe seu nome completo.');
      return;
    }
    if (!isLogin && password.length < 6) {
      Alert.alert('Senha fraca', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      Alert.alert('Senha incorreta', 'As senhas não conferem.');
      return;
    }

    setIsSubmitting(true);
    const action = isLogin
      ? signInWithEmailAndPassword(auth, trimmedEmail, password)
      : createUserWithEmailAndPassword(auth, trimmedEmail, password).then(async (result) => {
          if (name.trim()) {
            await updateProfile(result.user, { displayName: name.trim() });
          }
          return result;
        });

    action
      .then(async () => {
        await setRememberMePreference(rememberMe);
        triggerSuccess();
      })
      .catch((error) => {
        const message = error?.message?.includes('auth/user-not-found')
          ? 'Usuário não encontrado.'
          : error?.message?.includes('auth/wrong-password')
            ? 'Senha incorreta.'
            : error?.message?.includes('auth/email-already-in-use')
              ? 'Este e-mail já está cadastrado.'
              : 'Não foi possível autenticar. Verifique seus dados.';
        Alert.alert('Falha no login', message);
      })
      .finally(() => setIsSubmitting(false));
  };

  const handleForgotPassword = async () => {
    if (!hasAuthAvailable) {
      Alert.alert('Configuração pendente', 'Configure o Firebase para continuar.');
      return;
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      Alert.alert('Recuperar senha', 'Informe o e-mail para enviar o link.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      Alert.alert('Recuperar senha', 'Enviamos um link de redefinição para o seu e-mail.');
    } catch (error) {
      Alert.alert('Recuperar senha', 'Não foi possível enviar o e-mail. Verifique o endereço.');
    }
  };

  const toggleMode = () => {
    if (!isLogin) {
      setName('');
    }
    setPassword('');
    setConfirmPassword('');
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

            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputField}
                placeholder="Senha"
                placeholderTextColor={COLORS.placeholder}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={styles.inputIconButton}
                onPress={() => setShowPassword((prev) => !prev)}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} color={COLORS.placeholder} />
              </TouchableOpacity>
            </View>
            
            {!isLogin && (
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Confirmar Senha"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.inputIconButton}
                  onPress={() => setShowConfirmPassword((prev) => !prev)}
                >
                  <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color={COLORS.placeholder} />
                </TouchableOpacity>
              </View>
            )}

            {isLogin ? (
              <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotButton}>
                <Text style={styles.forgotText}>Esqueci minha senha</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.rememberRow}>
              <Text style={styles.rememberLabel}>Manter logado</Text>
              <Switch
                value={rememberMe}
                onValueChange={(value) => {
                  setRememberMe(value);
                  setRememberMePreference(value);
                }}
                trackColor={{ false: 'rgba(26,32,44,0.2)', true: COLORS.primary }}
                thumbColor={rememberMe ? COLORS.surface : '#f4f3f4'}
              />
            </View>
            
            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
              onPress={handlePrimaryAction}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={COLORS.textOnPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>{isLogin ? 'Entrar' : 'Criar conta'}</Text>
              )}
            </TouchableOpacity>
            
            <Text style={styles.dividerText}>OU</Text>

            <View style={styles.socialLoginContainer}>
              <TouchableOpacity
                style={[styles.socialButton, (!hasGoogleConfig || !hasAuthAvailable) && styles.socialButtonDisabled]}
                onPress={() => promptAsync()}
                disabled={!hasGoogleConfig || !request || !hasAuthAvailable}
              >
                <FontAwesome name="google" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {!hasGoogleConfig ? (
              <Text style={styles.socialHint}>
                Configure os Client IDs do Google para ativar este login.
              </Text>
            ) : null}
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
  inputRow: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    marginBottom: 15,
  },
  inputField: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
  },
  inputIconButton: {
    padding: 6,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 30,
    // Removi a margem superior para o botão de teste controlar o espaçamento
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.textOnPrimary,
    textAlign: 'center',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
  },
  forgotText: { ...TYPOGRAPHY.caption, color: COLORS.primary },
  rememberRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberLabel: { ...TYPOGRAPHY.body, color: COLORS.text },
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
  socialButtonDisabled: {
    opacity: 0.5,
  },
  socialHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.placeholder,
    marginTop: 12,
    textAlign: 'center',
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
