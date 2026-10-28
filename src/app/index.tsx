import { useRouter } from 'expo-router';
import { useIsMutating, useQuery } from '@tanstack/react-query';
import {
  CircleAlert,
  CircleCheck,
  CloudOff,
  CloudUpload,
  Gauge,
  LogOut,
} from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { useIsOnline } from '@/components/connection-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChromeFontScale, Radius, ScreenPadding, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pendingSyncCountQueryKey, READING_SYNC_MUTATION_KEY } from '@/query/reading-sync';
import { countUnsentReadings } from '@/storage/readings';

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

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function HomeScreen() {
  const { technician, signOut } = useSession();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const employeeCode = technician?.employeeCode ?? '';
  // HU-009 CA-04: se actualiza al guardar registros y al terminar cada envío.
  const pendingQuery = useQuery({
    queryKey: pendingSyncCountQueryKey(employeeCode),
    queryFn: () => countUnsentReadings(employeeCode),
    enabled: employeeCode !== '',
    networkMode: 'always',
  });
  const isOnline = useIsOnline();
  const isSyncing = useIsMutating({ mutationKey: READING_SYNC_MUTATION_KEY }) > 0;
  const pendingCount = pendingQuery.data;

  if (!technician) {
    // Solo se monta con sesión iniciada; al cerrar sesión el layout redirige a /login.
    return <ThemedView style={styles.container} />;
  }

  const now = new Date();
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
            text: 'Todas las lecturas fueron enviadas.',
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
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.identity}>
              <ThemedText type="caption" themeColor="infoForeground">
                {capitalize(TODAY_FORMAT.format(now))}
              </ThemedText>
              <ThemedText type="heading" numberOfLines={2}>
                {`${technician.name} ${technician.surname}`}
              </ThemedText>
              <View style={styles.employeeRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Código de empleado
                </ThemedText>
                <ThemedText type="data" style={styles.employeeCode}>
                  {technician.employeeCode}
                </ThemedText>
              </View>
            </View>

            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
              hitSlop={Spacing.two}
              style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
              <LogOut color={theme.textSecondary} size={18} />
              <ThemedText
                type="smallBold"
                themeColor="textSecondary"
                maxFontSizeMultiplier={ChromeFontScale}>
                Salir
              </ThemedText>
            </Pressable>
          </View>

          {/* Elemento distintivo de la pantalla: el período en curso y el estado de envío. */}
          <View style={[styles.periodPanel, { backgroundColor: theme.brand }]}>
            <View style={styles.periodBlock}>
              <ThemedText type="caption" style={{ color: theme.onBrandSecondary }}>
                Período de lectura
              </ThemedText>
              <ThemedText type="heading" style={{ color: theme.onBrand }}>
                {capitalize(PERIOD_FORMAT.format(now))}
              </ThemedText>
            </View>

            <View style={[styles.periodDivider, { backgroundColor: theme.onBrandSecondary }]} />

            <View accessibilityLiveRegion="polite" style={styles.pendingRow}>
              <View style={styles.pendingFigure}>
                <ThemedText type="display" style={{ color: theme.onBrand }}>
                  {pendingCount === undefined ? '…' : String(pendingCount)}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.onBrandSecondary }}>
                  Pendientes de envío
                </ThemedText>
              </View>
              <View style={styles.pendingStatus}>
                {StatusIcon ? (
                  <StatusIcon color={theme.onBrand} size={18} />
                ) : (
                  <ActivityIndicator color={theme.onBrand} size="small" />
                )}
                <ThemedText type="small" style={[styles.flexText, { color: theme.onBrand }]}>
                  {pendingStatus.text}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.tips}>
            <View style={styles.tipsHeader}>
              <ThemedText type="caption" themeColor="infoForeground">
                Antes de registrar
              </ThemedText>
              <ThemedText type="heading">Consejos para el técnico</ThemedText>
            </View>
            {FIELD_TIPS.map(({ title, text }, index) => (
              <View key={title} style={[styles.tip, { borderTopColor: theme.border }]}>
                <ThemedText type="data" themeColor="accent" style={styles.tipNumber}>
                  {String(index + 1).padStart(2, '0')}
                </ThemedText>
                <View style={styles.tipBody}>
                  <ThemedText type="smallBold">{title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {text}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Acción principal fija en la zona del pulgar. */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.border,
              paddingBottom: insets.bottom + Spacing.three,
            },
          ]}>
          <ThemedText type="small" themeColor="textSecondary">
            Tenga a mano la etiqueta MED del medidor.
          </ThemedText>
          <Pressable
            onPress={() => router.push('/medidor')}
            accessibilityRole="button"
            accessibilityLabel="Identificar medidor"
            accessibilityHint="Abre la pantalla para ingresar el código del medidor."
            style={({ pressed }) => [
              styles.identifyMeterButton,
              { backgroundColor: pressed ? theme.brand : theme.accent },
              pressed && styles.pressed,
            ]}>
            <Gauge color={theme.onAccent} size={22} />
            <ThemedText
              type="smallBold"
              maxFontSizeMultiplier={ChromeFontScale}
              style={[styles.buttonLabel, { color: theme.onAccent }]}>
              Identificar medidor
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  identity: {
    gap: Spacing.one,
    flexShrink: 1,
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  employeeCode: {
    fontSize: 14,
    lineHeight: 20,
  },
  signOutButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    paddingLeft: Spacing.two,
  },
  periodPanel: {
    borderRadius: Radius.lg,
    padding: Spacing.four - Spacing.one,
    gap: Spacing.three,
  },
  periodBlock: {
    gap: Spacing.one,
  },
  periodDivider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
  },
  pendingFigure: {
    gap: Spacing.half,
  },
  pendingStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingBottom: Spacing.half,
  },
  tips: {
    gap: Spacing.one,
  },
  tipsHeader: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  // Lista agrupada con divisores finos en lugar de tarjetas.
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
  },
  tipNumber: {
    minWidth: 24,
  },
  tipBody: {
    flex: 1,
    gap: Spacing.half,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: ScreenPadding,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  identifyMeterButton: {
    minHeight: 56,
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  buttonLabel: {
    fontSize: 16,
  },
  flexText: {
    flex: 1,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
