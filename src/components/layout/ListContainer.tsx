import React from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../theme';
import { EmptyState } from '../ui/EmptyState';
import { ErrorState } from '../ui/ErrorState';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';

type ListContainerProps = {
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  skeletonCount?: number;
  isEmpty?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function ListContainer({
  loading = false,
  error = '',
  onRetry,
  emptyTitle = '',
  emptyMessage = '',
  emptyIcon,
  emptyActionLabel,
  onEmptyAction,
  skeletonCount = 3,
  isEmpty = false,
  style,
  children,
}: ListContainerProps) {
  const safeSkeletonCount = Number.isFinite(skeletonCount)
    ? Math.max(1, Math.floor(skeletonCount))
    : 3;

  if (loading) {
    return (
      <View style={[styles.root, style]}>
        <View style={styles.skeletonList}>
          {Array.from({ length: safeSkeletonCount }).map((_, index) => (
            <View key={`list-container-skeleton-${index}`} style={styles.skeletonCard}>
              <LoadingSkeleton width="45%" height={16} style={styles.skeletonSpacing} />
              <LoadingSkeleton width="62%" height={14} style={styles.skeletonSpacing} />
              <LoadingSkeleton width="34%" height={22} style={styles.skeletonSpacing} />
              <LoadingSkeleton width="100%" height={38} rounded="sm" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, style]}>
        <ErrorState
          title="Falha ao carregar"
          message={error}
          onRetry={onRetry}
        />
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={[styles.root, style]}>
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          message={emptyMessage}
          ctaLabel={emptyActionLabel}
          onCtaPress={onEmptyAction}
        />
      </View>
    );
  }

  return <View style={[styles.root, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: spacing.xl,
  },
  skeletonList: {
    gap: spacing.sm,
  },
  skeletonCard: {
    marginBottom: 0,
  },
  skeletonSpacing: {
    marginBottom: 10,
  },
});
