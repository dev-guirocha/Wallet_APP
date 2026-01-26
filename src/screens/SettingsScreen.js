// /src/screens/SettingsScreen.js

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Platform,
  ToastAndroid,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useClientStore } from '../store/useClientStore';
import {
  cancelAllNotificationsAsync,
  getNotificationPermissionStatus,
  requestNotificationPermissionAsync,
} from '../utils/notifications';
import { COLORS as THEME, TYPOGRAPHY } from '../constants/theme';

const COLORS = {
  background: THEME.background,
  surface: THEME.surface,
  text: THEME.textPrimary,
  placeholder: THEME.textSecondary,
  accent: THEME.textSecondary,
  card: THEME.surface,
  border: THEME.border,
  primary: THEME.primary,
  success: THEME.success,
  warning: THEME.warning,
  danger: THEME.danger,
  textOnPrimary: THEME.textOnPrimary,
};

const FREE_CLIENT_LIMIT = 3;

const SettingsScreen = ({ navigation, onSignOut }) => {
  const clientCount = useClientStore((state) => state.clients.length);
  const planTier = useClientStore((state) => state.planTier);
  const notificationsEnabled = useClientStore((state) => state.notificationsEnabled);
  const setNotificationsEnabled = useClientStore((state) => state.setNotificationsEnabled);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [canAskNotifications, setCanAskNotifications] = useState(true);
  const renderPlanLabel = () => {
    if (planTier === 'premium' || planTier === 'pro') return 'Plano Pro';
    return 'Plano Gratuito';
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refreshPermission = async () => {
        const status = await getNotificationPermissionStatus();
        if (!active) return;
        setPermissionGranted(Boolean(status.granted));
        setCanAskNotifications(Boolean(status.canAsk));
        if (!status.granted && notificationsEnabled) {
          setNotificationsEnabled(false);
          await cancelAllNotificationsAsync();
        }
      };

      refreshPermission();

      return () => {
        active = false;
      };
    }, [notificationsEnabled, setNotificationsEnabled])
  );

  const notify = (message) => {
    if (!message) return;
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Atualização', message);
    }
  };

  const handlePlanPress = () => {
    navigation?.navigate('PlanDetails');
  };

  const handleNotificationChange = async (nextValue) => {
    if (!nextValue) {
      setNotificationsEnabled(false);
      await cancelAllNotificationsAsync();
      notify('Notificações desativadas.');
      return;
    }

    const granted = await requestNotificationPermissionAsync();
    setNotificationsEnabled(granted);
    const status = await getNotificationPermissionStatus();
    setPermissionGranted(Boolean(status.granted));
    setCanAskNotifications(Boolean(status.canAsk));

    notify(
      granted
        ? 'Notificações ativadas.'
        : 'Não foi possível ativar as notificações. Verifique as permissões do sistema.',
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarButton}>
            <Icon name="arrow-left" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Configurações</Text>
          <View style={styles.topBarSpacer} />
        </View>
        <View style={styles.header}>
          <View style={styles.avatarWrapper}>
            <Icon name="user" size={32} color={COLORS.text} />
          </View>
          <View style={styles.headerTextBlock}>
            <Text style={styles.profileName}>Olá!</Text>
            <Text style={styles.profileSubtitle}>Personalize sua experiência</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notificações</Text>
          <View style={styles.rowBetween}>
            <View style={styles.row}
            >
              <Icon name="bell" size={20} color={COLORS.text} />
              <Text style={styles.rowLabel}>Lembretes do aplicativo</Text>
            </View>
            <View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationChange}
                disabled={!permissionGranted && !canAskNotifications}
                trackColor={{ false: 'rgba(26,32,44,0.2)', true: COLORS.primary }}
                thumbColor={notificationsEnabled ? COLORS.surface : '#f4f3f4'}
              />
              {!permissionGranted && !canAskNotifications ? (
                <Text style={styles.helperText}>Ative nas configurações do sistema</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Plano</Text>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.planLabel}>{renderPlanLabel()}</Text>
              <Text style={styles.helperText}>
                {planTier === 'free'
                  ? `${clientCount}/${FREE_CLIENT_LIMIT} cadastros disponíveis`
                  : `${clientCount} clientes cadastrados`}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.planButton, planTier !== 'free' && styles.planButtonSecondary]}
              onPress={handlePlanPress}
            >
              <Text
                style={[styles.planButtonText, planTier !== 'free' && styles.planButtonTextSecondary]}
              >
                {planTier === 'free' ? 'Conhecer Plano Pro' : 'Ver detalhes do Pro'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Conta</Text>
          <TouchableOpacity style={styles.menuItem}>
            <Icon name="user" size={18} color={COLORS.text} />
            <Text style={styles.menuItemText}>Editar perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Icon name="image" size={18} color={COLORS.text} />
            <Text style={styles.menuItemText}>Alterar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Icon name="shield" size={18} color={COLORS.text} />
            <Text style={styles.menuItemText}>Preferências de privacidade</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
          <Icon name="log-out" size={18} color={COLORS.danger} />
          <Text style={styles.signOutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 24, paddingBottom: 80 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    marginTop: 6,
  },
  topBarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topBarTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.text },
  topBarSpacer: { width: 36 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  avatarWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTextBlock: { flex: 1 },
  profileName: { ...TYPOGRAPHY.title, color: COLORS.text },
  profileSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.accent, marginTop: 4 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { ...TYPOGRAPHY.overline, color: COLORS.accent, marginBottom: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, marginLeft: 12 },
  helperText: { ...TYPOGRAPHY.caption, color: COLORS.placeholder, marginTop: 6 },
  planLabel: { ...TYPOGRAPHY.subtitle, color: COLORS.text },
  planButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primary,
  },
  planButtonSecondary: { backgroundColor: 'rgba(26,32,44,0.08)' },
  planButtonText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textOnPrimary },
  planButtonTextSecondary: { ...TYPOGRAPHY.buttonSmall, color: COLORS.text },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemText: { marginLeft: 12, ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  menuItemDanger: { borderBottomWidth: 0 },
  signOutButton: {
    marginTop: 12,
    backgroundColor: 'rgba(229,62,62,0.12)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  signOutText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.danger, marginLeft: 10 },
});

export default SettingsScreen;
