import React, { useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme';

export function SwipeCarousel({
  slides = [],
  hint = 'Arraste para ver mais',
  style,
  slideStyle,
  onIndexChange,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const scrollRef = useRef(null);
  const slideHeightsRef = useRef({});
  const heightAnim = useRef(new Animated.Value(1)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const safeSlides = useMemo(
    () => (Array.isArray(slides) ? slides.filter((slide) => slide?.content) : []),
    [slides]
  );

  const pageWidth = containerWidth > 0 ? containerWidth : Math.max(280, windowWidth - spacing.xl * 2);

  const animateToHeight = (nextHeight, immediate = false) => {
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
    if (immediate) {
      heightAnim.setValue(nextHeight);
      return;
    }
    Animated.timing(heightAnim, {
      toValue: nextHeight,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const syncActiveHeight = (index, immediate = false) => {
    const measuredHeight = slideHeightsRef.current[index];
    if (!Number.isFinite(measuredHeight) || measuredHeight <= 0) return;
    animateToHeight(measuredHeight, immediate);
  };

  if (safeSlides.length === 0) return null;

  const handleMomentumEnd = (event) => {
    const offsetX = Number(event?.nativeEvent?.contentOffset?.x || 0);
    const nextIndex = Math.max(0, Math.min(safeSlides.length - 1, Math.round(offsetX / pageWidth)));
    if (nextIndex === activeIndex) return;
    setActiveIndex(nextIndex);
    syncActiveHeight(nextIndex);
    onIndexChange?.(nextIndex);
  };

  const handleSlideLayout = (index, event) => {
    const nextHeight = Number(event?.nativeEvent?.layout?.height || 0);
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
    const previousHeight = slideHeightsRef.current[index] || 0;
    if (Math.abs(previousHeight - nextHeight) < 1) return;
    slideHeightsRef.current[index] = nextHeight;
    if (index === activeIndex) {
      animateToHeight(nextHeight, previousHeight === 0);
    }
  };

  return (
    <View
      style={[styles.container, style]}
      onLayout={(event) => setContainerWidth(event?.nativeEvent?.layout?.width || 0)}
    >
      <Animated.View style={[styles.viewport, { height: heightAnim }]}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          decelerationRate="fast"
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
          contentContainerStyle={styles.scrollContent}
        >
          {safeSlides.map((slide, index) => (
            <View
              key={slide.key || String(slide.title)}
              style={[styles.slide, { width: pageWidth }, slideStyle]}
              onLayout={(event) => handleSlideLayout(index, event)}
            >
              {slide.content}
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      <View style={styles.footerRow}>
        <Text style={styles.hint}>{hint}</Text>
        <View style={styles.dots}>
          {safeSlides.map((slide, index) => {
            const isActive = index === activeIndex;
            return (
              <Pressable
                key={`dot-${slide.key || index}`}
                accessibilityRole="button"
                accessibilityLabel={`Ir para página ${index + 1}`}
                onPress={() => {
                  setActiveIndex(index);
                  syncActiveHeight(index);
                  onIndexChange?.(index);
                  scrollRef.current?.scrollTo?.({
                    x: index * pageWidth,
                    animated: true,
                  });
                }}
                style={[styles.dot, isActive && styles.dotActive]}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  scrollContent: {
    alignItems: 'flex-start',
  },
  viewport: {
    width: '100%',
    overflow: 'hidden',
  },
  slide: {
    paddingRight: 2,
  },
  footerRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hint: {
    ...typography.caption,
    color: colors.muted,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.info,
  },
});
