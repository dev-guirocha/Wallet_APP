// /src/screens/HomeScreen.js

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';

import {
  endOfDay,
  formatCurrency,
  formatDateLabel,
  formatTimeLabelFromDate,
  getDateKey,
  parseTimeLabelParts,
} from '../utils/dateUtils';
import { getAppointmentsForDate } from '../utils/schedule';
import { useClientStore } from '../store/useClientStore';
import { generateAndShareReceipt } from '../utils/receiptGenerator';
import { userReceivablesCollection } from '../utils/firestoreRefs';
import {
  createAppointmentOverride,
  updateUserPrivacy,
  markReceivablePaid,
  registerReceivableChargeSent,
} from '../utils/firestoreService';
import {
  applyTemplateVariables,
  buildPhoneE164FromRaw,
  openWhatsAppWithMessage,
} from '../utils/whatsapp';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import RescheduleModal from '../components/RescheduleModal';

const getGreetingLabel = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const DEFAULT_CONFIRM_TEMPLATE = 'Boa noite {nome}! Aula confirmada para {hora}!';
const DEFAULT_CHARGE_TEMPLATE = 'Olá {nome}, sua cobrança vence em {data}.';

const HomeScreen = ({ navigation }) => {
  const clients = useClientStore((state) => state.clients);
  const userName = useClientStore((state) => state.userName);
  const currentUserId = useClientStore((state) => state.currentUserId);
  const privacyHideBalances = useClientStore((state) => state.privacyHideBalances);
  const setPrivacyHideBalances = useClientStore((state) => state.setPrivacyHideBalances);
  const templates = useClientStore((state) => state.templates);
  const scheduleOverrides = useClientStore((state) => state.scheduleOverrides);

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [receivables, setReceivables] = useState([]);
  const [receivablesLoading, setReceivablesLoading] = useState(false);
  const [receivablesError, setReceivablesError] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

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

  useEffect(() => {
    if (!currentUserId) {
      setReceivables([]);
      setReceivablesLoading(false);
      setReceivablesError('');
      return;
    }

    setReceivablesLoading(true);
    setReceivablesError('');

    const receivablesQuery = query(
      userReceivablesCollection(currentUserId),
      where('paid', '==', false),
      orderBy('dueDate', 'asc'),
    );

    const unsubscribe = onSnapshot(
      receivablesQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setReceivables(items);
        setReceivablesLoading(false);
      },
      () => {
        setReceivablesLoading(false);
        setReceivablesError('Não foi possível carregar recebíveis.');
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  const upcomingPayments = useMemo(() => {
    const now = new Date();
    const endOfCurrentMonth = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const clientsMap = new Map(clients.map((client) => [client.id, client]));

    return receivables
      .map((receivable) => {
        const dueDate = receivable.dueDate?.toDate?.() || (receivable.dueDate ? new Date(receivable.dueDate) : null);
        const client = clientsMap.get(receivable.clientId) || null;
        const name = client?.name || receivable.clientName || 'Cliente';
        const amount = Number(receivable.amount ?? client?.value ?? 0);
        const isOverdue = dueDate && now.getTime() > endOfDay(dueDate).getTime();
        const phoneE164 = client?.phoneE164 || buildPhoneE164FromRaw(client?.phoneRaw || client?.phone || '');

        return {
          id: receivable.id,
          clientId: receivable.clientId,
          name,
          amount,
          dueDate,
          isOverdue,
          receivable,
          client,
          phoneE164,
        };
      })
      .filter((item) => item.dueDate && item.dueDate.getTime() <= endOfCurrentMonth.getTime())
      .sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return a.dueDate - b.dueDate;
      })
      .slice(0, 10);
  }, [clients, receivables]);

  const todayAppointments = useMemo(() => {
    const today = new Date();
    return getAppointmentsForDate({ date: today, clients, overrides: scheduleOverrides });
  }, [clients, scheduleOverrides]);

  const handleTogglePaymentFromMenu = async () => {
    if (!selectedPayment || !currentUserId) {
      setSelectedPayment(null);
      return;
    }

    try {
      await markReceivablePaid({
        uid: currentUserId,
        client: selectedPayment.client || { id: selectedPayment.clientId, name: selectedPayment.name, value: selectedPayment.amount },
        receivableId: selectedPayment.id,
        dueDate: selectedPayment.dueDate,
        amount: selectedPayment.amount,
        paid: true,
      });
    } catch (error) {
      Alert.alert('Pagamento', 'Não foi possível atualizar o recebimento.');
    }
    setSelectedPayment(null);
  };

  const handleReceiptGeneration = async () => {
    if (!selectedPayment) return;

    await generateAndShareReceipt({
      clientName: selectedPayment.name,
      amount: selectedPayment.amount || 0,
      date: new Date(),
      professionalName: userName || 'Profissional',
      serviceDescription: 'Prestacao de servicos mensais',
    });

    setSelectedPayment(null);
  };

  const buildAppointmentStartAt = (appointment) => {
    const dateKey = appointment.dateKey || getDateKey(new Date());
    const baseDate = new Date(`${dateKey}T12:00:00`);
    const { hour, minute } = parseTimeLabelParts(appointment.time, 9, 0);
    baseDate.setHours(hour, minute, 0, 0);
    return baseDate;
  };

  const handleConfirmAppointment = async (appointment) => {
    if (!appointment || !currentUserId) return;
    const client = clients.find((item) => item.id === appointment.clientId);
    const phoneE164 = client?.phoneE164 || buildPhoneE164FromRaw(client?.phoneRaw || client?.phone || '');
    const appointmentDate = buildAppointmentStartAt(appointment);
    const safeTime = appointment.time || '00:00';

    const lastConfirmation = appointment.confirmationSentAt;
    if (lastConfirmation) {
      const lastDate = lastConfirmation.toDate?.() || new Date(lastConfirmation);
      const today = new Date();
      if (
        lastDate.getDate() === today.getDate() &&
        lastDate.getMonth() === today.getMonth() &&
        lastDate.getFullYear() === today.getFullYear()
      ) {
        Alert.alert('Confirmação', 'Você já confirmou este compromisso hoje.');
        return;
      }
    }

    const template = templates?.confirmMsg?.trim() || DEFAULT_CONFIRM_TEMPLATE;
    const message = applyTemplateVariables(template, {
      nome: appointment.name,
      hora: appointment.time || '--:--',
      data: formatDateLabel(appointmentDate),
    });

    const opened = await openWhatsAppWithMessage({ phoneE164, message });
    if (!opened) return;

    try {
      const dateKey = appointment.dateKey || getDateKey(appointmentDate);
      await createAppointmentOverride({
        uid: currentUserId,
        appointmentId: `${appointment.clientId}-${dateKey}-${safeTime}`,
        payload: {
          clientId: appointment.clientId,
          dateKey,
          name: appointment.name,
          time: safeTime,
          location: appointment.location || '',
          startAt: Timestamp.fromDate(appointmentDate),
          confirmationSentAt: Timestamp.fromDate(new Date()),
        },
      });
    } catch (error) {
      // ignore confirmation tracking errors
    }
  };

  const handleCompleteAppointment = async (appointment) => {
    if (!appointment || !currentUserId) return;
    const appointmentDate = buildAppointmentStartAt(appointment);
    const dateKey = appointment.dateKey || getDateKey(appointmentDate);
    const safeTime = appointment.time || '00:00';
    try {
      await createAppointmentOverride({
        uid: currentUserId,
        appointmentId: `${appointment.clientId}-${dateKey}-${safeTime}`,
        payload: {
          clientId: appointment.clientId,
          dateKey,
          name: appointment.name,
          time: safeTime,
          location: appointment.location || '',
          status: 'done',
          statusUpdatedAt: Timestamp.fromDate(new Date()),
          startAt: Timestamp.fromDate(appointmentDate),
        },
      });
    } catch (error) {
      Alert.alert('Agenda', 'Não foi possível concluir o compromisso.');
    }
  };

  const handleOpenReschedule = (appointment) => {
    setRescheduleTarget(appointment);
    setRescheduleVisible(true);
  };

  const handleOpenAppointmentMenu = (appointment) => {
    setSelectedAppointment(appointment);
  };

  const handleCloseAppointmentMenu = () => {
    setSelectedAppointment(null);
  };

  const handleConfirmFromMenu = async () => {
    if (!selectedAppointment) return;
    const target = selectedAppointment;
    setSelectedAppointment(null);
    await handleConfirmAppointment(target);
  };

  const handleCompleteFromMenu = async () => {
    if (!selectedAppointment) return;
    const target = selectedAppointment;
    setSelectedAppointment(null);
    await handleCompleteAppointment(target);
  };

  const handleRescheduleFromMenu = () => {
    if (!selectedAppointment) return;
    const target = selectedAppointment;
    setSelectedAppointment(null);
    handleOpenReschedule(target);
  };

  const handleConfirmReschedule = async (newDate) => {
    if (!rescheduleTarget || !currentUserId) {
      setRescheduleVisible(false);
      setRescheduleTarget(null);
      return;
    }

    const oldAppointment = rescheduleTarget;
    const oldStartAt = buildAppointmentStartAt(oldAppointment);
    const oldDateKey = oldAppointment.dateKey || getDateKey(oldStartAt);
    const newDateKey = getDateKey(newDate);
    const oldSafeTime = oldAppointment.time || '00:00';
    const newTimeLabel = formatTimeLabelFromDate(newDate) || oldSafeTime;

    if (oldDateKey === newDateKey && newTimeLabel === oldSafeTime) {
      setRescheduleVisible(false);
      setRescheduleTarget(null);
      return;
    }

    try {
      await createAppointmentOverride({
        uid: currentUserId,
        appointmentId: `${oldAppointment.clientId}-${newDateKey}-${newTimeLabel}`,
        payload: {
          clientId: oldAppointment.clientId,
          dateKey: newDateKey,
          name: oldAppointment.name,
          time: newTimeLabel,
          location: oldAppointment.location || '',
          status: 'scheduled',
          action: 'add',
          startAt: Timestamp.fromDate(newDate),
        },
      });

      await createAppointmentOverride({
        uid: currentUserId,
        appointmentId: `${oldAppointment.clientId}-${oldDateKey}-${oldSafeTime}`,
        payload: {
          clientId: oldAppointment.clientId,
          dateKey: oldDateKey,
          name: oldAppointment.name,
          time: oldSafeTime,
          location: oldAppointment.location || '',
          status: 'rescheduled',
          rescheduledTo: Timestamp.fromDate(newDate),
          statusUpdatedAt: Timestamp.fromDate(new Date()),
          startAt: Timestamp.fromDate(oldStartAt),
        },
      });
    } catch (error) {
      Alert.alert('Agenda', 'Não foi possível remarcar o compromisso.');
    }

    setRescheduleVisible(false);
    setRescheduleTarget(null);
  };

  const handleChargeReceivable = async (payment) => {
    if (!payment) return;

    const last = payment.receivable?.lastChargeSentAt;
    if (last) {
      const lastDate = last.toDate?.() || new Date(last);
      const hoje = new Date();

      if (
        lastDate.getDate() === hoje.getDate() &&
        lastDate.getMonth() === hoje.getMonth() &&
        lastDate.getFullYear() === hoje.getFullYear()
      ) {
        Alert.alert('Cobrança', 'Você já enviou cobrança para este cliente hoje.');
        return;
      }
    }

    if (!currentUserId) return;
    const template = templates?.chargeMsg?.trim() || DEFAULT_CHARGE_TEMPLATE;
    const dueDate = payment.dueDate || new Date();
    const message = applyTemplateVariables(template, {
      nome: payment.name,
      dd: String(dueDate.getDate()).padStart(2, '0'),
      mm: String(dueDate.getMonth() + 1).padStart(2, '0'),
      data: formatDateLabel(dueDate),
    });

    const opened = await openWhatsAppWithMessage({ phoneE164: payment.phoneE164, message });
    if (!opened) return;

    try {
      await registerReceivableChargeSent({
        uid: currentUserId,
        receivableId: payment.id,
        usedTemplate: template,
      });
    } catch (error) {
      // ignore
    }
  };

  const handleToggleHideBalances = async () => {
    const previousValue = privacyHideBalances;
    const nextValue = !previousValue;
    setPrivacyHideBalances(nextValue);
    if (!currentUserId) return;
    try {
      await updateUserPrivacy({ uid: currentUserId, hideBalances: nextValue });
    } catch (error) {
      setPrivacyHideBalances(previousValue);
      Alert.alert('Privacidade', 'Não foi possível atualizar a preferência.');
    }
  };

  const getGreeting = () => {
    const base = getGreetingLabel();
    if (userName) return `${base}, ${userName}`;
    return `${base}!`;
  };

  const formatBalance = (value) => (privacyHideBalances ? '•••••' : formatCurrency(value));
  const receivablesEmptyLabel = receivablesLoading
    ? 'Carregando recebíveis...'
    : receivablesError || 'Tudo pago por enquanto!';

  const getStatusLabel = (status) => {
    if (status === 'done') return 'Concluído';
    if (status === 'rescheduled') return 'Remarcado';
    return 'Agendado';
  };

  const getStatusColor = (status) => {
    if (status === 'done') return COLORS.success;
    if (status === 'rescheduled') return COLORS.warning;
    return COLORS.primary;
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
            <View style={styles.summaryActions}>
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={handleToggleHideBalances}
              >
                <Icon name={privacyHideBalances ? 'eye-off' : 'eye'} size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <Icon name="bar-chart-2" size={20} color={COLORS.primary} />
            </View>
          </View>

          <View style={styles.summaryValues}>
            <View>
              <Text style={styles.label}>Recebido</Text>
              <Text style={styles.bigValue}>{formatBalance(financialData.received)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.label}>Previsto</Text>
              <Text style={styles.subValue}>{formatBalance(financialData.total)}</Text>
            </View>
          </View>

          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                { width: privacyHideBalances ? '0%' : financialData.progress },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            Falta {formatBalance(financialData.pending)} para a meta
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>A Receber</Text>
            <TouchableOpacity onPress={() => navigation.navigate('CobrancasHoje')}>
              <Text style={styles.sectionAction}>Cobranças de hoje</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={upcomingPayments}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.emptyText}>{receivablesEmptyLabel}</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.paymentCard}
                onPress={() => setSelectedPayment(item)}
              >
                <View style={styles.paymentIcon}>
                  <Icon name="dollar-sign" size={20} color={COLORS.primary} />
                </View>
                <View>
                  <Text
                    style={[styles.paymentName, item.isOverdue && styles.paymentNameOverdue]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text style={styles.paymentDate}>
                    Vence{' '}
                    {item.dueDate.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                  <TouchableOpacity
                    style={styles.chargeButton}
                    onPress={() => handleChargeReceivable(item)}
                  >
                    <Text style={styles.chargeButtonText}>
                      {item.receivable?.lastChargeSentAt ? 'Cobrar novamente' : 'Cobrar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Agenda Hoje</Text>
          </View>
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
                <TouchableOpacity
                  style={[
                    styles.appointmentCard,
                    { borderLeftColor: getStatusColor(appointment.status) },
                  ]}
                  onPress={() => handleOpenAppointmentMenu(appointment)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.appName}>{appointment.name}</Text>
                  <Text style={styles.appLocation}>{appointment.location}</Text>
                  <Text
                    style={[
                      styles.statusLabel,
                      { color: getStatusColor(appointment.status) },
                    ]}
                  >
                    {getStatusLabel(appointment.status)}
                  </Text>
                </TouchableOpacity>
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
                  Valor: {formatBalance(selectedPayment?.amount || 0)}
                </Text>
                {selectedPayment?.dueDate ? (
                  <Text style={styles.modalSubtitle}>
                    Vence em {selectedPayment.dueDate.toLocaleDateString('pt-BR')}
                  </Text>
                ) : null}

                <TouchableOpacity
                  style={styles.modalButtonPrimary}
                  onPress={handleTogglePaymentFromMenu}
                >
                  <Icon name="check-circle" size={20} color={COLORS.textOnPrimary} />
                  <Text style={styles.modalButtonText}>Marcar como Pago</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalButtonWarning}
                  onPress={() => handleChargeReceivable(selectedPayment)}
                >
                  <Icon name="message-circle" size={20} color={COLORS.warning} />
                  <Text style={[styles.modalButtonText, { color: COLORS.warning }]}>
                    Cobrar via WhatsApp
                  </Text>
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

      <Modal
        visible={!!selectedAppointment}
        transparent
        animationType="fade"
        onRequestClose={handleCloseAppointmentMenu}
      >
        <TouchableWithoutFeedback onPress={handleCloseAppointmentMenu}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.appointmentModalContent}>
                <Text style={styles.modalTitle}>{selectedAppointment?.name}</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedAppointment?.time || '00:00'} • {selectedAppointment?.location || 'Sem local'}
                </Text>

                <TouchableOpacity
                  style={styles.appointmentModalButtonPrimary}
                  onPress={handleConfirmFromMenu}
                >
                  <Icon name="message-circle" size={20} color={COLORS.primary} />
                  <Text style={[styles.modalButtonText, { color: COLORS.primary }]}>
                    Confirmar compromisso
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.appointmentModalButtonSuccess}
                  onPress={handleCompleteFromMenu}
                >
                  <Icon name="check-circle" size={20} color={COLORS.textOnPrimary} />
                  <Text style={styles.modalButtonText}>Marcar como concluído</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.appointmentModalButtonWarning}
                  onPress={handleRescheduleFromMenu}
                >
                  <Icon name="calendar" size={20} color={COLORS.warning} />
                  <Text style={[styles.modalButtonText, { color: COLORS.warning }]}>
                    Remarcar compromisso
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <RescheduleModal
        visible={rescheduleVisible}
        initialDate={rescheduleTarget ? buildAppointmentStartAt(rescheduleTarget) : new Date()}
        onClose={() => {
          setRescheduleVisible(false);
          setRescheduleTarget(null);
        }}
        onConfirm={handleConfirmReschedule}
      />
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
  summaryActions: { flexDirection: 'row', alignItems: 'center' },
  eyeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: 'rgba(160,174,192,0.15)',
  },
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 24,
    marginRight: 24,
    marginBottom: 15,
  },
  sectionTitle: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.textPrimary,
  },
  sectionAction: { ...TYPOGRAPHY.caption, color: COLORS.primary },
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
  paymentNameOverdue: { color: COLORS.danger },
  paymentDate: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 2 },
  chargeButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(43,108,176,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(43,108,176,0.2)',
  },
  chargeButtonText: { ...TYPOGRAPHY.caption, color: COLORS.primary },
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
  statusLabel: { ...TYPOGRAPHY.caption, marginTop: 6, fontWeight: '600' },
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
  modalButtonWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,158,46,0.15)',
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
  appointmentModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  appointmentModalButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF8FF',
    width: '100%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  appointmentModalButtonSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    width: '100%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  appointmentModalButtonWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,158,46,0.15)',
    width: '100%',
    padding: 16,
    borderRadius: 16,
  },
});

export default HomeScreen;
