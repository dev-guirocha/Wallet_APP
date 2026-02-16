import React from 'react';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

type ButtonVariant = 'primary' | 'secondary';

type ButtonProps = Omit<ComponentProps<typeof Pressable>, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  onPress,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';

  const backgroundColor = isPrimary ? colors.info : colors.surface;
  const textColor = isPrimary ? colors.surface : colors.info;
  const borderColor = isPrimary ? colors.info : colors.border;

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={spacing.xs}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        {
          minHeight: 48,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1,
          flexDirection: 'row',
          gap: spacing.xs,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} size="small" /> : null}
      <Text style={[typography.body, { color: textColor, fontWeight: '600' }, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

