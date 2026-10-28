import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { Wifi, WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();
  const tone = isOnline ? theme.infoForeground : theme.warningForeground;
  const Icon = isOnline ? Wifi : WifiOff;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel={isOnline ? 'Con conexión' : 'Sin conexión'}
      style={[
        styles.banner,
        {
          paddingTop: insets.top + Spacing.one,
          backgroundColor: isOnline ? theme.background : theme.warningBackground,
          borderBottomColor: isOnline ? theme.border : tone,
        },
      ]}>
      <Icon color={tone} size={16} strokeWidth={2.25} />
      <Text style={[styles.text, { color: isOnline ? theme.textSecondary : tone }]}>
        {isOnline ? 'Con conexión' : 'Sin conexión'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
