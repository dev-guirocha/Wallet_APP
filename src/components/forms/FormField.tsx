import React from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme';

type FormFieldProps = {
  label: string;
  children: ReactNode;
  helper?: string;
  error?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

const cloneField = (node: ReactNode, label: string) => {
  if (!React.isValidElement(node)) return node;
  const element = node as ReactElement<{ accessibilityLabel?: string }>;
  return React.cloneElement(element, {
    accessibilityLabel: element.props.accessibilityLabel ?? label,
  });
};

export function FormField({
  label,
  children,
  helper,
  error,
  style,
  labelStyle,
}: FormFieldProps) {
  const message = error || helper;
  const hasError = Boolean(error);

  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      <Text
        accessibilityRole="text"
        style={[
          typography.caption,
          {
            color: hasError ? colors.danger : colors.muted,
            marginBottom: spacing.xs,
          },
          labelStyle,
        ]}
      >
        {label}
      </Text>

      {cloneField(children, label)}

      {message ? (
        <Text
          accessibilityRole="text"
          accessibilityLiveRegion={hasError ? 'polite' : 'none'}
          style={[
            typography.caption,
            {
              marginTop: spacing.xs,
              color: hasError ? colors.danger : colors.muted,
            },
          ]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
