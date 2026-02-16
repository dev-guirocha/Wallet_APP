import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Card, FormField, FormScreen } from '../components';
import { useClientStore } from '../store/useClientStore';
import { saveUserProfile } from '../utils/firestoreService';
import { auth } from '../utils/firebase';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../theme/legacy';
import { formLabels } from '../utils/uiCopy';

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
    <FormScreen
      title={formLabels.editProfile.title}
      navigation={navigation}
      onSubmit={handleSave}
      submitLabel={formLabels.editProfile.submit}
      loading={isSaving}
    >
      <Card style={styles.card}>
        <FormField label={formLabels.editProfile.fullName} style={styles.group}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={formLabels.editProfile.fullNamePlaceholder}
            placeholderTextColor={COLORS.textSecondary}
            accessibilityLabel={formLabels.editProfile.fullName}
          />
        </FormField>

        <FormField label={formLabels.editProfile.phone} style={styles.group}>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder={formLabels.editProfile.phonePlaceholder}
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="phone-pad"
            accessibilityLabel={formLabels.editProfile.phone}
          />
        </FormField>

        <FormField label={formLabels.editProfile.profession} style={styles.groupLast}>
          <TextInput
            style={styles.input}
            value={profession}
            onChangeText={setProfession}
            placeholder={formLabels.editProfile.professionPlaceholder}
            placeholderTextColor={COLORS.textSecondary}
            accessibilityLabel={formLabels.editProfile.profession}
          />
        </FormField>
      </Card>
    </FormScreen>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    ...SHADOWS.medium,
  },
  group: {
    marginBottom: 14,
  },
  groupLast: {
    marginBottom: 2,
  },
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
});

export default EditProfileScreen;
