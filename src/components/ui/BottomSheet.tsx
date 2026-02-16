import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Modal, Pressable, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

const SHEET_TRANSLATE_START = 420;

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  style,
  contentStyle,
  testID,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(visible);
  const translateY = useRef(new Animated.Value(SHEET_TRANSLATE_START)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          stiffness: 220,
          mass: 0.85,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    if (!mounted) return;

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: SHEET_TRANSLATE_START,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
  }, [backdropOpacity, mounted, translateY, visible]);

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar painel"
          onPress={onClose}
          style={{ ...StyleSheetAbsoluteFill }}
        >
          <Animated.View
            style={{
              flex: 1,
              backgroundColor: '#000000',
              opacity: backdropOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.45],
              }),
            }}
          />
        </Pressable>

        <Animated.View
          accessibilityViewIsModal
          style={[
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.pill,
              borderTopRightRadius: radius.pill,
              borderWidth: 1,
              borderColor: colors.border,
              paddingTop: spacing.sm,
              paddingBottom: spacing.xl,
              paddingHorizontal: spacing.lg,
              transform: [{ translateY }],
            },
            style,
          ]}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: colors.border,
              marginBottom: spacing.sm,
            }}
          />

          {title ? (
            <Text
              accessibilityRole="header"
              style={[
                typography.subtitle,
                { color: colors.text, textAlign: 'center', marginBottom: spacing.md },
              ]}
            >
              {title}
            </Text>
          ) : null}

          <View style={contentStyle}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleSheetAbsoluteFill = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const;
