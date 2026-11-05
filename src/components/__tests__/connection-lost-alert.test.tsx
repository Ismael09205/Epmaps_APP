import { onlineManager } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import { ConnectionLostAlert } from '../connection-lost-alert';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/global.css', () => ({}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let renderer: ReactTestRenderer;

function visibleText(): string {
  return renderer.root
    .findAllByType(Text)
    .map((node) => [node.props.children].flat().join(''))
    .join('\n');
}

beforeEach(async () => {
  jest.useFakeTimers();
  onlineManager.setOnline(true);
  await act(async () => {
    renderer = create(<ConnectionLostAlert />);
  });
});

afterEach(() => {
  act(() => renderer.unmount());
  jest.useRealTimers();
});

describe('ConnectionLostAlert', () => {
  it('no aparece mientras hay conexión', () => {
    expect(renderer.toJSON()).toBeNull();
  });

  it('avisa con la animación cuando se pierde la conexión', () => {
    act(() => onlineManager.setOnline(false));

    expect(visibleText()).toContain('Se perdió la conexión');
    expect(renderer.root.findByProps({ testID: 'lottie-animation' }).props.loop).toBe(true);
  });

  it('se retira sola, al cerrarla o al recuperar la conexión', () => {
    act(() => onlineManager.setOnline(false));
    act(() => jest.advanceTimersByTime(6000));
    expect(renderer.toJSON()).toBeNull();

    act(() => onlineManager.setOnline(true));
    act(() => onlineManager.setOnline(false));
    expect(renderer.toJSON()).not.toBeNull();
    act(() => onlineManager.setOnline(true));
    expect(renderer.toJSON()).toBeNull();

    act(() => onlineManager.setOnline(false));
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: 'Cerrar aviso de conexión' }).props.onPress();
    });
    expect(renderer.toJSON()).toBeNull();
  });
});
