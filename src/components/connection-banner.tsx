import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { CloudUpload, Wifi, WifiOff } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { CloudSyncAnimation } from '@/components/lottie/animations';
import { Spacing } from '@/constants/theme';
import { usePendingSyncCount } from '@/hooks/use-pending-sync-count';
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

function formatPending(count: number): string {
  return count === 1 ? '1 pendiente' : `${count} pendientes`;
}

// HU-009 CA-03: franja común en todas las pantallas con el estado de conexión y, con sesión
// iniciada, las lecturas del técnico pendientes de envío.
export function ConnectionBanner() {
  const isOnline = useIsOnline();
  const { technician } = useSession();
  const { data: pendingCount } = usePendingSyncCount(technician?.employeeCode ?? '');
  const connectionLabel = isOnline ? 'Con conexión' : 'Sin conexión';
  const pendingLabel =
    technician && pendingCount !== undefined ? formatPending(pendingCount) : null;
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const tone = isOnline ? theme.infoForeground : theme.warningForeground;
  const textColor = isOnline ? theme.textSecondary : tone;
  const Icon = isOnline ? Wifi : WifiOff;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessible
      focusable={false}
      accessibilityLabel={
        pendingLabel ? `${connectionLabel}, ${pendingLabel} de envío` : connectionLabel
      }
      className={`px-6 pb-2 flex-row items-center justify-center gap-2 border-b-[0.5px] ${isOnline ? 'bg-background' : 'bg-warning-background'}`} style={{ paddingTop: insets.top + Spacing.one, borderBottomColor: isOnline ? theme.border : tone }}>
      <Icon color={tone} size={16} strokeWidth={2.25} />
      <Text className="text-[13px] font-semibold text-center" style={{ color: textColor }}>{connectionLabel}</Text>
      {pendingLabel && (
        <>
          <View className="w-[0.5px] h-[16px]" style={{ backgroundColor: isOnline ? theme.border : tone }} />
          {isOnline ? (
            <CloudUpload color={tone} size={16} strokeWidth={2.25} />
          ) : (
            <CloudSyncAnimation
              size={22}
              colors={{ primary: theme.accent, secondary: tone, base: theme.background }}
            />
          )}
          <Text className="text-[13px] font-semibold text-center" style={{ color: textColor }}>{pendingLabel}</Text>
        </>
      )}
    </View>
  );
}


