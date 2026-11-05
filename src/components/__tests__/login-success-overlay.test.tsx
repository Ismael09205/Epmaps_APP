import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import {
  holdSessionTransition,
  isSessionTransitionHeld,
  releaseSessionTransition,
  subscribeSessionTransitionHold,
} from '@/auth/login-success';

import { LoginSuccessOverlay } from '../login-success-overlay';

jest.mock('@/global.css', () => ({}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let renderer: ReactTestRenderer;
const onFinish = jest.fn();

beforeEach(async () => {
  jest.useFakeTimers();
  onFinish.mockReset();
  await act(async () => {
    renderer = create(<LoginSuccessOverlay onFinish={onFinish} />);
  });
});

afterEach(() => {
  act(() => renderer.unmount());
  jest.useRealTimers();
});

describe('LoginSuccessOverlay', () => {
  it('confirma el acceso en el centro de la pantalla', () => {
    const text = renderer.root
      .findAllByType(Text)
      .map((node) => [node.props.children].flat().join(''))
      .join('\n');

    expect(text).toContain('Acceso correcto');
  });

  it('permanece visible un tiempo mínimo aunque la animación termine antes', () => {
    act(() => renderer.root.findByProps({ testID: 'lottie-animation' }).props.onAnimationFinish());
    expect(onFinish).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(2200));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('termina como máximo a los 4 s si la animación no informa su fin', () => {
    act(() => jest.advanceTimersByTime(4000));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});

describe('espera del cambio de pantalla tras el login', () => {
  it('avisa al retener y al liberar la transición', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeSessionTransitionHold(listener);

    holdSessionTransition();
    expect(isSessionTransitionHeld()).toBe(true);
    releaseSessionTransition();
    expect(isSessionTransitionHeld()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });
});
