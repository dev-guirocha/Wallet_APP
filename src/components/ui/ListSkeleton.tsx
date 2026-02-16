import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import { colors, radius, spacing } from '../../theme';
import { LoadingSkeleton } from './LoadingSkeleton';

type ListSkeletonVariant = 'list' | 'card';

type ListSkeletonProps = {
  count?: number;
  itemHeight?: number;
  variant?: ListSkeletonVariant;
  style?: StyleProp<ViewStyle>;
};

export function ListSkeleton({
  count = 3,
  itemHeight = 72,
  variant = 'list',
  style,
}: ListSkeletonProps) {
  const safeCount = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 3;

  return (
    <View style={[{ gap: spacing.sm }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: safeCount }).map((_, index) => {
        if (variant === 'card') {
          return (
            <View
              key={`list-skeleton-card-${index}`}
              style={{
                minHeight: itemHeight,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: spacing.md,
                gap: spacing.xs,
              }}
            >
              <LoadingSkeleton width="38%" height={14} />
              <LoadingSkeleton width="72%" height={16} />
              <LoadingSkeleton width="55%" height={12} />
            </View>
          );
        }

        return (
          <View
            key={`list-skeleton-row-${index}`}
            style={{
              minHeight: itemHeight,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <LoadingSkeleton width={40} height={40} rounded="pill" />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <LoadingSkeleton width="48%" height={14} />
              <LoadingSkeleton width="78%" height={12} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
