import { useEffect, useRef, useState, type RefObject } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { buildLeafletHtml, parseMapMessage } from '@/components/map/leaflet-html';
import type { ReadingLocation } from '@/domain/reading-location';
import { useTheme } from '@/hooks/use-theme';
import { loadTile } from '@/storage/map-tiles';

// Estado y comunicación con el mapa Leaflet de la WebView: entrega las teselas desde el teléfono
// o internet y coloca el marcador de la ubicación.
export function useLeafletMap({
  interactive,
  onManualLocation,
}: {
  interactive: boolean;
  onManualLocation?: (latitude: number, longitude: number) => void;
}) {
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const isMounted = useRef(true);
  const [isReady, setIsReady] = useState(false);
  const [missingTiles, setMissingTiles] = useState(false);
  const [html] = useState(() =>
    buildLeafletHtml(
      { marker: theme.accent, accuracy: theme.accent, missingTile: theme.backgroundElement },
      { interactive },
    ),
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const inject = (code: string) => {
    webViewRef.current?.injectJavaScript(`${code};true;`);
  };

  const showLocation = (location: ReadingLocation, recenter: boolean) => {
    inject(`window.epmapsSetLocation(${JSON.stringify(location)}, ${recenter})`);
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    const message = parseMapMessage(event.nativeEvent.data);
    if (!message) {
      return;
    }

    if (message.type === 'ready') {
      setIsReady(true);
      return;
    }

    if (message.type === 'manual') {
      onManualLocation?.(message.latitude, message.longitude);
      return;
    }

    const online = onlineManager.isOnline();
    void loadTile({ z: message.z, x: message.x, y: message.y }, online).then((src) => {
      if (!isMounted.current) {
        return;
      }

      if (src === null && !online) {
        setMissingTiles(true);
      }
      inject(`window.epmapsTile(${message.id}, ${JSON.stringify(src)})`);
    });
  };

  return {
    webViewRef,
    html,
    handleMessage,
    isReady,
    missingTiles,
    clearMissingTiles: () => setMissingTiles(false),
    showLocation,
  };
}

export function LeafletMapView({
  webViewRef,
  html,
  onMessage,
  height,
  accessibilityLabel,
}: {
  webViewRef: RefObject<WebView | null>;
  html: string;
  onMessage: (event: WebViewMessageEvent) => void;
  height: number;
  accessibilityLabel: string;
}) {
  const theme = useTheme();

  return (
    <View className="rounded-sm overflow-hidden border-[1px] border-border" style={{ height }}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        nestedScrollEnabled
        scrollEnabled={false}
        setBuiltInZoomControls={false}
        accessibilityLabel={accessibilityLabel}
        style={{ backgroundColor: theme.backgroundElement }}
      />
    </View>
  );
}
