import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useIsMutating } from '@tanstack/react-query';
import {
  CircleAlert,
  CircleCheck,
  CloudOff,
  CloudUpload,
  Gauge,
  LogOut,
  Pencil,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { useIsOnline } from '@/components/connection-banner';
import { CloudSyncAnimation, WaterLoadingAnimation } from '@/components/lottie/animations';
import { AnimatedButton } from '@/components/motion/animated-button';
import { useCircularNavigation } from '@/components/motion/circular-transition';
import { ExpandableContent, ExpandChevron } from '@/components/motion/expandable';
import { FloatingCard } from '@/components/motion/floating-card';
import { AnimatedCount, SyncProgressBar } from '@/components/motion/sync-indicators';
import { SafeAreaView } from '@/components/styled';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChromeFontScale, Spacing } from '@/constants/theme';
import { usePendingSyncCount } from '@/hooks/use-pending-sync-count';
import { useSyncPeriodSummary } from '@/hooks/use-sync-period-summary';
import { useTheme } from '@/hooks/use-theme';
import { READING_SYNC_MUTATION_KEY } from '@/query/reading-sync';

const PERIOD_FORMAT = new Intl.DateTimeFormat('es-EC', {
  timeZone: 'America/Guayaquil',
  month: 'long',
  year: 'numeric',
});
const TODAY_FORMAT = new Intl.DateTimeFormat('es-EC', {
  timeZone: 'America/Guayaquil',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

// Consejos prácticos para el técnico en campo; incluyen las reglas de las HU que debe recordar.
const FIELD_TIPS = [
  {
    title: 'Lea el visor de frente',
    text: 'Limpie el vidrio y lea de izquierda a derecha. Los números negros son metros cúbicos; los rojos, decimales.',
  },
  {
    title: 'Confirme que es el medidor correcto',
    text: 'Compare el código MED de la etiqueta y la dirección de la ficha antes de registrar.',
  },
  {
    title: 'Tome una foto nítida',
    text: 'Encuadre el visor completo y evite reflejos. Es obligatoria si el medidor está dañado o el consumo supera el triple del promedio.',
  },
  {
    title: 'Si no puede llegar al medidor',
    text: 'Elija Inaccesible y anote el motivo concreto: puerta cerrada, perro suelto, medidor cubierto.',
  },
  {
    title: 'Sin señal, siga trabajando',
    text: 'La lectura queda guardada en el teléfono y se envía sola al volver la conexión. Un registro por medidor al mes; puede corregirlo mientras no se envíe.',
  },
] as const;

const HEADER_COLLAPSE_DISTANCE = 90;
const SUMMARY_PARALLAX = 0.18;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function HomeScreen() {
  const { technician: currentTechnician, displayName, signOut } = useSession();
  // Al salir, la pantalla sigue visible hasta que el círculo la cubre: conserva lo último mostrado.
  const [lastTechnician, setLastTechnician] = useState(currentTechnician);
  const [lastDisplayName, setLastDisplayName] = useState(displayName);
  if (currentTechnician && currentTechnician !== lastTechnician) {
    setLastTechnician(currentTechnician);
  }
  if (currentTechnician && displayName !== lastDisplayName) {
    setLastDisplayName(displayName);
  }
  const technician = currentTechnician ?? lastTechnician;

  const theme = useTheme();
  const router = useRouter();
  const { navigateWithReveal } = useCircularNavigation();
  const [openTip, setOpenTip] = useState<string | null>(null);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  // El encabezado se encoge y se aparta al desplazar.
  const headerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollOffset.get(), [0, HEADER_COLLAPSE_DISTANCE], [1, 0.35], 'clamp'),
    transform: [
      { translateY: interpolate(scrollOffset.get(), [0, HEADER_COLLAPSE_DISTANCE], [0, 14], 'clamp') },
      { scale: interpolate(scrollOffset.get(), [0, HEADER_COLLAPSE_DISTANCE], [1, 0.94], 'clamp') },
    ],
  }));
  // El resumen se queda atrás del resto del contenido, que pasa por encima.
  const summaryStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollOffset.get(), [80, 320], [1, 0.5], 'clamp'),
    transform: [{ translateY: Math.max(0, scrollOffset.get()) * SUMMARY_PARALLAX }],
  }));
  const insets = useSafeAreaInsets();
  const employeeCode = technician?.employeeCode ?? '';
  const pendingQuery = usePendingSyncCount(employeeCode);
  const periodSummary = useSyncPeriodSummary(employeeCode).data;
  const isOnline = useIsOnline();
  const isSyncing = useIsMutating({ mutationKey: READING_SYNC_MUTATION_KEY }) > 0;
  const pendingCount = pendingQuery.data;

  if (!technician) {
    // Solo se monta con sesión iniciada; al cerrar sesión el layout redirige a /login.
    return <ThemedView className="flex-1" />;
  }

  const now = new Date();
  const hasPeriodReadings =
    periodSummary !== undefined && periodSummary.sent + periodSummary.pending > 0;
  const pendingStatus = pendingQuery.isError
    ? {
        Icon: CircleAlert,
        text: 'No se pudo consultar la cantidad de lecturas pendientes.',
      }
    : isSyncing && isOnline
      ? { Icon: null, text: 'Enviando lecturas…' }
      : pendingCount === 0
        ? {
            Icon: CircleCheck,
            // Sin lecturas en el período no hay nada que se haya enviado todavía.
            text: hasPeriodReadings
              ? 'Todas las lecturas fueron enviadas.'
              : 'No hay lecturas por enviar.',
          }
        : isOnline
          ? {
              Icon: CloudUpload,
              text: 'Se envían automáticamente con conexión.',
            }
          : {
              Icon: CloudOff,
              text: 'Se enviarán al recuperar la conexión.',
            };
  const StatusIcon = pendingStatus.Icon;

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['left', 'right']}>
        <Animated.ScrollView ref={scrollRef} contentContainerClassName="px-5 pt-6 pb-8 gap-6">
          <Animated.View className="flex-row justify-between items-start gap-4" style={headerStyle}>
            <View className="gap-1 shrink">
              <ThemedText type="caption" themeColor="infoForeground">
                {capitalize(TODAY_FORMAT.format(now))}
              </ThemedText>
              <ThemedText type="heading" numberOfLines={2}>
                {lastDisplayName ?? `${technician.name} ${technician.surname}`}
              </ThemedText>
              <View className="flex-row items-baseline flex-wrap gap-2">
                <ThemedText type="small" themeColor="textSecondary">
                  Código de empleado
                </ThemedText>
                <ThemedText type="data" className="text-[14px] leading-[20px]">
                  {technician.employeeCode}
                </ThemedText>
              </View>
            </View>

            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
              hitSlop={Spacing.two}
              className="min-h-[44px] flex-row items-center gap-[6px] pl-2 active:scale-[0.98]">
              <LogOut color={theme.textSecondary} size={18} />
              <ThemedText
                type="smallBold"
                themeColor="textSecondary"
                maxFontSizeMultiplier={ChromeFontScale}>
                Salir
              </ThemedText>
            </Pressable>
          </Animated.View>

          <AnimatedButton
            label="Editar nombre"
            icon={Pencil}
            variant="secondary"
            onPress={(event) => navigateWithReveal(event, () => router.push('/editar-nombre'))}
          />

          {/* Elemento distintivo de la pantalla: el período en curso y el estado de envío. */}
          <Animated.View style={summaryStyle}>
            <FloatingCard
              layerColor={theme.brand}
              className="rounded-lg p-5 gap-4 bg-brand">
              <View className="gap-1">
                <ThemedText type="caption" className="text-on-brand-secondary">
                  Período de lectura
                </ThemedText>
                <ThemedText type="heading" className="text-on-brand">
                  {capitalize(PERIOD_FORMAT.format(now))}
                </ThemedText>
              </View>

              <View className="h-[0.5px] opacity-60 bg-on-brand-secondary" />

              <View accessibilityLiveRegion="polite" className="gap-2">
                {/* Cifra y mensaje en filas separadas: el mensaje usa todo el ancho de la tarjeta. */}
                <View className="flex-row items-center gap-3">
                  <AnimatedCount value={pendingCount}>
                    <ThemedText type="display" className="text-on-brand">
                      {pendingCount === undefined ? '…' : String(pendingCount)}
                    </ThemedText>
                  </AnimatedCount>
                  <ThemedText type="caption" className="flex-1 text-on-brand-secondary">
                    Pendientes de envío
                  </ThemedText>
                </View>
                <View className="flex-row items-center gap-2">
                  {pendingStatus.Icon === CloudOff ? (
                    <CloudSyncAnimation
                      size={24}
                      colors={{ primary: theme.onBrand, secondary: theme.onBrandSecondary, base: theme.brand }}
                    />
                  ) : StatusIcon ? (
                    <StatusIcon color={theme.onBrand} size={18} />
                  ) : (
                    <WaterLoadingAnimation size={24} />
                  )}
                  <ThemedText type="small" className="flex-1 text-on-brand">
                    {pendingStatus.text}
                  </ThemedText>
                </View>
              </View>

              {hasPeriodReadings && periodSummary && (
                <SyncProgressBar
                  sent={periodSummary.sent}
                  pending={periodSummary.pending}
                  trackColor={`${theme.onBrandSecondary}40`}
                  fillColor={theme.onBrand}
                  textColor={theme.onBrand}
                />
              )}
            </FloatingCard>
          </Animated.View>

          <View className="gap-1 bg-background">
            <View className="gap-1 mb-2">
              <ThemedText type="caption" themeColor="infoForeground">
                Antes de registrar
              </ThemedText>
              <ThemedText type="heading">Consejos para el técnico</ThemedText>
            </View>
            {FIELD_TIPS.map(({ title, text }, index) => {
              const expanded = openTip === title;

              return (
                <Pressable
                  key={title}
                  onPress={() => setOpenTip(expanded ? null : title)}
                  accessibilityRole="button"
                  accessibilityLabel={title}
                  accessibilityState={{ expanded }}
                  className="flex-row items-start gap-4 border-t-[0.5px] py-4 border-t-border">
                  <ThemedText type="data" themeColor="accent" className="min-w-[24px]">
                    {String(index + 1).padStart(2, '0')}
                  </ThemedText>
                  <View className="flex-1 gap-[2px]">
                    <View className="flex-row items-center gap-2">
                      <ThemedText type="smallBold" className="flex-1">
                        {title}
                      </ThemedText>
                      <ExpandChevron expanded={expanded} color={theme.textSecondary} />
                    </View>
                    <ExpandableContent expanded={expanded}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {text}
                      </ThemedText>
                    </ExpandableContent>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Animated.ScrollView>

        {/* Acción principal fija en la zona del pulgar. */}
        <View
          className="border-t-[0.5px] px-5 pt-4 gap-2 bg-background border-t-border" style={{ paddingBottom: insets.bottom + Spacing.three }}>
          <ThemedText type="small" themeColor="textSecondary">
            Tenga a mano la etiqueta MED del medidor.
          </ThemedText>
          <AnimatedButton
            label="Identificar medidor"
            accessibilityHint="Abre la pantalla para ingresar el código del medidor."
            icon={Gauge}
            onPress={(event) => navigateWithReveal(event, () => router.push('/medidor'))}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

