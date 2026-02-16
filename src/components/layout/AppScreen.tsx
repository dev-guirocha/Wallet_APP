import React from 'react';
import type { ReactNode } from 'react';
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../../theme';

type AppScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
} & Pick<ScrollViewProps, 'keyboardShouldPersistTaps'>;

export function AppScreen({
  children,
  scroll = false,
  backgroundColor = colors.bg,
  style,
  contentContainerStyle,
  keyboardShouldPersistTaps = 'handled',
  testID,
}: AppScreenProps) {
  const baseSafeAreaStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
  };

  const baseViewStyle: ViewStyle = {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  };

  const baseScrollContentStyle: ViewStyle = {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  };

  return (
    <SafeAreaView style={[baseSafeAreaStyle, style]} testID={testID}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          style={{ flex: 1 }}
          contentContainerStyle={[baseScrollContentStyle, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[baseViewStyle, contentContainerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
