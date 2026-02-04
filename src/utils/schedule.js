import { getDateKey } from './dateUtils';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const DEFAULT_LOCATION = 'Local a definir';

const parseSortValueFromTime = (time) => {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const match = String(time).match(/(\d{1,2})(?:[:hH]?([0-9]{1,2}))?/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hours = Math.min(23, Math.max(0, parseInt(match[1], 10) || 0));
  const minutes = match[2] ? Math.min(59, Math.max(0, parseInt(match[2], 10) || 0)) : 0;
  return hours * 60 + minutes;
};

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    const normalized = new Date(value);
    if (Number.isNaN(normalized.getTime())) return null;
    return normalized;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const resolveTimeForClient = (client, weekdayLabel) => {
  if (!client) return '';
  const dayTimes = client.dayTimes || {};
  if (weekdayLabel && dayTimes[weekdayLabel]) {
    return dayTimes[weekdayLabel];
  }
  return client.time || '';
};

const buildBaseAppointment = (client, dateKey, weekdayLabel) => ({
  clientId: client.id,
  id: `${client.id}-${dateKey}`,
  dateKey,
  name: client.name,
  location: client.location || DEFAULT_LOCATION,
  time: resolveTimeForClient(client, weekdayLabel),
  note: null,
  status: 'scheduled',
  statusUpdatedAt: null,
  rescheduledTo: null,
  confirmationSentAt: null,
});

const shouldClientAttendOnDay = (client, weekdayLabel) => {
  if (!client) return false;
  const days = Array.isArray(client.days) ? client.days : [];
  return days.includes(weekdayLabel);
};

export const getAppointmentsForDate = ({ date, clients = [], overrides = {} }) => {
  const targetDate = normalizeDate(date);
  if (!targetDate) return [];

  const weekdayLabel = WEEKDAY_LABELS[targetDate.getDay()];
  const dateKey = getDateKey(targetDate);
  const overridesForDate = overrides?.[dateKey] ?? {};

  const appointmentsMap = new Map();

  clients.forEach((client) => {
    if (!client || !shouldClientAttendOnDay(client, weekdayLabel)) return;
    const base = buildBaseAppointment(client, dateKey, weekdayLabel);
    appointmentsMap.set(client.id, base);
  });

  Object.entries(overridesForDate).forEach(([clientId, override]) => {
    if (!override) return;

    const action = override.action;
    if (action === 'skip' || action === 'cancel' || action === 'remove') {
      appointmentsMap.delete(clientId);
      return;
    }

    const client = clients.find((item) => item.id === clientId);
    const existing = appointmentsMap.get(clientId) ?? (client ? buildBaseAppointment(client, dateKey, weekdayLabel) : null);

    if (!existing && action !== 'add') {
      return;
    }

    const nextAppointment = {
      ...(existing ?? {
        clientId,
        id: `${clientId}-${dateKey}`,
        dateKey,
        name: override.name || 'Compromisso',
        location: override.location || DEFAULT_LOCATION,
        time: override.time || resolveTimeForClient(client, weekdayLabel),
        note: null,
        status: 'scheduled',
        statusUpdatedAt: null,
      }),
      ...(override.name ? { name: override.name } : {}),
      ...(override.time !== undefined ? { time: override.time } : {}),
      ...(override.location !== undefined
        ? { location: override.location || DEFAULT_LOCATION }
        : {}),
      ...(override.note !== undefined ? { note: override.note } : {}),
      ...(override.status ? { status: override.status } : {}),
      ...(override.statusUpdatedAt ? { statusUpdatedAt: override.statusUpdatedAt } : {}),
      ...(override.rescheduledTo !== undefined ? { rescheduledTo: override.rescheduledTo } : {}),
      ...(override.confirmationSentAt !== undefined ? { confirmationSentAt: override.confirmationSentAt } : {}),
    };

    if (action) {
      nextAppointment.overrideAction = action;
    }

    appointmentsMap.set(clientId, nextAppointment);
  });

  const appointments = Array.from(appointmentsMap.values());

  appointments.sort((a, b) => {
    const diff = parseSortValueFromTime(a.time) - parseSortValueFromTime(b.time);
    if (diff !== 0) return diff;
    return String(a.name).localeCompare(String(b.name));
  });

  return appointments;
};

export default {
  getAppointmentsForDate,
};
