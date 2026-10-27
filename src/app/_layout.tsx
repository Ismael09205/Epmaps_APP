import { DarkTheme, DefaultTheme, Redirect, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { SessionProvider, useSession } from '@/auth/session-context';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <SessionNavigator />
    </SessionProvider>
  );
}

function SessionNavigator() {
  const { status } = useSession();
  const colorScheme = useColorScheme();

  if (status === 'loading') {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" accessibilityLabel="Cargando sesión" />
        <ThemedText themeColor="textSecondary">Cargando sesión…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={status === 'authenticated'}>
          <Stack.Screen name="index" />
        </Stack.Protected>
        <Stack.Protected guard={status !== 'authenticated'}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
