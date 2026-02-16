import React from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import { Feather as Icon } from '@expo/vector-icons';

import { colors, spacing, typography } from '../../theme';
import { IconButton } from '../ui/IconButton';

type NavigationLike = {
  goBack?: () => void;
  canGoBack?: () => boolean;
};

type ScreenHeaderProps = {
  title: string;
  navigation?: NavigationLike | null;
  onBackPress?: () => void;
  backLabel?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  actionDisabled?: boolean;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
};

export function ScreenHeader({
  title,
  navigation,
  onBackPress,
  backLabel = 'Voltar',
  actionLabel,
  onActionPress,
  actionDisabled = false,
  style,
  titleStyle,
}: ScreenHeaderProps) {
  const hasGoBack = typeof navigation?.goBack === 'function';
  const canGoBack =
    typeof navigation?.canGoBack === 'function' ? navigation.canGoBack() : hasGoBack;

  const showBackButton = Boolean(onBackPress) || (hasGoBack && canGoBack);

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    navigation?.goBack?.();
  };

  const showAction = Boolean(actionLabel && onActionPress);

  return (
    <View
      style={[
        {
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          marginBottom: spacing.sm,
        },
        style,
      ]}
    >
      <View style={{ width: 40, alignItems: 'flex-start' }}>
        {showBackButton ? (
          <IconButton
            icon={<Icon name="chevron-left" size={20} color={colors.neutral} />}
            accessibilityLabel={backLabel}
            onPress={handleBackPress}
            size={36}
          />
        ) : null}
      </View>

      <Text
        style={[typography.subtitle, { color: colors.text, flex: 1, textAlign: 'center' }, titleStyle]}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>

      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>
        {showAction ? (
          <Pressable
            onPress={onActionPress}
            disabled={actionDisabled}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityState={{ disabled: actionDisabled }}
            hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.sm, right: spacing.sm }}
          >
            <Text
              style={[
                typography.caption,
                { color: actionDisabled ? colors.muted : colors.info, fontWeight: '600' },
              ]}
            >
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
