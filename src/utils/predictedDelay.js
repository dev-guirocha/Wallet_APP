import { parseDateKeyToDate, toDate } from './dateUtils';

const toEndOfDay = (value) => {
  const base = value instanceof Date ? new Date(value) : new Date();
  base.setHours(23, 59, 59, 999);
  return base;
};

const resolveDueDate = (entry) => {
  const parsed = toDate(entry?.dueDate || entry?.date || entry?.startAt);
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
  const fromKey = parseDateKeyToDate(entry?.dueDateKey || entry?.dateKey);
  return fromKey instanceof Date && !Number.isNaN(fromKey.getTime()) ? fromKey : null;
};

const resolvePaidDate = (entry) => {
  const parsed = toDate(entry?.paidAt || entry?.paymentDate || entry?.receivedAt);
  return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const resolveChargeCount = (entry) => {
  const historyCount = Array.isArray(entry?.chargeHistory) ? entry.chargeHistory.length : 0;
  if (historyCount > 0) return historyCount;
  return entry?.lastChargeSentAt ? 1 : 0;
};

const delayDays = (paidDate, dueDate) => {
  if (!(paidDate instanceof Date) || !(dueDate instanceof Date)) return 0;
  const diff = paidDate.getTime() - toEndOfDay(dueDate).getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / 86400000);
};

export const getPredictedDelayLevel = (receivableHistory = []) => {
  const history = Array.isArray(receivableHistory) ? receivableHistory : [];
  if (history.length === 0) return 'LOW';

  let totalDelayDays = 0;
  let delayedPayments = 0;
  let chargeCountTotal = 0;
  let consecutiveDelays = 0;
  let maxConsecutiveDelays = 0;
  let weightedScore = 0;

  history
    .map((entry) => {
      const dueDate = resolveDueDate(entry);
      const paidDate = resolvePaidDate(entry);
      return { entry, dueDate, paidDate };
    })
    .sort((a, b) => {
      const left = a.dueDate?.getTime?.() || 0;
      const right = b.dueDate?.getTime?.() || 0;
      return left - right;
    })
    .forEach(({ entry, dueDate, paidDate }) => {
      const chargeCount = resolveChargeCount(entry);
      chargeCountTotal += chargeCount;

      const days = delayDays(paidDate, dueDate);
      if (days > 0) {
        delayedPayments += 1;
        totalDelayDays += days;
        consecutiveDelays += 1;
        maxConsecutiveDelays = Math.max(maxConsecutiveDelays, consecutiveDelays);
        weightedScore += days >= 8 ? 3 : days >= 4 ? 2 : 1;
      } else {
        consecutiveDelays = 0;
      }

      if (chargeCount > 0) {
        weightedScore += Math.min(chargeCount, 3) * 0.8;
      }
    });

  const avgDelay = delayedPayments > 0 ? totalDelayDays / delayedPayments : 0;
  weightedScore += maxConsecutiveDelays * 1.4;
  if (avgDelay >= 7) weightedScore += 3;
  else if (avgDelay >= 3) weightedScore += 1.5;

  if (maxConsecutiveDelays >= 3 || avgDelay >= 8 || weightedScore >= 10) return 'HIGH';
  if (maxConsecutiveDelays >= 1 || avgDelay >= 2 || chargeCountTotal >= 2 || weightedScore >= 5) return 'MEDIUM';
  return 'LOW';
};

