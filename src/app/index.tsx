import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const { technician, signOut } = useSession();
  const theme = useTheme();

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
  pressed: {
    opacity: 0.7,
  },
});
