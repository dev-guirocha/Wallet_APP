import { parseDateKeyToDate, toDate } from './dateUtils';
import { getPredictedDelayLevel } from './predictedDelay';
import { getClientRiskLevel } from './riskAnalysis';

const PRIORITY_WEIGHT = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

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

const resolveDueDate = (entry) => {
  const parsed = toDate(entry?.dueDate || entry?.date || entry?.startAt);
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
  const fromKey = parseDateKeyToDate(entry?.dueDateKey || entry?.dateKey);
  return fromKey instanceof Date && !Number.isNaN(fromKey.getTime()) ? fromKey : null;
};

const getDaysUntilDue = (dueDate, todayStart) => {
  if (!(dueDate instanceof Date)) return Number.MAX_SAFE_INTEGER;
  const diff = toStartOfDay(dueDate).getTime() - todayStart.getTime();
  return Math.floor(diff / 86400000);
};

const resolvePriority = ({ daysUntilDue, riskLevel, delayLevel }) => {
  if (daysUntilDue < 0) return 'HIGH';
  if (daysUntilDue === 0) return 'HIGH';
  if (daysUntilDue <= 2 && (riskLevel === 'HIGH' || delayLevel === 'HIGH')) return 'HIGH';
  if (daysUntilDue <= 2 || riskLevel === 'MEDIUM' || delayLevel === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
};

const resolveReason = ({ daysUntilDue, riskLevel, delayLevel }) => {
  if (daysUntilDue < 0) return 'Cobrança atrasada';
  if (daysUntilDue === 0) return 'Vence hoje';
  if (daysUntilDue <= 2 && riskLevel === 'HIGH') return 'Vence em breve com risco alto';
  if (daysUntilDue <= 2 && delayLevel === 'HIGH') return 'Vence em breve com histórico de atraso';
  if (daysUntilDue <= 2) return 'Vence nos próximos dias';
  if (riskLevel === 'HIGH' || delayLevel === 'HIGH') return 'Cliente com risco futuro';
  return 'Acompanhamento preventivo';
};

export const getSuggestedReminders = (receivables = [], today = new Date()) => {
  const source = Array.isArray(receivables) ? receivables : [];
  const todayStart = toStartOfDay(today);
  const horizonEnd = toEndOfDay(new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + 7));

  const groupedByClient = source.reduce((acc, entry) => {
    const key =
      entry?.clientId ||
      entry?.receivable?.clientId ||
      entry?.clientName ||
      entry?.name ||
      entry?.id;
    if (!key) return acc;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(entry?.receivable || entry);
    return acc;
  }, new Map());

  const riskByClient = new Map();
  const delayByClient = new Map();
  groupedByClient.forEach((history, key) => {
    riskByClient.set(key, getClientRiskLevel(history));
    delayByClient.set(key, getPredictedDelayLevel(history));
  });

  return source
    .map((entry) => {
      if (entry?.paid === true) return null;
      const dueDate = resolveDueDate(entry);
      if (!(dueDate instanceof Date)) return null;
      if (dueDate.getTime() > horizonEnd.getTime()) return null;

      const clientKey =
        entry?.clientId ||
        entry?.receivable?.clientId ||
        entry?.clientName ||
        entry?.name ||
        entry?.id;
      const riskLevel = riskByClient.get(clientKey) || 'LOW';
      const delayLevel = delayByClient.get(clientKey) || 'LOW';
      const daysUntilDue = getDaysUntilDue(dueDate, todayStart);
      const priority = resolvePriority({ daysUntilDue, riskLevel, delayLevel });

      if (priority === 'LOW' && daysUntilDue > 2) return null;

      return {
        id: entry?.id || `${clientKey}-${dueDate.toISOString()}`,
        clientId: entry?.clientId || entry?.receivable?.clientId || null,
        name: entry?.name || entry?.clientName || 'Cliente',
        dueDate,
        amount: Number(entry?.amount ?? entry?.value ?? 0) || 0,
        priority,
        riskLevel,
        delayLevel,
        reason: resolveReason({ daysUntilDue, riskLevel, delayLevel }),
        daysUntilDue,
        receivable: entry?.receivable || entry,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const byPriority =
        (PRIORITY_WEIGHT[right.priority] || 0) - (PRIORITY_WEIGHT[left.priority] || 0);
      if (byPriority !== 0) return byPriority;
      const byDate = left.dueDate.getTime() - right.dueDate.getTime();
      if (byDate !== 0) return byDate;
      return String(left.name).localeCompare(String(right.name));
    });
};

