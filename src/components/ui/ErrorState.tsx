import React from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Text, View } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';

import { colors, spacing, typography } from '../../theme';
import { Button } from './Button';

type ErrorStateProps = {
  title: string;
  message: string;
  onRetry?: () => void;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ErrorState({ title, message, onRetry, icon, style }: ErrorStateProps) {
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
      <View pointerEvents="none">
        {icon ?? <Icon name="alert-circle" size={30} color={colors.danger} />}
      </View>

      <Text style={[typography.subtitle, { color: colors.text, textAlign: 'center' }]}>{title}</Text>

      <Text style={[typography.body, { color: colors.muted, textAlign: 'center' }]}>{message}</Text>

      {onRetry ? (
        <View style={{ minWidth: 180, marginTop: spacing.xs }}>
          <Button label="Tentar novamente" onPress={onRetry} accessibilityLabel="Tentar novamente" />
        </View>
      ) : null}
    </View>
  );
}
