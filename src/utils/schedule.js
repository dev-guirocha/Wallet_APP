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

const buildBaseAppointment = (client, dateKey, weekdayLabel) => {
  const time = resolveTimeForClient(client, weekdayLabel) || '00:00';
  const appointmentKey = `${client.id}-${dateKey}-${time}`;

  return {
    clientId: client.id,
    id: appointmentKey,
    appointmentKey,
    dateKey,
    name: client.name,
    location: client.location || DEFAULT_LOCATION,
    time,
    note: null,
    status: 'scheduled',
    statusUpdatedAt: null,
    rescheduledTo: null,
    confirmationStatus: 'pending',
    confirmationRespondedAt: null,
    confirmationSentAt: null,
  };
};

const shouldClientAttendOnDay = (client, weekdayLabel) => {
  if (!client) return false;
  const days = Array.isArray(client.days) ? client.days : [];
  return days.includes(weekdayLabel);
};

const resolveClientIdFromOverrideKey = (overrideKey, dateKey) => {
  if (!overrideKey) return '';
  if (!dateKey) return String(overrideKey);

  const markerWithTime = `-${dateKey}-`;
  const markerIndex = String(overrideKey).lastIndexOf(markerWithTime);
  if (markerIndex > 0) {
    return String(overrideKey).slice(0, markerIndex);
  }

  const marker = `-${dateKey}`;
  if (String(overrideKey).endsWith(marker) && String(overrideKey).length > marker.length) {
    return String(overrideKey).slice(0, -marker.length);
  }

  return String(overrideKey);
};

const findAppointmentKeyByClientId = (appointmentsMap, clientId) => {
  for (const [key, value] of appointmentsMap.entries()) {
    if (value?.clientId === clientId) return key;
  }
  return null;
};

export const getAppointmentsForDate = ({ date, clients = [], overrides = {} }) => {
  const targetDate = normalizeDate(date);
  if (!targetDate) return [];

  const weekdayLabel = WEEKDAY_LABELS[targetDate.getDay()];
  const safeDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    12,
    0,
    0,
    0
  );
  const dateKey = getDateKey(safeDate);
  const overridesForDate = overrides?.[dateKey] ?? {};

  const appointmentsMap = new Map();

  clients.forEach((client) => {
    if (!client || !shouldClientAttendOnDay(client, weekdayLabel)) return;
    const base = buildBaseAppointment(client, dateKey, weekdayLabel);
    appointmentsMap.set(base.appointmentKey, base);
  });

  Object.entries(overridesForDate).forEach(([overrideKey, override]) => {
    if (!override) return;

    const appointmentKey = override?.appointmentKey || overrideKey;
    const clientId = override?.clientId || resolveClientIdFromOverrideKey(appointmentKey, dateKey);
    if (!appointmentKey || !clientId) return;

    const action = override.action;
    if (action === 'skip' || action === 'cancel' || action === 'remove') {
      appointmentsMap.delete(appointmentKey);
      return;
    }

    const existingKeyByClientId = findAppointmentKeyByClientId(appointmentsMap, clientId);
    const hasExactKey = appointmentsMap.has(appointmentKey);
    const targetKey =
      action === 'add'
        ? appointmentKey
        : hasExactKey
          ? appointmentKey
          : existingKeyByClientId;

    const client = clients.find((item) => item.id === clientId);
    const existing =
      (targetKey ? appointmentsMap.get(targetKey) : null) ??
      (client ? buildBaseAppointment(client, dateKey, weekdayLabel) : null);

    if (!existing && action !== 'add') {
      return;
    }

    // Mantém apenas um compromisso por cliente/dia:
    // quando chega um override explícito de adição, ele substitui o base anterior.
    if (action === 'add' && existingKeyByClientId && existingKeyByClientId !== appointmentKey) {
      appointmentsMap.delete(existingKeyByClientId);
    }

    const shouldApplySchedulingFields = action === 'add' || targetKey === appointmentKey;
    const nextKey = targetKey || appointmentKey;

    const nextAppointment = {
      id: nextKey,
      appointmentKey: nextKey,
      ...(existing ?? {
        clientId,
        dateKey,
        name: override.name || 'Compromisso',
        location: override.location || DEFAULT_LOCATION,
        time: override.time || resolveTimeForClient(client, weekdayLabel),
        note: null,
        status: 'scheduled',
        statusUpdatedAt: null,
        confirmationStatus: 'pending',
        confirmationRespondedAt: null,
      }),
      ...(shouldApplySchedulingFields && override.name ? { name: override.name } : {}),
      ...(shouldApplySchedulingFields && override.time !== undefined ? { time: override.time } : {}),
      ...(shouldApplySchedulingFields && override.location !== undefined
        ? { location: override.location || DEFAULT_LOCATION }
        : {}),
      ...(override.note !== undefined ? { note: override.note } : {}),
      ...(override.status ? { status: override.status } : {}),
      ...(override.statusUpdatedAt ? { statusUpdatedAt: override.statusUpdatedAt } : {}),
      ...(override.rescheduledTo !== undefined ? { rescheduledTo: override.rescheduledTo } : {}),
      ...(override.confirmationStatus !== undefined ? { confirmationStatus: override.confirmationStatus } : {}),
      ...(override.confirmationRespondedAt !== undefined
        ? { confirmationRespondedAt: override.confirmationRespondedAt }
        : {}),
      ...(override.confirmationSentAt !== undefined ? { confirmationSentAt: override.confirmationSentAt } : {}),
    };

    const explicitConfirmationStatus = override.confirmationStatus;
    const hasConfirmationSentAt =
      override.confirmationSentAt !== undefined
        ? Boolean(override.confirmationSentAt)
        : Boolean(nextAppointment.confirmationSentAt);

    const resolvedConfirmationStatus =
      explicitConfirmationStatus !== undefined
        ? explicitConfirmationStatus
        : hasConfirmationSentAt
          ? 'sent'
          : 'pending';

    nextAppointment.confirmationStatus = resolvedConfirmationStatus;

    if (action) {
      nextAppointment.overrideAction = action;
    }

    appointmentsMap.set(nextKey, nextAppointment);
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
