import { parseDateKeyToDate, parseTimeLabelParts, toDate } from './dateUtils';
import { getClientRiskLevel } from './riskAnalysis';
import { appointmentToPillStatus, receivableToPillStatus } from './statusMapping';

const TASK_PRIORITY = {
  OVERDUE_CHARGE: 0,
  TODAY_CHARGE: 1,
  CONFIRM_APPOINTMENT: 2,
  TODAY_APPOINTMENT: 3,
  DONE: 4,
};

const RISK_ORDER = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
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

const resolveReceivableDate = (receivable) => {
  const parsed = toDate(receivable?.dueDate || receivable?.date || receivable?.startAt);
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
  const fromKey = parseDateKeyToDate(receivable?.dueDateKey || receivable?.dateKey);
  if (fromKey instanceof Date && !Number.isNaN(fromKey.getTime())) return fromKey;
  return null;
};

const resolveAppointmentDate = (appointment) => {
  const parsed = toDate(appointment?.startAt || appointment?.date || appointment?.dateAt);
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;

  const fromKey = parseDateKeyToDate(appointment?.dateKey);
  if (!(fromKey instanceof Date) || Number.isNaN(fromKey.getTime())) return null;
  const { hour, minute } = parseTimeLabelParts(appointment?.time, 9, 0);
  fromKey.setHours(hour, minute, 0, 0);
  return fromKey;
};

const resolveAppointmentConfirmationStatus = (appointment) => {
  const status = appointment?.confirmationStatus;
  if (status === 'confirmed' || status === 'canceled' || status === 'sent') return status;
  if (appointment?.confirmationSentAt) return 'sent';
  return 'pending';
};

const taskSorter = (left, right) => {
  const leftPriority = TASK_PRIORITY[left.type] ?? 999;
  const rightPriority = TASK_PRIORITY[right.type] ?? 999;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;

  const leftRisk = RISK_ORDER[left?.riskLevel] ?? -1;
  const rightRisk = RISK_ORDER[right?.riskLevel] ?? -1;
  if (leftRisk !== rightRisk) return rightRisk - leftRisk;

  const leftDate = left?.date instanceof Date ? left.date.getTime() : Number.MAX_SAFE_INTEGER;
  const rightDate = right?.date instanceof Date ? right.date.getTime() : Number.MAX_SAFE_INTEGER;
  if (leftDate !== rightDate) return leftDate - rightDate;

  const leftTitle = String(left?.title || '');
  const rightTitle = String(right?.title || '');
  const byTitle = leftTitle.localeCompare(rightTitle);
  if (byTitle !== 0) return byTitle;

  return String(left?.id || '').localeCompare(String(right?.id || ''));
};

const buildDoneTask = (today) => ({
  id: `done-${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`,
  type: 'DONE',
  title: 'Tudo resolvido por hoje',
  subtitle: 'Sem pendências imediatas. Ótimo trabalho.',
  actionLabel: 'Abrir agenda',
  date: today,
  payload: null,
});

export const getDailyTasks = ({ receivables = [], appointments = [], today = new Date() } = {}) => {
  const referenceDate = today instanceof Date && !Number.isNaN(today.getTime()) ? new Date(today) : new Date();
  const todayStart = toStartOfDay(referenceDate);
  const todayEnd = toEndOfDay(referenceDate);

  const tasks = [];
  const receivableList = Array.isArray(receivables) ? receivables : [];
  const clientHistoryMap = receivableList.reduce((acc, item) => {
    const key = item?.clientId || item?.receivable?.clientId || item?.name || item?.clientName || item?.id;
    if (!key) return acc;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key).push(item?.receivable || item);
    return acc;
  }, new Map());

  const riskByClient = new Map();
  clientHistoryMap.forEach((history, key) => {
    riskByClient.set(key, getClientRiskLevel(history));
  });

  receivableList.forEach((item, index) => {
    const dueDate = resolveReceivableDate(item);
    if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime())) return;
    if (item?.paid === true) return;

    const status = receivableToPillStatus(item, todayEnd);
    if (status === 'PAID') return;

    const dueMs = dueDate.getTime();
    const title = item?.name || item?.clientName || 'Cobrança';
    const amount = Number(item?.amount ?? item?.value ?? 0);
    const clientRiskKey = item?.clientId || item?.receivable?.clientId || item?.name || item?.clientName || item?.id;
    const riskLevel = item?.riskLevel || riskByClient.get(clientRiskKey) || 'LOW';

    if (dueMs < todayStart.getTime()) {
      tasks.push({
        id: `overdue-charge-${item?.id || item?.clientId || index}`,
        type: 'OVERDUE_CHARGE',
        title: `Cobrar ${title}`,
        subtitle: `Atrasada desde ${dueDate.toLocaleDateString('pt-BR')}`,
        actionLabel: 'Cobrar agora',
        date: dueDate,
        amount: Number.isFinite(amount) ? amount : undefined,
        status,
        riskLevel,
        payload: item,
      });
      return;
    }

    if (dueMs >= todayStart.getTime() && dueMs <= todayEnd.getTime()) {
      tasks.push({
        id: `today-charge-${item?.id || item?.clientId || index}`,
        type: 'TODAY_CHARGE',
        title: `Cobrar ${title}`,
        subtitle: 'Cobrança com vencimento hoje',
        actionLabel: 'Cobrar',
        date: dueDate,
        amount: Number.isFinite(amount) ? amount : undefined,
        status,
        riskLevel,
        payload: item,
      });
    }
  });

  (Array.isArray(appointments) ? appointments : []).forEach((item, index) => {
    const startAt = resolveAppointmentDate(item);
    if (!(startAt instanceof Date) || Number.isNaN(startAt.getTime())) return;

    const startOfItemDay = toStartOfDay(startAt).getTime();
    if (startOfItemDay !== todayStart.getTime()) return;
    if (item?.status === 'done' || item?.status === 'rescheduled') return;

    const pillStatus = appointmentToPillStatus(item);
    if (pillStatus === 'OVERDUE') return;

    const title = item?.name || 'Compromisso';
    const confirmationStatus = resolveAppointmentConfirmationStatus(item);
    const baseSubtitle =
      [item?.time, item?.location].filter(Boolean).join(' • ') || 'Compromisso de hoje';

    if (confirmationStatus === 'pending' || confirmationStatus === 'sent') {
      tasks.push({
        id: `confirm-appointment-${item?.appointmentKey || item?.id || `${item?.clientId || 'client'}-${index}`}`,
        type: 'CONFIRM_APPOINTMENT',
        title: `Confirmar ${title}`,
        subtitle: baseSubtitle,
        actionLabel: 'Confirmar',
        date: startAt,
        status: pillStatus,
        payload: item,
      });
      return;
    }

    tasks.push({
      id: `today-appointment-${item?.appointmentKey || item?.id || `${item?.clientId || 'client'}-${index}`}`,
      type: 'TODAY_APPOINTMENT',
      title: title,
      subtitle: baseSubtitle,
      actionLabel: 'Concluir',
      date: startAt,
      status: pillStatus,
      payload: item,
    });
  });

  const ordered = tasks.sort(taskSorter);
  if (ordered.length === 0) return [buildDoneTask(referenceDate)];
  return ordered;
};

export const getTasksProgress = (tasks = [], completedTasks = []) => {
  const taskList = Array.isArray(tasks) ? tasks : [];
  const activeTasks = taskList.filter((task) => task?.type !== 'DONE');

  if (activeTasks.length === 0) {
    return { done: 1, total: 1, percent: 100 };
  }

  const completedSet = new Set(
    (Array.isArray(completedTasks) ? completedTasks : [])
      .map((value) => {
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object') return value.id || '';
        return '';
      })
      .filter(Boolean)
  );

  const total = activeTasks.length;
  const done = activeTasks.reduce((sum, task) => (completedSet.has(task.id) ? sum + 1 : sum), 0);
  const ratio = total > 0 ? done / total : 1;
  const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)));

  return { done, total, percent };
};
