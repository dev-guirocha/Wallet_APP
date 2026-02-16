import { parseDateKeyToDate, parseTimeLabelParts, toDate } from './dateUtils';
import { appointmentToPillStatus, receivableToPillStatus } from './statusMapping';

const resolveReceivableDate = (receivable) => {
  const parsed = toDate(receivable?.dueDate);
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
  const fromKey = parseDateKeyToDate(receivable?.dueDateKey);
  if (fromKey instanceof Date && !Number.isNaN(fromKey.getTime())) return fromKey;
  return null;
};

const resolveAppointmentDate = (appointment) => {
  const parsed =
    toDate(appointment?.startAt) ||
    toDate(appointment?.date) ||
    toDate(appointment?.dateAt);

  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;

  const fromDateKey = parseDateKeyToDate(appointment?.dateKey);
  if (!(fromDateKey instanceof Date) || Number.isNaN(fromDateKey.getTime())) return null;

  const { hour, minute } = parseTimeLabelParts(appointment?.time, 9, 0);
  fromDateKey.setHours(hour, minute, 0, 0);
  return fromDateKey;
};

const formatDueDateSubtitle = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'Vencimento não definido';
  return `Vence ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;
};

const normalizeReceivableEvent = (receivable, index) => {
  const date = resolveReceivableDate(receivable);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const amountNumber = Number(receivable?.amount ?? receivable?.value ?? 0);
  const amount = Number.isFinite(amountNumber) ? amountNumber : undefined;
  const title = receivable?.name || receivable?.clientName || 'Cobrança';

  return {
    id: `receivable-${receivable?.id || receivable?.clientId || index}`,
    type: 'receivable',
    date,
    title,
    subtitle: formatDueDateSubtitle(date),
    amount,
    status: receivableToPillStatus(receivable),
  };
};

const normalizeAppointmentEvent = (appointment, index) => {
  const date = resolveAppointmentDate(appointment);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const title = appointment?.name || 'Compromisso';
  const subtitle = [appointment?.time, appointment?.location].filter(Boolean).join(' • ') || 'Compromisso agendado';

  return {
    id:
      `appointment-${
        appointment?.appointmentKey ||
        appointment?.id ||
        `${appointment?.clientId || 'client'}-${appointment?.dateKey || index}-${appointment?.time || '00:00'}`
      }`,
    type: 'appointment',
    date,
    title,
    subtitle,
    status: appointmentToPillStatus(appointment),
  };
};

export const normalizeEvents = ({ receivables = [], appointments = [] } = {}) => {
  const normalizedReceivables = (Array.isArray(receivables) ? receivables : [])
    .map(normalizeReceivableEvent)
    .filter(Boolean);

  const normalizedAppointments = (Array.isArray(appointments) ? appointments : [])
    .map(normalizeAppointmentEvent)
    .filter(Boolean);

  return [...normalizedReceivables, ...normalizedAppointments].sort(
    (left, right) => right.date.getTime() - left.date.getTime()
  );
};
