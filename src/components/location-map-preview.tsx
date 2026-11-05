import { useEffect, useEffectEvent } from 'react';
import { View } from 'react-native';

import { useIsOnline } from '@/components/connection-banner';
import { LeafletMapView, useLeafletMap } from '@/components/map/leaflet-map';
import { ThemedText } from '@/components/themed-text';
import type { ReadingLocation } from '@/domain/reading-location';

// Mapa de solo lectura con un marcador en la ubicación donde se registró la lectura.
export function LocationMapPreview({ location }: { location: ReadingLocation }) {
  const isOnline = useIsOnline();
  const map = useLeafletMap({ interactive: false });
  const { webViewRef, html, handleMessage, isReady, missingTiles } = map;

  const showMarker = useEffectEvent((current: ReadingLocation) => {
    map.showLocation(current, true);
  });
  useEffect(() => {
    if (isReady) {
      showMarker(location);
    }
  }, [isReady, location]);

  return (
    <View className="gap-2">
      <LeafletMapView
        webViewRef={webViewRef}
        html={html}
        onMessage={handleMessage}
        height={200}
        accessibilityLabel="Mapa con un marcador en la ubicación donde se registró la lectura."
      />
      {missingTiles && !isOnline && (
        <ThemedText type="small" themeColor="textSecondary">
          Sin conexión: el mapa de esta zona no está descargado, pero el marcador indica la ubicación
          registrada.
        </ThemedText>
      )}
    </View>
  );
}
