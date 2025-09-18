import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export function PrimaryButton({ title, onPress, disabled, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles.primary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.primaryText}>{title}</Text>
    </Pressable>
  );
}

export function OutlineButton({ title, onPress, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.base, styles.outline, pressed && styles.pressed, style]}
    >
      <Text style={styles.outlineText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#2563eb',
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  outline: {
    borderWidth: 1,
    borderColor: '#2563eb',
    backgroundColor: 'transparent',
  },
  outlineText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.75,
  },
});
