import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Swiper from 'react-native-swiper';
import { Feather } from '@expo/vector-icons';
import { COLORS as THEME, TYPOGRAPHY } from '../theme/legacy';
import { useClientStore } from '../store/useClientStore';
import {
  requestNotificationPermissionAsync,
  shouldAskForNotificationPermission,
} from '../utils/notifications';

const COLORS = {
  background: THEME.background,
  surface: THEME.surface,
  text: THEME.textPrimary,
  secondary: THEME.textSecondary,
  primary: THEME.primary,
  border: THEME.border,
  textOnPrimary: THEME.textOnPrimary,
};

const onboardingData = [
  {
    iconName: 'pie-chart',
    title: 'Clareza e Controle',
    description: 'Tenha recebimentos, despesas e clientes em um workspace financeiro inteligente.',
  },
  {
    iconName: 'calendar',
    title: 'Agenda Inteligente',
    description: 'Organize seus compromissos e visualize sua rotina diaria.',
  },
  {
    iconName: 'award',
    title: 'Foco no Essencial',
    description: 'Menos burocracia, mais tempo para o que realmente importa.',
  },
  {
    type: 'notifications',
    iconName: 'bell',
    title: 'Lembretes Inteligentes',
    description: 'Receba avisos de cobranca e compromissos sem perder nada.',
  },
];

const OnboardingScreen = ({
  onComplete,
  onRequestNotifications,
  notificationsEnabled,
  canAskNotifications,
}) => {
  const swiperRef = useRef(null);
  const storeNotificationsEnabled = useClientStore((state) => state.notificationsEnabled);
  const setNotificationsEnabled = useClientStore((state) => state.setNotificationsEnabled);
  const resolvedNotificationsEnabled =
    typeof notificationsEnabled === 'boolean' ? notificationsEnabled : storeNotificationsEnabled;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localNotificationsEnabled, setLocalNotificationsEnabled] = useState(
    Boolean(resolvedNotificationsEnabled),
  );
  const [localCanAskNotifications, setLocalCanAskNotifications] = useState(
    true,
  );

  useEffect(() => {
    setLocalNotificationsEnabled(Boolean(resolvedNotificationsEnabled));
  }, [resolvedNotificationsEnabled]);

  useEffect(() => {
    let active = true;

    const syncPermission = async () => {
      if (typeof canAskNotifications === 'boolean') {
        setLocalCanAskNotifications(Boolean(canAskNotifications));
        return;
      }
      const canAsk = await shouldAskForNotificationPermission();
      if (active) {
        setLocalCanAskNotifications(Boolean(canAsk));
      }
    };

    syncPermission();

    return () => {
      active = false;
    };
  }, [canAskNotifications]);

  const handlePress = () => {
    if (currentIndex < onboardingData.length - 1) {
      swiperRef.current?.scrollBy(1);
      return;
    }
    onComplete?.();
  };

  const handleNotificationsPress = async () => {
    try {
      let granted = false;
      if (onRequestNotifications) {
        const result = await onRequestNotifications();
        granted = Boolean(result);
      } else {
        granted = await requestNotificationPermissionAsync();
      }

      setLocalNotificationsEnabled(granted);
      setNotificationsEnabled(granted);

      if (!onRequestNotifications) {
        const canAsk = await shouldAskForNotificationPermission();
        setLocalCanAskNotifications(Boolean(canAsk));
      }
    } catch (_error) {
      setLocalNotificationsEnabled(false);
      setNotificationsEnabled(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.brandBlock}>
        <Text style={styles.brandTitle}>Flowdesk</Text>
        <Text style={styles.brandSubtitle}>Intelligent financial workspace for service professionals</Text>
      </View>
      <Swiper
        ref={swiperRef}
        style={styles.wrapper}
        showsButtons={false}
        loop={false}
        activeDotColor={COLORS.primary}
        dotColor={'rgba(113,128,150,0.3)'}
        onIndexChanged={(index) => setCurrentIndex(index)}
      >
        {onboardingData.map((item, index) => (
          <View key={`${item.title}-${index}`} style={styles.slide}>
            <View style={styles.slideCard}>
              <Feather name={item.iconName} size={72} color={COLORS.primary} style={styles.icon} />
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>

              {item.type === 'notifications' ? (
                <View style={styles.permissionCard}>
                  <View style={styles.permissionHeader}>
                    <Feather name="bell" size={24} color={COLORS.text} />
                    <View style={styles.permissionTextBlock}>
                      <Text style={styles.permissionTitle}>Receber lembretes</Text>
                      <Text style={styles.permissionSubtitle}>
                        Ative notificacoes para cobranca e compromissos automaticos.
                      </Text>
                    </View>
                  </View>
                  {localNotificationsEnabled ? (
                    <View style={styles.permissionStatus}>
                      <Feather name="check" size={16} color={COLORS.primary} />
                      <Text style={styles.permissionStatusText}>Notificacoes ativadas</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.permissionButton,
                        !localCanAskNotifications && styles.permissionButtonDisabled,
                      ]}
                      onPress={handleNotificationsPress}
                      disabled={!localCanAskNotifications}
                    >
                      <Text style={styles.permissionButtonText}>
                        {localCanAskNotifications
                          ? 'Ativar lembretes'
                          : 'Verifique as configuracoes do sistema'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </Swiper>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.doneButton} onPress={handlePress}>
          <Text style={styles.doneButtonText}>
            {currentIndex < onboardingData.length - 1 ? 'Continuar' : 'Comecar'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  wrapper: {
    marginTop: 8,
  },
  brandBlock: {
    paddingHorizontal: 30,
    paddingTop: 20,
    alignItems: 'center',
  },
  brandTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
    textAlign: 'center',
  },
  brandSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.secondary,
    marginTop: 2,
    textAlign: 'center',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  slideCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    ...TYPOGRAPHY.title,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    ...TYPOGRAPHY.body,
    color: COLORS.secondary,
    textAlign: 'center',
    lineHeight: 25,
  },
  footer: {
    padding: 30,
    paddingTop: 4,
  },
  permissionCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 18,
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: 'stretch',
  },
  permissionHeader: { flexDirection: 'row', alignItems: 'center' },
  permissionTextBlock: { marginLeft: 12, flex: 1 },
  permissionTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.text },
  permissionSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.secondary, marginTop: 4 },
  permissionButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  permissionButtonDisabled: { opacity: 0.5 },
  permissionButtonText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textOnPrimary },
  permissionStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  permissionStatusText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, marginLeft: 6 },
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 30,
  },
  doneButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.textOnPrimary,
    textAlign: 'center',
  },
});

export default OnboardingScreen;
