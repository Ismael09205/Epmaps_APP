import { useEffect, useRef, type ReactNode } from 'react';
import { CircleCheck, CloudUpload, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { type ThemeColor } from '@/constants/theme';
import type { SyncStatus } from '@/domain/reading';
import { useTheme } from '@/hooks/use-theme';

// Un estado nuevo de sincronización solo necesita una entrada aquí.
const STATUS_APPEARANCE: Record<
  SyncStatus,
  { label: string; icon: LucideIcon; background: ThemeColor; foreground: ThemeColor; pulses: boolean }
> = {
  pending: {
    label: 'Pendiente',
    icon: CloudUpload,
    background: 'warningBackground',
    foreground: 'warningForeground',
    pulses: true,
  },
  sent: {
    label: 'Enviado',
    icon: CircleCheck,
    background: 'successBackground',
    foreground: 'successForeground',
    pulses: false,
  },
};

export function SyncStatusPill({ status }: { status: SyncStatus }) {
  const theme = useTheme();
  const { label, icon: Icon, background, foreground, pulses } = STATUS_APPEARANCE[status];
  const pulse = useSharedValue(1);
  const pop = useSharedValue(1);
  const previousStatus = useRef(status);

  useEffect(() => {
    if (pulses) {
      pulse.set(
        withRepeat(
          withSequence(withTiming(0.45, { duration: 800 }), withTiming(1, { duration: 800 })),
          -1,
        ),
      );
    } else {
      cancelAnimation(pulse);
      pulse.set(withTiming(1, { duration: 150 }));
    }

    if (previousStatus.current !== status) {
      pop.set(withSequence(withTiming(1.15, { duration: 130 }), withTiming(1, { duration: 170 })));
      previousStatus.current = status;
    }
  }, [status, pulses, pulse, pop]);

  const iconStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <Animated.View className="flex-row items-center gap-1 rounded-full px-[10px] py-1" style={[{ backgroundColor: theme[background] }, pillStyle]}>
      <Animated.View style={iconStyle}>
        <Icon color={theme[foreground]} size={14} strokeWidth={2.5} />
      </Animated.View>
      <ThemedText className="text-[12px] leading-[16px] font-bold" style={{ color: theme[foreground] }}>{label}</ThemedText>
    </Animated.View>
  );
}

// Destaca un número cuando cambia su valor.
export function AnimatedCount({ value, children }: { value: number | undefined; children: ReactNode }) {
  const pop = useSharedValue(1);
  const previousValue = useRef(value);

  useEffect(() => {
    if (previousValue.current !== undefined && previousValue.current !== value) {
      pop.set(withSequence(withTiming(1.18, { duration: 130 }), withTiming(1, { duration: 190 })));
    }
    previousValue.current = value;
  }, [value, pop]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return <Animated.View className="self-start" style={animatedStyle}>{children}</Animated.View>;
}

export function syncProgressPercent(sent: number, pending: number): number {
  const total = sent + pending;
  return total === 0 ? 0 : Math.round((sent / total) * 100);
}

// Avance de envío de las lecturas del período.
export function SyncProgressBar({
  sent,
  pending,
  trackColor,
  fillColor,
  textColor,
}: {
  sent: number;
  pending: number;
  trackColor: string;
  fillColor: string;
  textColor: string;
}) {
  const total = sent + pending;
  const percent = syncProgressPercent(sent, pending);
  const width = useSharedValue(0);

  useEffect(() => {
    width.set(withTiming(percent, { duration: 500 }));
  }, [percent, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.get()}%` }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Lecturas enviadas en este período"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      className="gap-2">
      <View className="h-[8px] rounded-full overflow-hidden" style={{ backgroundColor: trackColor }}>
        <Animated.View className="h-full rounded-full" style={[{ backgroundColor: fillColor }, fillStyle]} />
      </View>
      <ThemedText type="small" style={{ color: textColor }}>
        {total === 0
          ? 'Todavía no hay lecturas en este período.'
          : `${sent} de ${total} ${total === 1 ? 'lectura enviada' : 'lecturas enviadas'} en este período`}
      </ThemedText>
    </View>
  );
}


