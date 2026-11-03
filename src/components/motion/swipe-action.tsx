import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';

import { ThemedText } from '@/components/themed-text';
import { ChromeFontScale } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ACTION_DISTANCE = 96;
const MAX_DISTANCE = 140;

// Deslizar hacia la izquierda ejecuta la acción. Es un atajo: la tarjeta debe ofrecer también un
// botón visible, porque un gesto no se descubre a simple vista ni lo alcanza un lector de pantalla.
export function SwipeAction({
  enabled,
  label,
  icon: Icon,
  onAction,
  children,
}: {
  enabled: boolean;
  label: string;
  icon: LucideIcon;
  onAction: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const offset = useSharedValue(0);

  const gesture = Gesture.Pan()
    .enabled(enabled)
    // Solo responde a un movimiento claramente horizontal, para no interferir con el desplazamiento.
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      offset.set(Math.max(-MAX_DISTANCE, Math.min(0, event.translationX)));
    })
    .onEnd((event) => {
      if (event.translationX <= -ACTION_DISTANCE) {
        runOnJS(onAction)();
      }
    })
    .onFinalize(() => {
      offset.set(withSpring(0, { damping: 18, stiffness: 220 }));
    });

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.get() }] }));
  const actionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.get(), [0, -ACTION_DISTANCE / 2], [0, 1], 'clamp'),
  }));

  return (
    <View>
      <Animated.View className="absolute inset-0 flex-row items-center justify-end gap-2 pr-6 rounded-md bg-accent" style={actionStyle}>
        <Icon color={theme.onAccent} size={20} />
        <ThemedText
          type="smallBold"
          maxFontSizeMultiplier={ChromeFontScale}
          className="text-on-accent">
          {label}
        </ThemedText>
      </Animated.View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={cardStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}


