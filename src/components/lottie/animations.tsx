import { useMemo, type ComponentProps } from 'react';
import LottieView from 'lottie-react-native';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { recolorLottie } from './recolor';

/* eslint-disable @typescript-eslint/no-require-imports -- los recursos de Lottie se cargan con require. */
const CLOUD_SYNC = require('../../../assets/animations/lottie/Cloud Sync Loading Loop Animation.json');
const NO_INTERNET = require('../../../assets/animations/lottie/No internet connection.json');
const SUCCESS = require('../../../assets/animations/lottie/Success checkmark.json');
const WATER = require('../../../assets/animations/lottie/water.lottie');
/* eslint-enable @typescript-eslint/no-require-imports */

// Colores originales de la animación de sincronización.
const CLOUD_SYNC_BLUE = [0, 0.72, 1] as const;
const CLOUD_SYNC_YELLOW = [0.955, 0.712, 0.143] as const;
const CLOUD_SYNC_WHITE = [1, 1, 1] as const;
// Trazo oscuro de la animación sin conexión.
const NO_INTERNET_STROKE = [0.059, 0.059, 0.059] as const;

type AnimationProps = { size: number };

// Las animaciones son decorativas: el texto que las acompaña comunica el estado. Con "reducir
// movimiento" activado se muestra un fotograma fijo.
function Animation({
  source,
  size,
  loop,
  staticProgress,
  onAnimationFinish,
}: AnimationProps & {
  source: unknown;
  loop: boolean;
  staticProgress: number;
  onAnimationFinish?: () => void;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <LottieView
        source={source as ComponentProps<typeof LottieView>['source']}
        autoPlay={!reducedMotion}
        loop={loop && !reducedMotion}
        progress={reducedMotion ? staticProgress : undefined}
        onAnimationFinish={onAnimationFinish}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
    </View>
  );
}

// Procesos pendientes de envío sin conexión, con los colores de la paleta de la app.
export function CloudSyncAnimation({
  size,
  colors,
}: AnimationProps & {
  colors: { primary: string; secondary: string; base: string };
}) {
  const { primary, secondary, base } = colors;
  const source = useMemo(
    () =>
      recolorLottie(CLOUD_SYNC, [
        { from: CLOUD_SYNC_BLUE, to: primary },
        { from: CLOUD_SYNC_YELLOW, to: secondary },
        { from: CLOUD_SYNC_WHITE, to: base },
      ]),
    [primary, secondary, base],
  );

  return <Animation source={source} size={size} loop staticProgress={0} />;
}

export function NoInternetAnimation({ size, strokeColor }: AnimationProps & { strokeColor: string }) {
  const source = useMemo(
    () => recolorLottie(NO_INTERNET, [{ from: NO_INTERNET_STROKE, to: strokeColor }]),
    [strokeColor],
  );

  return <Animation source={source} size={size} loop staticProgress={0} />;
}

// Se reproduce una vez: lectura registrada o acceso correcto.
export function SuccessAnimation({
  size,
  onAnimationFinish,
}: AnimationProps & { onAnimationFinish?: () => void }) {
  return (
    <Animation
      source={SUCCESS}
      size={size}
      loop={false}
      staticProgress={1}
      onAnimationFinish={onAnimationFinish}
    />
  );
}

// Estados de carga: consulta de medidores y envío de información.
export function WaterLoadingAnimation({ size }: AnimationProps) {
  return <Animation source={WATER} size={size} loop staticProgress={0} />;
}
