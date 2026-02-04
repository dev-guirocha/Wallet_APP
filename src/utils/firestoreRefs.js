import { collection, doc } from 'firebase/firestore';
import { db } from './firebase';

export const userDocRef = (uid) => doc(db, 'users', uid);

export const userClientsCollection = (uid) => collection(db, 'users', uid, 'clients');
export const userClientDoc = (uid, clientId) =>
  doc(db, 'users', uid, 'clients', clientId);

export const userAppointmentsCollection = (uid) =>
  collection(db, 'users', uid, 'appointments');
export const userAppointmentDoc = (uid, appointmentId) =>
  doc(db, 'users', uid, 'appointments', appointmentId);

export const userReceivablesCollection = (uid) =>
  collection(db, 'users', uid, 'receivables');
export const userReceivableDoc = (uid, receivableId) =>
  doc(db, 'users', uid, 'receivables', receivableId);

export const userExpensesCollection = (uid) =>
  collection(db, 'users', uid, 'expenses');
export const userExpenseDoc = (uid, expenseId) =>
  doc(db, 'users', uid, 'expenses', expenseId);
