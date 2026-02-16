import React, { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated } from 'react-native';

import { colors, radius } from '../../theme';

type LoadingSkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  rounded?: keyof typeof radius;
  style?: StyleProp<ViewStyle>;
};

export function LoadingSkeleton({
  width = '100%',
  height = 16,
  rounded = 'md',
  style,
}: LoadingSkeletonProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius[rounded],
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

