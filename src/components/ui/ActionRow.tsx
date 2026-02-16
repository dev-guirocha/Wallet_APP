import React from 'react';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

type ActionVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

type ActionItem = {
  label: string;
  onPress: () => void;
  variant?: ActionVariant;
  disabled?: boolean;
  icon?: ReactNode;
  accessibilityLabel?: string;
};

type ActionRowProps = {
  actions: ActionItem[];
  compact?: boolean;
};

const resolveVariant = (variant: ActionVariant = 'secondary') => {
  if (variant === 'primary') return { bg: colors.info, text: colors.surface };
  if (variant === 'success') return { bg: colors.success, text: colors.surface };
  if (variant === 'warning') return { bg: colors.warning, text: colors.surface };
  if (variant === 'danger') return { bg: colors.danger, text: colors.surface };
  return { bg: colors.surface, text: colors.info };
};

export function ActionRow({ actions, compact = false }: ActionRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: spacing.sm,
        gap: spacing.xs,
      }}
    >
      {actions.map((action) => {
        const palette = resolveVariant(action.variant);
        const isDisabled = Boolean(action.disabled);
        return (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            disabled={isDisabled}
            hitSlop={spacing.xs}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel || action.label}
            accessibilityState={{ disabled: isDisabled }}
            style={({ pressed }) => [
              {
                minHeight: 40,
                minWidth: compact ? 84 : 98,
                flexGrow: compact ? 1 : 0,
                borderRadius: radius.md,
                borderWidth: action.variant === 'secondary' ? 1 : 0,
                borderColor: colors.border,
                backgroundColor: palette.bg,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: spacing.xs,
                paddingHorizontal: spacing.xs,
                paddingVertical: spacing.xs,
                opacity: isDisabled ? 0.45 : pressed ? 0.88 : 1,
              },
            ]}
          >
            {action.icon}
            <Text
              numberOfLines={1}
              style={[typography.caption, { color: palette.text, fontWeight: '700' }]}
            >
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
