import { parseDateKeyToDate, toDate } from './dateUtils';

const IMPORTANCE_WEIGHT = {
  low: 0,
  medium: 1,
  high: 2,
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const normalizeImportance = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  return 'low';
};

const resolveDate = (entry, fallbackDate) => {
  if (!entry || typeof entry !== 'object') return fallbackDate;

  const candidates = [
    entry.date,
    entry.at,
    entry.createdAt,
    entry.updatedAt,
    entry.dueDate,
    entry.startAt,
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const parsed = toDate(candidates[i]);
    if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
  }

  const fromDateKey = parseDateKeyToDate(entry.dateKey || entry.dueDateKey);
  if (fromDateKey instanceof Date && !Number.isNaN(fromDateKey.getTime())) return fromDateKey;

  return fallbackDate;
};

const buildStableId = ({ source, type, title, subtitle, date, index }) => {
  const dateKey = date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString()
    : 'no-date';
  const raw = `${source}|${type}|${title}|${subtitle}|${dateKey}|${index}`;
  return raw
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-|]/g, '')
    .slice(0, 140);
};

const historyToFeedItem = (entry, index, today) => {
  const typeRaw = String(entry?.type || '').toUpperCase();
  const date = resolveDate(entry, today);
  const clientName = entry?.clientName || entry?.name || 'Cliente';

  if (typeRaw === 'PAID') {
    return {
      id: buildStableId({
        source: 'history',
        type: 'PAID',
        title: `Pagamento confirmado de ${clientName}`,
        subtitle: 'Recebimento registrado com sucesso',
        date,
        index,
      }),
      date,
      type: 'PAID',
      title: `Pagamento confirmado de ${clientName}`,
      subtitle: 'Recebimento registrado com sucesso',
      importance: entry?.reverted ? 'low' : 'medium',
    };
  }

  if (typeRaw === 'CHARGE_SENT') {
    return {
      id: buildStableId({
        source: 'history',
        type: 'CHARGE_SENT',
        title: `Cobrança enviada para ${clientName}`,
        subtitle: 'Lembrete financeiro disparado',
        date,
        index,
      }),
      date,
      type: 'CHARGE_SENT',
      title: `Cobrança enviada para ${clientName}`,
      subtitle: 'Lembrete financeiro disparado',
      importance: 'low',
    };
  }

  if (typeRaw === 'RESCHEDULED') {
    return {
      id: buildStableId({
        source: 'history',
        type: 'RESCHEDULED',
        title: `Vencimento reajustado para ${clientName}`,
        subtitle: 'Data de cobrança alterada',
        date,
        index,
      }),
      date,
      type: 'RESCHEDULED',
      title: `Vencimento reajustado para ${clientName}`,
      subtitle: 'Data de cobrança alterada',
      importance: entry?.reverted ? 'low' : 'medium',
    };
  }

  if (typeRaw === 'EDITED') {
    return {
      id: buildStableId({
        source: 'history',
        type: 'EDITED',
        title: `Cobrança atualizada de ${clientName}`,
        subtitle: 'Dados financeiros revisados',
        date,
        index,
      }),
      date,
      type: 'EDITED',
      title: `Cobrança atualizada de ${clientName}`,
      subtitle: 'Dados financeiros revisados',
      importance: 'low',
    };
  }

  return {
    id: buildStableId({
      source: 'history',
      type: typeRaw || 'UPDATE',
      title: `Atualização financeira: ${clientName}`,
      subtitle: 'Registro adicionado ao histórico',
      date,
      index,
    }),
    date,
    type: typeRaw || 'UPDATE',
    title: `Atualização financeira: ${clientName}`,
    subtitle: 'Registro adicionado ao histórico',
    importance: 'low',
  };
};

const predictionToFeedItem = (entry, index, today) => {
  const date = resolveDate(entry, today);
  const type = String(entry?.type || entry?.category || 'PREDICTION').toUpperCase();
  const name = entry?.name || entry?.clientName || entry?.title || 'Cliente';
  const reason = entry?.reason || entry?.subtitle || 'Acompanhe este sinal no curto prazo';
  const priority = normalizeImportance(entry?.importance || entry?.priority);

  return {
    id: buildStableId({
      source: 'prediction',
      type,
      title: `Sinal de risco: ${name}`,
      subtitle: String(reason),
      date,
      index,
    }),
    date,
    type,
    title: `Sinal de risco: ${name}`,
    subtitle: String(reason),
    importance: priority,
  };
};

const resolveInsightImportance = (text) => {
  const normalized = String(text || '').toLowerCase();
  if (
    normalized.includes('piora') ||
    normalized.includes('inadimpl') ||
    normalized.includes('perda') ||
    normalized.includes('risco')
  ) {
    return 'high';
  }
  if (normalized.includes('melhora') || normalized.includes('crescimento')) {
    return 'medium';
  }
  return 'low';
};

const insightToFeedItem = (entry, index, today) => {
  const text = typeof entry === 'string' ? entry : entry?.title || entry?.text || '';
  const subtitle = typeof entry === 'string'
    ? 'Insight mensal automático'
    : entry?.subtitle || 'Insight mensal automático';
  const date = resolveDate(entry, today);
  const importance = normalizeImportance(entry?.importance || resolveInsightImportance(text));

  return {
    id: buildStableId({
      source: 'insight',
      type: 'INSIGHT',
      title: text || 'Insight financeiro',
      subtitle: String(subtitle),
      date,
      index,
    }),
    date,
    type: 'INSIGHT',
    title: text || 'Insight financeiro',
    subtitle: String(subtitle),
    importance,
  };
};

export const buildActivityFeed = ({
  receivableHistory = [],
  predictions = [],
  insights = [],
  today = new Date(),
} = {}) => {
  const safeToday = today instanceof Date && !Number.isNaN(today.getTime()) ? new Date(today) : new Date();

  const historyItems = safeArray(receivableHistory)
    .map((entry, index) => historyToFeedItem(entry, index, safeToday))
    .filter(Boolean);

  const predictionSource = Array.isArray(predictions)
    ? predictions
    : safeArray(predictions?.items || predictions?.events || []);
  const predictionItems = predictionSource
    .map((entry, index) => predictionToFeedItem(entry, index, safeToday))
    .filter(Boolean);

  const insightItems = safeArray(insights)
    .map((entry, index) => insightToFeedItem(entry, index, safeToday))
    .filter(Boolean);

  return [...historyItems, ...predictionItems, ...insightItems]
    .sort((left, right) => {
      const leftTime = left.date instanceof Date ? left.date.getTime() : 0;
      const rightTime = right.date instanceof Date ? right.date.getTime() : 0;
      if (leftTime !== rightTime) return rightTime - leftTime;

      const importanceDiff =
        (IMPORTANCE_WEIGHT[right.importance] || 0) - (IMPORTANCE_WEIGHT[left.importance] || 0);
      if (importanceDiff !== 0) return importanceDiff;

      return String(left.id).localeCompare(String(right.id));
    })
    .map((entry) => ({
      id: entry.id,
      date: entry.date,
      type: entry.type,
      title: entry.title,
      subtitle: entry.subtitle,
      importance: normalizeImportance(entry.importance),
    }));
};

