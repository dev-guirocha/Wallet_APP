import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

type SnackbarUndoProps = {
  visible: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
  style?: StyleProp<ViewStyle>;
};

export function SnackbarUndo({
  visible,
  message,
  onUndo,
  onDismiss,
  durationMs = 5000,
  style,
}: SnackbarUndoProps) {
  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, message, onDismiss, visible]);

  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          left: spacing.lg,
          right: spacing.lg,
          bottom: spacing.xl,
        },
        style,
      ]}
    >
      <View
        style={{
          backgroundColor: '#1F2937',
          borderRadius: radius.lg,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderWidth: 1,
          borderColor: '#374151',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
        }}
      >
        <Text style={[typography.caption, { color: colors.surface, flex: 1 }]} numberOfLines={2}>
          {message}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Desfazer última ação"
          onPress={onUndo}
          style={({ pressed }) => ({
            paddingVertical: spacing.xs,
            paddingHorizontal: spacing.sm,
            borderRadius: radius.md,
            backgroundColor: pressed ? '#4B5563' : '#374151',
          })}
        >
          <Text style={[typography.caption, { color: '#F9FAFB', fontWeight: '700' }]}>Desfazer</Text>
        </Pressable>
      </View>
    </View>
  );
}
