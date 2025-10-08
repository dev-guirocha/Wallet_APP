// /src/screens/SettingsScreen.js

import React from 'react';
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

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
  accent: '#5D5D5D',
  card: 'rgba(30,30,30,0.05)',
};

const SettingsScreen = ({
  navigation,
  planTier = 'free',
  clientLimit = 0,
  clientCount = 0,
  notificationsEnabled = false,
  canAskNotifications = true,
  onRequestNotifications,
  onToggleNotifications,
  notificationPermissionGranted = false,
  onSignOut,
  onUpgradePlan,
}) => {
  const renderPlanLabel = () => {
    if (planTier === 'premium' || planTier === 'pro') return 'Plano Pro';
    return 'Plano Gratuito';
  };

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
    if (typeof onToggleNotifications === 'function') {
      try {
        const result = await onToggleNotifications(nextValue);
        if (nextValue) {
          if (result) {
            notify('Notificações ativadas.');
          } else {
            notify('Não foi possível ativar as notificações. Verifique as permissões do sistema.');
          }
        } else {
          notify('Notificações desativadas.');
        }
      } catch (error) {
        notify('Não foi possível atualizar as notificações.');
      }
    } else if (nextValue && typeof onRequestNotifications === 'function') {
      // Fallback para fluxos legados
      const granted = await onRequestNotifications();
      notify(
        granted
          ? 'Notificações ativadas.'
          : 'Não foi possível ativar as notificações. Verifique as permissões do sistema.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
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
                disabled={!notificationPermissionGranted && !canAskNotifications}
                trackColor={{ false: 'rgba(30,30,30,0.2)', true: COLORS.text }}
                thumbColor={notificationsEnabled ? COLORS.background : '#f4f3f4'}
              />
              {!notificationPermissionGranted && !canAskNotifications ? (
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
                  ? `${clientCount}/${clientLimit} cadastros disponíveis`
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
          <Icon name="log-out" size={18} color="#C70039" />
          <Text style={styles.signOutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 24, paddingBottom: 80 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  avatarWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTextBlock: { flex: 1 },
  profileName: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  profileSubtitle: { fontSize: 14, color: COLORS.accent, marginTop: 4 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.accent, marginBottom: 14, textTransform: 'uppercase' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { fontSize: 15, color: COLORS.text, fontWeight: '600', marginLeft: 12 },
  helperText: { fontSize: 12, color: COLORS.placeholder, marginTop: 6 },
  planLabel: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  planButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.text,
  },
  planButtonSecondary: { backgroundColor: 'rgba(30,30,30,0.08)' },
  planButtonText: { color: COLORS.background, fontSize: 13, fontWeight: '600' },
  planButtonTextSecondary: { color: COLORS.text },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30,30,30,0.08)',
  },
  menuItemText: { marginLeft: 12, color: COLORS.text, fontSize: 15, fontWeight: '600' },
  menuItemDanger: { borderBottomWidth: 0 },
  signOutButton: {
    marginTop: 12,
    backgroundColor: 'rgba(199,0,57,0.12)',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  signOutText: { color: '#C70039', fontSize: 15, fontWeight: '700', marginLeft: 10 },
});

export default SettingsScreen;
