import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { getDateKey, getNextDueDateFromDay } from './dateUtils';
import { getAppointmentsForDate } from './schedule';

const APPOINTMENT_LOOKAHEAD_DAYS = 14;
const PAYMENT_REMINDER_HOUR = 9;
const PAYMENT_REMINDER_MINUTE = 0;
const DEFAULT_CHANNEL_ID = 'wallet-reminders';

let notificationsConfigured = false;

const ensureAndroidChannelConfigured = async () => {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: 'Lembretes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });
  } catch (error) {
    // ignore channel setup errors
  }
};

const ensureNotificationConfigured = async () => {
  if (notificationsConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  await ensureAndroidChannelConfigured();
  notificationsConfigured = true;
};

const toPermissionStatus = (settings) => {
  const iosStatus = settings?.ios?.status;
  const provisional =
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL;

  const granted = Boolean(settings?.granted || provisional);
  const canAsk =
    typeof settings?.canAskAgain === 'boolean' ? settings.canAskAgain : !granted;

  return { granted, canAsk };
};

export const configureNotificationHandling = () => {
  void ensureNotificationConfigured();
};

export const requestNotificationPermissionAsync = async () => {
  await ensureNotificationConfigured();

  try {
    const settings = await Notifications.requestPermissionsAsync();
    return toPermissionStatus(settings).granted;
  } catch (error) {
    return false;
  }
};

export const getNotificationPermissionStatus = async () => {
  await ensureNotificationConfigured();

  try {
    const settings = await Notifications.getPermissionsAsync();
    return toPermissionStatus(settings);
  } catch (error) {
    return { granted: false, canAsk: false };
  }
};

export const shouldAskForNotificationPermission = async () => {
  const status = await getNotificationPermissionStatus();
  return status.canAsk && !status.granted;
};

const parseClientDueDay = (dueDay) => {
  if (!dueDay) return null;
  const match = String(dueDay).match(/(\d{1,2})/);
  if (!match) return null;
  const day = Number(match[1]);
  if (!Number.isInteger(day) || day <= 0) return null;
  return Math.min(day, 31);
};

const scheduleLocalNotification = async ({ title, message, date, data, channelId }) => {
  if (!date || date <= new Date()) return null;

  try {
    await ensureNotificationConfigured();

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        data: data || {},
        sound: 'default',
      },
      trigger:
        Platform.OS === 'android'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date,
              channelId: channelId || DEFAULT_CHANNEL_ID,
            }
          : date,
    });

    return notificationId;
  } catch (error) {
    return null;
  }
};

const schedulePaymentReminderAsync = async (client) => {
  if (client.notificationsPaymentOptIn === false) return null;

  const dueDay = parseClientDueDay(client.dueDay);
  if (!dueDay) return null;

  const reminderDate = getNextDueDateFromDay(dueDay, new Date(), client.time);
  if (!reminderDate || reminderDate <= new Date()) return null;

  reminderDate.setHours(PAYMENT_REMINDER_HOUR, PAYMENT_REMINDER_MINUTE, 0, 0);

  return scheduleLocalNotification({
    title: `Cobrar ${client.name}`,
    message: `Hoje é dia de pagamento. Valor combinado: R$ ${client.value || '0'}.`,
    date: reminderDate,
    data: { type: 'payment', clientId: client.id },
  });
};

const scheduleAppointmentRemindersAsync = async (clients, overrides = {}) => {
  const now = new Date();
  const registry = [];

  for (let offset = 0; offset < APPOINTMENT_LOOKAHEAD_DAYS; offset += 1) {
    const targetDate = new Date(now);
    targetDate.setHours(0, 0, 0, 0);
    targetDate.setDate(now.getDate() + offset);

    const appointments = getAppointmentsForDate({ date: targetDate, clients, overrides });

    appointments.forEach((appointment) => {
      if (appointment.status && appointment.status !== 'scheduled') return;
      const baseClient = clients.find((item) => item.id === appointment.clientId);
      if (!baseClient || baseClient.notificationsScheduleOptIn === false) return;

      const appointmentTime = appointment.time || baseClient.time;
      if (!appointmentTime) return;

      const match = String(appointmentTime).match(/(\d{1,2})(?:[:hH]?([0-9]{1,2}))?/);
      if (!match) return;

      const hours = Math.min(23, parseInt(match[1], 10) || 0);
      const minutes = match[2] ? Math.min(59, parseInt(match[2], 10) || 0) : 0;

      const triggerDate = new Date(targetDate);
      triggerDate.setHours(hours, minutes, 0, 0);

      const reminderDate = new Date(triggerDate.getTime() - 15 * 60 * 1000);
      if (reminderDate <= now) return;

      registry.push({ clientId: baseClient.id, reminderDate, appointment, baseClient });
    });
  }

  const results = [];

  for (const { clientId, reminderDate, appointment, baseClient } of registry) {
    const scheduled = await scheduleLocalNotification({
      title: `Compromisso com ${appointment.name}`,
      message: `${appointment.time || baseClient.time || '--:--'} em ${appointment.location || 'local a definir'}`,
      date: reminderDate,
      data: {
        type: 'appointment',
        clientId,
        dateKey: appointment.dateKey || getDateKey(reminderDate),
      },
    });

    if (scheduled) {
      results.push({ clientId, scheduled });
    }
  }

  return results;
};

export const rescheduleAllNotificationsAsync = async (clients, overrides = {}) => {
  try {
    await cancelAllNotificationsAsync();

    const registry = {};
    const appointmentResults = await scheduleAppointmentRemindersAsync(clients, overrides);

    if (Array.isArray(appointmentResults)) {
      appointmentResults.forEach(({ clientId, scheduled }) => {
        if (!registry[clientId]) registry[clientId] = [];
        registry[clientId].push(scheduled);
      });
    }

    for (const client of clients) {
      const paymentNotificationId = await schedulePaymentReminderAsync(client);
      if (paymentNotificationId) {
        if (!registry[client.id]) registry[client.id] = [];
        registry[client.id].push(paymentNotificationId);
      }
    }

    return registry;
  } catch (error) {
    return {};
  }
};

export const cancelAllNotificationsAsync = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    // ignore cancellation errors
  }
};
