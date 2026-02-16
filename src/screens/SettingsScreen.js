// /src/screens/SettingsScreen.js

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Platform,
  ToastAndroid,
  Alert,
  Image,
} from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AppScreen, Button, Card, ScreenHeader } from '../components';
import { useClientStore } from '../store/useClientStore';
import {
  cancelAllNotificationsAsync,
  getNotificationPermissionStatus,
  requestNotificationPermissionAsync,
} from '../utils/notifications';
import { COLORS as THEME, TYPOGRAPHY } from '../theme/legacy';
import { settingsCopy } from '../utils/uiCopy';

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
  const userName = useClientStore((state) => state.userName);
  const userPhotoURL = useClientStore((state) => state.userPhotoURL);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [canAskNotifications, setCanAskNotifications] = useState(true);
  const renderPlanLabel = () => {
    if (planTier === 'premium' || planTier === 'pro') return settingsCopy.proPlan;
    return settingsCopy.freePlan;
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
      notify(settingsCopy.notificationsDisabled);
      return;
    }

    const granted = await requestNotificationPermissionAsync();
    setNotificationsEnabled(granted);
    const status = await getNotificationPermissionStatus();
    setPermissionGranted(Boolean(status.granted));
    setCanAskNotifications(Boolean(status.canAsk));

    notify(
      granted
        ? settingsCopy.notificationsEnabled
        : settingsCopy.notificationsEnableError,
    );
  };

  return (
    <AppScreen scroll style={styles.safeArea} contentContainerStyle={styles.container}>
      <ScreenHeader title={settingsCopy.title} navigation={navigation} />
        <View style={styles.header}>
          <View style={styles.avatarWrapper}>
            {userPhotoURL ? (
              <Image source={{ uri: userPhotoURL }} style={styles.avatarImage} />
            ) : (
              <Icon name="user" size={32} color={COLORS.text} />
            )}
          </View>
          <View style={styles.headerTextBlock}>
            <Text style={styles.profileName}>
              {userName ? `Olá, ${userName}` : 'Olá!'}
            </Text>
            <Text style={styles.profileSubtitle}>{settingsCopy.profileSubtitle}</Text>
          </View>
        </View>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{settingsCopy.notificationsTitle}</Text>
          <View style={styles.rowBetween}>
            <View style={styles.row}
            >
              <Icon name="bell" size={20} color={COLORS.text} />
              <Text style={styles.rowLabel}>{settingsCopy.notificationsLabel}</Text>
            </View>
            <View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationChange}
                disabled={!permissionGranted && !canAskNotifications}
                trackColor={{ false: 'rgba(26,32,44,0.2)', true: COLORS.primary }}
                thumbColor={notificationsEnabled ? COLORS.surface : '#f4f3f4'}
                accessibilityLabel={settingsCopy.notificationsLabel}
              />
              {!permissionGranted && !canAskNotifications ? (
                <Text style={styles.helperText}>{settingsCopy.notificationsSystemHint}</Text>
              ) : null}
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{settingsCopy.planTitle}</Text>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.planLabel}>{renderPlanLabel()}</Text>
              <Text style={styles.helperText}>
                {planTier === 'free'
                  ? `${clientCount}/${FREE_CLIENT_LIMIT} cadastros disponíveis`
                  : `${clientCount} clientes cadastrados`}
              </Text>
            </View>
            <Button
              label={planTier === 'free' ? settingsCopy.planCtaFree : settingsCopy.planCtaPro}
              variant={planTier === 'free' ? 'primary' : 'secondary'}
              onPress={handlePlanPress}
              accessibilityLabel={planTier === 'free' ? settingsCopy.planCtaFree : settingsCopy.planCtaPro}
              style={styles.planButton}
              textStyle={styles.planButtonText}
            />
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{settingsCopy.accountTitle}</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation?.navigate('Editar Perfil')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={settingsCopy.editProfile}
          >
            <Icon name="user" size={18} color={COLORS.text} />
            <Text style={styles.menuItemText}>{settingsCopy.editProfile}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation?.navigate('Alterar Foto')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={settingsCopy.changePhoto}
          >
            <Icon name="image" size={18} color={COLORS.text} />
            <Text style={styles.menuItemText}>{settingsCopy.changePhoto}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation?.navigate('Privacidade')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={settingsCopy.privacy}
          >
            <Icon name="shield" size={18} color={COLORS.text} />
            <Text style={styles.menuItemText}>{settingsCopy.privacy}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation?.navigate('Preferências de mensagens')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={settingsCopy.templates}
          >
            <Icon name="message-square" size={18} color={COLORS.text} />
            <Text style={styles.menuItemText}>{settingsCopy.templates}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemLast]}
            onPress={() => navigation?.navigate('CobrancasHoje')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={settingsCopy.chargesToday}
          >
            <Icon name="message-circle" size={18} color={COLORS.text} />
            <Text style={styles.menuItemText}>{settingsCopy.chargesToday}</Text>
          </TouchableOpacity>
        </Card>

      <Button
        label={settingsCopy.signOut}
        variant="secondary"
        style={styles.signOutButton}
        textStyle={styles.signOutText}
        onPress={onSignOut}
        accessibilityLabel={settingsCopy.signOut}
      />
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { paddingBottom: 80 },
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
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  headerTextBlock: { flex: 1 },
  profileName: { ...TYPOGRAPHY.title, color: COLORS.text },
  profileSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.accent, marginTop: 4 },
  card: {
    marginBottom: 20,
  },
  cardTitle: { ...TYPOGRAPHY.overline, color: COLORS.accent, marginBottom: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, marginLeft: 12 },
  helperText: { ...TYPOGRAPHY.caption, color: COLORS.placeholder, marginTop: 6 },
  planLabel: { ...TYPOGRAPHY.subtitle, color: COLORS.text },
  planButton: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  planButtonText: { ...TYPOGRAPHY.buttonSmall },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemLast: { borderBottomWidth: 0 },
  menuItemText: { marginLeft: 12, ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  menuItemDanger: { borderBottomWidth: 0 },
  signOutButton: {
    marginTop: 12,
    borderColor: COLORS.danger,
  },
  signOutText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.danger },
});

export default SettingsScreen;
