import { useRouter } from 'expo-router';
import { useIsMutating, useQuery } from '@tanstack/react-query';
import {
  CalendarCheck,
  Camera,
  CircleAlert,
  CircleCheck,
  CloudOff,
  CloudUpload,
  Gauge,
  LogOut,
  WifiOff,
} from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { useIsOnline } from '@/components/connection-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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

// Reglas de las HU que el técnico necesita recordar antes de salir a campo.
const FIELD_RULES = [
  {
    Icon: CalendarCheck,
    text: 'Un registro por medidor al mes. Mientras no se envíe, puede modificarlo.',
  },
  {
    Icon: Camera,
    text: 'La foto es obligatoria si el medidor está dañado o el consumo supera el triple del promedio.',
  },
  {
    Icon: WifiOff,
    text: 'Sin señal, los registros se guardan en el teléfono y se envían solos al volver la conexión.',
  },
] as const;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function HomeScreen() {
  const { technician, signOut } = useSession();
  const theme = useTheme();
  const router = useRouter();
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
        tone: theme.errorForeground,
        Icon: CircleAlert,
        text: 'No se pudo consultar la cantidad de lecturas pendientes.',
      }
    : isSyncing && isOnline
      ? { tone: theme.infoForeground, Icon: null, text: 'Enviando lecturas…' }
      : pendingCount === 0
        ? {
            tone: theme.successForeground,
            Icon: CircleCheck,
            text: 'Todas las lecturas fueron enviadas.',
          }
        : isOnline
          ? {
              tone: theme.infoForeground,
              Icon: CloudUpload,
              text: 'Se envían automáticamente con conexión.',
            }
          : {
              tone: theme.warningForeground,
              Icon: CloudOff,
              text: 'Se enviarán al recuperar la conexión.',
            };
  const StatusIcon = pendingStatus.Icon;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.identity}>
              <ThemedText type="small" themeColor="textSecondary">
                {capitalize(TODAY_FORMAT.format(now))}
              </ThemedText>
              <ThemedText type="subtitle">{`${technician.name} ${technician.surname}`}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {`Código de empleado ${technician.employeeCode}`}
              </ThemedText>
            </View>

            <Pressable
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
              hitSlop={Spacing.two}
              style={({ pressed }) => [
                styles.signOutButton,
                { borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <LogOut color={theme.text} size={18} />
              <ThemedText type="small">Salir</ThemedText>
            </Pressable>
          </View>

          <View
            style={[
              styles.actionPanel,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <View style={[styles.periodRule, { backgroundColor: theme.accent }]} />
            <View style={styles.actionBody}>
              <ThemedText type="small" themeColor="textSecondary">
                Período de lectura
              </ThemedText>
              <ThemedText type="subtitle">{capitalize(PERIOD_FORMAT.format(now))}</ThemedText>
              <ThemedText themeColor="textSecondary">
                Ingrese el código MED de la etiqueta para ver la ficha del medidor y registrar su
                lectura.
              </ThemedText>
              <Pressable
                onPress={() => router.push('/medidor')}
                accessibilityRole="button"
                accessibilityLabel="Identificar medidor"
                accessibilityHint="Abre la pantalla para ingresar el código del medidor."
                style={({ pressed }) => [
                  styles.identifyMeterButton,
                  { backgroundColor: theme.accent },
                  pressed && styles.pressed,
                ]}>
                <Gauge color={theme.onAccent} size={22} />
                <ThemedText type="smallBold" style={[styles.buttonLabel, { color: theme.onAccent }]}>
                  Identificar medidor
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <View
            accessibilityLiveRegion="polite"
            style={[styles.pendingBox, { borderColor: theme.border }]}>
            <View style={styles.pendingHeader}>
              <ThemedText type="smallBold">Lecturas pendientes de envío</ThemedText>
              <ThemedText style={styles.pendingCount}>
                {pendingCount === undefined ? '…' : String(pendingCount)}
              </ThemedText>
            </View>
            <View style={styles.pendingStatus}>
              {StatusIcon ? (
                <StatusIcon color={pendingStatus.tone} size={18} />
              ) : (
                <ActivityIndicator color={pendingStatus.tone} size="small" />
              )}
              <ThemedText type="small" themeColor="textSecondary" style={styles.flexText}>
                {pendingStatus.text}
              </ThemedText>
            </View>
          </View>

          <View style={styles.rules}>
            <ThemedText type="smallBold">Antes de registrar</ThemedText>
            {FIELD_RULES.map(({ Icon, text }) => (
              <View key={text} style={[styles.rule, { borderTopColor: theme.border }]}>
                <Icon color={theme.infoForeground} size={20} />
                <ThemedText type="small" style={styles.flexText}>
                  {text}
                </ThemedText>
              </View>
            ))}
          </View>
        </ScrollView>
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
    paddingHorizontal: Spacing.four,
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
  signOutButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  actionPanel: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  // Línea vertical de acento: el motivo que marca el bloque de trabajo del período.
  periodRule: {
    width: 4,
  },
  actionBody: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  identifyMeterButton: {
    marginTop: Spacing.two,
    minHeight: 56,
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  buttonLabel: {
    fontSize: 16,
  },
  pendingBox: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  pendingCount: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pendingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rules: {
    gap: Spacing.two,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },
  flexText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
