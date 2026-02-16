import React from 'react';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Pressable, Text } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';

import { colors, radius, shadows, spacing, typography } from '../../theme';

type FabProps = Omit<ComponentProps<typeof Pressable>, 'children' | 'style'> & {
  label?: string;
  iconName?: ComponentProps<typeof Icon>['name'];
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function Fab({
  label,
  iconName = 'plus',
  accessibilityLabel,
  style,
  labelStyle,
  ...rest
}: FabProps) {
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Abrir ações rápidas'}
      hitSlop={spacing.sm}
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: spacing.xl,
          bottom: spacing.xxl,
          minHeight: 56,
          minWidth: 56,
          borderRadius: radius.pill,
          backgroundColor: colors.info,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          paddingHorizontal: spacing.md,
          gap: spacing.xs,
          opacity: pressed ? 0.92 : 1,
          ...shadows.md,
        },
        style,
      ]}
    >
      <Icon name={iconName} size={22} color={colors.surface} />
      {label ? (
        <Text style={[typography.body, { color: colors.surface, fontWeight: '700' }, labelStyle]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
