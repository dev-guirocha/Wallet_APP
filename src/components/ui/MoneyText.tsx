import React from 'react';
import type { ComponentProps } from 'react';
import { Text } from 'react-native';

import { colors, moneyTypography } from '../../theme';
import { formatBRL, safeMoneyNumber } from '../../utils/money';

type MoneyVariant = 'lg' | 'md' | 'sm';
type MoneyTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

type MoneyTextProps = Omit<ComponentProps<typeof Text>, 'children'> & {
  value: unknown;
  variant?: MoneyVariant;
  tone?: MoneyTone;
};

const toneToColor: Record<MoneyTone, string> = {
  neutral: colors.text,
  success: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  info: colors.info,
};

export function MoneyText({
  value,
  variant = 'md',
  tone = 'neutral',
  style,
  accessibilityLabel,
  ...rest
}: MoneyTextProps) {
  const numericValue = safeMoneyNumber(value, 0);
  const formattedValue = formatBRL(numericValue);

  return (
    <Text
      {...rest}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? formattedValue}
      style={[moneyTypography[variant], { color: toneToColor[tone] }, style]}
    >
      {formattedValue}
    </Text>
  );
}
