import { Link } from 'expo-router';
import { useIsMutating, useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { useIsOnline } from '@/components/connection-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { pendingSyncCountQueryKey, READING_SYNC_MUTATION_KEY } from '@/query/reading-sync';
import { countUnsentReadings } from '@/storage/readings';

export default function HomeScreen() {
  const { technician, signOut } = useSession();
  const theme = useTheme();
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ThemedView style={styles.header}>
          <ThemedView style={styles.identity}>
            <ThemedText type="small" themeColor="textSecondary">
              Técnico identificado
            </ThemedText>
            <ThemedText type="subtitle">{`${technician.name} ${technician.surname}`}</ThemedText>
            <ThemedText themeColor="textSecondary">
              {`Código de empleado ${technician.employeeCode}`}
            </ThemedText>
          </ThemedView>

          <Pressable
            onPress={signOut}
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
            style={({ pressed }) => [
              styles.signOutButton,
              { borderColor: theme.textSecondary },
              pressed && styles.pressed,
            ]}>
            <ThemedText>Cerrar sesión</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView
          accessibilityLiveRegion="polite"
          style={[
            styles.pendingBox,
            { backgroundColor: theme.backgroundElement, borderColor: theme.textSecondary },
          ]}>
          <ThemedText type="smallBold">Lecturas pendientes de envío</ThemedText>
          <ThemedText type="title">
            {pendingCount === undefined ? '…' : String(pendingCount)}
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            {pendingQuery.isError
              ? 'No se pudo consultar la cantidad de lecturas pendientes.'
              : isSyncing && isOnline
                ? 'Enviando lecturas…'
                : pendingCount === 0
                  ? 'Todas las lecturas fueron enviadas.'
                  : isOnline
                    ? 'Se envían automáticamente con conexión.'
                    : 'Se enviarán al recuperar la conexión.'}
          </ThemedText>
        </ThemedView>

        <Link href="/medidor" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Identificar medidor"
            accessibilityHint="Abre la pantalla para ingresar el código del medidor."
            style={({ pressed }) => [
              styles.identifyMeterButton,
              { backgroundColor: theme.text },
              pressed && styles.pressed,
            ]}>
            <ThemedText style={{ color: theme.background }}>Identificar medidor</ThemedText>
          </Pressable>
        </Link>
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
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
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
    borderRadius: Spacing.two,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  pendingBox: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  identifyMeterButton: {
    minHeight: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
