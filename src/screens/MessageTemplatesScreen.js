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
import { updateUserTemplates } from '../utils/firestoreService';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const DEFAULT_CONFIRM_TEMPLATE = 'Boa noite {nome}! Aula confirmada para {hora}!';
const DEFAULT_CHARGE_TEMPLATE = 'Olá {nome}, sua cobrança vence em {data}.';
const SAVE_TIMEOUT_MS = 8000;

const withTimeout = (promise, timeoutMs = SAVE_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('timeout'));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

const MessageTemplatesScreen = ({ navigation }) => {
  const currentUserId = useClientStore((state) => state.currentUserId);
  const templates = useClientStore((state) => state.templates);
  const setTemplates = useClientStore((state) => state.setTemplates);

  const [confirmMsg, setConfirmMsg] = useState(
    String(templates?.confirmMsg || '').trim() || DEFAULT_CONFIRM_TEMPLATE
  );
  const [chargeMsg, setChargeMsg] = useState(
    String(templates?.chargeMsg || '').trim() || DEFAULT_CHARGE_TEMPLATE
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    if (!currentUserId) {
      Alert.alert('Conta', 'Não foi possível identificar o usuário.');
      return;
    }

    const nextConfirm = String(confirmMsg || '').trim() || DEFAULT_CONFIRM_TEMPLATE;
    const nextCharge = String(chargeMsg || '').trim() || DEFAULT_CHARGE_TEMPLATE;

    setIsSaving(true);
    try {
      await withTimeout(
        updateUserTemplates({
          uid: currentUserId,
          templates: {
            confirmMsg: nextConfirm,
            chargeMsg: nextCharge,
          },
        })
      );
      setTemplates({
        confirmMsg: nextConfirm,
        chargeMsg: nextCharge,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Mensagens',
        'Não foi possível salvar suas preferências. Verifique sua conexão e tente novamente.'
      );
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
        <Text style={styles.title}>Preferências de mensagens</Text>
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
            <Text style={styles.label}>Mensagem de confirmação</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={confirmMsg}
              onChangeText={setConfirmMsg}
              placeholder={DEFAULT_CONFIRM_TEMPLATE}
              placeholderTextColor={COLORS.textSecondary}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.helperText}>Variáveis: {'{nome}'}, {'{hora}'}, {'{data}'}</Text>

            <Text style={styles.label}>Mensagem de cobrança</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={chargeMsg}
              onChangeText={setChargeMsg}
              placeholder={DEFAULT_CHARGE_TEMPLATE}
              placeholderTextColor={COLORS.textSecondary}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.helperText}>Variáveis: {'{nome}'}, {'{data}'}, {'{dd}'}, {'{mm}'}</Text>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Salvando...' : 'Salvar mensagens'}
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
  helperText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 6 },
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
  inputMultiline: { minHeight: 110 },
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

export default MessageTemplatesScreen;
