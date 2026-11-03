import type { ReactNode } from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

// Mensaje corto bajo un campo. Solo anima al aparecer y desaparecer: si sigue vigente no se repite.
export function FieldMessage({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(120)}>
      {children}
    </Animated.View>
  );
}
