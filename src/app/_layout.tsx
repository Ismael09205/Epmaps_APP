import '@/global.css';

import { useEffect, useState } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, Platform, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SessionProvider, useSession, type SessionStatus } from '@/auth/session-context';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ConnectionBanner } from '@/components/connection-banner';
import {
  CircularTransitionHost,
  ParallaxArea,
  useCircularNavigation,
} from '@/components/motion/circular-transition';
import { PendingDraftPrompt } from '@/components/pending-draft-prompt';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
    </GestureHandlerRootView>
  );
}

function SessionNavigator() {
  const { status } = useSession();
  // Pantallas que se muestran: siguen a la sesión, pero cambian cuando el círculo ya cubrió la vista.
  const [shownStatus, setShownStatus] = useState(status);
  if (shownStatus === 'loading' && status !== 'loading') {
    setShownStatus(status);
  }
  const colorScheme = useColorScheme();
  const theme = useTheme();

  if (status === 'loading') {
    return (
      <ThemedView className="flex-1 items-center justify-center gap-4">
        <ActivityIndicator color={theme.accent} size="large" accessibilityLabel="Cargando sesión" />
        <ThemedText themeColor="textSecondary">Cargando sesión…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <CircularTransitionHost>
        <View className="flex-1">
          <ConnectionBanner />
          <ParallaxArea>
            <SessionTransition
              status={status}
              shownStatus={shownStatus}
              onCovered={() => setShownStatus(status)}
            />
            <Stack
              screenOptions={{
                headerShown: false,
                // Sin fundido nativo en Android: el círculo cubre el cambio y evita el destello.
                animation: Platform.OS === 'ios' ? 'default' : 'none',
                contentStyle: { backgroundColor: theme.background },
              }}>
              <Stack.Protected guard={shownStatus === 'authenticated'}>
                <Stack.Screen name="index" />
                <Stack.Screen name="medidor" />
                <Stack.Screen name="editar-nombre" />
              </Stack.Protected>
              <Stack.Protected guard={shownStatus === 'pending-verification'}>
                <Stack.Screen name="verificar-correo" />
              </Stack.Protected>
              <Stack.Protected guard={shownStatus === 'unauthenticated'}>
                <Stack.Screen name="login" />
                <Stack.Screen name="crear-cuenta" />
                <Stack.Screen name="recuperar-clave" />
              </Stack.Protected>
            </Stack>
          </ParallaxArea>
        </View>
      </CircularTransitionHost>
      <PendingDraftPrompt />
    </ThemeProvider>
  );
}

// Iniciar o cerrar sesión no pasa por un botón de navegación: las pantallas protegidas cambian
// cuando el círculo ya cubrió la vista, igual que en el resto de la app.
function SessionTransition({
  status,
  shownStatus,
  onCovered,
}: {
  status: SessionStatus;
  shownStatus: SessionStatus;
  onCovered: () => void;
}) {
  const { runSessionTransition } = useCircularNavigation();

  useEffect(() => {
    if (status !== shownStatus) {
      runSessionTransition(onCovered);
    }
    // Solo reacciona al cambio de estado; `onCovered` se crea en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, shownStatus]);

  return null;
}
