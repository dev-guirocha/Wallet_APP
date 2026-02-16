// /src/screens/AgendaScreen.js

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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
import { COLORS, SHADOWS, TYPOGRAPHY } from '../theme/legacy';
import RescheduleModal from '../components/RescheduleModal';
import {
  AppScreen,
  ActionRow,
  ActionSheet,
  Card,
  EmptyState,
  Fab,
  ListContainer,
  MoneyText,
  ScreenHeader,
  SectionHeader,
  StatusPill,
} from '../components';
import { appointmentToPillStatus } from '../utils/statusMapping';
import { actionLabels, emptyMessages, titles } from '../utils/uiCopy';

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

const TAP_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

const AppointmentCard = React.memo(function AppointmentCard({
  appointment,
  isHighlighted = false,
  statusLabel,
  pillStatus,
  onOpenReschedule,
  onQuickConfirm,
  onChargeFromAppointment,
}) {
  const actions = useMemo(
    () => [
      {
        label:
          appointment.confirmationStatus === 'confirmed'
            ? actionLabels.complete
            : actionLabels.confirm,
        variant: 'primary',
        disabled: appointment.isDone,
        icon: <Icon name="check-circle" size={14} color={COLORS.textOnPrimary} />,
        onPress: () => onQuickConfirm(appointment),
        accessibilityLabel: `${appointment.confirmationStatus === 'confirmed' ? actionLabels.complete : actionLabels.confirm} atendimento de ${appointment.name}`,
      },
      {
        label: actionLabels.charge,
        variant: 'success',
        icon: <Icon name="dollar-sign" size={14} color={COLORS.textOnPrimary} />,
        onPress: () => onChargeFromAppointment(appointment),
        accessibilityLabel: `${actionLabels.charge} ${appointment.name}`,
      },
      {
        label: actionLabels.reschedule,
        variant: 'warning',
        disabled: appointment.isDone,
        icon: <Icon name="calendar" size={14} color={COLORS.textOnPrimary} />,
        onPress: () => onOpenReschedule(appointment),
        accessibilityLabel: `${actionLabels.reschedule} ${appointment.name}`,
      },
    ],
    [appointment, onChargeFromAppointment, onOpenReschedule, onQuickConfirm]
  );

  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, isHighlighted && styles.timelineDotActive]} />
        <View style={styles.timelineLine} />
      </View>

      <TouchableOpacity
        style={[styles.timelinePressable, isHighlighted && styles.timelinePressableActive]}
        activeOpacity={0.9}
        onPress={() => onOpenReschedule(appointment)}
        hitSlop={TAP_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={`Compromisso de ${appointment.name} às ${appointment.time}`}
        accessibilityHint="Toque para reagendar"
        accessibilityState={{ disabled: false }}
      >
        <Card style={[styles.card, isHighlighted && styles.cardHighlight]}>
          <View style={styles.timeBlock}>
            <Text style={styles.timeText}>{appointment.time}</Text>
            {isHighlighted ? <Text style={styles.timeTag}>Agora</Text> : null}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.clientName}>{appointment.name}</Text>
            <View style={styles.row}>
              <Icon name="map-pin" size={12} color={COLORS.textSecondary} />
              <Text style={styles.location}>{appointment.location}</Text>
            </View>
            <StatusPill status={pillStatus} label={statusLabel} style={styles.statusPill} />
            <ActionRow actions={actions} compact />
          </View>
        </Card>
      </TouchableOpacity>
    </View>
  );
}, (prev, next) => (
  prev.appointment?.id === next.appointment?.id &&
  prev.appointment?.status === next.appointment?.status &&
  prev.appointment?.confirmationStatus === next.appointment?.confirmationStatus &&
  prev.appointment?.isDone === next.appointment?.isDone &&
  prev.appointment?.startMs === next.appointment?.startMs &&
  prev.isHighlighted === next.isHighlighted &&
  prev.statusLabel === next.statusLabel &&
  prev.pillStatus === next.pillStatus &&
  prev.onOpenReschedule === next.onOpenReschedule &&
  prev.onQuickConfirm === next.onQuickConfirm &&
  prev.onChargeFromAppointment === next.onChargeFromAppointment
));

const AgendaScreen = ({ navigation, scheduleOverrides = {} }) => {
  const clients = useClientStore((state) => state.clients);
  const currentUserId = useClientStore((state) => state.currentUserId);
  const templates = useClientStore((state) => state.templates);
  const overridesFromStore = useClientStore((state) => state.scheduleOverrides);
  const storeIsLoading = useClientStore((state) => Boolean(state.isLoading));
  const setScheduleOverrides = useClientStore((state) => state.setScheduleOverrides);
  const todayString = getDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true);
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const resolveActiveUid = useCallback(
    () => currentUserId || auth?.currentUser?.uid || null,
    [currentUserId]
  );
  const effectiveOverrides = useMemo(
    () => (
      scheduleOverrides && Object.keys(scheduleOverrides).length > 0
        ? scheduleOverrides
        : overridesFromStore || {}
    ),
    [overridesFromStore, scheduleOverrides]
  );

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

  const selectedAppointments = useMemo(
    () => appointmentsData[selectedDate] || [],
    [appointmentsData, selectedDate]
  );
  const clientValues = useMemo(
    () => new Map(clients.map((client) => [client.id, Number(client.value || 0)])),
    [clients]
  );
  const selectedDateInstance = useMemo(
    () => (selectedDate ? new Date(`${selectedDate}T12:00:00`) : null),
    [selectedDate]
  );
  const hasDateError = Boolean(
    selectedDate && (!selectedDateInstance || Number.isNaN(selectedDateInstance.getTime()))
  );
  const isLoadingAgenda = storeIsLoading;
  const selectedDateRevenue = useMemo(
    () => selectedAppointments.reduce(
      (sum, appointment) => sum + Number(clientValues.get(appointment.clientId) || 0),
      0
    ),
    [clientValues, selectedAppointments]
  );
  const isSelectedToday = selectedDate === todayString;
  const nowMs = Date.now();
  const selectedDateLabel = useMemo(() => {
    if (!(selectedDateInstance instanceof Date) || Number.isNaN(selectedDateInstance.getTime())) return '';
    return selectedDateInstance.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, [selectedDateInstance]);

  const getStatusLabel = useCallback((appointment) => {
    const status = appointment?.status;
    if (status === 'done') return 'Concluído';
    if (status === 'rescheduled') return 'Remarcado';
    const confirmationStatus = resolveConfirmationStatus(appointment);
    if (confirmationStatus === 'confirmed') return 'Confirmado';
    if (confirmationStatus === 'canceled') return 'Cancelado';
    if (confirmationStatus === 'sent') return 'Aguardando resposta';
    return 'Agendado';
  }, []);

  const getAppointmentPillStatus = useCallback((appointment) => appointmentToPillStatus(appointment), []);

  const buildAppointmentStartAt = useCallback((appointment) => {
    const dateKey = appointment.dateKey || selectedDate || getDateKey(new Date());
    const baseDate = new Date(`${dateKey}T12:00:00`);
    const { hour, minute } = parseTimeLabelParts(appointment.time, 9, 0);
    baseDate.setHours(hour, minute, 0, 0);
    return baseDate;
  }, [selectedDate]);

  const resolveAppointmentId = useCallback((appointment, fallbackDateKey, fallbackTime) => {
    if (appointment?.appointmentKey) return appointment.appointmentKey;
    if (!appointment?.clientId) return '';
    return `${appointment.clientId}-${fallbackDateKey}-${fallbackTime}`;
  }, []);

  const handleConfirmAppointment = useCallback(async (appointment) => {
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
        } catch (_error) {
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
    } catch (_error) {
      Alert.alert('Agenda', 'Não foi possível registrar a confirmação.');
    }
  }, [buildAppointmentStartAt, clients, resolveActiveUid, resolveAppointmentId, templates]);

  const handleSetAppointmentConfirmation = useCallback(async (appointment, confirmationStatus) => {
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
    } catch (_error) {
      Alert.alert('Agenda', 'Não foi possível atualizar a confirmação do compromisso.');
    }
  }, [buildAppointmentStartAt, resolveActiveUid, resolveAppointmentId]);

  const handleCompleteAppointment = useCallback(async (appointment) => {
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
    } catch (_error) {
      Alert.alert('Agenda', 'Não foi possível concluir o compromisso.');
    }
  }, [buildAppointmentStartAt, resolveActiveUid, resolveAppointmentId]);

  const handleOpenReschedule = useCallback((appointment) => {
    setRescheduleTarget(appointment);
    setRescheduleVisible(true);
  }, []);

  const handleConfirmReschedule = useCallback(async (newDate) => {
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
    } catch (_error) {
      setScheduleOverrides(previousOverrides);
      console.error('Erro ao remarcar compromisso', _error);
      Alert.alert('Agenda', 'Não foi possível remarcar o compromisso.');
    }
  }, [buildAppointmentStartAt, effectiveOverrides, rescheduleTarget, resolveActiveUid, setScheduleOverrides]);

  const timelineItems = useMemo(
    () =>
      selectedAppointments
        .map((appointment) => {
          const startAt = buildAppointmentStartAt(appointment);
          if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) return null;
          const status = appointment?.status || 'scheduled';
          const confirmationStatus = resolveConfirmationStatus(appointment);
          return {
            ...appointment,
            id: buildAppointmentRenderKey(appointment),
            startAt,
            startMs: startAt.getTime(),
            amount: Number(clientValues.get(appointment.clientId) || 0),
            status,
            confirmationStatus,
            isDone: status === 'done',
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.startMs - right.startMs),
    [buildAppointmentStartAt, clientValues, selectedAppointments]
  );

  const nextWithinWindow = useMemo(() => {
    if (!isSelectedToday) return null;
    const candidate = timelineItems.find((item) => !item.isDone && item.startMs >= nowMs);
    if (!candidate) return null;
    return candidate.startMs - nowMs <= 90 * 60 * 1000 ? candidate : null;
  }, [isSelectedToday, nowMs, timelineItems]);

  const nowAppointments = useMemo(
    () => (nextWithinWindow ? [nextWithinWindow] : []),
    [nextWithinWindow]
  );

  const upcomingAppointments = useMemo(
    () =>
      timelineItems.filter((item) => {
        if (item.id === nextWithinWindow?.id) return false;
        if (item.isDone) return false;
        if (isSelectedToday) return item.startMs >= nowMs;
        return true;
      }),
    [isSelectedToday, nextWithinWindow?.id, nowMs, timelineItems]
  );

  const completedAppointments = useMemo(
    () =>
      timelineItems.filter((item) => {
        if (item.isDone) return true;
        if (isSelectedToday) return item.startMs < nowMs;
        return false;
      }),
    [isSelectedToday, nowMs, timelineItems]
  );

  const remainingCount = useMemo(
    () => timelineItems.filter((item) => !item.isDone && (!isSelectedToday || item.startMs >= nowMs)).length,
    [isSelectedToday, nowMs, timelineItems]
  );

  const handleChargeFromAppointment = useCallback((appointment) => {
    navigation.navigate('Cobrancas', {
      initialFilter: 'DUE_TODAY',
      clientId: appointment?.clientId,
    });
  }, [navigation]);

  const handleQuickConfirm = useCallback((appointment) => {
    if (!appointment || appointment.isDone) return;
    if (appointment.confirmationStatus === 'confirmed') {
      handleCompleteAppointment(appointment);
      return;
    }
    if (appointment.confirmationStatus === 'sent') {
      handleSetAppointmentConfirmation(appointment, 'confirmed');
      return;
    }
    handleConfirmAppointment(appointment);
  }, [handleCompleteAppointment, handleConfirmAppointment, handleSetAppointmentConfirmation]);

  const renderAppointmentCard = useCallback(
    (appointment, isHighlighted = false) => (
      <AppointmentCard
        key={appointment.id}
        appointment={appointment}
        isHighlighted={isHighlighted}
        statusLabel={getStatusLabel(appointment)}
        pillStatus={getAppointmentPillStatus(appointment)}
        onOpenReschedule={handleOpenReschedule}
        onQuickConfirm={handleQuickConfirm}
        onChargeFromAppointment={handleChargeFromAppointment}
      />
    ),
    [
      getAppointmentPillStatus,
      getStatusLabel,
      handleChargeFromAppointment,
      handleOpenReschedule,
      handleQuickConfirm,
    ]
  );

  return (
    <AppScreen style={styles.safeArea}>
      <ScreenHeader
        title="Agenda"
        navigation={navigation}
        actionLabel={isCalendarExpanded ? 'Minimizar' : 'Calendário'}
        onActionPress={() => setIsCalendarExpanded((current) => !current)}
      />

      {isCalendarExpanded ? (
        <Card style={styles.calendarContainer} contentStyle={styles.calendarContent}>
          <Calendar
            current={todayString}
            onDayPress={(day) => {
              setSelectedDate(day.dateString);
              setIsCalendarExpanded(false);
            }}
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
        </Card>
      ) : (
        <Card style={styles.calendarCollapsedCard}>
          <View style={styles.calendarCollapsedRow}>
            <View>
              <Text style={styles.calendarCollapsedLabel}>Dia selecionado</Text>
              <Text style={styles.calendarCollapsedValue}>{selectedDateLabel || titles.today}</Text>
            </View>
            <TouchableOpacity
              style={styles.calendarCollapsedButton}
              onPress={() => setIsCalendarExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel="Expandir calendário"
              hitSlop={TAP_HIT_SLOP}
            >
              <Icon name="calendar" size={16} color={COLORS.info} />
              <Text style={styles.calendarCollapsedButtonText}>Trocar data</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {selectedDate ? (
          <>
            {selectedDateLabel ? (
              <SectionHeader
                title={selectedDateLabel}
                action={<Text style={styles.dayCaption}>{isSelectedToday ? titles.today : 'Dia selecionado'}</Text>}
                style={styles.dateHeader}
              />
            ) : null}

            {!hasDateError ? (
              <Card style={styles.summaryCard}>
                <View style={styles.summaryRowTop}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Receita prevista hoje</Text>
                    <MoneyText value={selectedDateRevenue} variant="sm" tone="success" />
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Atendimentos restantes</Text>
                    <Text style={styles.summaryValue}>{remainingCount}</Text>
                  </View>
                </View>
              </Card>
            ) : null}

            <ListContainer
              loading={isLoadingAgenda}
              error={hasDateError ? 'Não foi possível carregar os compromissos deste dia.' : ''}
              isEmpty={!isLoadingAgenda && !hasDateError && timelineItems.length === 0}
              emptyIcon={<Icon name="calendar" size={34} color={COLORS.textSecondary} />}
              emptyTitle={emptyMessages.agenda.emptyDayTitle}
              emptyMessage={emptyMessages.agenda.emptyDayMessage}
              style={styles.dayListContainer}
            >
              {!hasDateError ? (
                <>
                  <View style={styles.timelineSection}>
                    <SectionHeader title="Agora" style={styles.sectionHeaderCompact} />
                    {nowAppointments.length > 0 ? (
                      nowAppointments.map((appointment) => renderAppointmentCard(appointment, true))
                    ) : (
                      <Text style={styles.sectionHint}>{emptyMessages.agenda.nowEmpty}</Text>
                    )}
                  </View>

                  <View style={styles.timelineSection}>
                    <SectionHeader title="Próximos" style={styles.sectionHeaderCompact} />
                    {upcomingAppointments.length > 0 ? (
                      upcomingAppointments.map((appointment) => renderAppointmentCard(appointment, false))
                    ) : (
                      <Text style={styles.sectionHint}>{emptyMessages.agenda.upcomingEmpty}</Text>
                    )}
                  </View>

                  <View style={styles.timelineSection}>
                    <SectionHeader title="Realizados" style={styles.sectionHeaderCompact} />
                    {completedAppointments.length > 0 ? (
                      completedAppointments.map((appointment) => renderAppointmentCard(appointment, false))
                    ) : (
                      <Text style={styles.sectionHint}>{emptyMessages.agenda.completedEmpty}</Text>
                    )}
                  </View>
                </>
              ) : null}
            </ListContainer>
          </>
        ) : (
          <EmptyState
            icon={<Icon name="calendar" size={34} color={COLORS.textSecondary} />}
            title={emptyMessages.agenda.noDateTitle}
            message={emptyMessages.agenda.noDateMessage}
          />
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

      <Fab
        style={styles.fab}
        accessibilityLabel="Abrir ações rápidas"
        onPress={() => setActionSheetVisible(true)}
      />

      <ActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        navigation={navigation}
      />
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  calendarContainer: {
    marginBottom: 16,
  },
  calendarCollapsedCard: {
    marginBottom: 16,
  },
  calendarCollapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  calendarCollapsedLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  calendarCollapsedValue: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    textTransform: 'capitalize',
  },
  calendarCollapsedButton: {
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calendarCollapsedButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.info,
    fontWeight: '700',
  },
  calendarContent: { padding: 0 },
  calendar: { borderRadius: 16, backgroundColor: COLORS.surface },
  listContainer: { flex: 1 },
  listContent: { paddingBottom: 24 },
  dateHeader: { marginBottom: 8, textTransform: 'capitalize' },
  dayCaption: { ...TYPOGRAPHY.caption, color: COLORS.info, fontWeight: '700' },
  summaryCard: { marginBottom: 14 },
  summaryRowTop: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1 },
  summaryLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 6 },
  summaryValue: { ...TYPOGRAPHY.subtitle, color: COLORS.textPrimary },
  summaryDivider: { width: 1, alignSelf: 'stretch', backgroundColor: COLORS.border, marginHorizontal: 12 },
  dayListContainer: { paddingBottom: 0 },
  timelineSection: { marginBottom: 10 },
  sectionHeaderCompact: { marginBottom: 4 },
  sectionHint: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 8 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 8 },
  timelineRail: { width: 22, alignItems: 'center' },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.border,
    marginTop: 22,
  },
  timelineDotActive: { backgroundColor: COLORS.info, transform: [{ scale: 1.2 }] },
  timelineLine: { width: 2, flex: 1, backgroundColor: 'rgba(148,163,184,0.35)', marginTop: 6, marginBottom: -2 },
  timelinePressable: { flex: 1 },
  timelinePressableActive: { transform: [{ scale: 1.01 }] },
  card: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cardHighlight: {
    borderColor: COLORS.info,
    borderWidth: 1.5,
    backgroundColor: 'rgba(49,130,206,0.06)',
  },
  timeBlock: {
    width: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    marginRight: 12,
  },
  timeText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  timeTag: {
    ...TYPOGRAPHY.caption,
    color: COLORS.info,
    marginTop: 2,
    fontWeight: '700',
  },
  infoBlock: { flex: 1, justifyContent: 'center' },
  clientName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  location: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginLeft: 4 },
  statusPill: { marginTop: 8 },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
});

export default AgendaScreen;
