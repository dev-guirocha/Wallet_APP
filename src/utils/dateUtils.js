export const WEEKDAY_ABBREVIATIONS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const getMonthKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getDateKey = (date = new Date()) => {
  const base = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(base.getTime())) return '';
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDateKeyToDate = (dateKey) => {
  if (!dateKey) return null;
  const parts = String(dateKey).split('-');
  if (parts.length !== 3) return null;
  const [yearString, monthString, dayString] = parts;
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const toDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
      return converted;
    }
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const converted = new Date(value);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  return null;
};

export const getReadableMonth = (monthKey) => {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

export const formatCurrency = (value) => {
  const numericValue = Number(value || 0);
  return numericValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const startOfDay = (date = new Date()) => {
  const base = date instanceof Date ? new Date(date) : new Date();
  base.setHours(0, 0, 0, 0);
  return base;
};

export const endOfDay = (date = new Date()) => {
  const base = date instanceof Date ? new Date(date) : new Date();
  base.setHours(23, 59, 59, 999);
  return base;
};

export const formatDateLabel = (date, options = {}) => {
  if (!(date instanceof Date)) return '';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
};

export const parseTimeLabelParts = (label, fallbackHour = 9, fallbackMinute = 0) => {
  if (!label) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }

  const sanitized = String(label).toLowerCase();
  const match = sanitized.match(/(\d{1,2})(?:[:h]?([0-9]{1,2}))?/);
  if (!match) {
    return { hour: fallbackHour, minute: fallbackMinute };
  }

  const parsedHour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const parsedMinute = match[2] ? Math.min(59, Math.max(0, parseInt(match[2], 10) || 0)) : fallbackMinute;

  return {
    hour: Number.isFinite(parsedHour) ? parsedHour : fallbackHour,
    minute: Number.isFinite(parsedMinute) ? parsedMinute : fallbackMinute,
  };
};

export const getNextDueDateFromDay = (day, referenceDate = new Date(), timeLabel) => {
  const dueDay = Number(day);
  if (!Number.isInteger(dueDay) || dueDay <= 0) return null;

  const now = new Date(referenceDate);
  now.setHours(0, 0, 0, 0);

  let year = now.getFullYear();
  let month = now.getMonth();

  const DEFAULT_HOUR = 9;
  const DEFAULT_MINUTE = 0;
  const { hour, minute } = parseTimeLabelParts(timeLabel, DEFAULT_HOUR, DEFAULT_MINUTE);
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const normalizedDay = Math.min(dueDay, daysInCurrentMonth);
  let candidate = new Date(year, month, normalizedDay, hour, minute, 0, 0);

  if (candidate < now) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    const daysInNextMonth = new Date(year, month + 1, 0).getDate();
    candidate = new Date(year, month, Math.min(dueDay, daysInNextMonth), hour, minute, 0, 0);
  }

  return candidate;
};

export const formatTimeLabelFromDate = (date, suffix = 'h') => {
  if (!(date instanceof Date)) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = date.getMinutes();
  if (minutes > 0) {
    return `${hours}${suffix}${String(minutes).padStart(2, '0')}`;
  }
  return `${hours}${suffix}`;
};
