import { formatDateLabel, parseDateKeyToDate, toDate } from './dateUtils';
import { formatBRL } from './money';

const resolveDueDate = (receivable) => {
  const fromRaw = toDate(receivable?.dueDate || receivable?.date);
  if (fromRaw instanceof Date && !Number.isNaN(fromRaw.getTime())) return fromRaw;
  const fromKey = parseDateKeyToDate(receivable?.dueDateKey);
  if (fromKey instanceof Date && !Number.isNaN(fromKey.getTime())) return fromKey;
  return null;
};

const computeDaysLate = (receivable) => {
  const dueDate = resolveDueDate(receivable);
  if (!(dueDate instanceof Date)) return 0;

  const dueEnd = new Date(dueDate);
  dueEnd.setHours(23, 59, 59, 999);
  const diffMs = Date.now() - dueEnd.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 86400000);
};

export const getChargeMessage = (receivable, daysLateValue) => {
  const daysLate = Number.isFinite(Number(daysLateValue))
    ? Math.max(0, Math.floor(Number(daysLateValue)))
    : computeDaysLate(receivable);

  const name = receivable?.name || receivable?.clientName || 'cliente';
  const dueDate = resolveDueDate(receivable);
  const dueLabel = dueDate ? formatDateLabel(dueDate) : 'sem vencimento definido';
  const amount = Number(receivable?.amount ?? receivable?.value ?? 0);
  const amountLabel = Number.isFinite(amount) ? formatBRL(amount) : '';

  if (daysLate === 0) {
    return `Olá ${name}, passando para lembrar da cobrança de ${amountLabel} com vencimento em ${dueLabel}.`;
  }

  if (daysLate >= 1 && daysLate <= 3) {
    return `Olá ${name}, sua cobrança de ${amountLabel} venceu há ${daysLate} dia(s) (${dueLabel}). Pode me confirmar o pagamento?`;
  }

  if (daysLate >= 4 && daysLate <= 7) {
    return `Olá ${name}, ainda consta em aberto a cobrança de ${amountLabel}, vencida em ${dueLabel}. Podemos regularizar hoje?`;
  }

  return `Olá ${name}, a cobrança de ${amountLabel} está em atraso há ${daysLate} dias (vencimento ${dueLabel}). Preciso da sua confirmação para regularização imediata.`;
};

