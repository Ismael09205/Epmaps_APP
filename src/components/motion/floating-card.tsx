import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';

const STAGGER_MS = 70;
const STACK_OVERLAP = 28;
const LAYER_OFFSET = Spacing.two;

// Tarjeta que entra flotando y se eleva al tocarla. Con `variant="stack"`, las tarjetas de una lista
// nacen superpuestas y se separan; con `layerColor`, deja ver una pila de tarjetas detrás.
export function FloatingCard({
  index = 0,
  variant = 'float',
  layerColor,
  className,
  children,
}: {
  index?: number;
  variant?: 'float' | 'stack';
  layerColor?: string;
  className?: string;
  children: ReactNode;
}) {
  const entrance = useSharedValue(0);
  const raised = useSharedValue(0);

  useEffect(() => {
    entrance.set(withDelay(index * STAGGER_MS, withSpring(1, { damping: 16, stiffness: 140 })));
  }, [entrance, index]);

  const overlap = variant === 'stack' ? -index * STACK_OVERLAP : Spacing.three;

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(entrance.get(), [0, 0.6], [0, 1], 'clamp'),
    transform: [
      { translateY: interpolate(entrance.get(), [0, 1], [overlap, 0]) - raised.get() * 3 },
      { scale: interpolate(entrance.get(), [0, 1], [0.96, 1]) + raised.get() * 0.012 },
    ],
  }));
  const firstLayerStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * entrance.get(),
    transform: [{ translateY: entrance.get() * LAYER_OFFSET }],
  }));
  const secondLayerStyle = useAnimatedStyle(() => ({
    opacity: 0.28 * entrance.get(),
    transform: [{ translateY: entrance.get() * LAYER_OFFSET * 2 }],
  }));

  const setRaised = (isRaised: boolean) => {
    raised.set(withTiming(isRaised ? 1 : 0, { duration: 140 }));
  };

  return (
    <Animated.View
      onTouchStart={() => setRaised(true)}
      onTouchEnd={() => setRaised(false)}
      onTouchCancel={() => setRaised(false)}
      className="rounded-md" style={[styles.card, { zIndex: 100 - index }, layerColor !== undefined && styles.withLayers, cardStyle]}>
      {layerColor !== undefined && (
        <View pointerEvents="none" className="absolute inset-0">
          <Animated.View
            className="absolute top-6 bottom-0 rounded-lg left-4 right-4" style={[{ backgroundColor: layerColor }, secondLayerStyle]}
          />
          <Animated.View
            className="absolute top-6 bottom-0 rounded-lg left-2 right-2" style={[{ backgroundColor: layerColor }, firstLayerStyle]}
          />
        </View>
      )}
      <View className={className}>{children}</View>
    </Animated.View>
  );
}

const styles = {
  card: { elevation: 3, shadowColor: '#0E1430', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.14, shadowRadius: 6 },
  withLayers: { elevation: 0, shadowOpacity: 0, marginBottom: LAYER_OFFSET * 2 },
} as const;
