import { useEffect, useRef, useState } from 'react';
import { Check, type LucideIcon } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  type GestureResponderEvent,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SuccessKeyframe } from '@/components/motion/success-keyframe';
import { ThemedText } from '@/components/themed-text';
import { ChromeFontScale } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonStatus = 'idle' | 'busy' | 'success';

const SUCCESS_VISIBLE_MS = 1400;

// Indica el éxito de una acción durante un momento y luego devuelve el botón a su estado normal.
export function useSuccessFlash(): [boolean, () => void] {
  const [isSuccess, setIsSuccess] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = () => {
    clearTimeout(timer.current);
    setIsSuccess(true);
    timer.current = setTimeout(() => setIsSuccess(false), SUCCESS_VISIBLE_MS);
  };

  return [isSuccess, flash];
}

// Botón de un solo color: se hunde al presionarlo, late mientras carga y pasa al color de éxito con
// un visto.
export function AnimatedButton({
  label,
  busyLabel,
  successLabel,
  icon: Icon,
  variant = 'primary',
  status = 'idle',
  disabled = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  className,
}: {
  label: string;
  busyLabel?: string;
  successLabel?: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary';
  status?: ButtonStatus;
  disabled?: boolean;
  onPress: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  className?: string;
}) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const isInactive = disabled || status !== 'idle';

  const press = useSharedValue(0);
  const successProgress = useSharedValue(status === 'success' ? 1 : 0);
  const busyPulse = useSharedValue(1);

  const faceColor = isPrimary ? theme.accent : theme.infoBackground;
  const successColor = theme.successForeground;
  const contentColor = status === 'success' || isPrimary ? theme.onAccent : theme.infoForeground;

  useEffect(() => {
    successProgress.set(withTiming(status === 'success' ? 1 : 0, { duration: 220 }));

    if (status === 'busy') {
      busyPulse.set(
        withRepeat(
          withSequence(
            withTiming(0.72, { duration: 480, easing: Easing.inOut(Easing.quad) }),
            withTiming(1, { duration: 480, easing: Easing.inOut(Easing.quad) }),
          ),
          -1,
        ),
      );
    } else {
      cancelAnimation(busyPulse);
      busyPulse.set(withTiming(1, { duration: 120 }));
    }
  }, [status, successProgress, busyPulse]);

  const faceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(successProgress.get(), [0, 1], [faceColor, successColor]),
    opacity: busyPulse.get(),
    transform: [{ translateY: press.get() * 2 }, { scale: 1 - press.get() * 0.025 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => press.set(withTiming(1, { duration: 80 }))}
      onPressOut={() => press.set(withSpring(0, { damping: 11, stiffness: 320 }))}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: status === 'busy' }}
      className={`${disabled ? 'opacity-50' : ''} ${className ?? ''}`}>
      <Animated.View className="min-h-[54px] flex-row gap-2 rounded-sm items-center justify-center px-6 py-2" style={faceStyle}>
        {status === 'busy' ? (
          <ActivityIndicator color={contentColor} size="small" />
        ) : status === 'success' ? (
          <Animated.View entering={SuccessKeyframe}>
            <Check color={contentColor} size={20} strokeWidth={3} />
          </Animated.View>
        ) : (
          Icon && <Icon color={contentColor} size={20} />
        )}
        <ThemedText
          type="smallBold"
          maxFontSizeMultiplier={ChromeFontScale}
          className="text-[16px] text-center shrink" style={{ color: contentColor }}>
          {status === 'busy'
            ? (busyLabel ?? label)
            : status === 'success'
              ? (successLabel ?? label)
              : label}
        </ThemedText>
      </Animated.View>
    </Pressable>
  );
}


