import { parseDateKeyToDate, toDate } from './dateUtils';

const RISK_ORDER = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

const toEndOfDay = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

const resolveDueDate = (entry) => {
  const fromRaw = toDate(entry?.dueDate || entry?.date || entry?.startAt);
  if (fromRaw instanceof Date && !Number.isNaN(fromRaw.getTime())) return fromRaw;
  const fromKey = parseDateKeyToDate(entry?.dueDateKey || entry?.dateKey);
  if (fromKey instanceof Date && !Number.isNaN(fromKey.getTime())) return fromKey;
  return null;
};

const resolvePaidDate = (entry) => {
  const fromRaw = toDate(entry?.paidAt || entry?.paymentDate || entry?.receivedAt);
  if (fromRaw instanceof Date && !Number.isNaN(fromRaw.getTime())) return fromRaw;
  return null;
};

const resolveChargeCount = (entry) => {
  const historyCount = Array.isArray(entry?.chargeHistory) ? entry.chargeHistory.length : 0;
  if (historyCount > 0) return historyCount;
  if (entry?.lastChargeSentAt) return 1;
  return 0;
};

const safeDiffInDays = (left, right) => {
  if (!(left instanceof Date) || !(right instanceof Date)) return 0;
  const diff = left.getTime() - right.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
};

const toRiskScore = (stats) => {
  const {
    punctualPayments,
    latePayments,
    lateDaysTotal,
    paidAfterCharge,
    openOverdue,
    chargeCountTotal,
  } = stats;

  let score = 0;
  score += latePayments * 2;
  score += Math.min(openOverdue, 3) * 2;
  score += paidAfterCharge * 1.5;
  score += Math.min(chargeCountTotal * 0.3, 2);

  if (lateDaysTotal >= 14) score += 2;
  else if (lateDaysTotal >= 5) score += 1;

  score -= punctualPayments * 0.8;
  return score;
};

export const getClientRiskLevel = (receivableHistory = []) => {
  const history = Array.isArray(receivableHistory) ? receivableHistory : [];
  if (history.length === 0) return 'LOW';

  const todayEnd = toEndOfDay(new Date());
  const stats = history.reduce(
    (acc, entry) => {
      const dueDate = resolveDueDate(entry);
      const paidDate = resolvePaidDate(entry);
      const paid = entry?.paid === true || Boolean(paidDate);
      const chargeCount = resolveChargeCount(entry);
      const dueEnd = dueDate ? toEndOfDay(dueDate) : null;

      acc.chargeCountTotal += chargeCount;

      if (paid) {
        if (dueEnd && paidDate && paidDate.getTime() > dueEnd.getTime()) {
          acc.latePayments += 1;
          acc.lateDaysTotal += safeDiffInDays(paidDate, dueEnd);
          if (chargeCount > 0) acc.paidAfterCharge += 1;
        } else {
          acc.punctualPayments += 1;
        }
      } else if (
        entry?.isOverdue === true ||
        (dueEnd instanceof Date && dueEnd.getTime() < todayEnd.getTime())
      ) {
        acc.openOverdue += 1;
      }

      return acc;
    },
    {
      punctualPayments: 0,
      latePayments: 0,
      lateDaysTotal: 0,
      paidAfterCharge: 0,
      openOverdue: 0,
      chargeCountTotal: 0,
    }
  );

  const totalSamples = history.length;
  const score = toRiskScore(stats);

  if (stats.openOverdue >= 2 || score >= 6) return 'HIGH';
  if (stats.latePayments >= 1 || stats.paidAfterCharge >= 2 || score >= 3) return 'MEDIUM';
  if (totalSamples <= 1 && stats.punctualPayments === 0 && stats.openOverdue === 0) return 'LOW';
  return 'LOW';
};

export const sortReceivablesByRisk = (receivables = []) => {
  const source = Array.isArray(receivables) ? receivables : [];
  const grouped = source.reduce((acc, entry) => {
    const key =
      entry?.clientId ||
      entry?.receivable?.clientId ||
      entry?.clientName ||
      entry?.name ||
      entry?.id ||
      `item-${acc.size}`;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(entry?.receivable || entry);
    return acc;
  }, new Map());

  const riskByClient = new Map();
  grouped.forEach((history, key) => {
    riskByClient.set(key, getClientRiskLevel(history));
  });

  return source
    .map((entry) => {
      const key =
        entry?.clientId ||
        entry?.receivable?.clientId ||
        entry?.clientName ||
        entry?.name ||
        entry?.id;
      const riskLevel = entry?.riskLevel || riskByClient.get(key) || 'LOW';
      return {
        ...entry,
        riskLevel,
      };
    })
    .sort((left, right) => {
      const leftOrder = RISK_ORDER[left?.riskLevel] ?? 0;
      const rightOrder = RISK_ORDER[right?.riskLevel] ?? 0;
      if (leftOrder !== rightOrder) return rightOrder - leftOrder;

      const leftMs = resolveDueDate(left)?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
      const rightMs = resolveDueDate(right)?.getTime?.() ?? Number.MAX_SAFE_INTEGER;
      if (leftMs !== rightMs) return leftMs - rightMs;

      return String(left?.name || '').localeCompare(String(right?.name || ''));
    });
};

