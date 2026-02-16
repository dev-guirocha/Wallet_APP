import { parseDateKeyToDate, toDate } from './dateUtils';

const toMonthKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const resolveDate = (entry, keys = []) => {
  for (let i = 0; i < keys.length; i += 1) {
    const parsed = toDate(entry?.[keys[i]]);
    if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsedDue = toDate(entry?.dueDate || entry?.date || entry?.startAt);
  if (parsedDue instanceof Date && !Number.isNaN(parsedDue.getTime())) return parsedDue;
  const fromKey = parseDateKeyToDate(entry?.dueDateKey || entry?.dateKey);
  if (fromKey instanceof Date && !Number.isNaN(fromKey.getTime())) return fromKey;
  return null;
};

const resolveMonthKey = (entry) => {
  if (entry?.monthKey) return String(entry.monthKey);
  const date = resolveDate(entry, ['dueDate', 'date']);
  return date ? toMonthKey(date) : '';
};

const resolveStatus = (entry) => {
  const raw = typeof entry?.status === 'string' ? entry.status.toLowerCase() : '';
  if (raw === 'paid' || raw === 'pago') return 'paid';
  if (entry?.paid === true) return 'paid';
  if (raw === 'canceled' || raw === 'cancelled') return 'canceled';
  return raw || 'pending';
};

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const roundInt = (value) => Math.round(clamp(value));

export const getFinancialScore = ({
  receivables = [],
  appointments = [],
  history = [],
  month,
} = {}) => {
  const targetMonth = month ? String(month) : toMonthKey(new Date());
  const receivableList = Array.isArray(receivables) ? receivables : [];
  const appointmentList = Array.isArray(appointments) ? appointments : [];
  const historyList = Array.isArray(history) ? history : [];

  const monthReceivables = receivableList.filter((entry) => resolveMonthKey(entry) === targetMonth);
  const monthHistory = historyList.filter((entry) => resolveMonthKey(entry) === targetMonth);
  const paidHistory = monthHistory.filter((entry) => resolveStatus(entry) === 'paid');
  const overdueReceivables = monthReceivables.filter((entry) => {
    const dueDate = resolveDate(entry, ['dueDate']);
    if (!(dueDate instanceof Date)) return false;
    return resolveStatus(entry) !== 'paid' && dueDate.getTime() < Date.now();
  });

  const delayDays = paidHistory
    .map((entry) => {
      const paidDate = resolveDate(entry, ['paidAt', 'paymentDate', 'receivedAt', 'date']);
      const dueDate = resolveDate(entry, ['dueDate', 'date']);
      if (!(paidDate instanceof Date) || !(dueDate instanceof Date)) return 0;
      const dueEnd = new Date(dueDate);
      dueEnd.setHours(23, 59, 59, 999);
      const diff = paidDate.getTime() - dueEnd.getTime();
      return diff > 0 ? Math.floor(diff / 86400000) : 0;
    })
    .filter((days) => Number.isFinite(days));

  const avgDelay = delayDays.length > 0
    ? delayDays.reduce((sum, days) => sum + days, 0) / delayDays.length
    : 0;
  const lateRate = paidHistory.length > 0
    ? delayDays.filter((days) => days > 0).length / paidHistory.length
    : 0;
  const paymentDelay = roundInt(100 - (avgDelay * 10 + lateRate * 45));

  const monthAppointments = appointmentList.filter((entry) => resolveMonthKey(entry) === targetMonth);
  const canceledAppointments = monthAppointments.filter(
    (entry) => resolveStatus(entry) === 'canceled' || entry?.confirmationStatus === 'canceled'
  );
  const cancellationRateRaw = monthAppointments.length > 0
    ? canceledAppointments.length / monthAppointments.length
    : 0;
  const cancellationRate = roundInt(100 - cancellationRateRaw * 100);

  const expectedCount = Math.max(monthReceivables.length, paidHistory.length);
  const overduePenalty = expectedCount > 0 ? overdueReceivables.length / expectedCount : 0;
  const appointmentVolatility = monthAppointments.length > 0 ? cancellationRateRaw : 0;
  const predictability = roundInt(100 - (overduePenalty * 65 + appointmentVolatility * 35) * 100);

  const chargedCount = monthReceivables.reduce((sum, entry) => {
    const count = Array.isArray(entry?.chargeHistory) ? entry.chargeHistory.length : entry?.lastChargeSentAt ? 1 : 0;
    return sum + (count > 0 ? 1 : 0);
  }, 0);
  const paidAfterCharge = paidHistory.filter((entry) => {
    const count = Array.isArray(entry?.chargeHistory) ? entry.chargeHistory.length : entry?.lastChargeSentAt ? 1 : 0;
    return count > 0;
  }).length;
  const recoveryRate = chargedCount > 0 ? roundInt((paidAfterCharge / chargedCount) * 100) : 70;

  const score = roundInt(
    paymentDelay * 0.35 +
    cancellationRate * 0.2 +
    predictability * 0.25 +
    recoveryRate * 0.2
  );

  return {
    score,
    factors: {
      paymentDelay,
      cancellationRate,
      predictability,
      recoveryRate,
    },
  };
};

