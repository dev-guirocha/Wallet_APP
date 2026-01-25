// /src/screens/HomeScreen.js

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { formatCurrency, getNextDueDateFromDay } from '../utils/dateUtils';
import { getAppointmentsForDate } from '../utils/schedule';
import { useClientStore } from '../store/useClientStore';
import { generateAndShareReceipt } from '../utils/receiptGenerator';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';

const getGreetingLabel = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const HomeScreen = ({ navigation }) => {
  const clients = useClientStore((state) => state.clients);
  const userName = useClientStore((state) => state.userName);
  const togglePayment = useClientStore((state) => state.togglePayment);

  const [selectedPayment, setSelectedPayment] = useState(null);

  const monthLabel = useMemo(() => {
    const month = new Date().toLocaleDateString('pt-BR', { month: 'long' });
    return month.charAt(0).toUpperCase() + month.slice(1);
  }, []);

  const financialData = useMemo(() => {
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const totalToReceive = clients.reduce((sum, client) => sum + Number(client.value || 0), 0);

    const received = clients.reduce((sum, client) => {
      const payment = client.payments?.[currentMonthKey];
      const isPaid = typeof payment === 'object' ? payment?.status === 'paid' : payment === 'pago';
      return isPaid ? sum + Number(client.value || 0) : sum;
    }, 0);

    const pending = totalToReceive - received;
    const progress = totalToReceive > 0 ? (received / totalToReceive) * 100 : 0;

    return {
      total: totalToReceive,
      received,
      pending,
      progress: `${progress}%`,
    };
  }, [clients]);

  const upcomingPayments = useMemo(() => {
    const now = new Date();
    const currentMonthKey = now.toISOString().slice(0, 7);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return clients
      .map((client) => {
        const payment = client.payments?.[currentMonthKey];
        const isPaid = typeof payment === 'object' ? payment?.status === 'paid' : payment === 'pago';

        let nextDueDate = null;
        if (!isPaid && client.dueDay) {
          nextDueDate = getNextDueDateFromDay(client.dueDay, startOfToday, client.time);
        }

        return { ...client, isPaid, nextDueDate };
      })
      .filter((client) => !client.isPaid && client.nextDueDate)
      .sort((a, b) => a.nextDueDate - b.nextDueDate)
      .slice(0, 10);
  }, [clients]);

  const todayAppointments = useMemo(() => {
    const today = new Date();
    return getAppointmentsForDate({ date: today, clients });
  }, [clients]);

  const handleTogglePaymentFromMenu = () => {
    if (selectedPayment) {
      const currentMonthKey = new Date().toISOString().slice(0, 7);
      togglePayment(selectedPayment.id, currentMonthKey);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSelectedPayment(null);
  };

  const handleReceiptGeneration = async () => {
    if (!selectedPayment) return;

    await generateAndShareReceipt({
      clientName: selectedPayment.name,
      amount: selectedPayment.value || 0,
      date: new Date(),
      professionalName: userName || 'Profissional',
      serviceDescription: 'Prestacao de servicos mensais',
    });

    setSelectedPayment(null);
  };

  const getGreeting = () => {
    const base = getGreetingLabel();
    if (userName) return `${base}, ${userName}`;
    return `${base}!`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Configurações')}
          >
            <Icon name="settings" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Resumo de {monthLabel}</Text>
            <Icon name="bar-chart-2" size={20} color={COLORS.primary} />
          </View>

          <View style={styles.summaryValues}>
            <View>
              <Text style={styles.label}>Recebido</Text>
              <Text style={styles.bigValue}>{formatCurrency(financialData.received)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.label}>Previsto</Text>
              <Text style={styles.subValue}>{formatCurrency(financialData.total)}</Text>
            </View>
          </View>

          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: financialData.progress }]} />
          </View>
          <Text style={styles.progressText}>
            Falta {formatCurrency(financialData.pending)} para a meta
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>A Receber</Text>
          <FlatList
            data={upcomingPayments}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.emptyText}>Tudo pago por enquanto!</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.paymentCard}
                onPress={() => setSelectedPayment(item)}
              >
                <View style={styles.paymentIcon}>
                  <Icon name="dollar-sign" size={20} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.paymentName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.paymentDate}>
                    Vence{' '}
                    {item.nextDueDate.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Agenda Hoje</Text>
          {todayAppointments.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="calendar" size={40} color={COLORS.textSecondary} style={{ opacity: 0.3 }} />
              <Text style={styles.emptyText}>Agenda livre hoje.</Text>
            </View>
          ) : (
            todayAppointments.map((appointment) => (
              <View key={appointment.id} style={styles.appointmentRow}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeText}>{appointment.time}</Text>
                </View>
                <View style={styles.appointmentCard}>
                  <Text style={styles.appName}>{appointment.name}</Text>
                  <Text style={styles.appLocation}>{appointment.location}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddClient')}>
        <Icon name="plus" size={28} color={COLORS.textOnPrimary} />
      </TouchableOpacity>

      <Modal
        visible={!!selectedPayment}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPayment(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedPayment(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{selectedPayment?.name}</Text>
                <Text style={styles.modalSubtitle}>
                  Valor: {formatCurrency(selectedPayment?.value || 0)}
                </Text>

                <TouchableOpacity
                  style={styles.modalButtonPrimary}
                  onPress={handleTogglePaymentFromMenu}
                >
                  <Icon name="check-circle" size={20} color={COLORS.textOnPrimary} />
                  <Text style={styles.modalButtonText}>Marcar como Pago</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalButtonSecondary}
                  onPress={handleReceiptGeneration}
                >
                  <Icon name="share" size={20} color={COLORS.primary} />
                  <Text style={[styles.modalButtonText, { color: COLORS.primary }]}
                  >
                    Enviar Recibo
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  header: {
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { ...TYPOGRAPHY.title, color: COLORS.textPrimary },
  date: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  profileButton: {
    padding: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  summaryCard: {
    marginHorizontal: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    ...SHADOWS.medium,
    marginBottom: 30,
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  summaryTitle: { ...TYPOGRAPHY.subtitle, color: COLORS.textSecondary },
  summaryValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  bigValue: { ...TYPOGRAPHY.hero, color: COLORS.textPrimary },
  subValue: { ...TYPOGRAPHY.subtitle, color: COLORS.textSecondary },
  label: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 4 },
  progressBg: { height: 8, backgroundColor: '#EDF2F7', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  progressText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, fontStyle: 'italic' },
  section: { marginBottom: 30 },
  sectionTitle: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.textPrimary,
    marginLeft: 24,
    marginBottom: 15,
  },
  paymentCard: {
    width: 190,
    backgroundColor: COLORS.surface,
    marginLeft: 24,
    borderRadius: 16,
    padding: 16,
    ...SHADOWS.small,
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(43,108,176,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  paymentDate: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 2 },
  emptyText: { ...TYPOGRAPHY.body, marginLeft: 24, color: COLORS.textSecondary },
  appointmentRow: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16 },
  timeColumn: { width: 60, alignItems: 'center', paddingTop: 10 },
  timeText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  appointmentCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    ...SHADOWS.small,
  },
  appName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  appLocation: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 4 },
  emptyState: { alignItems: 'center', padding: 20 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  modalTitle: { ...TYPOGRAPHY.title, color: COLORS.textPrimary, marginBottom: 8 },
  modalSubtitle: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginBottom: 24 },
  modalButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    width: '100%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  modalButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF8FF',
    width: '100%',
    padding: 16,
    borderRadius: 16,
  },
  modalButtonText: { ...TYPOGRAPHY.button, color: COLORS.textOnPrimary, marginLeft: 8 },
});

export default HomeScreen;
