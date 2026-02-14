import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';

import { useClientStore } from '../store/useClientStore';
import { saveUserProfile } from '../utils/firestoreService';
import { auth } from '../utils/firebase';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const EditProfileScreen = ({ navigation }) => {
  const currentUserId = useClientStore((state) => state.currentUserId);
  const userName = useClientStore((state) => state.userName);
  const userEmail = useClientStore((state) => state.userEmail);
  const userPhone = useClientStore((state) => state.userPhone);
  const userProfession = useClientStore((state) => state.userProfession);
  const userBirthdate = useClientStore((state) => state.userBirthdate);
  const setUserDoc = useClientStore((state) => state.setUserDoc);

  const [name, setName] = useState(userName || '');
  const [phone, setPhone] = useState(userPhone || '');
  const [profession, setProfession] = useState(userProfession || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Atenção', 'Informe um nome válido.');
      return;
    }
    if (phone && phone.replace(/\D/g, '').length < 10) {
      Alert.alert('Telefone', 'Informe um número válido com DDD.');
      return;
    }
    const uid = currentUserId || auth?.currentUser?.uid || null;
    if (!uid) {
      Alert.alert('Conta', 'Não foi possível identificar o usuário.');
      return;
    }

    const trimmedPhone = phone.trim();
    const trimmedProfession = profession.trim();
    console.log('[profile] edit:save:start', { uid, hasEmail: Boolean(userEmail) });
    setIsSaving(true);
    try {
      const remoteSavePromise = saveUserProfile({
        uid,
        profile: {
          name: trimmed,
          email: userEmail || '',
          phone: trimmedPhone,
          profession: trimmedProfession,
          birthdate: userBirthdate || '',
        },
      });

      remoteSavePromise
        .then(() => console.log('[profile] edit:save:sync:ok'))
        .catch((syncError) =>
          console.warn('[profile] edit:save:sync:error', {
            message: syncError?.message || '',
            code: syncError?.code || 'unknown',
          })
        );

      await remoteSavePromise;

      setUserDoc({
        name: trimmed,
        phone: trimmedPhone,
        profession: trimmedProfession,
      });
      console.log('[profile] edit:save:done');
      navigation.goBack();
    } catch (error) {
      console.warn('[profile] edit:save:catch', {
        message: error?.message || '',
        code: error?.code || 'unknown',
      });
      Alert.alert('Erro', 'Não foi possível atualizar o perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Editar perfil</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.card}>
            <Text style={styles.label}>Nome completo</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              placeholderTextColor={COLORS.textSecondary}
            />
            <Text style={styles.label}>Telefone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="(00) 00000-0000"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="phone-pad"
            />
            <Text style={styles.label}>Profissão</Text>
            <TextInput
              style={styles.input}
              value={profession}
              onChangeText={setProfession}
              placeholder="Sua profissão"
              placeholderTextColor={COLORS.textSecondary}
            />
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Salvando...' : 'Salvar alterações'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  keyboardWrapper: { flex: 1 },
  scrollContainer: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
  headerSpacer: { width: 36 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  label: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 10, marginTop: 12 },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textOnPrimary },
});

export default EditProfileScreen;
