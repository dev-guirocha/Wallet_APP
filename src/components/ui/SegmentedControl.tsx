import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

type SegmentedOption = {
  key: string;
  label: string;
};

type SegmentedControlProps = {
  options: SegmentedOption[];
  value: string;
  onChange: (nextValue: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedControl({ options, value, onChange, style }: SegmentedControlProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
        },
        style,
      ]}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const isSelected = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            hitSlop={spacing.xs}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isSelected }}
            style={({ pressed }) => [
              {
                minHeight: 36,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs - 1,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: isSelected ? colors.info : colors.border,
                backgroundColor: isSelected ? 'rgba(29,78,216,0.12)' : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Text
              style={[
                typography.caption,
                { color: isSelected ? colors.info : colors.muted, fontWeight: '700' },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
