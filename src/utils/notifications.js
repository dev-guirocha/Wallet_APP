import * as Notifications from 'expo-notifications';

import { getDateKey, getNextDueDateFromDay } from './dateUtils';
import { getAppointmentsForDate } from './schedule';

const APPOINTMENT_LOOKAHEAD_DAYS = 14;
const PAYMENT_REMINDER_HOUR = 9;
const PAYMENT_REMINDER_MINUTE = 0;

const parseClientDueDay = (dueDay) => {
  if (!dueDay) return null;
  const match = String(dueDay).match(/(\d{1,2})/);
  if (!match) return null;
  const day = Number(match[1]);
  if (!Number.isInteger(day) || day <= 0) return null;
  return Math.min(day, 31);
};

export const configureNotificationHandling = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
};

export const requestNotificationPermissionAsync = async () => {
  const settings = await Notifications.getPermissionsAsync();
  if (settings?.granted || settings?.status === 'granted') {
    return true;
  }

  if (settings?.canAskAgain) {
    const response = await Notifications.requestPermissionsAsync();
    return response?.granted || response?.status === 'granted';
  }

  return false;
};

export const shouldAskForNotificationPermission = async () => {
  const settings = await Notifications.getPermissionsAsync();
  return settings?.canAskAgain && !(settings?.granted || settings?.status === 'granted');
};

const schedulePaymentReminderAsync = async (client) => {
  if (client.notificationsPaymentOptIn === false) return null;

  const dueDay = parseClientDueDay(client.dueDay);
  if (!dueDay) return null;

  const reminderDate = getNextDueDateFromDay(dueDay, new Date(), client.time);
  if (!reminderDate || reminderDate <= new Date()) return null;

  reminderDate.setHours(PAYMENT_REMINDER_HOUR, PAYMENT_REMINDER_MINUTE, 0, 0);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Cobrar ${client.name}`,
      body: `Hoje é dia de pagamento. Valor combinado: R$ ${client.value || '0'}.`,
      data: { type: 'payment', clientId: client.id },
    },
    trigger: { type: 'date', date: reminderDate },
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

  const notifications = await Promise.all(
    registry.map(async ({ clientId, reminderDate, appointment, baseClient }) => {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Compromisso com ${appointment.name}`,
          body: `${appointment.time || baseClient.time || '--:--'} em ${appointment.location || 'local a definir'}`,
          data: {
            type: 'appointment',
            clientId,
            dateKey: appointment.dateKey || getDateKey(reminderDate),
          },
        },
        trigger: { type: 'date', date: reminderDate },
      });

      return { clientId, notificationId };
    })
  );

  return notifications.filter(Boolean);
};

export const rescheduleAllNotificationsAsync = async (clients, overrides = {}) => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    // ignore cancellation errors
  }

  const registry = {};

  const appointmentResults = await scheduleAppointmentRemindersAsync(clients, overrides);
  if (Array.isArray(appointmentResults)) {
    appointmentResults.forEach(({ clientId, notificationId }) => {
      if (!notificationId) return;
      if (!registry[clientId]) registry[clientId] = [];
      registry[clientId].push(notificationId);
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
};
