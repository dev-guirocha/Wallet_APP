// /src/screens/ProfileSetupScreen.js

import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useClientStore } from '../store/useClientStore';
import { auth } from '../utils/firebase';
import { saveUserProfile } from '../utils/firestoreService';
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

const formatDateLabel = (date) =>
  date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseBirthdate = (value) => {
  if (!value) return null;
  const parts = String(value).split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return new Date(year, month - 1, day);
};

const getAgeFromBirthdate = (date) => {
  if (!date) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() >= date.getDate());
  if (!hasBirthdayPassed) age -= 1;
  return age;
};

const ProfileSetupScreen = ({ onComplete, initialProfile }) => {
  const insets = useSafeAreaInsets();
  const setClientTerm = useClientStore((state) => state.setClientTerm);
  const setUserProfile = useClientStore((state) => state.setUserProfile);
  const currentUserId = useClientStore((state) => state.currentUserId);

  const scrollRef = useRef(null);
  const inputPositions = useRef({ email: 0, profession: 0 });

  const [name, setName] = useState(initialProfile?.name || '');
  const [phone, setPhone] = useState(initialProfile?.phone || '');
  const [email, setEmail] = useState(initialProfile?.email || '');
  const [profession, setProfession] = useState(initialProfile?.profession || '');
  const [birthdate, setBirthdate] = useState(() => {
    const parsed = parseBirthdate(initialProfile?.birthdate);
    return parsed || new Date(1995, 0, 1);
  });
  const [birthdateDraft, setBirthdateDraft] = useState(birthdate);
  const [showBirthdatePicker, setShowBirthdatePicker] = useState(false);

  const normalizedPhone = useMemo(() => formatPhoneBR(phone), [phone]);
  const ageNumber = useMemo(() => getAgeFromBirthdate(birthdate), [birthdate]);
  const topSpacing = Platform.OS === 'ios'
    ? Math.max(insets.top + 10, 42)
    : Math.max(insets.top + 12, 24);

  const openBirthdatePicker = () => {
    setBirthdateDraft(birthdate);
    setShowBirthdatePicker(true);
  };

  const handleBirthdateCancel = () => {
    setShowBirthdatePicker(false);
  };

  const handleBirthdateConfirm = () => {
    setBirthdate(birthdateDraft);
    setShowBirthdatePicker(false);
  };

  const handleContinue = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Atenção', 'Informe seu nome.');
      return;
    }

    if (!birthdate || Number.isNaN(birthdate.getTime())) {
      Alert.alert('Atenção', 'Informe sua data de nascimento.');
      return;
    }

    if (birthdate > new Date()) {
      Alert.alert('Atenção', 'A data de nascimento não pode ser no futuro.');
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
      birthdate: getDateKey(birthdate),
      phone: phoneDigits,
      email: trimmedEmail,
      profession: trimmedProfession,
    });

    const uid = currentUserId || auth?.currentUser?.uid || null;
    if (uid) {
      try {
        await saveUserProfile({
          uid,
          profile: {
            name: trimmedName,
            birthdate: getDateKey(birthdate),
            phone: phoneDigits,
            email: trimmedEmail,
            profession: trimmedProfession,
          },
        });
      } catch (error) {
        // ignore firestore profile errors
      }
    }

    onComplete?.();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.container, { paddingTop: topSpacing }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
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
              <Text style={styles.label}>Data de nascimento</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={openBirthdatePicker}
              >
                <Icon name="calendar" size={18} color={COLORS.textPrimary} />
                <Text style={styles.dateText}>{formatDateLabel(birthdate)}</Text>
              </TouchableOpacity>
              {ageNumber !== null ? (
                <Text style={styles.helperText}>Idade atual: {ageNumber} anos</Text>
              ) : null}
              {showBirthdatePicker && Platform.OS === 'ios' ? (
                <View style={styles.datePickerCard}>
                  <DateTimePicker
                    value={birthdateDraft}
                    mode="date"
                    display="spinner"
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setBirthdateDraft(selectedDate);
                      }
                    }}
                  />
                  <View style={styles.datePickerActions}>
                    <TouchableOpacity onPress={handleBirthdateCancel}>
                      <Text style={styles.datePickerActionText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleBirthdateConfirm}>
                      <Text style={styles.datePickerActionTextPrimary}>Concluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              {showBirthdatePicker && Platform.OS === 'android' ? (
                <DateTimePicker
                  value={birthdate}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    if (event?.type === 'dismissed') {
                      setShowBirthdatePicker(false);
                      return;
                    }
                    if (selectedDate) {
                      setBirthdate(selectedDate);
                    }
                    setShowBirthdatePicker(false);
                  }}
                />
              ) : null}
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

            <View
              style={styles.inputGroup}
              onLayout={(event) => {
                inputPositions.current.email = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                onFocus={() => {
                  scrollRef.current?.scrollTo({
                    y: Math.max(inputPositions.current.email - 24, 0),
                    animated: true,
                  });
                }}
                placeholder="voce@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            <View
              style={styles.inputGroup}
              onLayout={(event) => {
                inputPositions.current.profession = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.label}>Profissao</Text>
              <TextInput
                style={styles.input}
                value={profession}
                onChangeText={setProfession}
                onFocus={() => {
                  scrollRef.current?.scrollTo({
                    y: Math.max(inputPositions.current.profession - 24, 0),
                    animated: true,
                  });
                }}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, paddingBottom: 140 },
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
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  dateText: { ...TYPOGRAPHY.body, color: COLORS.textPrimary, marginLeft: 8 },
  helperText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 6 },
  datePickerCard: {
    marginTop: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  datePickerActionText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textSecondary },
  datePickerActionTextPrimary: { ...TYPOGRAPHY.buttonSmall, color: COLORS.primary },
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
