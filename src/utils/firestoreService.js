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
import { getDownloadURL, ref, uploadString } from 'firebase/storage';
let cachedRNFS = null;
let rnfsLoadAttempted = false;

const getRNFS = () => {
  if (rnfsLoadAttempted) return cachedRNFS;
  rnfsLoadAttempted = true;

  try {
    const module = require('react-native-fs');
    cachedRNFS = module.default ?? module;
  } catch (error) {
    cachedRNFS = null;
  }

  return cachedRNFS;
};

import { endOfDay, getMonthKey, startOfDay } from './dateUtils';
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
import { db, storage } from './firebase';

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

const resolveReceivableMonthKey = (client, referenceDate = new Date()) => {
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

export const ensureUserDefaults = async ({ uid, profile = {} }) => {
  if (!uid) return;
  const userRef = userDocRef(uid);
  await setDoc(
    userRef,
    {
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      birthdate: profile.birthdate || '',
      profession: profile.profession || '',
      photoURL: profile.photoURL || '',
      privacy: {
        hideBalances: Boolean(profile?.privacy?.hideBalances),
      },
      templates: {
        confirmMsg: profile?.templates?.confirmMsg || '',
        chargeMsg: profile?.templates?.chargeMsg || '',
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const saveUserProfile = async ({ uid, profile }) => {
  if (!uid || !profile) return;
  const userRef = userDocRef(uid);
  await setDoc(
    userRef,
    {
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      birthdate: profile.birthdate || '',
      profession: profile.profession || '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const updateUserName = async ({ uid, name }) => {
  if (!uid) return;
  const userRef = userDocRef(uid);
  await updateDoc(userRef, { name: name || '', updatedAt: serverTimestamp() });
};

export const updateUserPhoto = async ({ uid, photoURL }) => {
  if (!uid) return;
  const userRef = userDocRef(uid);
  await updateDoc(userRef, { photoURL: photoURL || '', updatedAt: serverTimestamp() });
};

const resolveImageContentType = (fileName) => {
  const normalized = String(fileName || '').toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

const normalizeFilePath = (uri) => {
  if (!uri) return '';
  if (uri.startsWith('file://')) {
    return uri.replace('file://', '');
  }
  return uri;
};

export const uploadUserProfilePhoto = async ({ uid, uri, fileName }) => {
  if (!uid || !uri) return '';
  const contentType = resolveImageContentType(fileName);
  const filePath = normalizeFilePath(uri);
  const RNFS = getRNFS();
  if (!RNFS) {
    throw new Error('react-native-fs não está disponível. Recompile o app e rode pod install.');
  }

  const base64 = await RNFS.readFile(filePath, 'base64');

  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const storageRef = ref(storage, `users/${uid}/profile_${Date.now()}.${extension}`);

  await uploadString(storageRef, base64, 'base64', { contentType });
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
  await updateDoc(userRef, {
    templates: {
      confirmMsg: templates?.confirmMsg || '',
      chargeMsg: templates?.chargeMsg || '',
    },
    updatedAt: serverTimestamp(),
  });
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
  const monthKey = resolveReceivableMonthKey(client, referenceDate);
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

export const registerReceivableChargeSent = async ({ uid, receivableId, usedTemplate, userAgent }) => {
  if (!uid || !receivableId) return;
  const receivableRef = userReceivableDoc(uid, receivableId);
  const chargeEntry = {
    at: Timestamp.fromDate(new Date()),
    channel: 'whatsapp',
    template: usedTemplate || '',
    ...(userAgent ? { userAgent } : {}),
  };
  try {
    await updateDoc(receivableRef, {
      lastChargeSentAt: serverTimestamp(),
      chargeHistory: arrayUnion(chargeEntry),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await setDoc(
      receivableRef,
      {
        lastChargeSentAt: serverTimestamp(),
        chargeHistory: arrayUnion(chargeEntry),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
};

export const markReceivableAsPaid = async ({ uid, receivableId, method }) => {
  if (!uid || !receivableId) return;
  const receivableRef = userReceivableDoc(uid, receivableId);
  const payload = {
    paid: true,
    paidAt: serverTimestamp(),
    paymentMethod: method || '',
    updatedAt: serverTimestamp(),
  };
  try {
    await updateDoc(receivableRef, payload);
  } catch (error) {
    await setDoc(receivableRef, payload, { merge: true });
  }
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
