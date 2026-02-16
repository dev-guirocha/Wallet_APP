import { getPredictedDelayLevel } from './predictedDelay';

const RISK_ORDER = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

const normalizeInput = (clientsReceivablesHistory) => {
  if (Array.isArray(clientsReceivablesHistory)) return clientsReceivablesHistory;
  if (clientsReceivablesHistory && typeof clientsReceivablesHistory === 'object') {
    return Object.entries(clientsReceivablesHistory).map(([clientId, history]) => ({
      clientId,
      name: clientId,
      history: Array.isArray(history) ? history : [],
    }));
  }
  return [];
};

const resolveEntryDate = (entry) => {
  const value = entry?.dueDate || entry?.date || entry?.paidAt || entry?.paymentDate;
  const parsed = value ? new Date(value) : null;
  return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const splitHistory = (history = []) => {
  const sorted = [...history].sort((a, b) => {
    const left = resolveEntryDate(a)?.getTime?.() || 0;
    const right = resolveEntryDate(b)?.getTime?.() || 0;
    return left - right;
  });
  if (sorted.length < 2) return { past: sorted, recent: sorted };
  const pivot = Math.floor(sorted.length / 2);
  return {
    past: sorted.slice(0, pivot),
    recent: sorted.slice(pivot),
  };
};

const overdueRatio = (history = []) => {
  if (history.length === 0) return 0;
  const overdue = history.filter((entry) => entry?.isOverdue === true || entry?.paid === false).length;
  return overdue / history.length;
};

export const getClientHealth = (clientsReceivablesHistory = []) => {
  const source = normalizeInput(clientsReceivablesHistory);
  const improvingClients = [];
  const worseningClients = [];
  const churnRiskClients = [];

  source.forEach((entry) => {
    const history = Array.isArray(entry?.history) ? entry.history : [];
    if (history.length === 0) return;

    const { past, recent } = splitHistory(history);
    const pastLevel = getPredictedDelayLevel(past);
    const recentLevel = getPredictedDelayLevel(recent);
    const pastScore = RISK_ORDER[pastLevel] ?? 0;
    const recentScore = RISK_ORDER[recentLevel] ?? 0;
    const riskPayload = {
      clientId: entry?.clientId || entry?.id || entry?.name,
      name: entry?.name || entry?.clientName || 'Cliente',
      previousLevel: pastLevel,
      currentLevel: recentLevel,
    };

    if (recentScore < pastScore) {
      improvingClients.push(riskPayload);
    } else if (recentScore > pastScore) {
      worseningClients.push(riskPayload);
    }

    const isHighRisk =
      recentLevel === 'HIGH' ||
      (recentLevel === 'MEDIUM' && overdueRatio(recent) >= 0.5) ||
      overdueRatio(history) >= 0.6;
    if (isHighRisk) {
      churnRiskClients.push(riskPayload);
    }
  });

  return {
    improvingClients,
    worseningClients,
    churnRiskClients,
  };
};

