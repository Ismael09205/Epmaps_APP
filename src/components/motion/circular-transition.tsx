import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { BackHandler, Platform, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';


const COVER_MS = 260;
// Da tiempo a montar la pantalla nueva detrás del círculo; en iOS, también a que termine su
// deslizamiento nativo.
const HOLD_MS = Platform.OS === 'ios' ? 240 : 180;
const OPEN_MS = 340;
const SESSION_COVER_MS = 420;
const SESSION_HOLD_MS = 260;
const SESSION_OPEN_MS = 560;
const ACCENT_RING_LEAD = 1.06;

type CircularNavigation = {
  // Cubre la pantalla con un círculo que nace del punto tocado, ejecuta la navegación y lo abre.
  navigateWithReveal: (event: GestureResponderEvent | null, navigate: () => void) => void;
  // Iniciar o cerrar sesión: el círculo cubre primero y el cambio de pantalla ocurre detrás de él. Es
  // más pausado porque la pantalla de destino es más pesada de montar.
  runSessionTransition: (change: () => void) => void;
};

const CircularNavigationContext = createContext<CircularNavigation>({
  navigateWithReveal: (_event, navigate) => navigate(),
  runSessionTransition: (change) => change(),
});

const CoverageContext = createContext<SharedValue<number> | null>(null);

export function useCircularNavigation(): CircularNavigation {
  return useContext(CircularNavigationContext);
}

export function circleDiameter(x: number, y: number, width: number, height: number): number {
  return 2 * Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

// Reanimated no recorta pantallas nativas: el círculo cubre toda la ventana, incluida la franja de
// conexión, mientras cambia la pantalla, y al abrirse deja ver la nueva.
export function CircularTransitionHost({ children }: { children: ReactNode }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const coverage = useSharedValue(0);
  const [circle, setCircle] = useState({ x: 0, y: 0, size: 0 });
  const area = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const isRunning = useRef(false);

  const placeCircle = (x: number, y: number) => {
    setCircle({ x, y, size: circleDiameter(x, y, area.current.width, area.current.height) });
  };

  const open = (duration = OPEN_MS) => {
    coverage.set(withTiming(0, { duration, easing: Easing.out(Easing.cubic) }));
    setTimeout(() => {
      isRunning.current = false;
    }, duration);
  };

  const value: CircularNavigation = {
    navigateWithReveal: (event, navigate) => {
      if (reducedMotion || area.current.width === 0) {
        navigate();
        return;
      }
      if (isRunning.current) {
        return;
      }

      isRunning.current = true;
      placeCircle(
        (event?.nativeEvent.pageX ?? area.current.width / 2) - area.current.x,
        (event?.nativeEvent.pageY ?? area.current.height / 2) - area.current.y,
      );
      coverage.set(withTiming(1, { duration: COVER_MS, easing: Easing.in(Easing.cubic) }));
      setTimeout(() => {
        navigate();
        setTimeout(() => open(), HOLD_MS);
      }, COVER_MS);
    },
    runSessionTransition: (change) => {
      // Un cambio de sesión nunca se descarta: si no se puede animar, se aplica directamente.
      if (reducedMotion || area.current.width === 0 || isRunning.current) {
        change();
        return;
      }

      isRunning.current = true;
      placeCircle(area.current.width / 2, area.current.height / 2);
      coverage.set(
        withTiming(1, { duration: SESSION_COVER_MS, easing: Easing.inOut(Easing.cubic) }),
      );
      setTimeout(() => {
        change();
        setTimeout(() => open(SESSION_OPEN_MS), SESSION_HOLD_MS);
      }, SESSION_COVER_MS);
    },
  };

  // El botón atrás de Android usa la misma transición que el resto de la navegación.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!router.canGoBack()) {
        return false;
      }
      value.navigateWithReveal(null, () => router.back());
      return true;
    });
    return () => subscription.remove();
  });

  const brandCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coverage.get() }],
  }));
  const accentCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: Math.min(1, coverage.get() * ACCENT_RING_LEAD) }],
  }));
  const circleBox = {
    width: circle.size,
    height: circle.size,
    borderRadius: circle.size / 2,
    left: circle.x - circle.size / 2,
    top: circle.y - circle.size / 2,
  };

  return (
    <CircularNavigationContext.Provider value={value}>
      <CoverageContext.Provider value={coverage}>
        <View
          className="flex-1"
          onLayout={({ nativeEvent }) => {
            area.current = nativeEvent.layout;
          }}>
          {children}
          <View pointerEvents="none" className="absolute inset-0 overflow-hidden z-[10]" style={styles.overlay}>
            <Animated.View
              className="absolute bg-accent" style={[circleBox, accentCircleStyle]}
            />
            <Animated.View
              className="absolute bg-brand" style={[circleBox, brandCircleStyle]}
            />
          </View>
        </View>
      </CoverageContext.Provider>
    </CircularNavigationContext.Provider>
  );
}

// Parallax de las pantallas: solo acerca la vista, para que nunca deje un hueco en los bordes.
export function ParallaxArea({ children }: { children: ReactNode }) {
  const coverage = useContext(CoverageContext);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (coverage?.get() ?? 0) * 0.06 }],
  }));

  return <Animated.View className="flex-1" style={animatedStyle}>{children}</Animated.View>;
}

const styles = {
  overlay: { elevation: 10 },
} as const;
