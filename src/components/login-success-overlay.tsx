import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { Easing, FadeIn, Keyframe } from 'react-native-reanimated';

import { SuccessAnimation } from '@/components/lottie/animations';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// Tiempo mínimo para que el técnico vea la confirmación y máximo por si la animación no informa
// su fin (por ejemplo, con movimiento reducido).
const MIN_VISIBLE_MS = 2200;
const MAX_VISIBLE_MS = 4000;

const CardEntering = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.9 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(260);

// Confirmación del acceso correcto en el centro del login, antes de pasar a la pantalla principal.
export function LoginSuccessOverlay({ onFinish }: { onFinish: () => void }) {
  const theme = useTheme();
  const shownAt = useRef(0);
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const finish = () => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    onFinishRef.current();
  };

  useEffect(() => {
    shownAt.current = Date.now();
    const timer = setTimeout(() => {
      if (!finished.current) {
        finished.current = true;
        onFinishRef.current();
      }
    }, MAX_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  const handleAnimationFinish = () => {
    const remaining = MIN_VISIBLE_MS - (Date.now() - shownAt.current);
    if (remaining > 0) {
      setTimeout(finish, remaining);
    } else {
      finish();
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      accessibilityViewIsModal
      className="absolute inset-0 items-center justify-center px-6"
      style={{ backgroundColor: `${theme.background}EB` }}>
      <Animated.View
        entering={CardEntering}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        className="w-full max-w-[360px] items-center gap-2 rounded-sm border-[1px] p-6 bg-background border-success-foreground">
        <SuccessAnimation size={120} onAnimationFinish={handleAnimationFinish} />
        <ThemedText type="heading" className="text-center text-success-foreground">
          Acceso correcto
        </ThemedText>
        <View>
          <ThemedText themeColor="textSecondary" className="text-center">
            Ingresando a la pantalla principal…
          </ThemedText>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
