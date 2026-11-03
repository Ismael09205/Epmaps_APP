import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const TRANSITION_MS = 220;
const SLIDE_DISTANCE = 10;

// La altura se anima hasta 0 sin desmontar el contenido: lo que está debajo acompaña el cambio y no
// queda ningún espacio al cerrar. Cerrado, también se oculta al lector de pantalla.
export function ExpandableContent({
  expanded,
  testID,
  children,
}: {
  expanded: boolean;
  testID?: string;
  children: ReactNode;
}) {
  const progress = useSharedValue(expanded ? 1 : 0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(expanded ? 1 : 0, { duration: TRANSITION_MS }));
  }, [expanded, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: progress.get() * contentHeight.get(),
    opacity: progress.get(),
  }));

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * -SLIDE_DISTANCE }],
  }));

  return (
    <Animated.View
      testID={testID}
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
      className="overflow-hidden" style={animatedStyle}>
      {/* Con posición absoluta, el contenido conserva su altura real aunque esté cerrado. */}
      <Animated.View
        className="absolute top-0 left-0 right-0" style={slideStyle}
        onLayout={(event) => {
          contentHeight.set(event.nativeEvent.layout.height);
        }}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

// Sección que depende de una opción: se despliega al aparecer y se pliega antes de salir del
// formulario, sin dejar espacio cuando ya no aplica.
export function RevealSection({ visible, children }: { visible: boolean; children: ReactNode }) {
  const [isRendered, setIsRendered] = useState(visible);
  if (visible && !isRendered) {
    setIsRendered(true);
  }

  const progress = useSharedValue(0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(visible ? 1 : 0, { duration: TRANSITION_MS }));
    if (visible) {
      return;
    }

    const timer = setTimeout(() => setIsRendered(false), TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [visible, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: progress.get() * contentHeight.get(),
    opacity: progress.get(),
  }));
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * -SLIDE_DISTANCE }],
  }));

  if (!isRendered) {
    return null;
  }

  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      className="overflow-hidden mx-[-6px] my-[-6px]" style={animatedStyle}>
      <Animated.View
        className="absolute top-0 left-0 right-0 p-[6px]" style={slideStyle}
        onLayout={(event) => {
          contentHeight.set(event.nativeEvent.layout.height);
        }}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

export function ExpandChevron({ expanded, color }: { expanded: boolean; color: string }) {
  const rotation = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    rotation.set(withTiming(expanded ? 1 : 0, { duration: TRANSITION_MS }));
  }, [expanded, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get() * 180}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <ChevronDown color={color} size={20} />
    </Animated.View>
  );
}


