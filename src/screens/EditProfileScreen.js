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
import Icon from 'react-native-vector-icons/Feather';

import { useClientStore } from '../store/useClientStore';
import { saveUserProfile } from '../utils/firestoreService';
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
    if (!currentUserId) {
      Alert.alert('Conta', 'Não foi possível identificar o usuário.');
      return;
    }
    setIsSaving(true);
    try {
      await saveUserProfile({
        uid: currentUserId,
        profile: {
          name: trimmed,
          email: userEmail || '',
          phone: phone.trim(),
          profession: profession.trim(),
          birthdate: userBirthdate || '',
        },
      });
      setUserDoc({
        name: trimmed,
        phone: phone.trim(),
        profession: profession.trim(),
      });
      navigation.goBack();
    } catch (error) {
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
