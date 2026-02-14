import React, { useState } from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';

import { useClientStore } from '../store/useClientStore';
import { updateUserPrivacy } from '../utils/firestoreService';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const PrivacyScreen = ({ navigation }) => {
  const currentUserId = useClientStore((state) => state.currentUserId);
  const hideBalances = useClientStore((state) => state.privacyHideBalances);
  const setPrivacyHideBalances = useClientStore((state) => state.setPrivacyHideBalances);

  const [isSaving, setIsSaving] = useState(false);

  const handleToggle = async (value) => {
    setPrivacyHideBalances(value);
    if (!currentUserId) return;
    setIsSaving(true);
    try {
      await updateUserPrivacy({ uid: currentUserId, hideBalances: value });
    } catch (error) {
      // ignore
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
        <Text style={styles.title}>Privacidade</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Saldo e valores</Text>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Icon name="eye-off" size={18} color={COLORS.textSecondary} />
            <Text style={styles.rowLabel}>Ocultar valores na Home</Text>
          </View>
          <Switch
            value={hideBalances}
            onValueChange={handleToggle}
            disabled={isSaving}
            trackColor={{ false: 'rgba(26,32,44,0.2)', true: COLORS.primary }}
            thumbColor={hideBalances ? COLORS.surface : '#f4f3f4'}
          />
        </View>
        <Text style={styles.helperText}>
          Quando ativado, os valores financeiros ficarão mascarados na tela inicial.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
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
  cardTitle: { ...TYPOGRAPHY.overline, color: COLORS.textSecondary, marginBottom: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, marginLeft: 10 },
  helperText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 10 },
});

export default PrivacyScreen;
