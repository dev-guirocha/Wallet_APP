import * as Notifications from 'expo-notifications';
import { getDateKey, getNextDueDateFromDay } from './dateUtils';
import { getAppointmentsForDate } from './schedule';

const WEEKDAY_TO_TRIGGER = {
  Dom: 1,
  Seg: 2,
  Ter: 3,
  Qua: 4,
  Qui: 5,
  Sex: 6,
  Sáb: 7,
};

const parseTimeToHourMinute = (time) => {
  if (!time) return { hour: 9, minute: 0 };
  const match = String(time).match(/(\d{1,2})[:hH]?(\d{0,2})?/);
  if (!match) return { hour: 9, minute: 0 };
  const hour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minute = match[2] ? Math.min(59, parseInt(match[2], 10) || 0) : 0;
  return { hour, minute };
};

const scheduleAppointmentReminders = async (clients, scheduleOverrides = {}) => {
  if (!Array.isArray(clients) || clients.length === 0) return;

  const clientMap = clients.reduce((acc, client) => {
    acc[client.id] = client;
    return acc;
  }, {});

  const now = new Date();
  const seenKeys = new Set();
  const results = [];

  for (let offset = 0; offset < 14; offset += 1) {
    const targetDate = new Date(now);
    targetDate.setHours(0, 0, 0, 0);
    targetDate.setDate(now.getDate() + offset);

    const appointments = getAppointmentsForDate({
      date: targetDate,
      clients,
      overrides: scheduleOverrides,
    });

    for (const appointment of appointments) {
      const baseClient = clientMap[appointment.clientId];
      if (!baseClient || baseClient.notificationsOptIn === false) continue;

      const { hour, minute } = parseTimeToHourMinute(appointment.time || baseClient.time);
      const triggerDate = new Date(targetDate);
      triggerDate.setHours(hour, minute, 0, 0);

      const reminderDate = new Date(triggerDate.getTime() - 15 * 60 * 1000);

      if (reminderDate <= new Date()) continue;

      const key = `${appointment.clientId}-${reminderDate.toISOString()}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Compromisso com ${baseClient.name}`,
          body: `Faltam 15 minutos para ${appointment.time || baseClient.time} em ${baseClient.location || 'local definido'}.`,
          data: { type: 'appointment', clientId: baseClient.id, date: getDateKey(triggerDate) },
        },
        trigger: {
          type: 'date',
          date: reminderDate,
        },
      });

      results.push({ clientId: baseClient.id, notificationId });
    }
  }

  return results;
};

const schedulePaymentReminder = async (client) => {
  if (client.notificationsOptIn === false) return;
  const dueDate = getNextDueDateFromDay(client.dueDay, undefined, client.time);
  if (!dueDate) return;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Lembrete de pagamento - ${client.name}`,
      body: `Verifique o pagamento do mês. Valor: R$ ${client.value || '0'}${client.location ? ` (${client.location})` : ''}.`,
      data: { type: 'payment', clientId: client.id },
    },
    trigger: {
      type: 'date',
      date: dueDate,
    },
  });
};

export const rescheduleAllNotificationsAsync = async (clients, scheduleOverrides = {}) => {
  if (!Array.isArray(clients) || clients.length === 0) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return {};
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  const registry = {};
  const appointmentResults = await scheduleAppointmentReminders(clients, scheduleOverrides);
  if (Array.isArray(appointmentResults)) {
    appointmentResults.forEach(({ clientId, notificationId }) => {
      if (!notificationId) return;
      if (!registry[clientId]) registry[clientId] = [];
      registry[clientId].push(notificationId);
    });
  }

  for (const client of clients) {
    const paymentId = await schedulePaymentReminder(client);
    if (paymentId) {
      if (!registry[client.id]) registry[client.id] = [];
      registry[client.id].push(paymentId);
    }
  }

  return registry;
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
    const result = await Notifications.requestPermissionsAsync();
    return result?.granted || result?.status === 'granted';
  }

  return false;
};

export const shouldAskForNotificationPermission = async () => {
  const settings = await Notifications.getPermissionsAsync();
  return settings?.canAskAgain && !(settings?.granted || settings?.status === 'granted');
};
