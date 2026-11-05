import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NoInternetAnimation } from '@/components/lottie/animations';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const VISIBLE_MS = 6000;
// Altura aproximada de la franja de conexión, bajo la cual aparece la alerta.
const BANNER_HEIGHT = 36;

const AlertEntering = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -10 }, { scale: 0.97 }] },
  100: {
    opacity: 1,
    transform: [{ translateY: 0 }, { scale: 1 }],
    easing: Easing.out(Easing.cubic),
  },
}).duration(260);

const AlertExiting = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 0, transform: [{ translateY: -6 }], easing: Easing.in(Easing.quad) },
}).duration(180);

// Pestaña flotante que avisa cuando se pierde la conexión. Se retira sola, al cerrarla o al
// recuperar la conexión.
export function ConnectionLostAlert() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let wasOnline = onlineManager.isOnline();
    return onlineManager.subscribe((isOnline) => {
      if (wasOnline && !isOnline) {
        setVisible(true);
      } else if (isOnline) {
        setVisible(false);
      }
      wasOnline = isOnline;
    });
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      entering={AlertEntering}
      exiting={AlertExiting}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      className="absolute left-4 right-4 flex-row items-center gap-3 rounded-sm border-[1px] py-3 pl-2 pr-3 bg-background border-warning-foreground"
      style={{
        top: insets.top + BANNER_HEIGHT,
        shadowColor: '#000000',
        shadowOpacity: 0.16,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}>
      <NoInternetAnimation size={56} strokeColor={theme.text} />
      <View className="flex-1 gap-[2px]">
        <ThemedText type="smallBold" style={{ color: theme.warningForeground }}>
          Se perdió la conexión
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Puede seguir registrando lecturas: se guardan en el teléfono y se enviarán al recuperar la
          conexión.
        </ThemedText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar aviso de conexión"
        hitSlop={8}
        onPress={() => setVisible(false)}
        className="w-[32px] h-[32px] items-center justify-center rounded-full active:opacity-70">
        <X color={theme.textSecondary} size={18} />
      </Pressable>
    </Animated.View>
  );
}
