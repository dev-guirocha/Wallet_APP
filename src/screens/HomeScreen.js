// /src/screens/HomeScreen.js

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  Platform,
  ToastAndroid,
} from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';
import { onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';

import {
  endOfDay,
  formatDateLabel,
  formatTimeLabelFromDate,
  getDateKey,
  getMonthKey,
  parseDateKeyToDate,
  parseTimeLabelParts,
  startOfDay,
  toDate,
} from '../utils/dateUtils';
import { getChargeMessage } from '../utils/chargeMessageBuilder';
import { getAppointmentsForDate } from '../utils/schedule';
import { useClientStore } from '../store/useClientStore';
import { auth } from '../utils/firebase';
import { generateAndShareReceipt } from '../utils/receiptGenerator';
import { userReceivablesCollection } from '../utils/firestoreRefs';
import {
  createAppointmentOverride,
  markReceivableAsUnpaid,
  rescheduleAppointment,
  updateUserPrivacy,
  markReceivableAsPaid,
  markReceivablesPaidByIds,
  markReceivablesUnpaidByIds,
  registerReceivableChargeSent,
} from '../utils/firestoreService';
import {
  applyTemplateVariables,
  buildPhoneE164FromRaw,
  openWhatsAppWithMessage,
} from '../utils/whatsapp';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../theme/legacy';
import RescheduleModal from '../components/RescheduleModal';
import {
  ActionSheet,
  ActivityFeedCard,
  AppScreen,
  Card,
  DailyPlanCard,
  EmptyState,
  Fab,
  MoneyText,
  SnackbarUndo,
  SectionHeader,
  StatusPill,
  SwipeCarousel,
} from '../components';
import { runGuardedAction } from '../utils/actionGuard';
import { formatBRL } from '../utils/money';
import { getDailyTasks, getTasksProgress } from '../utils/dailyTasks';
import { normalizeEvents } from '../utils/timelineEvents';
import { appointmentToPillStatus } from '../utils/statusMapping';

const getGreetingLabel = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const DEFAULT_CONFIRM_TEMPLATE = 'Boa noite {nome}! Aula confirmada para {hora}!';
const DEFAULT_CHARGE_TEMPLATE = 'Olá {nome}, sua cobrança vence em {data}.';

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

const isPaymentMarkedPaid = (entry) => {
  const rawStatus = typeof entry === 'object' ? entry?.status : entry;
  return rawStatus === 'paid' || rawStatus === 'pago';
};

const resolveReceivableDueDate = (receivable) => {
  const fromTimestamp = receivable?.dueDate?.toDate?.() || (receivable?.dueDate ? new Date(receivable.dueDate) : null);
  if (fromTimestamp instanceof Date && !Number.isNaN(fromTimestamp.getTime())) return fromTimestamp;
  const fromKey = parseDateKeyToDate(receivable?.dueDateKey);
  return fromKey instanceof Date && !Number.isNaN(fromKey.getTime()) ? fromKey : null;
};

const HomeScreen = ({ navigation }) => {
  const clients = useClientStore((state) => state.clients);
  const expenses = useClientStore((state) => state.expenses);
  const userName = useClientStore((state) => state.userName);
  const currentUserId = useClientStore((state) => state.currentUserId);
  const privacyHideBalances = useClientStore((state) => state.privacyHideBalances);
  const setPrivacyHideBalances = useClientStore((state) => state.setPrivacyHideBalances);
  const templates = useClientStore((state) => state.templates);
  const scheduleOverrides = useClientStore((state) => state.scheduleOverrides);
  const setScheduleOverrides = useClientStore((state) => state.setScheduleOverrides);
  const setClientPaymentStatus = useClientStore((state) => state.setClientPaymentStatus);

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [receivables, setReceivables] = useState([]);
  const [receivablesLoading, setReceivablesLoading] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [rescheduleVisible, setRescheduleVisible] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [payingReceivableIds, setPayingReceivableIds] = useState([]);
  const [completedTaskIds, setCompletedTaskIds] = useState([]);
  const [runningTaskIds, setRunningTaskIds] = useState([]);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [undoVisible, setUndoVisible] = useState(false);
  const [undoMessage, setUndoMessage] = useState('');
  const dailyProgressAnim = useRef(new Animated.Value(0)).current;
  const undoActionRef = useRef(null);
  const resolveActiveUid = () => currentUserId || auth?.currentUser?.uid || null;

  const getLocalDateKey = (value) => {
    const base = value instanceof Date ? value : new Date(value);
    return getDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0));
  };

  useEffect(() => {
    if (!currentUserId) {
      setReceivables([]);
      setReceivablesLoading(false);
      return;
    }

    setReceivablesLoading(true);

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
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  const receivableEntries = useMemo(() => {
    const now = new Date();
    const todayKey = getDateKey(now);
    const currentMonthKey = getMonthKey(now);
    const clientsMap = new Map(clients.map((client) => [client.id, client]));
    const monthEntries = new Set();

    const fromReceivables = receivables
      .map((receivable) => {
        const dueDate = resolveReceivableDueDate(receivable);
        const dueDateKey = receivable?.dueDateKey || (dueDate ? getDateKey(dueDate) : '');
        const entryMonthKey =
          receivable?.monthKey || (dueDate ? getMonthKey(dueDate) : dueDateKey ? dueDateKey.slice(0, 7) : '');
        if (entryMonthKey) {
          monthEntries.add(`${receivable.clientId}-${entryMonthKey}`);
        }
        const client = clientsMap.get(receivable.clientId) || null;
        const name = client?.name || receivable.clientName || 'Cliente';
        const amount = Number(receivable.amount ?? client?.value ?? 0);
        const isOverdue = Boolean(dueDateKey && dueDateKey < todayKey);
        const phoneE164 = client?.phoneE164 || buildPhoneE164FromRaw(client?.phoneRaw || client?.phone || '');

        return {
          id: receivable.id,
          clientId: receivable.clientId,
          name,
          amount,
          dueDate,
          dueDateKey,
          isOverdue,
          receivable,
          client,
          phoneE164,
        };
      });

    const fromClientsFallback = clients
      .map((client) => {
        const dueDay = Number(client?.dueDay || 0);
        if (!client?.id || !Number.isInteger(dueDay) || dueDay <= 0) return null;
        if (isPaymentMarkedPaid(client?.payments?.[currentMonthKey])) return null;

        const fallbackKey = `${client.id}-${currentMonthKey}`;
        if (monthEntries.has(fallbackKey)) return null;

        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const safeDueDay = Math.min(dueDay, daysInMonth);
        const dueDate = new Date(now.getFullYear(), now.getMonth(), safeDueDay, 12, 0, 0, 0);
        const dueDateKey = getDateKey(dueDate);
        const amount = Number(client?.value ?? 0);
        const phoneE164 = client?.phoneE164 || buildPhoneE164FromRaw(client?.phoneRaw || client?.phone || '');
        const syntheticReceivable = {
          id: fallbackKey,
          clientId: client.id,
          clientName: client.name || 'Cliente',
          amount,
          monthKey: currentMonthKey,
          dueDay: safeDueDay,
          dueDateKey,
          dueDate,
          paid: false,
          synthetic: true,
        };

        return {
          id: fallbackKey,
          clientId: client.id,
          name: client.name || 'Cliente',
          amount,
          dueDate,
          dueDateKey,
          isOverdue: dueDateKey < todayKey,
          receivable: syntheticReceivable,
          client,
          phoneE164,
        };
      })
      .filter(Boolean);

    return [...fromReceivables, ...fromClientsFallback].sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      const left = a.dueDate instanceof Date ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.dueDate instanceof Date ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    });
  }, [clients, receivables]);

  const homeKpis = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(todayStart);
    const weekEnd = endOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 6));

    const isBetween = (value, from, to) =>
      value instanceof Date && value.getTime() >= from.getTime() && value.getTime() <= to.getTime();

    const receivedToday = clients.reduce((sum, client) => {
      const payments = client?.payments;
      if (!payments || typeof payments !== 'object') return sum;

      const paidToday = Object.values(payments).reduce((clientSum, payment) => {
        const paymentStatus = typeof payment === 'object' ? payment?.status : payment;
        if (paymentStatus !== 'paid' && paymentStatus !== 'pago') return clientSum;

        const paymentDate = toDate(
          (typeof payment === 'object' && payment?.date) ||
            (typeof payment === 'object' && payment?.paidAt) ||
            (typeof payment === 'object' && payment?.updatedAt)
        );
        if (!isBetween(paymentDate, todayStart, todayEnd)) return clientSum;

        const paymentValue = Number(
          (typeof payment === 'object' ? payment?.value : null) ?? client?.value ?? 0
        );
        return clientSum + (Number.isFinite(paymentValue) ? paymentValue : 0);
      }, 0);

      return sum + paidToday;
    }, 0);

    const receivables7Days = receivableEntries.reduce((sum, item) => {
      if (!isBetween(item.dueDate, todayStart, weekEnd)) return sum;
      return sum + Number(item.amount || 0);
    }, 0);

    const overdueReceivablesCount = receivableEntries.reduce((sum, item) => {
      if (!(item.dueDate instanceof Date)) return sum;
      return item.dueDate.getTime() < todayStart.getTime() ? sum + 1 : sum;
    }, 0);

    const dueTodayReceivablesCount = receivableEntries.reduce((sum, item) => {
      return isBetween(item.dueDate, todayStart, todayEnd) ? sum + 1 : sum;
    }, 0);

    const expensesDueToday = expenses.reduce((sum, expense) => {
      const expenseDate = toDate(expense?.date || expense?.createdAt || expense?.updatedAt);
      if (!isBetween(expenseDate, todayStart, todayEnd)) return sum;
      return sum + Number(expense?.value || 0);
    }, 0);

    const expenses7Days = expenses.reduce((sum, expense) => {
      const expenseDate = toDate(expense?.date || expense?.createdAt || expense?.updatedAt);
      if (!isBetween(expenseDate, todayStart, weekEnd)) return sum;
      return sum + Number(expense?.value || 0);
    }, 0);

    return {
      balanceToday: receivedToday - expensesDueToday,
      receivables7Days,
      expenses7Days,
      overdueReceivablesCount,
      dueTodayReceivablesCount,
    };
  }, [clients, expenses, receivableEntries]);

  const todayDateKey = getDateKey(new Date());
  const todayReferenceDate = useMemo(
    () => parseDateKeyToDate(todayDateKey) || new Date(),
    [todayDateKey]
  );

  const todayAppointments = useMemo(() => {
    const today = new Date();
    const appointments = getAppointmentsForDate({ date: today, clients, overrides: scheduleOverrides });
    return dedupeAppointments(appointments);
  }, [clients, scheduleOverrides]);
  const dailyTasks = useMemo(() => {
    return getDailyTasks({
      receivables: receivableEntries,
      appointments: todayAppointments,
      today: todayReferenceDate,
    });
  }, [receivableEntries, todayAppointments, todayReferenceDate]);

  useEffect(() => {
    const taskIds = new Set(dailyTasks.map((task) => task.id));
    setCompletedTaskIds((previous) => previous.filter((id) => taskIds.has(id)));
    setRunningTaskIds((previous) => previous.filter((id) => taskIds.has(id)));
  }, [dailyTasks]);

  const tasksProgress = useMemo(
    () => getTasksProgress(dailyTasks, completedTaskIds),
    [completedTaskIds, dailyTasks]
  );

  useEffect(() => {
    Animated.timing(dailyProgressAnim, {
      toValue: tasksProgress.percent,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [dailyProgressAnim, tasksProgress.percent]);

  const openUndo = useCallback((message, handler) => {
    undoActionRef.current = handler;
    setUndoMessage(message);
    setUndoVisible(true);
  }, []);

  const closeUndo = useCallback(() => {
    undoActionRef.current = null;
    setUndoVisible(false);
    setUndoMessage('');
  }, []);

  const handleUndo = useCallback(async () => {
    const handler = undoActionRef.current;
    closeUndo();
    if (typeof handler === 'function') {
      try {
        await handler();
      } catch (_error) {
        Alert.alert('Desfazer', 'Não foi possível desfazer a última ação.');
      }
    }
  }, [closeUndo]);

  const handleTogglePaymentFromMenu = async () => {
    if (!selectedPayment || !currentUserId) {
      setSelectedPayment(null);
      return;
    }

    await handleMarkReceivablePaid(selectedPayment);
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

  const resolveAppointmentId = (appointment, fallbackDateKey, fallbackTime) => {
    if (appointment?.appointmentKey) return appointment.appointmentKey;
    if (!appointment?.clientId) return '';
    return `${appointment.clientId}-${fallbackDateKey}-${fallbackTime}`;
  };

  const handleConfirmAppointment = async (appointment) => {
    if (!appointment || !currentUserId) return;
    const client = clients.find((item) => item.id === appointment.clientId);
    const phoneE164 = client?.phoneE164 || buildPhoneE164FromRaw(client?.phoneRaw || client?.phone || '');
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
            uid: currentUserId,
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
        uid: currentUserId,
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
      // ignore confirmation tracking errors
    }
  };

  const handleCompleteAppointment = async (appointment) => {
    if (!appointment || !currentUserId) return;
    const appointmentDate = buildAppointmentStartAt(appointment);
    const safeTime = appointment.time || '00:00';
    const dateKey = appointment.dateKey || getDateKey(appointmentDate);
    const appointmentId = resolveAppointmentId(appointment, dateKey, safeTime);
    if (!appointmentId) return;
    try {
      await createAppointmentOverride({
        uid: currentUserId,
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
  };

  const handleSetAppointmentConfirmation = async (appointment, confirmationStatus) => {
    if (!appointment || !currentUserId) return;
    const appointmentDate = buildAppointmentStartAt(appointment);
    const safeTime = appointment.time || '00:00';
    const dateKey = appointment.dateKey || getDateKey(appointmentDate);
    const appointmentId = resolveAppointmentId(appointment, dateKey, safeTime);
    if (!appointmentId) return;

    try {
      await createAppointmentOverride({
        uid: currentUserId,
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
  };

  const handleOpenReschedule = (appointment) => {
    setRescheduleTarget(appointment);
    setRescheduleVisible(true);
  };

  const handleOpenAppointmentMenu = useCallback((appointment) => {
    setSelectedAppointment(appointment);
  }, []);

  const handleCloseAppointmentMenu = useCallback(() => {
    setSelectedAppointment(null);
  }, []);

  const handleConfirmFromMenu = async () => {
    if (!selectedAppointment) return;
    const target = selectedAppointment;
    setSelectedAppointment(null);
    await handleConfirmAppointment(target);
  };

  const handleMarkConfirmedFromMenu = async () => {
    if (!selectedAppointment) return;
    const target = selectedAppointment;
    setSelectedAppointment(null);
    await handleSetAppointmentConfirmation(target, 'confirmed');
  };

  const handleMarkCanceledFromMenu = async () => {
    if (!selectedAppointment) return;
    const target = selectedAppointment;
    setSelectedAppointment(null);
    await handleSetAppointmentConfirmation(target, 'canceled');
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
    const oldDateKey = oldAppointment.dateKey || getLocalDateKey(oldStartAt);
    const newDateKey = getLocalDateKey(newDate);
    const oldSafeTime = oldAppointment.time || '00:00';
    const newSafeTime = formatTimeLabelFromDate(newDate) || oldSafeTime;
    const oldAppointmentId =
      oldAppointment.appointmentKey || `${oldAppointment.clientId}-${oldDateKey}-${oldSafeTime}`;
    const newAppointmentId = `${oldAppointment.clientId}-${newDateKey}-${newSafeTime}`;
    const previousOverrides = scheduleOverrides || {};

    if (oldAppointmentId === newAppointmentId) {
      Alert.alert('Agenda', 'Escolha uma data ou horário diferente para remarcar.');
      return;
    }

    try {
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

      // Fecha o modal imediatamente para feedback instantâneo no Android.
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
      if (Platform.OS === 'android') {
        ToastAndroid.show('Compromisso remarcado.', ToastAndroid.SHORT);
      } else {
        Alert.alert('Agenda', 'Compromisso remarcado com sucesso.');
      }
    } catch (error) {
      setScheduleOverrides(previousOverrides);
      console.error('Erro ao remarcar compromisso', error);
      Alert.alert('Agenda', 'Não foi possível remarcar o compromisso.');
    }
  };

  const handleChargeReceivable = async (payment) => {
    if (!payment) return false;

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
        return false;
      }
    }

    if (!currentUserId) return false;
    const dueDate = payment.dueDate;
    if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) {
      Alert.alert('Cobrança', 'Defina o vencimento do cliente para enviar cobrança.', [
        { text: 'Agora não', style: 'cancel' },
        {
          text: 'Editar cliente',
          onPress: () => navigation.navigate('AddClient', { clientId: payment.clientId }),
        },
      ]);
      return false;
    }
    const template = templates?.chargeMsg?.trim() || DEFAULT_CHARGE_TEMPLATE;
    const dueEnd = endOfDay(dueDate);
    const daysLate = Math.max(0, Math.floor((Date.now() - dueEnd.getTime()) / 86400000));
    const message = getChargeMessage(payment, daysLate);
    const actionKey = `home-charge:${payment.id}`;
    const { blocked, value } = await runGuardedAction(actionKey, async () => {
      const opened = await openWhatsAppWithMessage({ phoneE164: payment.phoneE164, message });
      if (!opened) return false;

      try {
        const fallbackReceivable = {
          clientId: payment.clientId,
          clientName: payment.name,
          amount: Number(payment.amount ?? 0),
          dueDate,
          monthKey: payment.receivable?.monthKey || getMonthKey(dueDate),
          paid: false,
        };
        await registerReceivableChargeSent({
          uid: currentUserId,
          receivableId: payment.id,
          usedTemplate: template,
          fallbackReceivable,
        });
        const sentAt = Timestamp.fromDate(new Date());
        setReceivables((prev) =>
          prev.map((item) => {
            if (item.id !== payment.id) return item;
            const history = Array.isArray(item.chargeHistory) ? item.chargeHistory : [];
            return {
              ...item,
              lastChargeSentAt: sentAt,
              chargeHistory: [
                ...history,
                { at: sentAt, channel: 'whatsapp', template },
              ],
            };
          })
        );
      } catch (_error) {
        Alert.alert('Cobrança', 'Não foi possível enviar cobrança agora.');
      }
      return true;
    });
    if (blocked) return false;
    return Boolean(value);
  };

  const notifyPaymentSuccess = () => {
    const message = 'Pagamento marcado como pago.';
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Pagamento', message);
  };

  const handleMarkReceivablePaid = async (payment) => {
    if (!payment || !currentUserId) {
      setSelectedPayment(null);
      return;
    }

    if (!payment.dueDate) {
      Alert.alert('Pagamento', 'Vencimento inválido para este recebível.');
      setSelectedPayment(null);
      return;
    }

    const actionKey = `home-pay:${payment.id}`;
    const { blocked } = await runGuardedAction(actionKey, async () => {
      if (payingReceivableIds.includes(payment.id)) return;
      setPayingReceivableIds((prev) => [...prev, payment.id]);

      try {
        const monthKey = getMonthKey(payment.dueDate);
        const duplicateIds = receivables
          .filter((item) => {
            if (item.clientId !== payment.clientId) return false;
            const itemDueDate = item.dueDate?.toDate?.() || (item.dueDate ? new Date(item.dueDate) : null);
            const itemMonthKey =
              item.monthKey || (item.dueDateKey ? String(item.dueDateKey).slice(0, 7) : itemDueDate ? getMonthKey(itemDueDate) : '');
            if (!itemMonthKey) return false;
            return itemMonthKey === monthKey;
          })
          .map((item) => item.id);

        const removedItems = receivables.filter((item) => {
          if (item.clientId !== payment.clientId) return false;
          const itemDueDate = item.dueDate?.toDate?.() || (item.dueDate ? new Date(item.dueDate) : null);
          if (!itemDueDate) return item.id === payment.id;
          return getMonthKey(itemDueDate) === monthKey;
        });

        await markReceivableAsPaid({
          uid: currentUserId,
          receivableId: payment.id,
          method: 'manual',
          fallbackReceivable: {
            clientId: payment.clientId,
            clientName: payment.name,
            amount: Number(payment.amount ?? 0),
            dueDate: payment.dueDate,
            monthKey,
            paid: true,
          },
        });

        setClientPaymentStatus({
          clientId: payment.clientId,
          monthKey,
          paid: true,
          amount: payment.amount,
        });

        if (duplicateIds.length > 0) {
          await markReceivablesPaidByIds({
            uid: currentUserId,
            receivableIds: duplicateIds,
          });
        }

        setReceivables((prev) =>
          prev.filter((item) => {
            if (item.clientId !== payment.clientId) return true;
            const itemDueDate = item.dueDate?.toDate?.() || (item.dueDate ? new Date(item.dueDate) : null);
            if (!itemDueDate) return item.id !== payment.id;
            return getMonthKey(itemDueDate) !== monthKey;
          })
        );
        notifyPaymentSuccess();
        openUndo('Pagamento registrado. Deseja desfazer?', async () => {
          await markReceivableAsUnpaid({ uid: currentUserId, receivableId: payment.id });
          if (duplicateIds.length > 0) {
            await markReceivablesUnpaidByIds({ uid: currentUserId, receivableIds: duplicateIds });
          }
          setClientPaymentStatus({
            clientId: payment.clientId,
            monthKey,
            paid: false,
            amount: payment.amount,
          });
          setReceivables((prev) => {
            const ids = new Set(prev.map((entry) => entry.id));
            const restored = removedItems.filter((entry) => !ids.has(entry.id));
            return [...prev, ...restored];
          });
        });
      } catch (_error) {
        Alert.alert('Pagamento', 'Não foi possível atualizar o recebimento.');
      } finally {
        setPayingReceivableIds((prev) => prev.filter((id) => id !== payment.id));
        setSelectedPayment(null);
      }
    });
    if (blocked) return;
  };

  const handleRunDailyTask = async (task) => {
    if (!task?.id || runningTaskIds.includes(task.id)) return;

    setCompletedTaskIds((previous) => (
      previous.includes(task.id) ? previous : [...previous, task.id]
    ));
    setRunningTaskIds((previous) => [...previous, task.id]);

    try {
      if (task.type === 'OVERDUE_CHARGE' || task.type === 'TODAY_CHARGE') {
        const target = task.payload;
        if (target) {
          await handleChargeReceivable(target);
        } else {
          navigation.navigate('Cobrancas', {
            initialFilter: task.type === 'OVERDUE_CHARGE' ? 'OVERDUE' : 'DUE_TODAY',
          });
        }
      } else if (task.type === 'CONFIRM_APPOINTMENT') {
        if (task.payload) {
          await handleConfirmAppointment(task.payload);
        }
      } else if (task.type === 'TODAY_APPOINTMENT') {
        if (task.payload) {
          await handleCompleteAppointment(task.payload);
        } else {
          navigation.navigate('Agenda');
        }
      } else {
        navigation.navigate('Agenda');
      }
    } catch (_error) {
      setCompletedTaskIds((previous) => previous.filter((id) => id !== task.id));
      Alert.alert('Plano de hoje', 'Não foi possível concluir essa tarefa agora.');
    } finally {
      setRunningTaskIds((previous) => previous.filter((id) => id !== task.id));
    }
  };

  const handleToggleHideBalances = useCallback(async () => {
    const previousValue = privacyHideBalances;
    const nextValue = !previousValue;
    setPrivacyHideBalances(nextValue);
    if (!currentUserId) return;
    try {
      await updateUserPrivacy({ uid: currentUserId, hideBalances: nextValue });
    } catch (_error) {
      setPrivacyHideBalances(previousValue);
      Alert.alert('Privacidade', 'Não foi possível atualizar a preferência.');
    }
  }, [currentUserId, privacyHideBalances, setPrivacyHideBalances]);

  const getGreeting = useCallback(() => {
    const base = getGreetingLabel();
    if (userName) return `${base}, ${userName}`;
    return `${base}!`;
  }, [userName]);

  const formatBalance = useCallback(
    (value) => (privacyHideBalances ? '•••••' : formatBRL(value)),
    [privacyHideBalances]
  );
  const balanceTodayTone = homeKpis.balanceToday < 0 ? 'danger' : homeKpis.balanceToday > 0 ? 'success' : 'neutral';
  const agendaTodayCount = todayAppointments.length;
  const dailyProgressWidth = dailyProgressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

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

  const timelineItems = useMemo(() => {
    const statusToImportance = {
      OVERDUE: 'high',
      PENDING: 'medium',
      SCHEDULED: 'low',
      PAID: 'low',
    };

    return normalizeEvents({
      receivables: receivableEntries,
      appointments: todayAppointments,
    })
      .slice(0, 20)
      .map((event) => ({
        id: `timeline-${event.id}`,
        date: event.date,
        type: String(event.type || event.status || 'UPDATE').toUpperCase(),
        title: event.title,
        subtitle: event.subtitle,
        importance: statusToImportance[event.status] || 'low',
      }));
  }, [receivableEntries, todayAppointments]);

  const todayAppointmentRows = useMemo(
    () =>
      todayAppointments.map((appointment) => (
        <View key={appointment.appointmentKey || appointment.id} style={styles.appointmentRow}>
          <View style={styles.timeColumn}>
            <Text style={styles.timeText}>{appointment.time}</Text>
          </View>
          <TouchableOpacity
            style={styles.appointmentCardTouchable}
            onPress={() => handleOpenAppointmentMenu(appointment)}
            activeOpacity={0.85}
          >
            <Card style={styles.appointmentCard}>
              <Text style={styles.appName}>{appointment.name}</Text>
              <Text style={styles.appLocation}>{appointment.location}</Text>
              <StatusPill
                status={getAppointmentPillStatus(appointment)}
                label={getStatusLabel(appointment)}
                style={styles.appointmentPill}
              />
            </Card>
          </TouchableOpacity>
        </View>
      )),
    [getAppointmentPillStatus, getStatusLabel, handleOpenAppointmentMenu, todayAppointments]
  );

  const selectedAppointmentConfirmationStatus = resolveConfirmationStatus(selectedAppointment);
  const isSelectedAppointmentScheduled = selectedAppointment?.status === 'scheduled';

  return (
    <>
      <AppScreen scroll style={styles.safeArea} contentContainerStyle={styles.screenContent}>
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

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{tasksProgress.percent}% do dia resolvido</Text>
            <Text style={styles.progressMeta}>
              {tasksProgress.done}/{tasksProgress.total}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: dailyProgressWidth }]} />
          </View>
        </View>

        <View style={styles.section}>
          <SwipeCarousel
            hint="Arraste para ver mais"
            slides={[
              {
                key: 'today-overview',
                content: (
                  <View style={styles.carouselSlide}>
                    <SectionHeader
                      title="Visão de hoje"
                      style={styles.sectionHeader}
                      action={(
                        <TouchableOpacity style={styles.eyeButton} onPress={handleToggleHideBalances}>
                          <Icon name={privacyHideBalances ? 'eye-off' : 'eye'} size={18} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                      )}
                    />
                    <Card style={styles.heroCard}>
                      <View style={styles.kpiGrid}>
                        <View style={[styles.kpiItem, styles.kpiItemDivider]}>
                          <Text style={styles.kpiLabel}>Saldo hoje</Text>
                          {privacyHideBalances ? (
                            <Text style={styles.kpiMaskedValue}>•••••</Text>
                          ) : (
                            <MoneyText value={homeKpis.balanceToday} variant="md" tone={balanceTodayTone} />
                          )}
                        </View>

                        <View style={[styles.kpiItem, styles.kpiItemDivider]}>
                          <Text style={styles.kpiLabel}>A receber (7 dias)</Text>
                          {privacyHideBalances ? (
                            <Text style={styles.kpiMaskedValue}>•••••</Text>
                          ) : (
                            <MoneyText value={homeKpis.receivables7Days} variant="sm" tone="success" />
                          )}
                        </View>

                        <View style={styles.kpiItem}>
                          <Text style={styles.kpiLabel}>Agenda (hoje)</Text>
                          <Text style={styles.kpiCountValue}>{agendaTodayCount}</Text>
                        </View>
                      </View>
                    </Card>
                  </View>
                ),
              },
              {
                key: 'daily-plan',
                content: (
                  <View style={styles.carouselSlide}>
                    <SectionHeader title="Plano de hoje" style={styles.sectionHeader} />
                    <DailyPlanCard
                      receivables={receivableEntries}
                      appointments={todayAppointments}
                      today={todayReferenceDate}
                      completedTaskIds={completedTaskIds}
                      runningTaskIds={runningTaskIds}
                      loading={receivablesLoading}
                      onRunTask={handleRunDailyTask}
                      style={styles.actionCard}
                    />
                  </View>
                ),
              },
              {
                key: 'timeline',
                content: (
                  <View style={styles.carouselSlide}>
                    <SectionHeader title="Timeline" style={styles.sectionHeader} />
                    <ActivityFeedCard
                      items={timelineItems}
                      maxItems={6}
                      title="Movimentações recentes"
                      emptyTitle="Sem eventos recentes"
                      emptyMessage="Quando houver movimentações, elas aparecem aqui."
                    />
                  </View>
                ),
              },
            ]}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Agenda Hoje" style={styles.sectionHeader} />
          {todayAppointments.length === 0 ? (
            <EmptyState
              icon={<Icon name="calendar" size={34} color={COLORS.textSecondary} />}
              title="Agenda livre hoje"
              message="Nenhum compromisso confirmado para hoje."
              style={styles.emptyState}
            />
          ) : (
            todayAppointmentRows
          )}
        </View>
      </AppScreen>

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
                ) : (
                  <Text style={[styles.modalSubtitle, styles.modalSubtitleWarning]}>
                    Vencimento não definido
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.modalButtonPrimary}
                  onPress={handleTogglePaymentFromMenu}
                >
                  <Icon name="check-circle" size={20} color={COLORS.textOnPrimary} />
                  <Text style={styles.modalButtonText}>Marcar como Pago</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalButtonWarning,
                    !selectedPayment?.dueDate && styles.modalButtonDisabled,
                  ]}
                  onPress={() => handleChargeReceivable(selectedPayment)}
                  disabled={!selectedPayment?.dueDate}
                >
                  <Icon name="message-circle" size={20} color={COLORS.warning} />
                  <Text style={[styles.modalButtonText, { color: COLORS.warning }]}>
                    Cobrar via WhatsApp
                  </Text>
                </TouchableOpacity>

                {!selectedPayment?.dueDate ? (
                  <TouchableOpacity
                    style={styles.modalButtonSecondary}
                    onPress={() => {
                      const clientId = selectedPayment?.clientId;
                      setSelectedPayment(null);
                      if (clientId) {
                        navigation.navigate('AddClient', { clientId });
                      }
                    }}
                  >
                    <Icon name="edit-2" size={20} color={COLORS.primary} />
                    <Text style={[styles.modalButtonText, { color: COLORS.primary }]}>
                      Definir vencimento
                    </Text>
                  </TouchableOpacity>
                ) : null}

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

                {isSelectedAppointmentScheduled && selectedAppointmentConfirmationStatus === 'pending' ? (
                  <TouchableOpacity
                    style={styles.appointmentModalButtonPrimary}
                    onPress={handleConfirmFromMenu}
                  >
                    <Icon name="message-circle" size={20} color={COLORS.primary} />
                    <Text style={[styles.modalButtonText, { color: COLORS.primary }]}>
                      Confirmar compromisso
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {isSelectedAppointmentScheduled && selectedAppointmentConfirmationStatus === 'sent' ? (
                  <>
                    <TouchableOpacity
                      style={styles.appointmentModalButtonSuccess}
                      onPress={handleMarkConfirmedFromMenu}
                    >
                      <Icon name="check-circle" size={20} color={COLORS.textOnPrimary} />
                      <Text style={styles.modalButtonText}>Confirmado</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.appointmentModalButtonDanger}
                      onPress={handleMarkCanceledFromMenu}
                    >
                      <Icon name="x-circle" size={20} color={COLORS.textOnPrimary} />
                      <Text style={styles.modalButtonText}>Cancelado</Text>
                    </TouchableOpacity>
                  </>
                ) : null}

                {isSelectedAppointmentScheduled && selectedAppointmentConfirmationStatus === 'confirmed' ? (
                  <>
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
                  </>
                ) : null}

                {isSelectedAppointmentScheduled && selectedAppointmentConfirmationStatus === 'canceled' ? (
                  <TouchableOpacity
                    style={styles.appointmentModalButtonWarning}
                    onPress={handleRescheduleFromMenu}
                  >
                    <Icon name="calendar" size={20} color={COLORS.warning} />
                    <Text style={[styles.modalButtonText, { color: COLORS.warning }]}>
                      Remarcar compromisso
                    </Text>
                  </TouchableOpacity>
                ) : null}
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

      <SnackbarUndo
        visible={undoVisible}
        message={undoMessage}
        onUndo={handleUndo}
        onDismiss={closeUndo}
      />
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  screenContent: { paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
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
  progressSection: {
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  progressMeta: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(113,128,150,0.22)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  heroCard: {
    marginBottom: 4,
  },
  carouselSlide: {
    paddingRight: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  kpiItem: {
    flex: 1,
    paddingHorizontal: 10,
  },
  kpiItemDivider: {
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  eyeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: 'rgba(160,174,192,0.15)',
  },
  kpiLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  kpiMaskedValue: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  kpiCountValue: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.primary,
  },
  actionCard: {
    marginBottom: 4,
  },
  tomorrowCard: {
    marginBottom: 4,
  },
  tomorrowRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tomorrowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: 'rgba(66,153,225,0.12)',
  },
  tomorrowTextBlock: {
    flex: 1,
  },
  tomorrowTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  tomorrowSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  tomorrowButton: {
    marginTop: 2,
  },
  forecastCard: {
    marginBottom: 4,
  },
  forecastTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  forecastLabel: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  forecastSplitRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  forecastSplitItem: {
    flex: 1,
  },
  forecastSplitDivider: {
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingRight: 10,
    marginRight: 10,
  },
  forecastSubLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  forecastHiddenValue: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  forecastAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    backgroundColor: 'rgba(229,62,62,0.1)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  forecastAlertText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.danger,
    flex: 1,
  },
  forecastRiskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  forecastRiskText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  monthCard: {
    marginBottom: 4,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  monthScoreLabel: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
  },
  monthScoreBadge: {
    minWidth: 48,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: 'rgba(43,108,176,0.12)',
  },
  monthScoreValue: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.primary,
    fontWeight: '700',
  },
  monthFactorsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  monthFactorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    flex: 1,
  },
  monthInsightsBlock: {
    marginTop: 8,
    marginBottom: 10,
    gap: 8,
  },
  monthInsightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  monthInsightText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
    flex: 1,
    lineHeight: 18,
  },
  monthRiskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthRiskText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  actionCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  actionIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionIconDanger: {
    backgroundColor: 'rgba(229, 62, 62, 0.12)',
  },
  actionIconWarning: {
    backgroundColor: 'rgba(214, 158, 46, 0.16)',
  },
  actionIconSuccess: {
    backgroundColor: 'rgba(56, 161, 105, 0.15)',
  },
  actionTextContent: {
    flex: 1,
  },
  actionTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  actionDescription: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  actionButton: {
    marginTop: 4,
  },
  timelineGroup: {
    marginBottom: 14,
    gap: 10,
  },
  timelineBucketTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  timelineCard: {
    marginBottom: 10,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  timelineMainInfo: {
    flex: 1,
  },
  timelineTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  timelineSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  timelinePill: {
    marginTop: 1,
  },
  timelineMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineDateLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  timelineAmountHidden: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  section: { marginBottom: 30 },
  sectionHeader: {
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 2,
  },
  skeletonSpacing: {
    marginBottom: 10,
  },
  paymentsListContent: {
    paddingHorizontal: 2,
  },
  paymentsEmptyState: {
    width: 260,
  },
  paymentCardTouchable: {
    marginRight: 12,
  },
  paymentCard: {
    width: 220,
  },
  paymentCardContent: {
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
  paymentInfo: { flex: 1 },
  paymentName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  paymentNameOverdue: { color: COLORS.danger },
  paymentDate: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 4 },
  paymentPill: {
    marginTop: 8,
  },
  chargeActionButton: {
    marginTop: 10,
    minHeight: 36,
    paddingVertical: 8,
  },
  chargeActionButtonText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  appointmentRow: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16 },
  timeColumn: { width: 60, alignItems: 'center', paddingTop: 10 },
  timeText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  appointmentCardTouchable: { flex: 1 },
  appointmentCard: {
    flex: 1,
  },
  appName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textPrimary },
  appLocation: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 4 },
  appointmentPill: { marginTop: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 20 },
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
  modalSubtitleWarning: { color: COLORS.warning },
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
  modalButtonDisabled: { opacity: 0.5 },
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
  appointmentModalButtonDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    width: '100%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
});

export default HomeScreen;
