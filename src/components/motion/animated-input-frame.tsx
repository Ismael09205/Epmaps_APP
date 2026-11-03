import { useEffect, useRef, type ReactNode } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, {
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type InputState = 'idle' | 'focused' | 'valid' | 'error';

const STATE_POSITION: Record<InputState, number> = { idle: 0, focused: 1, valid: 2, error: 3 };
const SHAKE_DISTANCE = 6;

// Un error o un dato válido se muestran aunque el campo tenga el foco: indican lo que falta corregir.
export function resolveInputState({
  isFocused,
  isInvalid,
  isValid,
}: {
  isFocused: boolean;
  isInvalid: boolean;
  isValid: boolean;
}): InputState {
  if (isInvalid) {
    return 'error';
  }
  if (isValid) {
    return 'valid';
  }
  return isFocused ? 'focused' : 'idle';
}

// Marco común de los campos: anima el color según la validación, muestra un halo mientras el campo
// está activo y se sacude al pasar a error. No cambia de tamaño para no mover el formulario.
export function AnimatedInputFrame({
  state,
  palette,
  showStatusIcon = true,
  className,
  children,
}: {
  state: InputState;
  palette?: (typeof Colors)['light' | 'dark'];
  showStatusIcon?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const colors = palette ?? theme;
  const idleColor = colors.inputBorder;
  const focusedColor = colors.accent;
  const validColor = colors.successForeground;
  const errorColor = colors.errorForeground;

  const position = useSharedValue(STATE_POSITION[state]);
  const ring = useSharedValue(state === 'idle' ? 0 : 1);
  const shake = useSharedValue(0);
  const previousState = useRef(state);

  useEffect(() => {
    position.set(withTiming(STATE_POSITION[state], { duration: 180 }));
    ring.set(withTiming(state === 'idle' ? 0 : 1, { duration: 180 }));

    if (state === 'error' && previousState.current !== 'error') {
      shake.set(
        withSequence(
          withTiming(-SHAKE_DISTANCE, { duration: 45 }),
          withTiming(SHAKE_DISTANCE, { duration: 70 }),
          withTiming(-SHAKE_DISTANCE / 2, { duration: 60 }),
          withTiming(0, { duration: 45 }),
        ),
      );
    }
    previousState.current = state;
  }, [state, position, ring, shake]);

  const frameStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      position.get(),
      [0, 1, 2, 3],
      [idleColor, focusedColor, validColor, errorColor],
    ),
    transform: [{ translateX: shake.get() }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.get() * 0.25,
    borderColor: interpolateColor(
      position.get(),
      [0, 1, 2, 3],
      [idleColor, focusedColor, validColor, errorColor],
    ),
  }));

  return (
    <Animated.View
      className={`border-[1.5px] rounded-sm ${className ?? ''}`}
      style={[{ backgroundColor: colors.background }, frameStyle]}>
      <Animated.View pointerEvents="none" className="absolute top-[-4px] left-[-4px] right-[-4px] bottom-[-4px] border-[3px] rounded-md" style={ringStyle} />
      {children}
      {showStatusIcon && (
        <View className="w-[20px] items-center justify-center" pointerEvents="none">
          {state === 'valid' && (
            <Animated.View entering={ZoomIn.duration(200)} exiting={FadeOut.duration(100)}>
              <CircleCheck color={validColor} size={20} />
            </Animated.View>
          )}
          {state === 'error' && (
            <Animated.View entering={ZoomIn.duration(200)} exiting={FadeOut.duration(100)}>
              <CircleAlert color={errorColor} size={20} />
            </Animated.View>
          )}
        </View>
      )}
    </Animated.View>
  );
}


