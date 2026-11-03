import { onlineManager } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { ConnectionBanner } from '../connection-banner';

const mockUseSession = jest.fn();
const mockUsePendingSyncCount = jest.fn();

jest.mock('@/auth/session-context', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('@/hooks/use-pending-sync-count', () => ({
  usePendingSyncCount: (employeeCode: string) => mockUsePendingSyncCount(employeeCode),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0 }),
}));

jest.mock('@/global.css', () => ({}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const technician = { employeeCode: 'EPM-1001', name: 'Ana', surname: 'Guamán' };

let renderer: ReactTestRenderer;

async function renderBanner() {
  await act(async () => {
    renderer = create(<ConnectionBanner />);
  });
}

function visibleTexts() {
  return renderer.root.findAllByType(Text).map((node) => node.props.children);
}

beforeEach(() => {
  jest.clearAllMocks();
  onlineManager.setOnline(true);
  mockUseSession.mockReturnValue({ technician });
  mockUsePendingSyncCount.mockReturnValue({ data: 3 });
});

afterEach(async () => {
  await act(async () => {
    renderer.unmount();
  });
});

describe('ConnectionBanner', () => {
  it('muestra la conexión y las lecturas pendientes del técnico', async () => {
    await renderBanner();

    expect(mockUsePendingSyncCount).toHaveBeenCalledWith('EPM-1001');
    expect(visibleTexts()).toEqual(['Con conexión', '3 pendientes']);
  });

  it('muestra las pendientes también sin conexión', async () => {
    onlineManager.setOnline(false);

    await renderBanner();

    expect(visibleTexts()).toEqual(['Sin conexión', '3 pendientes']);
  });

  it('usa el singular con una sola pendiente', async () => {
    mockUsePendingSyncCount.mockReturnValue({ data: 1 });

    await renderBanner();

    expect(visibleTexts()).toEqual(['Con conexión', '1 pendiente']);
  });

  it('muestra cero cuando no quedan pendientes', async () => {
    mockUsePendingSyncCount.mockReturnValue({ data: 0 });

    await renderBanner();

    expect(visibleTexts()).toEqual(['Con conexión', '0 pendientes']);
  });

  it('muestra solo la conexión mientras no se conoce la cantidad', async () => {
    mockUsePendingSyncCount.mockReturnValue({ data: undefined });

    await renderBanner();

    expect(visibleTexts()).toEqual(['Con conexión']);
  });

  it('muestra solo la conexión sin sesión iniciada', async () => {
    mockUseSession.mockReturnValue({ technician: null });
    mockUsePendingSyncCount.mockReturnValue({ data: undefined });

    await renderBanner();

    expect(visibleTexts()).toEqual(['Con conexión']);
  });
});
