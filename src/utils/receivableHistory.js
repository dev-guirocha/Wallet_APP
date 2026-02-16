import { toDate } from './dateUtils';

export const RECEIVABLE_HISTORY_TYPES = {
  PAID: 'PAID',
  CHARGE_SENT: 'CHARGE_SENT',
  RESCHEDULED: 'RESCHEDULED',
  EDITED: 'EDITED',
};

const resolveEntryDate = (value) => {
  const parsed = toDate(value);
  return parsed instanceof Date && !Number.isNaN(parsed.getTime())
    ? parsed
    : new Date();
};

export const appendReceivableHistory = (receivable, entry) => {
  const source = receivable && typeof receivable === 'object' ? receivable : {};
  const nextEntry = entry && typeof entry === 'object' ? entry : {};
  const previousHistory = Array.isArray(source.history) ? source.history : [];

  const normalizedEntry = {
    ...nextEntry,
    type: nextEntry.type || RECEIVABLE_HISTORY_TYPES.EDITED,
    at: resolveEntryDate(nextEntry.at).toISOString(),
  };

  return [...previousHistory, normalizedEntry];
};

