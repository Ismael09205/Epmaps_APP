import { onlineManager } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { loadTile } from '@/storage/map-tiles';

import { LocationMapPreview } from '../location-map-preview';

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

jest.mock('@/storage/map-tiles', () => ({ loadTile: jest.fn() }));

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

const location = {
  latitude: -0.180653,
  longitude: -78.467834,
  accuracy: 8,
  source: 'gps' as const,
  capturedAt: '2026-10-27T15:29:00.000Z',
};

let renderer: ReactTestRenderer;

async function sendMapMessage(message: object) {
  const webView = renderer.root.findByProps({ testID: 'map-webview' });
  await act(async () => {
    webView.props.onMessage({ nativeEvent: { data: JSON.stringify(message) } });
  });
}

beforeEach(async () => {
  mockInject.mockReset();
  (loadTile as jest.Mock).mockReset().mockResolvedValue(null);
  onlineManager.setOnline(true);
  await act(async () => {
    renderer = create(<LocationMapPreview location={location} />);
  });
});

afterEach(() => {
  act(() => renderer.unmount());
});

describe('LocationMapPreview', () => {
  it('coloca el marcador en la ubicación registrada al cargar el mapa', async () => {
    await sendMapMessage({ type: 'ready' });

    expect(mockInject).toHaveBeenCalledWith(
      `window.epmapsSetLocation(${JSON.stringify(location)}, true);true;`,
    );
  });

  it('usa un mapa de solo lectura: el marcador no se puede mover', () => {
    const html: string = renderer.root.findByProps({ testID: 'map-webview' }).props.source.html;

    expect(html).toContain('var interactive = false;');
  });

  it('sin conexión avisa si el mapa de la zona no está descargado', async () => {
    onlineManager.setOnline(false);
    await sendMapMessage({ type: 'tile', id: 1, z: 16, x: 18483, y: 32800 });

    const text = renderer.root
      .findAllByType(Text)
      .map((node) => [node.props.children].flat().join(''))
      .join('\n');
    expect(text).toContain('el marcador indica la ubicación registrada');
  });
});
