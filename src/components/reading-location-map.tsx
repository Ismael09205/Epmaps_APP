import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Download, LocateFixed } from 'lucide-react-native';
import { View } from 'react-native';

import { useIsOnline } from '@/components/connection-banner';
import { LocationSummary } from '@/components/location-summary';
import { LeafletMapView, useLeafletMap } from '@/components/map/leaflet-map';
import { AnimatedButton } from '@/components/motion/animated-button';
import { Notice } from '@/components/notice';
import { ThemedText } from '@/components/themed-text';
import { isLowAccuracy, LOW_ACCURACY_METERS, type ReadingLocation } from '@/domain/reading-location';
import { requestGpsLocation } from '@/location/gps';
import { downloadAreaTiles, isAreaDownloaded, type AreaDownloadResult } from '@/storage/map-tiles';

type DownloadState =
  | { status: 'idle' }
  | { status: 'downloading'; done: number; total: number }
  | { status: 'done'; result: AreaDownloadResult }
  | { status: 'error' };

type GpsStatus = 'idle' | 'locating' | 'denied' | 'services-off' | 'unavailable';

// Ubicación obligatoria de la lectura: se toma del GPS al abrir el formulario y el técnico puede
// ajustarla tocando el mapa o arrastrando el marcador. El mapa funciona sin conexión con las
// teselas guardadas en el teléfono.
export function ReadingLocationMap({
  location,
  onChange,
}: {
  location: ReadingLocation | null;
  onChange: (location: ReadingLocation) => void;
}) {
  const isOnline = useIsOnline();
  const isMounted = useRef(true);
  const hasCentered = useRef(false);
  // Cada solicitud al GPS y cada ajuste manual invalidan las respuestas del GPS anteriores.
  const locationRequest = useRef(0);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>(location === null ? 'locating' : 'idle');
  const [download, setDownload] = useState<DownloadState>({ status: 'idle' });
  // null mientras se comprueba si el mapa de la zona ya está guardado.
  const [isAreaSaved, setIsAreaSaved] = useState<boolean | null>(null);
  const map = useLeafletMap({
    interactive: true,
    onManualLocation: (latitude, longitude) => {
      locationRequest.current += 1;
      setGpsStatus('idle');
      onChange({
        latitude,
        longitude,
        accuracy: null,
        source: 'manual',
        capturedAt: new Date().toISOString(),
      });
    },
  });
  const { isReady: isMapReady, missingTiles, webViewRef, html, handleMessage } = map;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // El estado "obteniendo ubicación" se marca al iniciar (botón o estado inicial) y se actualiza
  // solo tras la respuesta del GPS.
  const updateFromGps = async () => {
    const request = ++locationRequest.current;
    const result = await requestGpsLocation();
    if (!isMounted.current || request !== locationRequest.current) {
      return;
    }

    if (result.status === 'ok') {
      onChange(result.location);
      setGpsStatus('idle');
    } else {
      setGpsStatus(result.status);
    }
  };

  // Por defecto la ubicación es automática: se solicita al GPS cuando la lectura aún no tiene una.
  const needsLocation = location === null;
  const requestInitialLocation = useEffectEvent(() => {
    void updateFromGps();
  });

  const locate = () => {
    setGpsStatus('locating');
    void updateFromGps();
  };
  useEffect(() => {
    if (needsLocation) {
      // Sincroniza con un sistema externo (GPS): el estado solo cambia tras cada respuesta asíncrona.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      requestInitialLocation();
    }
  }, [needsLocation]);

  const syncMarker = useEffectEvent((current: ReadingLocation) => {
    const recenter = current.source === 'gps' || !hasCentered.current;
    hasCentered.current = true;
    map.showLocation(current, recenter);
  });
  useEffect(() => {
    if (isMapReady && location) {
      syncMarker(location);
    }
  }, [isMapReady, location]);


  const latitude = location?.latitude;
  const longitude = location?.longitude;
  useEffect(() => {
    if (latitude === undefined || longitude === undefined) {
      return;
    }

    let cancelled = false;
    void isAreaDownloaded(latitude, longitude).then((saved) => {
      if (!cancelled) {
        setIsAreaSaved(saved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  // Acceso manual: guarda el mapa alrededor de la ubicación para verlo sin conexión.
  const handleDownloadArea = async () => {
    if (!location) {
      return;
    }

    setDownload({ status: 'downloading', done: 0, total: 0 });
    try {
      const result = await downloadAreaTiles(location.latitude, location.longitude, (done, total) => {
        if (isMounted.current) {
          setDownload({ status: 'downloading', done, total });
        }
      });
      if (isMounted.current) {
        setDownload({ status: 'done', result });
        map.clearMissingTiles();
        setIsAreaSaved(result.failed === 0);
      }
    } catch (error: unknown) {
      console.warn('No se pudo descargar el mapa de la zona.', error);
      if (isMounted.current) {
        setDownload({ status: 'error' });
      }
    }
  };

  const isLocating = gpsStatus === 'locating';
  const isDownloading = download.status === 'downloading';

  return (
    <View className="gap-2">
      <ThemedText type="smallBold">Ubicación del medidor (obligatoria)</ThemedText>
      <LeafletMapView
        webViewRef={webViewRef}
        html={html}
        onMessage={handleMessage}
        height={260}
        accessibilityLabel="Mapa de la ubicación del medidor. Toque el mapa o arrastre el marcador para ajustar la ubicación."
      />
      <ThemedText type="small" themeColor="textSecondary">
        Toque el mapa o arrastre el marcador para ajustar la ubicación manualmente.
      </ThemedText>

      {isLocating ? (
        <Notice tone="loading">Obteniendo la ubicación del GPS…</Notice>
      ) : location ? (
        <View accessibilityLiveRegion="polite">
          <LocationSummary location={location} />
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          Sin ubicación: no se puede registrar la lectura hasta definirla.
        </ThemedText>
      )}
      {location && isLowAccuracy(location) && (
        <Notice tone="warning">
          {`La precisión del GPS es baja (más de ${LOW_ACCURACY_METERS} m). Puede esperar y volver a obtener la ubicación, o ajustarla en el mapa.`}
        </Notice>
      )}
      {gpsStatus === 'denied' && (
        <Notice tone="warning">
          Sin permiso de ubicación. Active el permiso en los ajustes del teléfono o marque la ubicación en el mapa.
        </Notice>
      )}
      {gpsStatus === 'services-off' && (
        <Notice tone="warning">
          El GPS del teléfono está desactivado. Actívelo o marque la ubicación en el mapa.
        </Notice>
      )}
      {gpsStatus === 'unavailable' && (
        <Notice tone="warning">
          No se pudo obtener la ubicación del GPS. Inténtelo de nuevo o marque la ubicación en el mapa.
        </Notice>
      )}
      {missingTiles && !isOnline && (
        <Notice tone="info">
          Sin conexión: el mapa solo muestra las zonas descargadas. Puede registrar la ubicación igualmente.
        </Notice>
      )}

      <AnimatedButton
        label="Usar mi ubicación actual"
        busyLabel="Obteniendo ubicación…"
        icon={LocateFixed}
        variant="secondary"
        status={isLocating ? 'busy' : 'idle'}
        disabled={isLocating}
        onPress={locate}
      />
      <AnimatedButton
        label={isAreaSaved ? 'Actualizar mapa de esta zona' : 'Descargar mapa de esta zona'}
        busyLabel={
          isDownloading && download.total > 0
            ? `Descargando mapa… ${download.done}/${download.total}`
            : 'Descargando mapa…'
        }
        accessibilityHint="Guarda el mapa alrededor de la ubicación para verlo sin conexión."
        icon={Download}
        variant="secondary"
        status={isDownloading ? 'busy' : 'idle'}
        disabled={!isOnline || !location || isDownloading}
        onPress={() => void handleDownloadArea()}
      />
      {!isOnline && !isAreaSaved && (
        <ThemedText type="small" themeColor="textSecondary">
          La descarga del mapa requiere conexión.
        </ThemedText>
      )}
      {location && isAreaSaved === true && !isDownloading && (
        <Notice tone="success">Mapa de esta zona disponible sin conexión.</Notice>
      )}
      {download.status === 'done' && download.result.failed > 0 && (
        <Notice tone="warning">
          {`No se guardaron ${download.result.failed} de ${download.result.total} partes del mapa. Inténtelo de nuevo con conexión.`}
        </Notice>
      )}
      {download.status === 'error' && (
        <Notice tone="error">No se pudo descargar el mapa de la zona.</Notice>
      )}
    </View>
  );
}
