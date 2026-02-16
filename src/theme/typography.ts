import type { TextStyle } from 'react-native';

type TypographyStyle = Readonly<TextStyle>;

export const typography = {
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
} as const satisfies Record<'title' | 'subtitle' | 'body' | 'caption', TypographyStyle>;

export const moneyTypography = {
  lg: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  md: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sm: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<'lg' | 'md' | 'sm', TypographyStyle>;

export type TypographyToken = keyof typeof typography;
export type MoneyTypographyToken = keyof typeof moneyTypography;
