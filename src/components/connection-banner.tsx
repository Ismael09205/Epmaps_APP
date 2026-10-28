import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

function subscribe(onChange: () => void) {
  return onlineManager.subscribe(onChange);
}

function getIsOnline() {
  return onlineManager.isOnline();
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getIsOnline);
}

// HU-009 CA-03: franja común en todas las pantallas con el estado de conexión.
export function ConnectionBanner() {
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel={isOnline ? 'Con conexión' : 'Sin conexión'}
      style={[
        styles.banner,
        {
          paddingTop: insets.top + Spacing.one,
          backgroundColor: isOnline ? '#1E6B3A' : '#8A3B00',
        },
      ]}>
      <Text style={styles.text}>
        {isOnline ? 'Con conexión' : 'Sin conexión'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
