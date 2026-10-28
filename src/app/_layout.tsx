import { useEffect } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';

import { SessionProvider, useSession } from '@/auth/session-context';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ConnectionBanner } from '@/components/connection-banner';
import { PendingDraftPrompt } from '@/components/pending-draft-prompt';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  persistOptions,
  pruneExpiredMeterCache,
  queryClient,
  setupNetworkManager,
} from '@/query/query-client';
import { setupReadingVerification } from '@/query/reading-verification';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    setupNetworkManager();
    return setupReadingVerification(queryClient);
  }, []);

  return (
    <SessionProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
        onSuccess={() => pruneExpiredMeterCache(queryClient)}
        onError={() => {
          console.error('No se pudo restaurar la caché de medidores.');
        }}>
        <SessionNavigator />
      </PersistQueryClientProvider>
    </SessionProvider>
  );
}

function SessionNavigator() {
  const { status } = useSession();
  const colorScheme = useColorScheme();
  const theme = useTheme();

  if (status === 'loading') {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator
          color={theme.accent}
          size="large"
          accessibilityLabel="Cargando sesión"
        />
        <ThemedText themeColor="textSecondary">Cargando sesión…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <View style={styles.app}>
        <ConnectionBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={status === 'authenticated'}>
            <Stack.Screen name="index" />
            <Stack.Screen name="medidor" />
          </Stack.Protected>
          <Stack.Protected guard={status !== 'authenticated'}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
      </View>
      <PendingDraftPrompt />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
