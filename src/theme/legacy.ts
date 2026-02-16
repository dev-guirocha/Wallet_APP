import type { TextStyle, ViewStyle } from 'react-native';

import { colors, shadows, typography } from './index';

const SYSTEM_FONT = 'System' as const;

export const COLORS = {
  background: colors.bg,
  surface: colors.surface,
  textPrimary: colors.text,
  textSecondary: colors.muted,
  textOnPrimary: colors.surface,
  primary: colors.info,
  info: colors.info,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  border: colors.border,
  neutral: colors.neutral,
} as const;

export const SHADOWS = {
  small: {
    ...shadows.sm,
    shadowColor: '#000',
  },
  medium: {
    ...shadows.md,
    shadowColor: '#000',
  },
} as const satisfies Record<'small' | 'medium', Readonly<ViewStyle>>;

export const TYPOGRAPHY = {
  hero: {
    ...typography.title,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: SYSTEM_FONT,
  },
  display: {
    ...typography.title,
    fontSize: 30,
    lineHeight: 36,
    fontFamily: SYSTEM_FONT,
  },
  title: {
    ...typography.title,
    fontFamily: SYSTEM_FONT,
  },
  subtitle: {
    ...typography.subtitle,
    fontFamily: SYSTEM_FONT,
  },
  body: {
    ...typography.body,
    fontSize: 17,
    lineHeight: 25,
    fontFamily: SYSTEM_FONT,
  },
  bodyMedium: {
    ...typography.body,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '600',
    fontFamily: SYSTEM_FONT,
  },
  caption: {
    ...typography.caption,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: SYSTEM_FONT,
  },
  button: {
    ...typography.subtitle,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: SYSTEM_FONT,
  },
  buttonSmall: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: SYSTEM_FONT,
  },
  overline: {
    ...typography.caption,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: SYSTEM_FONT,
  },
} as const satisfies Record<
  | 'hero'
  | 'display'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bodyMedium'
  | 'caption'
  | 'button'
  | 'buttonSmall'
  | 'overline',
  Readonly<TextStyle>
>;
