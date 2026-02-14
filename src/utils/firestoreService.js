import {
  Timestamp,
  arrayUnion,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes, uploadString } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';

import { endOfDay, getMonthKey, startOfDay } from './dateUtils';
import { readEnv } from './env';
import {
  userAppointmentsCollection,
  userAppointmentDoc,
  userClientDoc,
  userClientsCollection,
  userDocRef,
  userExpenseDoc,
  userExpensesCollection,
  userReceivableDoc,
  userReceivablesCollection,
} from './firestoreRefs';
import { buildPhoneE164FromRaw } from './whatsapp';
import { auth, db, storage } from './firebase';

const normalizePaymentStatus = (entry) => {
  if (!entry) return 'pending';
  const rawStatus = typeof entry === 'string' ? entry : entry?.status;
  if (!rawStatus) return 'pending';
  return rawStatus === 'paid' || rawStatus === 'pago' ? 'paid' : 'pending';
};

const parseMonthKey = (monthKey) => {
  if (!monthKey) return null;
  const [yearString, monthString] = String(monthKey).split('-');
  const year = Number(yearString);
  const month = Number(monthString);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  return { year, month: month - 1 };
};

const buildDueDateForMonth = (dueDay, referenceDate) => {
  const target = referenceDate instanceof Date ? referenceDate : new Date();
  const year = target.getFullYear();
  const month = target.getMonth();
  const dayNumber = Number(dueDay);
  if (!Number.isInteger(dayNumber) || dayNumber <= 0) return null;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(dayNumber, daysInMonth);
  return endOfDay(new Date(year, month, day));
};

const buildDueDateForMonthKey = (dueDay, monthKey) => {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return null;
  const dayNumber = Number(dueDay);
  if (!Number.isInteger(dayNumber) || dayNumber <= 0) return null;
  const daysInMonth = new Date(parsed.year, parsed.month + 1, 0).getDate();
  const day = Math.min(dayNumber, daysInMonth);
  return endOfDay(new Date(parsed.year, parsed.month, day));
};

const buildNextMonthDate = (referenceDate) => {
  const date = referenceDate instanceof Date ? new Date(referenceDate) : new Date();
  date.setMonth(date.getMonth() + 1);
  return date;
};

const resolveReceivableMonthKeyForClient = (client, referenceDate = new Date()) => {
  const dueDateCurrent = buildDueDateForMonth(client?.dueDay, referenceDate);
  if (!dueDateCurrent) return null;
  const currentMonthKey = getMonthKey(dueDateCurrent);
  const paidThisMonth = normalizePaymentStatus(client?.payments?.[currentMonthKey]) === 'paid';
  if (!paidThisMonth) return currentMonthKey;
  return null;
};

const buildReceivablePayload = ({ client, monthKey, dueDate, paid }) => ({
  clientId: client.id,
  clientName: client.name || '',
  amount: Number(client.value || 0),
  monthKey,
  dueDate: Timestamp.fromDate(dueDate),
  paid: Boolean(paid),
  updatedAt: serverTimestamp(),
});

const resolveDateFromUnknown = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value?.toDate) {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildReceivableFallbackPayload = (fallbackReceivable) => {
  if (!fallbackReceivable || typeof fallbackReceivable !== 'object') return {};

  const payload = {};
  if (fallbackReceivable.clientId) payload.clientId = fallbackReceivable.clientId;
  if (fallbackReceivable.clientName) payload.clientName = fallbackReceivable.clientName;

  const amount = Number(fallbackReceivable.amount);
  if (Number.isFinite(amount)) payload.amount = amount;

  const dueDate = resolveDateFromUnknown(fallbackReceivable.dueDate);
  const monthKey = fallbackReceivable.monthKey || (dueDate ? getMonthKey(dueDate) : '');
  if (monthKey) payload.monthKey = monthKey;
  if (dueDate) payload.dueDate = Timestamp.fromDate(dueDate);

  if (fallbackReceivable.paid !== undefined) {
    payload.paid = Boolean(fallbackReceivable.paid);
  }

  return payload;
};

const PROFILE_SDK_TIMEOUT_MS = 9000;
const PROFILE_REST_TIMEOUT_MS = 7000;

const withTimeout = (promise, timeoutMs, timeoutMessage) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const buildProfileRestUrl = (uid) => {
  const projectId = readEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID');
  if (!projectId || !uid) return '';
  const mask = [
    'name',
    'email',
    'phone',
    'birthdate',
    'profession',
    'updatedAt',
  ]
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${encodeURIComponent(
    uid
  )}?${mask}`;
};

const saveUserProfileViaRest = async ({ uid, profile }) => {
  const url = buildProfileRestUrl(uid);
  const token = await auth?.currentUser?.getIdToken?.();
  if (!url || !token) {
    throw new Error('PROFILE_REST_UNAVAILABLE');
  }

  const payload = {
    fields: {
      name: { stringValue: profile?.name || '' },
      email: { stringValue: profile?.email || '' },
      phone: { stringValue: profile?.phone || '' },
      birthdate: { stringValue: profile?.birthdate || '' },
      profession: { stringValue: profile?.profession || '' },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error('PROFILE_REST_WRITE_FAILED');
    error.code = `HTTP_${response.status}`;
    error.details = details?.slice?.(0, 300) || '';
    throw error;
  }
};

export const ensureUserDefaults = async ({ uid, profile = {} }) => {
  if (!uid) return;
  const userRef = userDocRef(uid);
  const payload = {
    privacy: {
      hideBalances: Boolean(profile?.privacy?.hideBalances),
    },
    templates: {
      confirmMsg: profile?.templates?.confirmMsg || '',
      chargeMsg: profile?.templates?.chargeMsg || '',
    },
    updatedAt: serverTimestamp(),
  };

  const assignIfNonEmpty = (key, value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) payload[key] = trimmed;
      return;
    }
    if (value !== undefined && value !== null) {
      payload[key] = value;
    }
  };

  assignIfNonEmpty('name', profile.name);
  assignIfNonEmpty('email', profile.email);
  assignIfNonEmpty('phone', profile.phone);
  assignIfNonEmpty('birthdate', profile.birthdate);
  assignIfNonEmpty('profession', profile.profession);
  assignIfNonEmpty('photoURL', profile.photoURL);

  await setDoc(
    userRef,
    payload,
    { merge: true }
  );
};

export const saveUserProfile = async ({ uid, profile }) => {
  if (!uid || !profile) return;
  const userRef = userDocRef(uid);
  const payload = {
    name: profile.name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    birthdate: profile.birthdate || '',
    profession: profile.profession || '',
    updatedAt: serverTimestamp(),
  };

  const startedAt = Date.now();
  try {
    console.log('[profile] saveUserProfile:start', { uid, hasEmail: Boolean(payload.email) });
    await withTimeout(
      setDoc(userRef, payload, { merge: true }),
      PROFILE_SDK_TIMEOUT_MS,
      'PROFILE_SDK_TIMEOUT'
    );
    console.log('[profile] saveUserProfile:ok', { uid, ms: Date.now() - startedAt, source: 'sdk' });
    return;
  } catch (error) {
    console.warn('[profile] saveUserProfile:error', {
      uid,
      ms: Date.now() - startedAt,
      code: error?.code || 'unknown',
      message: error?.message || '',
    });
    if (error?.message !== 'PROFILE_SDK_TIMEOUT') {
      throw error;
    }
  }

  try {
    await withTimeout(
      saveUserProfileViaRest({ uid, profile: payload }),
      PROFILE_REST_TIMEOUT_MS,
      'PROFILE_REST_TIMEOUT'
    );
    console.log('[profile] saveUserProfile:ok', { uid, ms: Date.now() - startedAt, source: 'rest' });
  } catch (error) {
    console.warn('[profile] saveUserProfile:rest_error', {
      uid,
      ms: Date.now() - startedAt,
      code: error?.code || 'unknown',
      message: error?.message || '',
      details: error?.details || '',
    });
    throw error;
  }
};

export const updateUserName = async ({ uid, name }) => {
  if (!uid) return;
  const userRef = userDocRef(uid);
  await updateDoc(userRef, { name: name || '', updatedAt: serverTimestamp() });
};

export const updateUserPhoto = async ({ uid, photoURL }) => {
  if (!uid) return;
  const userRef = userDocRef(uid);
  await setDoc(
    userRef,
    { photoURL: photoURL || '', updatedAt: serverTimestamp() },
    { merge: true }
  );
};

const resolveImageContentType = (fileName, mimeType) => {
  if (typeof mimeType === 'string' && mimeType.startsWith('image/')) {
    return mimeType;
  }
  const normalized = String(fileName || '').toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.heic')) return 'image/heic';
  if (normalized.endsWith('.heif')) return 'image/heif';
  if (normalized.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
};

const normalizeFileUri = (uri) => {
  if (!uri) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(uri)) return uri;
  return `file://${uri}`;
};

export const uploadUserProfilePhoto = async ({ uid, uri, fileName, base64Data, mimeType }) => {
  if (!uid || (!uri && !base64Data) || !storage) return '';
  const contentType = resolveImageContentType(fileName, mimeType);
  let base64 = String(base64Data || '').trim();

  if (!base64 && uri) {
    const fileUri = normalizeFileUri(uri);
    try {
      base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (error) {
      base64 = '';
    }
  }

  const extension =
    contentType === 'image/png'
      ? 'png'
      : contentType === 'image/webp'
        ? 'webp'
        : contentType === 'image/heic'
          ? 'heic'
          : contentType === 'image/heif'
            ? 'heif'
            : contentType === 'image/gif'
              ? 'gif'
              : 'jpg';
  const storageRef = ref(storage, `users/${uid}/profile_${Date.now()}.${extension}`);
  if (base64) {
    await uploadString(storageRef, base64, 'base64', { contentType });
  } else if (uri) {
    const response = await fetch(normalizeFileUri(uri));
    if (!response.ok) {
      throw new Error('PHOTO_UPLOAD_FETCH_FAILED');
    }
    const blob = await response.blob();
    await uploadBytes(storageRef, blob, { contentType });
  } else {
    return '';
  }
  return getDownloadURL(storageRef);
};

export const updateUserPrivacy = async ({ uid, hideBalances }) => {
  if (!uid) return;
  const userRef = userDocRef(uid);
  await updateDoc(userRef, {
    'privacy.hideBalances': Boolean(hideBalances),
    updatedAt: serverTimestamp(),
  });
};

export const updateUserTemplates = async ({ uid, templates }) => {
  if (!uid) return;
  const userRef = userDocRef(uid);
  await setDoc(
    userRef,
    {
      templates: {
        confirmMsg: templates?.confirmMsg || '',
        chargeMsg: templates?.chargeMsg || '',
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const upsertClient = async ({ uid, client }) => {
  if (!uid || !client?.id) return;
  const clientRef = userClientDoc(uid, client.id);
  const phoneRaw = client.phoneRaw || client.phone || '';
  const phoneE164 = client.phoneE164 || buildPhoneE164FromRaw(phoneRaw);

  await setDoc(
    clientRef,
    {
      ...client,
      phoneRaw: phoneRaw || '',
      phoneE164: phoneE164 || '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const deleteClientFromFirestore = async ({ uid, clientId }) => {
  if (!uid || !clientId) return;
  const clientRef = userClientDoc(uid, clientId);
  await setDoc(clientRef, { deletedAt: serverTimestamp() }, { merge: true });
};

export const upsertExpense = async ({ uid, expense }) => {
  if (!uid || !expense?.id) return;
  const expenseRef = userExpenseDoc(uid, expense.id);
  await setDoc(
    expenseRef,
    {
      ...expense,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const deleteExpenseFromFirestore = async ({ uid, expenseId }) => {
  if (!uid || !expenseId) return;
  const expenseRef = userExpenseDoc(uid, expenseId);
  await setDoc(expenseRef, { deletedAt: serverTimestamp() }, { merge: true });
};

export const upsertReceivableForMonth = async ({ uid, client, monthKey, paid }) => {
  if (!uid || !client?.id || !monthKey) return;
  const dueDate = buildDueDateForMonthKey(client.dueDay, monthKey);
  if (!dueDate) return;

  const receivableId = `${client.id}-${monthKey}`;
  const receivableRef = userReceivableDoc(uid, receivableId);
  const payload = buildReceivablePayload({ client, monthKey, dueDate, paid });

  await setDoc(
    receivableRef,
    {
      ...payload,
    },
    { merge: true }
  );
};

export const upsertReceivableForClient = async ({ uid, client, referenceDate = new Date() }) => {
  if (!uid || !client?.id) return;
  const monthKey = resolveReceivableMonthKeyForClient(client, referenceDate);
  if (!monthKey) return;

  const dueDate = buildDueDateForMonthKey(client.dueDay, monthKey);
  if (!dueDate) return;

  const paid = normalizePaymentStatus(client?.payments?.[monthKey]) === 'paid';
  const receivableId = `${client.id}-${monthKey}`;
  const receivableRef = userReceivableDoc(uid, receivableId);
  const payload = buildReceivablePayload({ client, monthKey, dueDate, paid });

  await setDoc(
    receivableRef,
    {
      ...payload,
    },
    { merge: true }
  );
};

export const ensureReceivablesForClients = async ({ uid, clients }) => {
  if (!uid || !Array.isArray(clients) || clients.length === 0) return;

  const tasks = clients
    .filter((client) => client?.id && Number(client?.dueDay) > 0)
    .map((client) => upsertReceivableForClient({ uid, client }));

  await Promise.all(tasks);
};

const resolveReceivableMonthKeyFromData = (data) => {
  if (data?.monthKey) return data.monthKey;
  const dueDate = data?.dueDate?.toDate?.() || (data?.dueDate ? new Date(data.dueDate) : null);
  if (!dueDate) return null;
  return getMonthKey(dueDate);
};

const resolveTimestampMs = (value) => {
  if (!value) return 0;
  if (value?.toDate) {
    const date = value.toDate();
    return Number.isNaN(date?.getTime?.()) ? 0 : date.getTime();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const chooseReceivableToKeep = (candidates, canonicalId) => {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const canonical = candidates.find((entry) => entry.id === canonicalId);
  if (canonical) return canonical;

  return [...candidates].sort((a, b) => {
    const paidDiff = Number(Boolean(b.paid)) - Number(Boolean(a.paid));
    if (paidDiff !== 0) return paidDiff;
    const updatedDiff = b.updatedAtMs - a.updatedAtMs;
    if (updatedDiff !== 0) return updatedDiff;
    return b.dueDateMs - a.dueDateMs;
  })[0];
};

export const cleanupDuplicateReceivables = async ({ uid }) => {
  if (!uid) return { removed: 0 };

  const snapshot = await getDocs(userReceivablesCollection(uid));
  const groups = new Map();

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const clientId = data?.clientId;
    const monthKey = resolveReceivableMonthKeyFromData(data);
    if (!clientId || !monthKey) return;

    const key = `${clientId}-${monthKey}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({
      id: docSnap.id,
      paid: Boolean(data?.paid),
      updatedAtMs: resolveTimestampMs(data?.updatedAt),
      dueDateMs: resolveTimestampMs(data?.dueDate),
    });
  });

  const toDelete = [];

  groups.forEach((entries, key) => {
    if (entries.length <= 1) return;
    const keeper = chooseReceivableToKeep(entries, key);
    entries.forEach((entry) => {
      if (entry.id !== keeper?.id) toDelete.push(entry.id);
    });
  });

  if (toDelete.length === 0) return { removed: 0 };

  const BATCH_LIMIT = 450;
  for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
    const slice = toDelete.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    slice.forEach((id) => {
      batch.delete(userReceivableDoc(uid, id));
    });
    await batch.commit();
  }

  return { removed: toDelete.length };
};

export const markReceivablePaid = async ({
  uid,
  client,
  receivableId,
  dueDate,
  amount,
  paid,
}) => {
  if (!uid || !client?.id || !receivableId || !dueDate) return;
  const monthKey = getMonthKey(dueDate);
  const clientRef = userClientDoc(uid, client.id);
  const receivableRef = userReceivableDoc(uid, receivableId);
  const entry = {
    status: paid ? 'paid' : 'pending',
    date: paid ? new Date().toISOString() : null,
    value: amount ?? client.value ?? 0,
    updatedAt: new Date().toISOString(),
  };

  await updateDoc(clientRef, {
    [`payments.${monthKey}`]: entry,
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    receivableRef,
    {
      paid: Boolean(paid),
      paidAt: paid ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Não cria o próximo mês automaticamente ao pagar.
  // O próximo receivable será gerado no início do próximo mês via ensureReceivablesForClients.
};

export const markReceivablesPaidByIds = async ({ uid, receivableIds }) => {
  if (!uid || !Array.isArray(receivableIds) || receivableIds.length === 0) return;

  const uniqueIds = Array.from(new Set(receivableIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const BATCH_LIMIT = 450;
  for (let i = 0; i < uniqueIds.length; i += BATCH_LIMIT) {
    const slice = uniqueIds.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    slice.forEach((id) => {
      batch.set(
        userReceivableDoc(uid, id),
        {
          paid: true,
          paidAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
  }
};

export const createAppointmentOverride = async ({
  uid,
  appointmentId,
  payload,
}) => {
  if (!uid || !appointmentId || !payload) return;
  const appointmentRef = userAppointmentDoc(uid, appointmentId);
  await setDoc(
    appointmentRef,
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const rescheduleAppointment = async ({
  uid,
  oldAppointmentId,
  newAppointmentId,
  oldPayload,
  newPayload,
}) => {
  if (!uid || !oldAppointmentId || !newAppointmentId || !oldPayload || !newPayload) return;

  const batch = writeBatch(db);
  const oldRef = userAppointmentDoc(uid, oldAppointmentId);
  const newRef = userAppointmentDoc(uid, newAppointmentId);

  batch.set(
    newRef,
    {
      ...newPayload,
      appointmentKey: newPayload?.appointmentKey || newAppointmentId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  batch.set(
    oldRef,
    {
      ...oldPayload,
      appointmentKey: oldPayload?.appointmentKey || oldAppointmentId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
};

export const registerAppointmentConfirmationSent = async ({ uid, appointmentId }) => {
  if (!uid || !appointmentId) return;
  const appointmentRef = userAppointmentDoc(uid, appointmentId);
  await setDoc(
    appointmentRef,
    {
      confirmationSentAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const registerReceivableChargeSent = async ({
  uid,
  receivableId,
  usedTemplate,
  userAgent,
  fallbackReceivable,
}) => {
  if (!uid || !receivableId) return;
  const receivableRef = userReceivableDoc(uid, receivableId);
  const chargeEntry = {
    at: Timestamp.fromDate(new Date()),
    channel: 'whatsapp',
    template: usedTemplate || '',
    ...(userAgent ? { userAgent } : {}),
  };
  const fallbackPayload = buildReceivableFallbackPayload(fallbackReceivable);
  await setDoc(
    receivableRef,
    {
      ...fallbackPayload,
      paid: fallbackPayload.paid !== undefined ? fallbackPayload.paid : false,
      lastChargeSentAt: serverTimestamp(),
      chargeHistory: arrayUnion(chargeEntry),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const markReceivableAsPaid = async ({
  uid,
  receivableId,
  method,
  fallbackReceivable,
}) => {
  if (!uid || !receivableId) return;
  const receivableRef = userReceivableDoc(uid, receivableId);
  const fallbackPayload = buildReceivableFallbackPayload(fallbackReceivable);
  const payload = {
    ...fallbackPayload,
    paid: true,
    paidAt: serverTimestamp(),
    paymentMethod: method || '',
    updatedAt: serverTimestamp(),
  };
  await setDoc(receivableRef, payload, { merge: true });
};

export const fetchReceivablesForRange = async ({ uid, startDate, endDate }) => {
  if (!uid) return [];
  const collectionRef = userReceivablesCollection(uid);
  const q = query(
    collectionRef,
    where('dueDate', '>=', Timestamp.fromDate(startOfDay(startDate))),
    where('dueDate', '<=', Timestamp.fromDate(endOfDay(endDate))),
    orderBy('dueDate', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

export const migrateLocalDataToFirestore = async ({ uid, localState }) => {
  if (!uid) return { migrated: false };
  const userRef = userDocRef(uid);
  const existing = await getDoc(userRef);
  if (existing.exists() && existing.data()?.migratedAt) {
    return { migrated: false };
  }

  const clientsRef = userClientsCollection(uid);
  const existingClients = await getDocs(query(clientsRef, limit(1)));
  if (!existingClients.empty) {
    return { migrated: false };
  }

  const profile = {
    name: localState?.userName || '',
    email: localState?.userEmail || '',
    phone: localState?.userPhone || '',
    birthdate: localState?.userBirthdate || '',
    profession: localState?.userProfession || '',
    photoURL: localState?.userPhotoURL || '',
    privacy: {
      hideBalances: Boolean(localState?.privacyHideBalances),
    },
  };

  await ensureUserDefaults({ uid, profile });
  await setDoc(
    userRef,
    { migratedAt: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true }
  );

  const clients = Array.isArray(localState?.clients) ? localState.clients : [];
  const expenses = Array.isArray(localState?.expenses) ? localState.expenses : [];

  const batchSize = 400;
  for (let i = 0; i < clients.length; i += batchSize) {
    const batch = writeBatch(db);
    clients.slice(i, i + batchSize).forEach((client) => {
      if (!client?.id) return;
      const clientRef = userClientDoc(uid, client.id);
      const phoneRaw = client.phoneRaw || client.phone || '';
      const phoneE164 = client.phoneE164 || buildPhoneE164FromRaw(phoneRaw);
      batch.set(
        clientRef,
        {
          ...client,
          phoneRaw: phoneRaw || '',
          phoneE164: phoneE164 || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
  }

  for (let i = 0; i < expenses.length; i += batchSize) {
    const batch = writeBatch(db);
    expenses.slice(i, i + batchSize).forEach((expense) => {
      if (!expense?.id) return;
      const expenseRef = userExpenseDoc(uid, expense.id);
      batch.set(
        expenseRef,
        {
          ...expense,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
  }

  for (const client of clients) {
    await upsertReceivableForClient({ uid, client });
  }

  return { migrated: true };
};

export const fetchAppointmentOverridesForRange = async ({ uid, startDate, endDate }) => {
  if (!uid) return [];
  const collectionRef = userAppointmentsCollection(uid);
  const q = query(
    collectionRef,
    where('startAt', '>=', Timestamp.fromDate(startOfDay(startDate))),
    where('startAt', '<=', Timestamp.fromDate(endOfDay(endDate))),
    orderBy('startAt', 'asc'),
    limit(500)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};
