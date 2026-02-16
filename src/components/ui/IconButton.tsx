import React from 'react';
import type { ReactNode } from 'react';
import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, View } from 'react-native';

import { colors, radius, spacing } from '../../theme';

type IconButtonTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info';

type IconButtonProps = Omit<ComponentProps<typeof Pressable>, 'style' | 'children'> & {
  icon: ReactNode;
  accessibilityLabel: string;
  size?: number;
  tone?: IconButtonTone;
  style?: StyleProp<ViewStyle>;
};

const toneToColor: Record<IconButtonTone, string> = {
  neutral: colors.neutral,
  success: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  info: colors.info,
};

export function IconButton({
  icon,
  accessibilityLabel,
  size = 40,
  tone = 'neutral',
  disabled = false,
  style,
  onPress,
  ...rest
}: IconButtonProps) {
  const color = toneToColor[tone];

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      disabled={disabled}
      hitSlop={spacing.xs}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: color,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View pointerEvents="none">{icon}</View>
    </Pressable>
  );
}

