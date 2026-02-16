import React from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Pressable, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme';

type SectionHeaderProps = {
  title: string;
  action?: ReactNode;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
};

export function SectionHeader({
  title,
  action,
  actionLabel,
  onActionPress,
  style,
  titleStyle,
}: SectionHeaderProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      <Text style={[typography.subtitle, { color: colors.text }, titleStyle]}>{title}</Text>

      {action ? action : null}

      {!action && actionLabel && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={spacing.xs}
        >
          <Text style={[typography.caption, { color: colors.info, fontWeight: '600' }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

