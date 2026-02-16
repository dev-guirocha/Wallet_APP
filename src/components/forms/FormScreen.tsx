import React from 'react';
import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';

import { colors, spacing } from '../../theme';
import { ScreenHeader } from '../layout/ScreenHeader';
import { AppScreen } from '../layout/AppScreen';
import { Button } from '../ui/Button';

type FormScreenProps = PropsWithChildren<{
  title: string;
  onSubmit: () => void;
  submitLabel: string;
  loading?: boolean;
  disabled?: boolean;
  submitDisabled?: boolean;
  navigation?: {
    goBack?: () => void;
    canGoBack?: () => boolean;
  } | null;
  onBackPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  ctaContainerStyle?: StyleProp<ViewStyle>;
}>;

export function FormScreen({
  title,
  onSubmit,
  submitLabel,
  loading = false,
  disabled = false,
  submitDisabled = false,
  navigation,
  onBackPress,
  style,
  contentContainerStyle,
  ctaContainerStyle,
  children,
}: FormScreenProps) {
  const isSubmitDisabled = loading || disabled || submitDisabled;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
    >
      <AppScreen
        scroll
        style={[styles.screen, style]}
        contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
      >
        <ScreenHeader
          title={title}
          navigation={navigation}
          onBackPress={onBackPress}
        />

        {children}
      </AppScreen>

      <View
        style={[
          styles.ctaContainer,
          ctaContainerStyle,
        ]}
      >
        <Button
          label={submitLabel}
          loading={loading}
          disabled={isSubmitDisabled}
          onPress={onSubmit}
          accessibilityLabel={submitLabel}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing.xxl * 2,
  },
  ctaContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
