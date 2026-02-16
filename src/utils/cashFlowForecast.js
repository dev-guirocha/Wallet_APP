import { parseDateKeyToDate, parseTimeLabelParts, toDate } from './dateUtils';

const toStartOfDay = (value) => {
  const base = value instanceof Date ? new Date(value) : new Date();
  base.setHours(0, 0, 0, 0);
  return base;
};

const toEndOfDay = (value) => {
  const base = value instanceof Date ? new Date(value) : new Date();
  base.setHours(23, 59, 59, 999);
  return base;
};

const addDays = (value, days) => {
  const base = toStartOfDay(value);
  base.setDate(base.getDate() + days);
  return base;
};

const resolveReceivableDate = (entry) => {
  const parsed = toDate(entry?.dueDate || entry?.date || entry?.startAt);
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
  const fromKey = parseDateKeyToDate(entry?.dueDateKey || entry?.dateKey);
  return fromKey instanceof Date && !Number.isNaN(fromKey.getTime()) ? fromKey : null;
};

const resolveAppointmentDate = (entry) => {
  const parsed = toDate(entry?.startAt || entry?.date || entry?.dateAt);
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
  const fromKey = parseDateKeyToDate(entry?.dateKey);
  if (!(fromKey instanceof Date) || Number.isNaN(fromKey.getTime())) return null;
  const { hour, minute } = parseTimeLabelParts(entry?.time, 9, 0);
  fromKey.setHours(hour, minute, 0, 0);
  return fromKey;
};

const resolveExpenseDate = (entry) => {
  const parsed = toDate(entry?.date || entry?.dueDate || entry?.createdAt || entry?.updatedAt);
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
  const fromKey = parseDateKeyToDate(entry?.dateKey);
  return fromKey instanceof Date && !Number.isNaN(fromKey.getTime()) ? fromKey : null;
};

const safeAmount = (value) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const shouldIncludeAppointment = (entry) => {
  const status = entry?.status;
  if (status === 'canceled' || status === 'cancelled' || status === 'rescheduled') return false;
  return true;
};

export const getCashFlowForecast = ({
  receivables = [],
  appointments = [],
  expenses = [],
  today = new Date(),
  days = 30,
} = {}) => {
  const safeDays = Math.max(1, Number.isInteger(days) ? days : 30);
  const start = toStartOfDay(today);
  const end = toEndOfDay(addDays(start, safeDays - 1));
  const rows = Array.from({ length: safeDays }, (_, index) => {
    const date = addDays(start, index);
    return {
      date,
      expectedIn: 0,
      expectedOut: 0,
      balance: 0,
    };
  });

  const indexByKey = new Map(rows.map((row, idx) => [row.date.toISOString().slice(0, 10), idx]));
  const includeByDate = (date, side, amount) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return;
    if (date.getTime() < start.getTime() || date.getTime() > end.getTime()) return;
    const key = toStartOfDay(date).toISOString().slice(0, 10);
    const idx = indexByKey.get(key);
    if (idx === undefined) return;
    if (side === 'in') rows[idx].expectedIn += amount;
    if (side === 'out') rows[idx].expectedOut += amount;
  };

  (Array.isArray(receivables) ? receivables : []).forEach((entry) => {
    if (entry?.paid === true) return;
    const date = resolveReceivableDate(entry);
    includeByDate(date, 'in', safeAmount(entry?.amount ?? entry?.value));
  });

  (Array.isArray(appointments) ? appointments : []).forEach((entry) => {
    if (!shouldIncludeAppointment(entry)) return;
    const amount = safeAmount(entry?.amount ?? entry?.price ?? entry?.value ?? 0);
    if (amount <= 0) return;
    includeByDate(resolveAppointmentDate(entry), 'in', amount);
  });

  (Array.isArray(expenses) ? expenses : []).forEach((entry) => {
    includeByDate(resolveExpenseDate(entry), 'out', safeAmount(entry?.amount ?? entry?.value));
  });

  let runningBalance = 0;
  return rows.map((row) => {
    runningBalance += row.expectedIn - row.expectedOut;
    return {
      date: row.date,
      expectedIn: row.expectedIn,
      expectedOut: row.expectedOut,
      balance: runningBalance,
    };
  });
};

