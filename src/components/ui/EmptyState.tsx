import React from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme';
import { Button } from './Button';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  message: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  messageStyle?: StyleProp<TextStyle>;
};

export function EmptyState({
  icon,
  title,
  message,
  ctaLabel,
  onCtaPress,
  style,
  titleStyle,
  messageStyle,
}: EmptyStateProps) {
  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: spacing.xl,
          paddingHorizontal: spacing.lg,
          gap: spacing.sm,
        },
        style,
      ]}
      accessibilityRole="summary"
      accessibilityLabel={title}
    >
      {icon ? <View pointerEvents="none">{icon}</View> : null}

      <Text style={[typography.subtitle, { color: colors.text, textAlign: 'center' }, titleStyle]}>
        {title}
      </Text>

      <Text style={[typography.body, { color: colors.muted, textAlign: 'center' }, messageStyle]}>
        {message}
      </Text>

      {ctaLabel && onCtaPress ? (
        <View style={{ marginTop: spacing.sm, minWidth: 180 }}>
          <Button label={ctaLabel} onPress={onCtaPress} />
        </View>
      ) : null}
    </View>
  );
}

