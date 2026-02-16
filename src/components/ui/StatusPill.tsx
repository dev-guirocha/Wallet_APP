import React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

export type StatusPillStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'SCHEDULED';

type StatusPillProps = {
  status: StatusPillStatus;
  label?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

const alpha = (hex: string, value: number) => {
  const safeHex = hex.replace('#', '');
  const fullHex =
    safeHex.length === 3
      ? safeHex
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : safeHex;

  const intValue = parseInt(fullHex, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;

  return `rgba(${r}, ${g}, ${b}, ${value})`;
};

const statusStyles: Record<
  StatusPillStatus,
  { text: string; border: string; background: string; defaultLabel: string }
> = {
  PAID: {
    text: colors.success,
    border: alpha(colors.success, 0.35),
    background: alpha(colors.success, 0.12),
    defaultLabel: 'Pago',
  },
  PENDING: {
    text: colors.warning,
    border: alpha(colors.warning, 0.35),
    background: alpha(colors.warning, 0.12),
    defaultLabel: 'Pendente',
  },
  OVERDUE: {
    text: colors.danger,
    border: alpha(colors.danger, 0.35),
    background: alpha(colors.danger, 0.12),
    defaultLabel: 'Atrasado',
  },
  SCHEDULED: {
    text: colors.info,
    border: alpha(colors.info, 0.35),
    background: alpha(colors.info, 0.12),
    defaultLabel: 'Agendado',
  },
};

export function StatusPill({ status, label, style, textStyle }: StatusPillProps) {
  const config = statusStyles[status];
  const pillLabel = label ?? config.defaultLabel;

  return (
    <View
      style={[
        {
          borderRadius: radius.pill,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xxs,
          borderWidth: 1,
          borderColor: config.border,
          backgroundColor: config.background,
          alignSelf: 'flex-start',
        },
        style,
      ]}
      accessibilityRole="text"
      accessibilityLabel={pillLabel}
    >
      <Text style={[typography.caption, { color: config.text, fontWeight: '600' }, textStyle]}>
        {pillLabel}
      </Text>
    </View>
  );
}

