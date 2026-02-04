import { PermissionsAndroid, Platform } from 'react-native';

import { getDateKey, getNextDueDateFromDay } from './dateUtils';
import { getAppointmentsForDate } from './schedule';

const APPOINTMENT_LOOKAHEAD_DAYS = 14;
const PAYMENT_REMINDER_HOUR = 9;
const PAYMENT_REMINDER_MINUTE = 0;
const DEFAULT_CHANNEL_ID = 'wallet-reminders';

let cachedPushNotification = null;
let pushNotificationLoadAttempted = false;
let notificationsConfigured = false;

const getPushNotification = () => {
  if (pushNotificationLoadAttempted) return cachedPushNotification;
  pushNotificationLoadAttempted = true;

  try {
    const module = require('react-native-push-notification');
    cachedPushNotification = module.default ?? module;
  } catch (error) {
    cachedPushNotification = null;
  }

  return cachedPushNotification;
};

const ensureNotificationConfigured = () => {
  if (notificationsConfigured) return;

  const PushNotification = getPushNotification();
  if (!PushNotification) return;

  PushNotification.configure({
    onNotification: () => {},
    requestPermissions: Platform.OS === 'ios',
  });

  if (Platform.OS === 'android') {
    PushNotification.createChannel(
      {
        channelId: DEFAULT_CHANNEL_ID,
        channelName: 'Lembretes',
        channelDescription: 'Lembretes de compromissos e pagamentos',
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      () => {}
    );
  }

  notificationsConfigured = true;
};

const requestAndroidNotificationPermission = async () => {
  if (Platform.Version < 33) return true;

  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (error) {
    return false;
  }
};

const checkAndroidNotificationPermission = async () => {
  if (Platform.Version < 33) {
    return { granted: true, canAsk: true };
  }

  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    return { granted, canAsk: !granted };
  } catch (error) {
    return { granted: false, canAsk: false };
  }
};

const checkIosNotificationPermission = () => {
  const PushNotification = getPushNotification();
  if (!PushNotification) {
    return Promise.resolve({ granted: false, canAsk: false });
  }

  return new Promise((resolve) => {
    PushNotification.checkPermissions((permissions) => {
      const granted = Boolean(permissions?.alert || permissions?.badge || permissions?.sound);
      resolve({ granted, canAsk: !granted });
    });
  });
};

export const configureNotificationHandling = () => {
  ensureNotificationConfigured();
};

export const requestNotificationPermissionAsync = async () => {
  ensureNotificationConfigured();

  if (Platform.OS === 'android') {
    return requestAndroidNotificationPermission();
  }

  const PushNotification = getPushNotification();
  if (!PushNotification) return false;

  const permissions = await PushNotification.requestPermissions();
  return Boolean(permissions?.alert || permissions?.badge || permissions?.sound);
};

export const getNotificationPermissionStatus = async () => {
  ensureNotificationConfigured();

  if (Platform.OS === 'android') {
    return checkAndroidNotificationPermission();
  }

  return checkIosNotificationPermission();
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

const scheduleLocalNotification = ({ title, message, date, data }) => {
  const PushNotification = getPushNotification();
  if (!PushNotification) return null;

  if (!date || date <= new Date()) return null;
  ensureNotificationConfigured();

  PushNotification.localNotificationSchedule({
    channelId: DEFAULT_CHANNEL_ID,
    title,
    message,
    date,
    allowWhileIdle: true,
    userInfo: data,
    data,
  });

  return true;
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
  registry.forEach(({ clientId, reminderDate, appointment, baseClient }) => {
    const scheduled = scheduleLocalNotification({
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
  });

  return results;
};

export const rescheduleAllNotificationsAsync = async (clients, overrides = {}) => {
  try {
    cancelAllNotificationsAsync();

    const registry = {};
    const appointmentResults = await scheduleAppointmentRemindersAsync(clients, overrides);

    if (Array.isArray(appointmentResults)) {
      appointmentResults.forEach(({ clientId }) => {
        if (!registry[clientId]) registry[clientId] = [];
        registry[clientId].push(true);
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
  const PushNotification = getPushNotification();
  if (!PushNotification) return;

  try {
    PushNotification.cancelAllLocalNotifications();
    if (PushNotification.removeAllDeliveredNotifications) {
      PushNotification.removeAllDeliveredNotifications();
    }
  } catch (error) {
    // ignore cancellation errors
  }
};
