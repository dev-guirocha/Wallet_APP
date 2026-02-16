import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Card, FormField, FormScreen } from '../components';
import { useClientStore } from '../store/useClientStore';
import { updateUserTemplates } from '../utils/firestoreService';
import { COLORS, TYPOGRAPHY } from '../theme/legacy';
import { templatesCopy } from '../utils/uiCopy';

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
    } catch (_error) {
      Alert.alert(
        'Mensagens',
        templatesCopy.saveError
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormScreen
      title={templatesCopy.title}
      navigation={navigation}
      onSubmit={handleSave}
      submitLabel={templatesCopy.submit}
      loading={isSaving}
    >
      <Card style={styles.card}>
        <FormField
          label={templatesCopy.confirmLabel}
          helper={templatesCopy.confirmHelper}
          style={styles.field}
        >
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={confirmMsg}
            onChangeText={setConfirmMsg}
            placeholder={DEFAULT_CONFIRM_TEMPLATE}
            placeholderTextColor={COLORS.textSecondary}
            multiline
            textAlignVertical="top"
            accessibilityLabel={templatesCopy.confirmLabel}
          />
        </FormField>

        <FormField
          label={templatesCopy.chargeLabel}
          helper={templatesCopy.chargeHelper}
          style={styles.fieldLast}
        >
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={chargeMsg}
            onChangeText={setChargeMsg}
            placeholder={DEFAULT_CHARGE_TEMPLATE}
            placeholderTextColor={COLORS.textSecondary}
            multiline
            textAlignVertical="top"
            accessibilityLabel={templatesCopy.chargeLabel}
          />
        </FormField>
      </Card>
    </FormScreen>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: 8 },
  field: { marginBottom: 16 },
  fieldLast: { marginBottom: 4 },
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
});

export default MessageTemplatesScreen;
