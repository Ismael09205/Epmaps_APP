import { useEffect, useRef, useState, type RefObject } from 'react';
import { BlurView } from 'expo-blur';
import { CloudDownload } from 'lucide-react-native';
import { BackHandler, StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, Keyframe } from 'react-native-reanimated';

import { useIsOnline } from '@/components/connection-banner';
import { AnimatedButton } from '@/components/motion/animated-button';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { getKnownGpsLocation } from '@/location/gps';
import { isAreaDownloaded } from '@/storage/map-tiles';

// La tarjeta aparece desde el centro con una ligera escala.
const CardEntering = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.92 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(240);


// Recomendación informativa al consultar un medidor con conexión: descargar el mapa de la zona
// antes de ir a un sector sin señal. No obliga a descargarlo; se muestra una vez por medidor y no
// aparece si la zona conocida ya está guardada.
// Se muestra sobre la pantalla, que debe estar dentro del BlurTargetView de `blurTarget` para que
// Android difumine el fondo.
export function OfflineMapPrompt({
  meterCode,
  blurTarget,
}: {
  meterCode: string | null;
  blurTarget: RefObject<View | null>;
}) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const isOnline = useIsOnline();
  const [shownFor, setShownFor] = useState<string | null>(null);
  const acknowledged = useRef(new Set<string>());

  useEffect(() => {
    if (meterCode === null || !isOnline || acknowledged.current.has(meterCode)) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const known = await getKnownGpsLocation();
      const saved = known ? await isAreaDownloaded(known.latitude, known.longitude) : false;
      if (!cancelled && !saved) {
        setShownFor(meterCode);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [meterCode, isOnline]);

  const visible = meterCode !== null && shownFor === meterCode;

  const handleAccept = () => {
    if (meterCode !== null) {
      acknowledged.current.add(meterCode);
    }
    setShownFor(null);
  };

  // El botón Atrás de Android cierra la recomendación en lugar de salir de la pantalla.
  useEffect(() => {
    if (!visible || meterCode === null) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      acknowledged.current.add(meterCode);
      setShownFor(null);
      return true;
    });
    return () => subscription.remove();
  }, [visible, meterCode]);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      exiting={FadeOut.duration(180)}
      className="absolute inset-0 items-center justify-center px-6">
      <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
        <BlurView
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          intensity={40}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {/* Velo suave para mantener el contraste de la tarjeta sobre cualquier contenido. */}
        <View className="absolute inset-0" style={{ backgroundColor: 'rgba(14, 20, 48, 0.25)' }} />
      </Animated.View>
      <Animated.View
        entering={CardEntering}
        accessibilityViewIsModal
        accessibilityRole="alert"
        className="w-full max-w-[420px] rounded-sm p-6 gap-4 bg-background"
        style={{
          shadowColor: '#000000',
          shadowOpacity: 0.2,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        }}>
        <View className="w-[48px] h-[48px] rounded-full items-center justify-center self-center bg-info-background">
          <CloudDownload color={theme.infoForeground} size={24} />
        </View>
        <View className="gap-2">
          <ThemedText type="caption" themeColor="infoForeground" className="text-center">
            RECOMENDACIÓN
          </ThemedText>
          <ThemedText type="heading" className="text-center">
            ¿Va a trabajar sin conexión?
          </ThemedText>
          <ThemedText themeColor="textSecondary" className="text-center">
            Si irá a un sector sin señal, descargue antes el mapa de la zona desde la sección
            Ubicación del medidor. La lectura y el GPS funcionan igual sin conexión.
          </ThemedText>
        </View>
        <AnimatedButton label="Aceptar" onPress={handleAccept} />
      </Animated.View>
    </Animated.View>
  );
}
