import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';

import { AppScreen, Card, ScreenHeader } from '../components';
import { useClientStore } from '../store/useClientStore';
import { updateUserPrivacy } from '../utils/firestoreService';
import { COLORS, TYPOGRAPHY } from '../theme/legacy';
import { privacyCopy } from '../utils/uiCopy';

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
    } catch (_error) {
      Alert.alert(privacyCopy.title, privacyCopy.updateError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppScreen style={styles.safeArea}>
      <ScreenHeader title={privacyCopy.title} navigation={navigation} />

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{privacyCopy.balancesTitle}</Text>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Icon name="eye-off" size={18} color={COLORS.textSecondary} />
            <Text style={styles.rowLabel}>{privacyCopy.hideBalances}</Text>
          </View>
          <Switch
            value={hideBalances}
            onValueChange={handleToggle}
            disabled={isSaving}
            trackColor={{ false: 'rgba(26,32,44,0.2)', true: COLORS.primary }}
            thumbColor={hideBalances ? COLORS.surface : '#f4f3f4'}
            accessibilityLabel={privacyCopy.hideBalances}
          />
        </View>
        <Text style={styles.helperText}>
          {privacyCopy.helper}
        </Text>
      </Card>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  card: { marginTop: 8 },
  cardTitle: { ...TYPOGRAPHY.overline, color: COLORS.textSecondary, marginBottom: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, marginLeft: 10 },
  helperText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 10 },
});

export default PrivacyScreen;
