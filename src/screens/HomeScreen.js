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
  Alert,
  Platform,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather as Icon } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  formatCurrency,
  getReadableMonth,
  getNextDueDateFromDay,
  formatTimeLabelFromDate,
  parseDateKeyToDate,
} from '../utils/dateUtils';
import { getAppointmentsForDate } from '../utils/schedule';
import AdBanner from '../components/AdBanner';

const COLORS = {
  background: '#E4E2DD',
  text: '#1E1E1E',
  placeholder: 'rgba(30, 30, 30, 0.5)',
  accent: '#8A8A8A',
};

const getStatusBadgeStyle = (status) => ({
  marginTop: 6,
  backgroundColor: status === 'done' ? '#5CB85C' : '#F0AD4E',
  borderRadius: 12,
  paddingHorizontal: 10,
  paddingVertical: 4,
});

const getGreetingLabel = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const RESCHEDULE_WINDOW_DAYS = 90;

const buildRescheduleBounds = () => {
  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);
  const maxDate = new Date(minDate);
  maxDate.setDate(maxDate.getDate() + (RESCHEDULE_WINDOW_DAYS - 1));
  maxDate.setHours(23, 59, 59, 999);
  return { minDate, maxDate };
};

const clampDateToRange = (date, minDate, maxDate) => {
  if (!(date instanceof Date)) return new Date(minDate);
  const time = date.getTime();
  if (time < minDate.getTime()) return new Date(minDate);
  if (time > maxDate.getTime()) return new Date(maxDate);
  return new Date(date);
};

const HomeScreen = ({
  clientTerm,
  navigation,
  clients,
  activeMonth,
  onToggleClientPayment,
  planTier = 'free',
  clientLimit = 3,
  scheduleOverrides = {},
  onMarkAppointmentStatus,
  onClearAppointmentStatus,
  onRescheduleAppointment,
  adsEnabled = false,
  userName = '',
  userProfession = '',
}) => {
  const [fabMenuVisible, setFabMenuVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [rescheduleState, setRescheduleState] = useState(() => {
    const bounds = buildRescheduleBounds();
    const initialDate = clampDateToRange(new Date(), bounds.minDate, bounds.maxDate);
    return {
      visible: false,
      appointment: null,
      date: initialDate,
      showDatePicker: false,
      showTimePicker: false,
      minimumDate: bounds.minDate,
      maximumDate: bounds.maxDate,
    };
  });
  const [isMonthCardCollapsed, setIsMonthCardCollapsed] = useState(false);

  const monthLabel = useMemo(() => getReadableMonth(activeMonth), [activeMonth]);

  const clientLookup = useMemo(
    () =>
      clients.reduce((acc, client) => {
        acc[client.id] = client;
        return acc;
      }, {}),
    [clients],
  );

  // CHECKPOINT 8: CÁLCULOS FINANCEIROS ATUALIZADOS
    const financialData = useMemo(() => {
      const currentMonthKey = new Date().toISOString().slice(0, 7); // 'AAAA-MM'

      const totalToReceive = clients.reduce((sum, client) => sum + parseFloat(client.value || 0), 0);
      
      const received = clients.reduce((sum, client) => {
        if (client.payments && client.payments[currentMonthKey] === 'pago') {
          return sum + parseFloat(client.value || 0);
        }
        return sum;
      }, 0);

      const pending = totalToReceive - received;
      const progress = totalToReceive > 0 ? (received / totalToReceive) * 100 : 0;

      return {
        totalToReceive: totalToReceive.toFixed(2),
        received: received.toFixed(2),
        pending: pending.toFixed(2),
        progress: `${progress}%`,
      };
  }, [clients]);

  const todayAppointments = useMemo(() => {
    const today = new Date();
    return getAppointmentsForDate({ date: today, clients, overrides: scheduleOverrides });
  }, [clients, scheduleOverrides]);

  const upcomingPayments = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfHorizon = new Date(startOfToday);
    endOfHorizon.setDate(startOfToday.getDate() + 7);
    endOfHorizon.setHours(23, 59, 59, 999);

    return clients
      .filter((client) => client.paymentStatus !== 'paid')
      .map((client) => {
        const dueDayNumber = Number(String(client.dueDay).replace(/[^0-9]/g, ''));
        const nextDueDate = dueDayNumber
          ? getNextDueDateFromDay(dueDayNumber, startOfToday, client.time)
          : null;
        return {
          ...client,
          nextDueDate,
        };
      })
      .filter((client) => {
        if (!client.dueDay) return false;
        if (!client.nextDueDate) return false;
        return client.nextDueDate >= startOfToday && client.nextDueDate <= endOfHorizon;
      })
      .sort((a, b) => {
        if (!a.nextDueDate) return 1;
        if (!b.nextDueDate) return -1;
        return a.nextDueDate.getTime() - b.nextDueDate.getTime();
      });
  }, [clients]);

  const handleOpenPaymentMenu = (client) => {
    setSelectedPayment(client);
  };

  const handleClosePaymentMenu = () => {
    setSelectedPayment(null);
  };

  const handleTogglePaymentFromMenu = () => {
    if (selectedPayment && onToggleClientPayment) {
      const toggledToPaid = selectedPayment.paymentStatus !== 'paid';
      const updated = onToggleClientPayment(selectedPayment.id);
      if (updated) {
        notify(toggledToPaid ? 'Pagamento marcado como pago.' : 'Pagamento marcado como pendente.');
      } else {
        notify('Não foi possível atualizar o pagamento.');
      }
    }
    handleClosePaymentMenu();
  };

  const getFormattedDate = () => {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const date = new Date().toLocaleDateString('pt-BR', options);
    return date.charAt(0).toUpperCase() + date.slice(1);
  };

  const navigateAndCloseMenu = (screen) => {
    setFabMenuVisible(false);
    navigation.navigate(screen, { clientTerm });
  };

  const progressWidth = financialData.progress; // já vem como "50%"
  const shouldShowAds = adsEnabled && planTier === 'free';

  const normalizedName = useMemo(() => {
    if (!userName) return null;
    const trimmed = userName.trim();
    if (!trimmed) return null;
    const firstWord = trimmed.split(' ')[0];
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  }, [userName]);

  const normalizedProfession = useMemo(() => {
    if (!userProfession) return null;
    const trimmed = userProfession.trim();
    if (!trimmed) return null;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }, [userProfession]);

  const greetingText = useMemo(() => {
    const base = getGreetingLabel();
    if (normalizedName) {
      return `${base}, ${normalizedName}`;
    }
    if (normalizedProfession) {
      return `${base}, ${normalizedProfession}`;
    }
    return `${base}!`;
  }, [normalizedName, normalizedProfession]);

  const notify = (message) => {
    if (!message) return;
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert('Atualização', message);
    }
  };

  const handleMarkAsDone = (appointment) => {
    if (!appointment || !onMarkAppointmentStatus) return;
    onMarkAppointmentStatus({
      dateKey: appointment.dateKey,
      clientId: appointment.clientId,
      status: 'done',
    });
  };

  const handleUndoStatus = (appointment) => {
    if (!appointment || !onClearAppointmentStatus) return;
    onClearAppointmentStatus({
      dateKey: appointment.dateKey,
      clientId: appointment.clientId,
    });
  };

  const handleToggleAppointmentCompletion = (appointment) => {
    if (!appointment) return;
    if (appointment.status === 'done') {
      handleUndoStatus(appointment);
    } else {
      handleMarkAsDone(appointment);
    }
  };

  const parseTimeToDate = (baseDate, timeLabel) => {
    if (!timeLabel) return new Date(baseDate);
    const match = String(timeLabel).match(/(\d{1,2})(?:[:hH]?([0-9]{1,2}))?/);
    if (!match) return new Date(baseDate);
    const next = new Date(baseDate);
    next.setHours(Math.min(23, parseInt(match[1], 10) || 0));
    next.setMinutes(match[2] ? Math.min(59, parseInt(match[2], 10) || 0) : 0);
    next.setSeconds(0, 0);
    return next;
  };

  const openRescheduleModal = (appointment) => {
    if (!appointment) return;
    const bounds = buildRescheduleBounds();
    const parsedDate = appointment.dateKey ? parseDateKeyToDate(appointment.dateKey) : null;
    const baseDate = parsedDate instanceof Date && !Number.isNaN(parsedDate.getTime()) ? parsedDate : new Date();
    const clampedBase = clampDateToRange(baseDate, bounds.minDate, bounds.maxDate);
    const preset = parseTimeToDate(clampedBase, appointment.time);
    setRescheduleState({
      visible: true,
      appointment,
      date: preset,
      showDatePicker: false,
      showTimePicker: false,
      minimumDate: bounds.minDate,
      maximumDate: bounds.maxDate,
    });
  };

  const closeRescheduleModal = () => {
    setRescheduleState((prev) => ({ ...prev, visible: false, appointment: null }));
  };

  const handleConfirmReschedule = () => {
    if (!rescheduleState.appointment || !onRescheduleAppointment) {
      closeRescheduleModal();
      return;
    }

    const client = clientLookup[rescheduleState.appointment.clientId];
    if (!client) {
      Alert.alert('Não foi possível remarcar', 'Cliente não encontrado para este compromisso.');
      closeRescheduleModal();
      return;
    }

    const timeLabel = formatTimeLabelFromDate(rescheduleState.date);

    onRescheduleAppointment({
      client,
      originalDateKey: rescheduleState.appointment.dateKey,
      targetDate: rescheduleState.date,
      newTime: timeLabel,
    });

    closeRescheduleModal();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.greeting}>{greetingText}</Text>
          <Text style={styles.date}>{getFormattedDate()}</Text>
          {planTier === 'free' ? (
            <View style={styles.homeLimitBanner}>
              <Text style={styles.homeLimitText}>
                {`Plano gratuito: ${clients.length}/${clientLimit} clientes`}
              </Text>
              {clients.length >= clientLimit ? (
                <Text style={styles.homeLimitCTA}>Passe para o Pro para liberar mais cadastros</Text>
              ) : null}
            </View>
          ) : (
            <View style={[styles.homeLimitBanner, styles.homeLimitBannerPro]}>
              <Text style={styles.homeLimitTextPro}>Plano Pro ativo</Text>
            </View>
          )}
        </View>

        {shouldShowAds ? (
          <View style={styles.adContainer}>
            <AdBanner placement="home" />
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>VISÃO DO MÊS ({monthLabel})</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={isMonthCardCollapsed ? 'Mostrar visão do mês' : 'Ocultar visão do mês'}
              onPress={() => setIsMonthCardCollapsed((prev) => !prev)}
            >
              <Icon
                name={isMonthCardCollapsed ? 'eye' : 'eye-off'}
                size={20}
                color={COLORS.text}
              />
            </TouchableOpacity>
          </View>

          {!isMonthCardCollapsed ? (
            <>
              <Text style={styles.receivedValue}>R$ {formatCurrency(Number(financialData.totalToReceive))}</Text>
              <Text style={styles.receivedLabel}>Previsto neste mês</Text>

              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: progressWidth }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressText}>Total a Receber: R$ {formatCurrency(financialData.expectedMonth)}</Text>
                <Text style={styles.progressText}>Pendente: R$ R$ {formatCurrency(Number(financialData.pending))}</Text>
              </View>
              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Recebido no mês</Text>
                  <Text style={styles.metricValue}>R$ {formatCurrency(Number(financialData.received))}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricBox}>
                  <Text style={styles.metricLabel}>Pendente no mês</Text>
                  <Text style={styles.metricValue}>R$ {formatCurrency(Number(financialData.pending))}</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRÓXIMOS PAGAMENTOS</Text>
          <FlatList
            data={upcomingPayments}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pill} onPress={() => handleOpenPaymentMenu(item)}>
                <Text style={styles.pillText}>{item.name}</Text>
                <Text style={styles.pillSubText}>
                  {item.paymentStatus === 'paid'
                    ? 'Pago'
                    : item.nextDueDate
                      ? `Vence ${item.nextDueDate.toLocaleDateString('pt-BR', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                        })}`
                      : 'Vencimento a definir'}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyFlatListText}>Nenhum pagamento previsto nos próximos 7 dias.</Text>}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COMPROMISSOS DE HOJE</Text>
          {todayAppointments.length > 0 ? (
            todayAppointments.map((item) => (
              
              <View key={item.id} style={styles.appointmentCard}>
                <View style={styles.appointmentHeader}>
                  <View style={styles.appointmentHeaderTitle}>
                    <Text style={styles.appointmentName}>{item.name}</Text>
                    {item.status === 'done' ? (
                      <View style={styles.statusBadgeDonePill}>
                        <Text style={styles.statusBadgeDonePillText}>Concluído</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.timePill}>
                    <Icon name="clock" size={16} color={COLORS.text} />
                    <Text style={styles.timePillText}>{item.time || '--:--'}</Text>
                  </View>
                </View>

                <View style={styles.appointmentBody}>
                  <View style={styles.infoRow}>
                    <Icon name="map-pin" size={16} color="rgba(30,30,30,0.6)" />
                    <Text style={styles.infoText}>
                      {item.location || 'Local não informado'}
                    </Text>
                  </View>
                  {item.note ? (
                    <View style={[styles.infoRow, styles.noteRow]}>
                      <Icon name="clipboard" size={16} color="rgba(30,30,30,0.6)" />
                      <Text style={styles.infoText}>
                        {item.note}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.appointmentActions}>
                  <TouchableOpacity
                    style={[styles.primaryActionButton, item.status === 'done' && styles.primaryActionButtonDone]}
                    onPress={() => handleToggleAppointmentCompletion(item)}
                  >
                    <Text style={styles.primaryActionButtonText}>
                      {item.status === 'done' ? 'Desfazer' : 'Marcar como concluído'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonSecondary]}
                    onPress={() => openRescheduleModal(item)}
                  >
                    <Icon name="clock" size={16} color={COLORS.text} />
                    <Text style={styles.actionButtonSecondaryText}>Remarcar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noAppointmentsText}>Nenhum compromisso hoje.</Text>
          )}
        </View>

      </ScrollView>
      {fabMenuVisible && (
        <View style={styles.fabMenu}>
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              // Placeholder action for scheduling flow; adjust route name if you have it
              navigateAndCloseMenu('Schedule');
            }}
          >
            <Text style={styles.fabMenuText}>Agendar</Text>
            <Icon name="clock" size={20} color={COLORS.background} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => navigateAndCloseMenu('AddClient')}
          >
            <Text style={styles.fabMenuText}>Novo {clientTerm}</Text>
            <Icon name="user-plus" size={20} color={COLORS.background} />
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity style={styles.fab} onPress={() => setFabMenuVisible((prev) => !prev)}>
        <Icon name={fabMenuVisible ? 'x' : 'plus'} size={28} color={COLORS.background} />
      </TouchableOpacity>

      <Modal
        visible={!!selectedPayment}
        animationType="fade"
        transparent
        onRequestClose={handleClosePaymentMenu}
      >
        <TouchableWithoutFeedback onPress={handleClosePaymentMenu}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.paymentMenu}>
                <Text style={styles.paymentTitle}>Atualizar pagamento</Text>
                {selectedPayment ? (
                  <View style={styles.paymentDetails}>
                    <Text style={styles.paymentName}>{selectedPayment.name}</Text>
                    <Text style={styles.paymentInfo}>
                      {selectedPayment.paymentStatus === 'paid'
                        ? 'Marcado como pago neste mês.'
                        : selectedPayment.dueDay
                          ? `Vencimento dia ${selectedPayment.dueDay}.`
                          : 'Sem dia definido para pagamento.'}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity style={styles.paymentAction} onPress={handleTogglePaymentFromMenu}>
                  <Icon
                    name={selectedPayment?.paymentStatus === 'paid' ? 'rotate-ccw' : 'check-circle'}
                    size={20}
                    color={COLORS.background}
                    style={styles.paymentActionIcon}
                  />
                  <Text style={styles.paymentActionText}>
                    {selectedPayment?.paymentStatus === 'paid' ? 'Desmarcar pagamento' : 'Marcar como pago'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.paymentCancel} onPress={handleClosePaymentMenu}>
                  <Text style={styles.paymentCancelText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={rescheduleState.visible}
        animationType="slide"
        transparent
        onRequestClose={closeRescheduleModal}
      >
        <TouchableWithoutFeedback onPress={closeRescheduleModal}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.rescheduleModal}>
                <Text style={styles.rescheduleTitle}>Remarcar compromisso</Text>
                {rescheduleState.appointment ? (
                  <Text style={styles.rescheduleSubtitle}>{rescheduleState.appointment.name}</Text>
                ) : null}

                <View style={styles.rescheduleField}>
                  <Text style={styles.rescheduleLabel}>Nova data</Text>
                  <TouchableOpacity
                    style={styles.reschedulePickerButton}
                    onPress={() =>
                      setRescheduleState((prev) => ({
                        ...prev,
                        showDatePicker: true,
                      }))
                    }
                  >
                    <Text style={styles.reschedulePickerText}>
                      {rescheduleState.date.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </Text>
                    <Icon name="calendar" size={18} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.rescheduleField}>
                  <Text style={styles.rescheduleLabel}>Horário</Text>
                  <TouchableOpacity
                    style={styles.reschedulePickerButton}
                    onPress={() =>
                      setRescheduleState((prev) => ({
                        ...prev,
                        showTimePicker: true,
                      }))
                    }
                  >
                    <Text style={styles.reschedulePickerText}>
                      {formatTimeLabelFromDate(rescheduleState.date) || '--:--'}
                    </Text>
                    <Icon name="clock" size={18} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.rescheduleActions}>
                  <TouchableOpacity style={styles.rescheduleCancel} onPress={closeRescheduleModal}>
                    <Text style={styles.rescheduleCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rescheduleConfirm} onPress={handleConfirmReschedule}>
                    <Text style={styles.rescheduleConfirmText}>Confirmar</Text>
                  </TouchableOpacity>
                </View>

                {rescheduleState.showDatePicker ? (
                  <DateTimePicker
                    value={rescheduleState.date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={rescheduleState.minimumDate}
                    maximumDate={rescheduleState.maximumDate}
                    onChange={(_, selectedDate) => {
                      setRescheduleState((prev) => ({
                        ...prev,
                        showDatePicker: Platform.OS === 'ios',
                        date: selectedDate
                          ? clampDateToRange(
                              new Date(
                                selectedDate.getFullYear(),
                                selectedDate.getMonth(),
                                selectedDate.getDate(),
                                prev.date.getHours(),
                                prev.date.getMinutes(),
                              ),
                              prev.minimumDate,
                              prev.maximumDate,
                            )
                          : prev.date,
                      }));
                    }}
                  />
                ) : null}

                {rescheduleState.showTimePicker ? (
                  <DateTimePicker
                    value={rescheduleState.date}
                    mode="time"
                    display="spinner"
                    is24Hour
                    onChange={(_, selectedDate) => {
                      setRescheduleState((prev) => ({
                        ...prev,
                        showTimePicker: Platform.OS === 'ios',
                        date: selectedDate
                          ? clampDateToRange(
                              new Date(
                                prev.date.getFullYear(),
                                prev.date.getMonth(),
                                prev.date.getDate(),
                                selectedDate.getHours(),
                                selectedDate.getMinutes(),
                              ),
                              prev.minimumDate,
                              prev.maximumDate,
                            )
                          : prev.date,
                      }));
                    }}
                  />
                ) : null}
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
  header: { padding: 30, paddingBottom: 15 },
  greeting: { fontSize: 28, fontWeight: '900', color: COLORS.text },
  date: { fontSize: 16, fontWeight: '300', color: COLORS.accent, marginTop: 4 },
  homeLimitBanner: {
    marginTop: 18,
    backgroundColor: 'rgba(30,30,30,0.08)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  homeLimitBannerPro: { backgroundColor: '#5CB85C' },
  homeLimitText: { color: COLORS.accent, fontSize: 14 },
  homeLimitTextPro: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  homeLimitCTA: { marginTop: 4, color: COLORS.text, fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: 'rgba(30,30,30,0.05)',
    borderRadius: 20,
    padding: 25,
    marginHorizontal: 30,
    marginBottom: 30,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.accent, textTransform: 'uppercase' },
  receivedValue: { fontSize: 32, fontWeight: 'bold', color: COLORS.text },
  receivedLabel: { fontSize: 16, color: COLORS.accent, marginBottom: 20 },
  progressContainer: { height: 8, backgroundColor: 'rgba(30,30,30,0.1)', borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: COLORS.text, borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressText: { fontSize: 12, color: COLORS.accent },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    backgroundColor: 'rgba(30,30,30,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  metricBox: { flex: 1 },
  metricDivider: { width: 1, height: 40, backgroundColor: 'rgba(30,30,30,0.12)', marginHorizontal: 16 },
  metricLabel: { fontSize: 12, color: COLORS.accent, marginBottom: 4, textTransform: 'uppercase' },
  metricValue: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.accent, marginBottom: 15, marginLeft: 30, textTransform: 'uppercase' },
  pill: {
    backgroundColor: 'rgba(30,30,30,0.05)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginLeft: 15,
    alignItems: 'center',
  },
  pillText: { color: COLORS.text, fontWeight: '600' },
  pillSubText: { color: COLORS.accent, fontSize: 12, marginTop: 2 },
  emptyFlatListText: { color: COLORS.placeholder, marginLeft: 30 },
  appointmentCard: {
    marginHorizontal: 30,
    marginBottom: 18,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(30,30,30,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  appointmentHeaderTitle: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statusBadgeDonePill: {
    marginLeft: 12,
    borderRadius: 12,
    backgroundColor: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusBadgeDonePillText: { color: COLORS.background, fontSize: 12, fontWeight: '600' },
  appointmentName: { fontSize: 16, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,30,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  timePillText: { marginLeft: 6, fontSize: 13, fontWeight: '600', color: COLORS.text },
  appointmentBody: { marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { marginLeft: 8, fontSize: 13, color: COLORS.accent, flexShrink: 1 },
  noteRow: { marginBottom: 0 },
  appointmentActions: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -10, marginTop: 4 },
  primaryActionButton: {
    borderRadius: 12,
    backgroundColor: COLORS.text,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    marginBottom: 10,
  },
  primaryActionButtonDone: { backgroundColor: COLORS.text, opacity: 0.85 },
  primaryActionButtonText: { color: COLORS.background, fontSize: 14, fontWeight: '700' },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 10,
    marginBottom: 10,
  },
  actionButtonText: { color: COLORS.background, fontSize: 14, fontWeight: '600', marginLeft: 6 },
  actionButtonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.text },
  actionButtonSecondaryText: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginLeft: 6 },
  noAppointmentsText: { color: COLORS.placeholder, textAlign: 'center', paddingHorizontal: 30 },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.text,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { height: 2, width: 0 },
  },
  fabMenu: {
    position: 'absolute',
    bottom: 100,
    right: 30,
    backgroundColor: COLORS.text,
    borderRadius: 15,
    elevation: 5,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { height: 2, width: 0 },
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  fabMenuText: { color: COLORS.background, fontSize: 16, fontWeight: '600', marginRight: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  paymentMenu: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  paymentTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  paymentDetails: { marginBottom: 24 },
  paymentName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  paymentInfo: { fontSize: 14, color: COLORS.accent, marginTop: 4 },
  paymentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.text,
    borderRadius: 16,
    paddingVertical: 14,
  },
  paymentActionIcon: { marginRight: 12 },
  paymentActionText: { color: COLORS.background, fontSize: 16, fontWeight: '600' },
  paymentCancel: { marginTop: 16, alignItems: 'center' },
  paymentCancelText: { color: COLORS.accent, fontSize: 14 },
  adContainer: { marginHorizontal: 30, marginBottom: 24 },
  statusBadgeText: { color: COLORS.background, fontSize: 12, fontWeight: '600' },
  rescheduleModal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  rescheduleTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  rescheduleSubtitle: { fontSize: 14, color: COLORS.accent, marginBottom: 16 },
  rescheduleField: { marginBottom: 16 },
  rescheduleLabel: { fontSize: 13, color: COLORS.accent, marginBottom: 6, textTransform: 'uppercase' },
  reschedulePickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,30,0.05)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  reschedulePickerText: { fontSize: 16, color: COLORS.text },
  rescheduleActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  rescheduleCancel: { paddingVertical: 12, paddingHorizontal: 18 },
  rescheduleCancelText: { color: COLORS.accent, fontSize: 15, fontWeight: '600' },
  rescheduleConfirm: {
    backgroundColor: COLORS.text,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  rescheduleConfirmText: { color: COLORS.background, fontSize: 15, fontWeight: '600' },
});

export default HomeScreen;
