import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import { colors, spacing } from '../../theme';

type DividerProps = {
  inset?: number;
  verticalSpacing?: number;
  thickness?: number;
  style?: StyleProp<ViewStyle>;
};

export function Divider({
  inset = 0,
  verticalSpacing = spacing.sm,
  thickness = 1,
  style,
}: DividerProps) {
  return (
    <View
      style={[
        {
          marginVertical: verticalSpacing,
          marginHorizontal: inset,
          height: thickness,
          backgroundColor: colors.border,
          width: 'auto',
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

