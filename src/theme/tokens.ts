import { colors } from './colors';
import { radius, radiusScale } from './radius';
import { shadows } from './shadows';
import { spacing, spacingScale } from './spacing';
import { moneyTypography, typography } from './typography';

export const tokens = {
  colors,
  spacing,
  spacingScale,
  radius,
  radiusScale,
  typography,
  moneyTypography,
  shadows,
} as const;

export type ThemeTokens = typeof tokens;
