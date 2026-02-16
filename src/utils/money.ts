const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const safeMoneyNumber = (value: unknown, fallback = 0): number => {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return numericValue;
};

export const formatBRL = (value: unknown): string => {
  return BRL_FORMATTER.format(safeMoneyNumber(value, 0));
};

export const normalizeMoneyInput = (text: string): string => {
  if (!text) return '';

  return String(text)
    .replace(/[R$\s]/gi, '')
    .replace(/\./g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
};

export const parseMoneyInput = (text: string): number => {
  const normalized = normalizeMoneyInput(text);
  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

export const isValidMoneyInput = (text: string): boolean => {
  const normalized = normalizeMoneyInput(text);
  if (!normalized) return false;
  const parsed = Number(normalized);
  return Number.isFinite(parsed);
};

