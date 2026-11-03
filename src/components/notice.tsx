import { useEffect, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react-native';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SuccessKeyframe } from '@/components/motion/success-keyframe';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error' | 'loading';

const ICONS = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
} as const;

const ENTER_MS = 260;
const LEAVE_MS = 200;
const SLIDE_DISTANCE = 12;
export const CONFIRMATION_VISIBLE_MS = 3500;

// Mensaje de estado: el color y el icono indican el tipo; el texto siempre usa el color principal
// para conservar el contraste sobre el fondo tenue.
export function Notice({
  tone,
  title,
  children,
  style,
}: {
  tone: NoticeTone;
  title?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  // Una confirmación breve se retira sola para no acumular mensajes. Las que tienen título, detalle
  // o piden algo al técnico permanecen, igual que los avisos y los errores.
  const isBriefConfirmation = tone === 'success' && title === undefined && typeof children === 'string';
  const [isLeaving, setIsLeaving] = useState(false);
  const [isGone, setIsGone] = useState(false);
  const progress = useSharedValue(0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }));
  }, [progress]);

  useEffect(() => {
    if (!isBriefConfirmation) {
      return;
    }

    const leaveTimer = setTimeout(() => {
      setIsLeaving(true);
      progress.set(withTiming(0, { duration: LEAVE_MS }));
    }, CONFIRMATION_VISIBLE_MS);
    const goneTimer = setTimeout(() => setIsGone(true), CONFIRMATION_VISIBLE_MS + LEAVE_MS);

    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(goneTimer);
    };
  }, [isBriefConfirmation, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: progress.get() * contentHeight.get(),
    opacity: progress.get(),
  }));
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * SLIDE_DISTANCE }],
  }));

  const palette =
    tone === 'loading' || tone === 'info'
      ? { background: theme.infoBackground, foreground: theme.infoForeground }
      : tone === 'success'
        ? { background: theme.successBackground, foreground: theme.successForeground }
        : tone === 'warning'
          ? { background: theme.warningBackground, foreground: theme.warningForeground }
          : { background: theme.errorBackground, foreground: theme.errorForeground };

  const Icon = tone === 'loading' ? null : ICONS[tone];

  if (isGone) {
    return null;
  }

  // La altura crece desde 0: lo que está debajo se desplaza sin saltos al aparecer y al retirarse.
  return (
    <Animated.View
      accessibilityElementsHidden={isLeaving}
      className="overflow-hidden" style={animatedStyle}>
      <View
        className="absolute top-0 left-0 right-0"
        onLayout={(event) => {
          contentHeight.set(event.nativeEvent.layout.height);
        }}>
        <Animated.View
          accessibilityLiveRegion="polite"
          className="flex-row gap-2 border-l-[4px] rounded-sm py-3 px-4" style={[{ backgroundColor: palette.background, borderLeftColor: palette.foreground }, style, slideStyle]}>
          <View className="w-[20px] min-h-[20px] items-center pt-[1px]">
            {Icon ? (
              <Animated.View entering={tone === 'success' ? SuccessKeyframe : undefined}>
                <Icon color={palette.foreground} size={20} strokeWidth={2.25} />
              </Animated.View>
            ) : (
              <ActivityIndicator color={palette.foreground} size="small" />
            )}
          </View>
          <View className="flex-1 gap-[2px]">
            {title !== undefined && <ThemedText type="smallBold">{title}</ThemedText>}
            {typeof children === 'string' ? <ThemedText type="small">{children}</ThemedText> : children}
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}


