import { onlineManager } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { getKnownGpsLocation } from '@/location/gps';
import { isAreaDownloaded } from '@/storage/map-tiles';

import { OfflineMapPrompt } from '../offline-map-prompt';

jest.mock('@/location/gps', () => ({
  getKnownGpsLocation: jest.fn(),
}));

jest.mock('@/storage/map-tiles', () => ({
  isAreaDownloaded: jest.fn(),
}));

jest.mock('@/components/connection-banner', () => ({
  useIsOnline: () =>
    jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
      .onlineManager.isOnline(),
}));

jest.mock('@/global.css', () => ({}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const mockedKnown = getKnownGpsLocation as jest.Mock;
const mockedIsSaved = isAreaDownloaded as jest.Mock;

const location = {
  latitude: -0.180653,
  longitude: -78.467834,
  accuracy: 8,
  source: 'gps' as const,
  capturedAt: '2026-10-27T15:29:00.000Z',
};

let renderer: ReactTestRenderer;
const blurTarget = { current: null };

async function renderPrompt(meterCode: string | null = 'MED-123456') {
  await act(async () => {
    renderer = create(<OfflineMapPrompt meterCode={meterCode} blurTarget={blurTarget} />);
  });
}

function visibleText(): string {
  return renderer.root
    .findAllByType(Text)
    .map((node) => [node.props.children].flat().join(''))
    .join('\n');
}

async function accept() {
  const button = renderer.root
    .findAll((node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
    .find((node) => node.findAllByType(Text).some((text) => text.props.children === 'Aceptar'));
  await act(async () => {
    button!.props.onPress();
  });
}

beforeEach(() => {
  onlineManager.setOnline(true);
  mockedKnown.mockReset().mockResolvedValue(null);
  mockedIsSaved.mockReset().mockResolvedValue(false);
});

afterEach(() => {
  act(() => renderer.unmount());
});

describe('OfflineMapPrompt', () => {
  it('no aparece mientras no se consulta un medidor', async () => {
    await renderPrompt(null);

    expect(visibleText()).not.toContain('¿Va a trabajar sin conexión?');
    expect(mockedKnown).not.toHaveBeenCalled();
  });

  it('al consultar con conexión informa la recomendación con un único botón Aceptar', async () => {
    await renderPrompt();

    expect(visibleText()).toContain('¿Va a trabajar sin conexión?');
    expect(visibleText()).toContain('Aceptar');
    expect(visibleText()).not.toContain('Descargar mapa');
  });

  it('no aparece si el mapa de la zona conocida ya está guardado', async () => {
    mockedKnown.mockResolvedValue(location);
    mockedIsSaved.mockResolvedValue(true);

    await renderPrompt();

    expect(mockedIsSaved).toHaveBeenCalledWith(-0.180653, -78.467834);
    expect(visibleText()).not.toContain('¿Va a trabajar sin conexión?');
  });

  it('no aparece sin conexión', async () => {
    onlineManager.setOnline(false);

    await renderPrompt();

    expect(visibleText()).not.toContain('¿Va a trabajar sin conexión?');
  });

  it('al aceptar se cierra y no vuelve a aparecer para el mismo medidor', async () => {
    await renderPrompt();

    await accept();
    expect(visibleText()).not.toContain('¿Va a trabajar sin conexión?');

    await act(async () => {
      renderer.update(<OfflineMapPrompt meterCode={null} blurTarget={blurTarget} />);
    });
    await act(async () => {
      renderer.update(<OfflineMapPrompt meterCode="MED-123456" blurTarget={blurTarget} />);
    });
    expect(visibleText()).not.toContain('¿Va a trabajar sin conexión?');
  });
});

describe('fondo de la recomendación', () => {
  it('difumina la pantalla de fondo con expo-blur', async () => {
    const { BlurView } = jest.requireActual<typeof import('expo-blur')>('expo-blur');
    await renderPrompt();

    const blur = renderer.root.findByType(BlurView);
    expect(blur.props.blurTarget).toBe(blurTarget);
    expect(blur.props.blurMethod).toBe('dimezisBlurViewSdk31Plus');
  });
});
