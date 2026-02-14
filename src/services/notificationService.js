import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';

import { userReceivablesCollection } from '../utils/firestoreRefs';
import { endOfDay, startOfDay } from '../utils/dateUtils';

const CHANNEL_ID = 'charges-reminder';

let notificationsConfigured = false;
let responseSubscription = null;
let scheduledChargeNotificationIds = [];

const ensureChannelConfigured = async () => {
  if (Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Cobranças',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });
  } catch (error) {
    // ignore channel setup errors
  }
};

const ensureConfigured = async () => {
  if (!responseSubscription) {
    responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      const link = data?.link;
      if (typeof link === 'string' && link.length > 0) {
        Linking.openURL(link).catch(() => {});
      }
    });
  }

  if (notificationsConfigured) return;
  await ensureChannelConfigured();
  notificationsConfigured = true;
};

export const configureChargeNotifications = () => {
  void ensureConfigured();
};

export const cancelChargeNotifications = async () => {
  const ids = [...scheduledChargeNotificationIds];
  scheduledChargeNotificationIds = [];

  if (!ids.length) return;

  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
};

const buildDateKey = (date) => date.toISOString().split('T')[0];

export const scheduleChargeNotifications = async ({ uid }) => {
  if (!uid) return;

  await ensureConfigured();
  await cancelChargeNotifications();

  const today = new Date();
  const rangeStart = startOfDay(today);
  const rangeEnd = endOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6));

  const receivablesQuery = query(
    userReceivablesCollection(uid),
    where('paid', '==', false),
    where('dueDate', '>=', Timestamp.fromDate(rangeStart)),
    where('dueDate', '<=', Timestamp.fromDate(rangeEnd)),
    orderBy('dueDate', 'asc')
  );

  const snapshot = await getDocs(receivablesQuery);
  const counts = {};
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const dueDate = data?.dueDate?.toDate?.() || (data?.dueDate ? new Date(data.dueDate) : null);
    if (!dueDate) return;
    const key = buildDateKey(dueDate);
    counts[key] = (counts[key] || 0) + 1;
  });

  const nextScheduledIds = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const key = buildDateKey(date);
    const count = counts[key] || 0;
    if (!count) continue;

    const fireDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7, 0, 0, 0);
    if (fireDate.getTime() < Date.now()) continue;

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Cobranças do dia',
          body: `Você tem ${count} cobranças hoje – toque para cobrar`,
          data: { link: 'myapp://charges' },
          sound: 'default',
        },
        trigger:
          Platform.OS === 'android'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: fireDate,
                channelId: CHANNEL_ID,
              }
            : fireDate,
      });

      nextScheduledIds.push(notificationId);
    } catch (error) {
      // ignore notification scheduling errors
    }
  }

  scheduledChargeNotificationIds = nextScheduledIds;
};

export default {
  configureChargeNotifications,
  cancelChargeNotifications,
  scheduleChargeNotifications,
};
