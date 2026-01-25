// /src/screens/ProfileSetupScreen.js

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';

import { useClientStore } from '../store/useClientStore';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const healthProfessions = [
  'fisioterapeuta',
  'fonoaudiologo',
  'medico',
  'medica',
  'profissional de educacao fisica',
  'personal trainer',
  'dentista',
  'odontologo',
  'odontologa',
  'terapeuta',
  'medico veterinario',
  'veterinario',
  'veterinaria',
  'farmaceutico',
  'farmaceutica',
  'biomedico',
  'biomedica',
  'enfermeiro',
  'enfermeira',
  'psicologo',
  'psicologa',
  'nutricionista',
  'terapeuta ocupacional',
];

const onlyDigits = (value = '') => String(value).replace(/\D+/g, '');

const formatPhoneBR = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const isValidEmail = (value) => /\S+@\S+\.\S+/.test(value);

const ProfileSetupScreen = ({ onComplete, initialProfile }) => {
  const setClientTerm = useClientStore((state) => state.setClientTerm);
  const setUserProfile = useClientStore((state) => state.setUserProfile);

  const [name, setName] = useState(initialProfile?.name || '');
  const [age, setAge] = useState(initialProfile?.age ? String(initialProfile.age) : '');
  const [phone, setPhone] = useState(initialProfile?.phone || '');
  const [email, setEmail] = useState(initialProfile?.email || '');
  const [profession, setProfession] = useState(initialProfile?.profession || '');

  const normalizedPhone = useMemo(() => formatPhoneBR(phone), [phone]);

  const handleContinue = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Atenção', 'Informe seu nome.');
      return;
    }

    const ageNumber = Number(onlyDigits(age));
    if (!Number.isInteger(ageNumber) || ageNumber <= 0 || ageNumber > 120) {
      Alert.alert('Atenção', 'Informe uma idade valida.');
      return;
    }

    const phoneDigits = onlyDigits(phone);
    if (phoneDigits.length < 10) {
      Alert.alert('Atenção', 'Informe um telefone valido com DDD.');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      Alert.alert('Atenção', 'Informe um e-mail valido.');
      return;
    }

    const trimmedProfession = profession.trim();
    if (!trimmedProfession) {
      Alert.alert('Atenção', 'Informe sua profissao.');
      return;
    }

    const normalizedProfession = trimmedProfession.toLowerCase();
    const term = healthProfessions.includes(normalizedProfession) ? 'Paciente' : 'Cliente';

    setClientTerm(term);
    setUserProfile({
      name: trimmedName,
      age: ageNumber,
      phone: phoneDigits,
      email: trimmedEmail,
      profession: trimmedProfession,
    });

    onComplete?.();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Vamos personalizar seu perfil</Text>
          <Text style={styles.subtitle}>Falta pouco para comecar.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Idade</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={(text) => setAge(onlyDigits(text).slice(0, 3))}
              placeholder="Ex: 32"
              keyboardType="numeric"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={styles.input}
              value={normalizedPhone}
              onChangeText={setPhone}
              placeholder="(11) 99999-9999"
              keyboardType="phone-pad"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Profissao</Text>
            <TextInput
              style={styles.input}
              value={profession}
              onChangeText={setProfession}
              placeholder="Ex: Personal Trainer"
              autoCapitalize="words"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
          <Text style={styles.primaryButtonText}>Comecar</Text>
          <Icon name="arrow-right" size={18} color={COLORS.textOnPrimary} style={styles.primaryButtonIcon} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 24, paddingBottom: 60 },
  header: { marginBottom: 24 },
  title: { ...TYPOGRAPHY.title, color: COLORS.textPrimary, marginBottom: 6 },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  inputGroup: { marginBottom: 18 },
  label: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 8 },
  input: {
    ...TYPOGRAPHY.body,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
  primaryButton: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { ...TYPOGRAPHY.button, color: COLORS.textOnPrimary },
  primaryButtonIcon: { marginLeft: 8 },
});

export default ProfileSetupScreen;
