export const colors = {
  bg: '#F6F7FB',
  surface: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  neutral: '#334155',
  success: '#15803D',
  danger: '#B91C1C',
  warning: '#B45309',
  info: '#1D4ED8',
} as const;

export type ColorToken = keyof typeof colors;
