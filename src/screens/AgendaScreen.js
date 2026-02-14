// /src/screens/AgendaScreen.js

import React, { useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Feather as Icon } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';

import {
  formatDateLabel,
  formatTimeLabelFromDate,
  getDateKey,
  parseTimeLabelParts,
} from '../utils/dateUtils';
import { getAppointmentsForDate } from '../utils/schedule';
import { useClientStore } from '../store/useClientStore';
import { createAppointmentOverride, rescheduleAppointment } from '../utils/firestoreService';
import { auth } from '../utils/firebase';
import {
  applyTemplateVariables,
  buildPhoneE164FromRaw,
  openWhatsAppWithMessage,
} from '../utils/whatsapp';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/theme';
import RescheduleModal from '../components/RescheduleModal';

LocaleConfig.locales['pt-br'] = {
  monthNames: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
  monthNamesShort: ['Jan.','Fev.','Mar','Abr','Mai','Jun','Jul.','Ago','Set.','Out.','Nov.','Dez.'],
  dayNames: ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'],
  dayNamesShort: ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'],
  today: 'Hoje',
};
LocaleConfig.defaultLocale = 'pt-br';

const DEFAULT_CONFIRM_TEMPLATE = 'Boa noite {nome}! Aula confirmada para {hora}!';

const buildAppointmentRenderKey = (appointment) =>
  appointment?.appointmentKey ||
  appointment?.id ||
  `${appointment?.clientId || 'client'}-${appointment?.dateKey || 'date'}-${appointment?.time || '00:00'}`;

const dedupeAppointments = (appointments = []) => {
  const seen = new Set();
  return appointments.filter((appointment) => {
    const key = buildAppointmentRenderKey(appointment);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const resolveConfirmationStatus = (appointment) => {
  const rawStatus = appointment?.confirmationStatus;
  if (rawStatus === 'confirmed' || rawStatus === 'canceled' || rawStatus === 'sent') {
    return rawStatus;
  }
  if (appointment?.confirmationSentAt) return 'sent';
  return 'pending';
};

const AgendaScreen = ({ scheduleOverrides = {} }) => {
  const clients = useClientStore((state) => state.clients);
  const currentUserId = useClientStore((state) => state.currentUserId);
  const templates = useClientStore((state) => state.templates);
  const overridesFromStore = useClientStore((state) => state.scheduleOverrides);
  const setScheduleOverrides = useClientStore((state) => state.setScheduleOverrides);
  const [selectedDate, setSelectedDate] = useState('');
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const resolveActiveUid = () => currentUserId || auth?.currentUser?.uid || null;
  const effectiveOverrides = scheduleOverrides && Object.keys(scheduleOverrides).length > 0
    ? scheduleOverrides
    : overridesFromStore || {};

  const appointmentsData = useMemo(() => {
    const data = {};
    const today = new Date();
    for (let i = 0; i < 90; i += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const appointmentsForDay = getAppointmentsForDate({ date, clients, overrides: effectiveOverrides });
      if (appointmentsForDay.length > 0) {
        data[getDateKey(date)] = dedupeAppointments(appointmentsForDay);
      }
    }
    return data;
  }, [clients, effectiveOverrides]);

  const selectedAppointments = appointmentsData[selectedDate] || [];
  const todayString = new Date().toISOString().split('T')[0];

  const getStatusLabel = (appointment) => {
    const status = appointment?.status;
    if (status === 'done') return 'Concluído';
    if (status === 'rescheduled') return 'Remarcado';
    const confirmationStatus = resolveConfirmationStatus(appointment);
    if (confirmationStatus === 'confirmed') return 'Confirmado';
    if (confirmationStatus === 'canceled') return 'Cancelado';
    if (confirmationStatus === 'sent') return 'Aguardando resposta';
    return 'Agendado';
  };

  const getStatusColor = (appointment) => {
    const status = appointment?.status;
    if (status === 'done') return COLORS.success;
    if (status === 'rescheduled') return COLORS.warning;
    const confirmationStatus = resolveConfirmationStatus(appointment);
    if (confirmationStatus === 'confirmed') return COLORS.success;
    if (confirmationStatus === 'canceled') return COLORS.danger;
    return COLORS.primary;
  };

  const buildAppointmentStartAt = (appointment) => {
    const dateKey = appointment.dateKey || selectedDate || getDateKey(new Date());
    const baseDate = new Date(`${dateKey}T12:00:00`);
    const { hour, minute } = parseTimeLabelParts(appointment.time, 9, 0);
    baseDate.setHours(hour, minute, 0, 0);
    return baseDate;
  };

  const resolveAppointmentId = (appointment, fallbackDateKey, fallbackTime) => {
    if (appointment?.appointmentKey) return appointment.appointmentKey;
    if (!appointment?.clientId) return '';
    return `${appointment.clientId}-${fallbackDateKey}-${fallbackTime}`;
  };

  const handleConfirmAppointment = async (appointment) => {
    const uid = resolveActiveUid();
    if (!appointment || !uid) return;
    const client = clients.find((item) => item.id === appointment.clientId);
    const phoneE164 = client?.phoneE164 || buildPhoneE164FromRaw(client?.phoneRaw || client?.phone || '');
    if (!phoneE164) {
      Alert.alert('Contato', 'Cliente sem telefone válido.');
      return;
    }
    const appointmentDate = buildAppointmentStartAt(appointment);
    const safeTime = appointment.time || '00:00';
    const dateKey = appointment.dateKey || getDateKey(appointmentDate);
    const appointmentId = resolveAppointmentId(appointment, dateKey, safeTime);
    if (!appointmentId) return;

    const lastConfirmation = appointment.confirmationSentAt;
    if (lastConfirmation) {
      const lastDate = lastConfirmation.toDate?.() || new Date(lastConfirmation);
      const today = new Date();
      if (
        lastDate.getDate() === today.getDate() &&
        lastDate.getMonth() === today.getMonth() &&
        lastDate.getFullYear() === today.getFullYear()
      ) {
        try {
          await createAppointmentOverride({
            uid,
            appointmentId,
            payload: {
              appointmentKey: appointmentId,
              clientId: appointment.clientId,
              dateKey,
              name: appointment.name,
              time: safeTime,
              location: appointment.location || '',
              status: 'scheduled',
              confirmationStatus: 'sent',
              confirmationSentAt: Timestamp.fromDate(lastDate),
              startAt: Timestamp.fromDate(appointmentDate),
            },
          });
        } catch (error) {
          // ignore backfill errors
        }
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
      await createAppointmentOverride({
        uid,
        appointmentId,
        payload: {
          appointmentKey: appointmentId,
          clientId: appointment.clientId,
          dateKey,
          name: appointment.name,
          time: safeTime,
          location: appointment.location || '',
          startAt: Timestamp.fromDate(appointmentDate),
          confirmationStatus: 'sent',
          confirmationRespondedAt: null,
          confirmationSentAt: Timestamp.fromDate(new Date()),
        },
      });
    } catch (error) {
      Alert.alert('Agenda', 'Não foi possível registrar a confirmação.');
    }
  };

  const handleSetAppointmentConfirmation = async (appointment, confirmationStatus) => {
    const uid = resolveActiveUid();
    if (!appointment || !uid) return;
    const appointmentDate = buildAppointmentStartAt(appointment);
    const safeTime = appointment.time || '00:00';
    const dateKey = appointment.dateKey || getDateKey(appointmentDate);
    const appointmentId = resolveAppointmentId(appointment, dateKey, safeTime);
    if (!appointmentId) return;

    try {
      await createAppointmentOverride({
        uid,
        appointmentId,
        payload: {
          appointmentKey: appointmentId,
          clientId: appointment.clientId,
          dateKey,
          name: appointment.name,
          time: safeTime,
          location: appointment.location || '',
          status: 'scheduled',
          confirmationStatus,
          confirmationRespondedAt: Timestamp.fromDate(new Date()),
          startAt: Timestamp.fromDate(appointmentDate),
        },
      });
    } catch (error) {
      Alert.alert('Agenda', 'Não foi possível atualizar a confirmação do compromisso.');
    }
  };

  const handleCompleteAppointment = async (appointment) => {
    const uid = resolveActiveUid();
    if (!appointment || !uid) return;
    const appointmentDate = buildAppointmentStartAt(appointment);
    const safeTime = appointment.time || '00:00';
    const dateKey = appointment.dateKey || getDateKey(appointmentDate);
    const appointmentId = resolveAppointmentId(appointment, dateKey, safeTime);
    if (!appointmentId) return;
    try {
      await createAppointmentOverride({
        uid,
        appointmentId,
        payload: {
          appointmentKey: appointmentId,
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

  const handleConfirmReschedule = async (newDate) => {
    const uid = resolveActiveUid();
    if (!rescheduleTarget) {
      setRescheduleVisible(false);
      setRescheduleTarget(null);
      return;
    }
    if (!uid) {
      Alert.alert('Agenda', 'Sessão indisponível. Entre novamente para remarcar.');
      return;
    }
    if (!(newDate instanceof Date) || Number.isNaN(newDate.getTime())) {
      Alert.alert('Agenda', 'Data inválida para remarcação.');
      return;
    }

    const oldAppointment = rescheduleTarget;
    const oldStartAt = buildAppointmentStartAt(oldAppointment);
    const oldDateKey = oldAppointment.dateKey || getDateKey(oldStartAt);
    const newDateKey = getDateKey(newDate);
    const oldSafeTime = oldAppointment.time || '00:00';
    const newSafeTime = formatTimeLabelFromDate(newDate) || oldSafeTime;
    const oldAppointmentId =
      oldAppointment.appointmentKey || `${oldAppointment.clientId}-${oldDateKey}-${oldSafeTime}`;
    const newAppointmentId = `${oldAppointment.clientId}-${newDateKey}-${newSafeTime}`;
    const previousOverrides = effectiveOverrides || {};

    try {
      if (oldAppointmentId === newAppointmentId) {
        Alert.alert('Agenda', 'Escolha uma data ou horário diferente para remarcar.');
        return;
      }
      setScheduleOverrides((current) => {
        const source = current || {};
        const next = { ...source };
        next[newDateKey] = {
          ...(next[newDateKey] || {}),
          [newAppointmentId]: {
            appointmentKey: newAppointmentId,
            clientId: oldAppointment.clientId,
            dateKey: newDateKey,
            name: oldAppointment.name,
            time: newSafeTime,
            location: oldAppointment.location || '',
            status: 'scheduled',
            confirmationStatus: 'pending',
            confirmationRespondedAt: null,
            confirmationSentAt: null,
            action: 'add',
            startAt: newDate,
          },
        };
        next[oldDateKey] = {
          ...(next[oldDateKey] || {}),
          [oldAppointmentId]: {
            appointmentKey: oldAppointmentId,
            clientId: oldAppointment.clientId,
            dateKey: oldDateKey,
            name: oldAppointment.name,
            time: oldSafeTime,
            location: oldAppointment.location || '',
            status: 'rescheduled',
            action: 'remove',
            rescheduledTo: newDate,
            statusUpdatedAt: new Date(),
            startAt: oldStartAt,
          },
        };
        return next;
      });

      // Fecha o modal imediatamente para evitar sensação de travamento.
      setRescheduleVisible(false);
      setRescheduleTarget(null);

      await rescheduleAppointment({
        uid,
        oldAppointmentId,
        newAppointmentId,
        newPayload: {
          appointmentKey: newAppointmentId,
          clientId: oldAppointment.clientId,
          dateKey: newDateKey,
          name: oldAppointment.name,
          time: newSafeTime,
          location: oldAppointment.location || '',
          status: 'scheduled',
          confirmationStatus: 'pending',
          confirmationRespondedAt: null,
          confirmationSentAt: null,
          action: 'add',
          startAt: Timestamp.fromDate(newDate),
        },
        oldPayload: {
          appointmentKey: oldAppointmentId,
          clientId: oldAppointment.clientId,
          dateKey: oldDateKey,
          name: oldAppointment.name,
          time: oldSafeTime,
          location: oldAppointment.location || '',
          status: 'rescheduled',
          action: 'remove',
          rescheduledTo: Timestamp.fromDate(newDate),
          statusUpdatedAt: Timestamp.fromDate(new Date()),
          startAt: Timestamp.fromDate(oldStartAt),
        },
      });
      Alert.alert('Agenda', 'Compromisso remarcado com sucesso.');
    } catch (error) {
      setScheduleOverrides(previousOverrides);
      console.error('Erro ao remarcar compromisso', error);
      Alert.alert('Agenda', 'Não foi possível remarcar o compromisso.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Agenda</Text>
      </View>

      <View style={styles.calendarContainer}>
        <Calendar
          current={todayString}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={{
            ...Object.keys(appointmentsData).reduce((obj, date) => {
              obj[date] = { marked: true, dotColor: COLORS.primary };
              return obj;
            }, {}),
            [selectedDate]: { selected: true, selectedColor: COLORS.primary, marked: true, dotColor: 'white' },
            [todayString]: { today: true, todayTextColor: COLORS.primary },
          }}
          theme={{
            backgroundColor: COLORS.surface,
            calendarBackground: COLORS.surface,
            textSectionTitleColor: COLORS.textSecondary,
            selectedDayBackgroundColor: COLORS.primary,
            selectedDayTextColor: '#ffffff',
            todayTextColor: COLORS.primary,
            dayTextColor: COLORS.textPrimary,
            textDisabledColor: '#D1D5DB',
            arrowColor: COLORS.primary,
            monthTextColor: COLORS.textPrimary,
            textDayFontWeight: '500',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '500',
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 12,
          }}
          style={styles.calendar}
        />
      </View>

      <ScrollView style={styles.listContainer}>
        {selectedDate ? (
          <>
            <Text style={styles.dateHeader}>
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
            {selectedAppointments.length > 0 ? (
              selectedAppointments.map((appointment) => (
                <View
                  key={appointment.appointmentKey || appointment.id}
                  style={[styles.card, { borderLeftColor: getStatusColor(appointment) }]}
                >
                  <View style={styles.timeBlock}>
                    <Text style={styles.timeText}>{appointment.time}</Text>
                  </View>
                  <View style={styles.infoBlock}>
                    <Text style={styles.clientName}>{appointment.name}</Text>
                    <View style={styles.row}>
                      <Icon name="map-pin" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.location}>{appointment.location}</Text>
                    </View>
                    <Text style={[styles.statusLabel, { color: getStatusColor(appointment) }]}>
                      {getStatusLabel(appointment)}
                    </Text>
                    {appointment.status === 'scheduled' ? (
                      <View style={styles.actionsRow}>
                        {resolveConfirmationStatus(appointment) === 'pending' ? (
                          <TouchableOpacity
                            style={[styles.actionButton, styles.actionConfirm]}
                            onPress={() => handleConfirmAppointment(appointment)}
                          >
                            <Text style={styles.actionText}>Confirmar</Text>
                          </TouchableOpacity>
                        ) : null}
                        {resolveConfirmationStatus(appointment) === 'sent' ? (
                          <>
                            <TouchableOpacity
                              style={[styles.actionButton, styles.actionDone]}
                              onPress={() => handleSetAppointmentConfirmation(appointment, 'confirmed')}
                            >
                              <Text style={styles.actionText}>Confirmado</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButton, styles.actionCancel]}
                              onPress={() => handleSetAppointmentConfirmation(appointment, 'canceled')}
                            >
                              <Text style={styles.actionText}>Cancelado</Text>
                            </TouchableOpacity>
                          </>
                        ) : null}
                        {resolveConfirmationStatus(appointment) === 'confirmed' ? (
                          <>
                            <TouchableOpacity
                              style={[styles.actionButton, styles.actionDone]}
                              onPress={() => handleCompleteAppointment(appointment)}
                            >
                              <Text style={styles.actionText}>Concluir</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.actionButton, styles.actionReschedule]}
                              onPress={() => handleOpenReschedule(appointment)}
                            >
                              <Text style={styles.actionText}>Remarcar</Text>
                            </TouchableOpacity>
                          </>
                        ) : null}
                        {resolveConfirmationStatus(appointment) === 'canceled' ? (
                          <TouchableOpacity
                            style={[styles.actionButton, styles.actionReschedule]}
                            onPress={() => handleOpenReschedule(appointment)}
                          >
                            <Text style={styles.actionText}>Remarcar</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Nenhum compromisso.</Text>
            )}
          </>
        ) : (
          <Text style={styles.placeholderText}>Selecione um dia no calendario.</Text>
        )}
      </ScrollView>

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
  header: { padding: 24, paddingBottom: 10 },
  title: { ...TYPOGRAPHY.display, color: COLORS.textPrimary },
  calendarContainer: {
    marginHorizontal: 24,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  calendar: { borderRadius: 16, backgroundColor: COLORS.surface },
  listContainer: { flex: 1, paddingHorizontal: 24, marginTop: 20 },
  dateHeader: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 12, textTransform: 'capitalize' },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    ...SHADOWS.small,
  },
  timeBlock: { width: 50, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border, marginRight: 12 },
  timeText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  infoBlock: { flex: 1, justifyContent: 'center' },
  clientName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  location: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginLeft: 4 },
  statusLabel: { ...TYPOGRAPHY.caption, marginTop: 6, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginRight: 8,
    marginBottom: 6,
  },
  actionConfirm: { backgroundColor: COLORS.primary },
  actionDone: { backgroundColor: COLORS.success },
  actionCancel: { backgroundColor: COLORS.danger },
  actionReschedule: { backgroundColor: COLORS.warning },
  actionText: { ...TYPOGRAPHY.buttonSmall, color: COLORS.textOnPrimary },
  emptyText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, textAlign: 'center', marginTop: 20 },
  placeholderText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },
});

export default AgendaScreen;
