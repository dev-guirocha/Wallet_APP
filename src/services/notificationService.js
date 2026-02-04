import { Linking, Platform } from 'react-native';
import { getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';

import { userReceivablesCollection } from '../utils/firestoreRefs';
import { endOfDay, startOfDay } from '../utils/dateUtils';

const CHANNEL_ID = 'charges-reminder';

let cachedPushNotification = null;
let pushNotificationLoadAttempted = false;

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

const withPushNotification = (handler) => {
  const PushNotification = getPushNotification();
  if (!PushNotification) return null;
  return handler(PushNotification);
};

export const configureChargeNotifications = () => {
  withPushNotification((PushNotification) => {
    PushNotification.configure({
      onNotification: (notification) => {
        const link = notification?.data?.link || notification?.userInfo?.link;
        if (notification?.userInteraction && link) {
          Linking.openURL(link).catch(() => {});
        }
      },
      requestPermissions: Platform.OS === 'ios',
    });

    PushNotification.createChannel(
      {
        channelId: CHANNEL_ID,
        channelName: 'Cobranças',
        channelDescription: 'Lembretes de cobranças do dia',
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      () => {}
    );
  });
};

export const cancelChargeNotifications = () => {
  withPushNotification((PushNotification) => {
    PushNotification.cancelAllLocalNotifications();
    if (PushNotification.removeAllDeliveredNotifications) {
      PushNotification.removeAllDeliveredNotifications();
    }
  });
};

const buildDateKey = (date) => date.toISOString().split('T')[0];

export const scheduleChargeNotifications = async ({ uid }) => {
  if (!uid) return;
  const PushNotification = getPushNotification();
  if (!PushNotification) return;

  cancelChargeNotifications();

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

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const key = buildDateKey(date);
    const count = counts[key] || 0;
    if (!count) continue;

    const fireDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 7, 0, 0, 0);
    if (fireDate.getTime() < Date.now()) continue;

    PushNotification.localNotificationSchedule({
      channelId: CHANNEL_ID,
      message: `Você tem ${count} cobranças hoje – toque para cobrar`,
      date: fireDate,
      allowWhileIdle: true,
      data: { link: 'myapp://charges' },
      userInfo: { link: 'myapp://charges' },
    });
  }
};

export default {
  configureChargeNotifications,
  cancelChargeNotifications,
  scheduleChargeNotifications,
};
