import { parseDateKeyToDate, toDate } from './dateUtils';

const resolveDateFromEntry = (entry) => {
  const parsed = toDate(entry?.dueDate || entry?.date || entry?.startAt);
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
  const fromKey = parseDateKeyToDate(entry?.dueDateKey || entry?.dateKey);
  if (fromKey instanceof Date && !Number.isNaN(fromKey.getTime())) return fromKey;
  return null;
};

const resolveConfirmationStatus = (appointment) => {
  const rawStatus = appointment?.confirmationStatus;
  if (rawStatus === 'confirmed' || rawStatus === 'canceled' || rawStatus === 'sent') {
    return rawStatus;
  }
  if (appointment?.confirmationSentAt) return 'sent';
  return 'pending';
};

export const appointmentToPillStatus = (appointment) => {
  const status = appointment?.status;
  if (status === 'done') return 'PAID';
  if (status === 'rescheduled') return 'SCHEDULED';

  const confirmationStatus = resolveConfirmationStatus(appointment);
  if (confirmationStatus === 'confirmed') return 'PAID';
  if (confirmationStatus === 'canceled') return 'OVERDUE';
  if (confirmationStatus === 'sent') return 'PENDING';
  return 'SCHEDULED';
};

export const receivableToPillStatus = (receivable, referenceDate = new Date()) => {
  if (receivable?.isOverdue) return 'OVERDUE';
  if (receivable?.paid === true) return 'PAID';

  const dueDate = resolveDateFromEntry(receivable);
  if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) return 'PENDING';

  const endOfDueDay = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
    23,
    59,
    59,
    999
  );

  return endOfDueDay.getTime() < referenceDate.getTime() ? 'OVERDUE' : 'PENDING';
};
