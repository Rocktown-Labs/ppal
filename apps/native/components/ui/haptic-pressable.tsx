import * as Haptics from "expo-haptics";
import React, { useCallback, useRef } from "react";
import type { PressableProps, StyleProp, ViewStyle } from "react-native";
import { Animated, Pressable } from "react-native";

export interface HapticPressableProps extends PressableProps {
  activeScale?: number;
  children: React.ReactNode;
  className?: string;
  hapticStyle?: Haptics.ImpactFeedbackStyle | "none";
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function HapticPressable({
  activeScale = 0.97,
  children,
  disabled,
  hapticStyle = Haptics.ImpactFeedbackStyle.Light,
  onPress,
  onPressIn,
  onPressOut,
  style,
  ...props
}: HapticPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(
    (event: any) => {
      if (disabled) return;
      if (hapticStyle !== "none") {
        Haptics.impactAsync(hapticStyle).catch(() => {});
      }
      Animated.timing(scaleAnim, {
        duration: 120,
        toValue: activeScale,
        useNativeDriver: true,
      }).start();
      onPressIn?.(event);
    },
    [activeScale, disabled, hapticStyle, onPressIn, scaleAnim]
  );

  const handlePressOut = useCallback(
    (event: any) => {
      Animated.timing(scaleAnim, {
        duration: 150,
        toValue: 1,
        useNativeDriver: true,
      }).start();
      onPressOut?.(event);
    },
    [onPressOut, scaleAnim]
  );

  return (
    <AnimatedPressable
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[{ transform: [{ scale: scaleAnim }] }, style]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
