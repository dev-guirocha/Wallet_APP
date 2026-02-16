import React from 'react';
import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import { colors, radius, shadows, spacing } from '../../theme';

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}>;

export function Card({ children, style, contentStyle }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadows.sm,
        },
        style,
      ]}
    >
      <View style={[{ padding: spacing.md }, contentStyle]}>{children}</View>
    </View>
  );
}

