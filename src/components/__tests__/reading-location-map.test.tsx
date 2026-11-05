import { onlineManager } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { downloadAreaTiles, isAreaDownloaded, loadTile } from '@/storage/map-tiles';

import { ReadingLocationMap } from '../reading-location-map';

const mockInject = jest.fn();

jest.mock('react-native-webview', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    WebView: React.forwardRef(function MockWebView(props: object, ref) {
      React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInject }));
      return React.createElement(View, { ...props, testID: 'map-webview' });
    }),
  };
});

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));

jest.mock('@/storage/map-tiles', () => ({
  loadTile: jest.fn(),
  downloadAreaTiles: jest.fn(),
  isAreaDownloaded: jest.fn(),
}));

jest.mock('@/components/map/leaflet-assets', () => ({
  LEAFLET_CSS: '',
  LEAFLET_JS: '',
  LEAFLET_VERSION: 'test',
}));

jest.mock('@/components/connection-banner', () => ({
  useIsOnline: () =>
    jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
      .onlineManager.isOnline(),
}));

jest.mock('@/global.css', () => ({}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const mockedLocation = Location as jest.Mocked<typeof Location>;
const mockedLoadTile = loadTile as jest.Mock;
const mockedIsAreaDownloaded = isAreaDownloaded as jest.Mock;
const mockedDownload = downloadAreaTiles as jest.Mock;

const position = {
  coords: {
    latitude: -0.180653,
    longitude: -78.467834,
    accuracy: 8,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.parse('2026-10-27T15:29:00.000Z'),
};

let renderer: ReactTestRenderer;
const onChange = jest.fn();

async function renderMap(location: Parameters<typeof ReadingLocationMap>[0]['location'] = null) {
  await act(async () => {
    renderer = create(<ReadingLocationMap location={location} onChange={onChange} />);
  });
}

function visibleText(): string {
  return renderer.root
    .findAllByType(Text)
    .map((node) => [node.props.children].flat().join(''))
    .join('\n');
}

async function sendMapMessage(message: object) {
  const webView = renderer.root.findByProps({ testID: 'map-webview' });
  await act(async () => {
    webView.props.onMessage({ nativeEvent: { data: JSON.stringify(message) } });
  });
}

beforeEach(() => {
  onChange.mockReset();
  mockInject.mockReset();
  mockedLoadTile.mockReset();
  mockedIsAreaDownloaded.mockReset().mockResolvedValue(false);
  mockedDownload.mockReset().mockResolvedValue({ total: 190, downloaded: 190, failed: 0 });
  mockedLocation.requestForegroundPermissionsAsync.mockReset().mockResolvedValue({
    granted: true,
  } as Location.LocationPermissionResponse);
  mockedLocation.hasServicesEnabledAsync.mockReset().mockResolvedValue(true);
  mockedLocation.getCurrentPositionAsync.mockReset().mockResolvedValue(position);
  mockedLocation.getLastKnownPositionAsync.mockReset().mockResolvedValue(null);
  onlineManager.setOnline(true);
});

afterEach(() => {
  act(() => renderer.unmount());
});

describe('ReadingLocationMap', () => {
  it('registra por defecto la ubicación del GPS con su precisión', async () => {
    await renderMap();

    expect(onChange).toHaveBeenCalledWith({
      latitude: -0.180653,
      longitude: -78.467834,
      accuracy: 8,
      source: 'gps',
      capturedAt: '2026-10-27T15:29:00.000Z',
    });
  });

  it('no solicita el GPS si la lectura ya tiene ubicación', async () => {
    await renderMap({
      latitude: -0.18,
      longitude: -78.46,
      accuracy: null,
      source: 'manual',
      capturedAt: '2026-10-27T15:29:00.000Z',
    });

    expect(mockedLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(visibleText()).toContain('Ubicación marcada en el mapa');
    expect(visibleText()).not.toContain('-78.46');
  });

  it('sin permiso de ubicación permite marcarla en el mapa', async () => {
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
    } as Location.LocationPermissionResponse);

    await renderMap();

    expect(onChange).not.toHaveBeenCalled();
    expect(visibleText()).toContain('Sin permiso de ubicación');
  });

  it('advierte la precisión baja del GPS sin bloquear la ubicación', async () => {
    await renderMap({
      latitude: -0.18,
      longitude: -78.46,
      accuracy: 120,
      source: 'gps',
      capturedAt: '2026-10-27T15:29:00.000Z',
    });

    expect(visibleText()).toContain('La precisión del GPS es baja');
  });

  it('registra la ubicación manual al tocar el mapa o arrastrar el marcador', async () => {
    await renderMap();
    onChange.mockReset();

    await sendMapMessage({ type: 'manual', latitude: -0.1811, longitude: -78.4681 });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: -0.1811,
        longitude: -78.4681,
        accuracy: null,
        source: 'manual',
      }),
    );
  });

  it('una respuesta tardía del GPS no reemplaza la ubicación manual', async () => {
    let resolvePosition: (value: typeof position) => void = () => undefined;
    mockedLocation.getCurrentPositionAsync.mockReturnValue(
      new Promise((resolve) => {
        resolvePosition = resolve;
      }),
    );
    await renderMap();

    await sendMapMessage({ type: 'manual', latitude: -0.1811, longitude: -78.4681 });
    await act(async () => resolvePosition(position));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ source: 'manual' }));
  });

  it('entrega al mapa las teselas guardadas y avisa sin conexión si faltan', async () => {
    mockedLoadTile.mockResolvedValue(null);
    onlineManager.setOnline(false);
    await renderMap();

    await sendMapMessage({ type: 'tile', id: 7, z: 16, x: 18483, y: 32800 });

    expect(mockedLoadTile).toHaveBeenCalledWith({ z: 16, x: 18483, y: 32800 }, false);
    expect(mockInject).toHaveBeenCalledWith('window.epmapsTile(7, null);true;');
    expect(visibleText()).toContain('el mapa solo muestra las zonas descargadas');
  });
});

describe('información de la ubicación', () => {
  it('muestra el origen y la precisión del GPS en lugar de las coordenadas', async () => {
    await renderMap();
    await act(async () => {
      renderer.update(<ReadingLocationMap location={onChange.mock.calls[0][0]} onChange={onChange} />);
    });

    const text = visibleText();
    expect(text).toContain('Ubicación por GPS');
    expect(text).toContain('Alta · ±8 m');
    expect(text).toContain('El punto puede desviarse hasta 8 m del lugar real.');
    expect(text).not.toContain('-0.180653');
  });
});


describe('descarga manual del mapa', () => {
  const gpsLocation = {
    latitude: -0.180653,
    longitude: -78.467834,
    accuracy: 8,
    source: 'gps' as const,
    capturedAt: '2026-10-27T15:29:00.000Z',
  };

  it('descarga el mapa alrededor de la ubicación al pulsar el botón', async () => {
    await renderMap(gpsLocation);
    const button = renderer.root
      .findAll((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
      .find((node) => node.findAllByType(Text).some((text) => text.props.children === 'Descargar mapa de esta zona'));

    await act(async () => {
      button!.props.onPress();
    });

    expect(mockedDownload).toHaveBeenCalledWith(-0.180653, -78.467834, expect.any(Function));
    expect(visibleText()).toContain('Mapa de esta zona disponible sin conexión.');
  });

  it('indica si la zona ya está guardada', async () => {
    mockedIsAreaDownloaded.mockResolvedValue(true);
    await renderMap(gpsLocation);

    expect(visibleText()).toContain('Actualizar mapa de esta zona');
    expect(visibleText()).toContain('Mapa de esta zona disponible sin conexión.');
  });
});
