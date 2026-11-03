import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BackHandler, Text } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { AnimatedButton } from '../motion/animated-button';
import { resolveInputState } from '../motion/animated-input-frame';
import {
  circleDiameter,
  CircularTransitionHost,
  useCircularNavigation,
} from '../motion/circular-transition';
import { ExpandableContent, RevealSection } from '../motion/expandable';
import { CONFIRMATION_VISIBLE_MS, Notice } from '../notice';
import { syncProgressPercent, SyncStatusPill } from '../motion/sync-indicators';

jest.mock('@/global.css', () => ({}));

const mockBack = jest.fn();
let mockCanGoBack = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => mockCanGoBack }),
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let renderer: ReactTestRenderer;

async function render(element: React.ReactElement) {
  await act(async () => {
    renderer = create(element);
  });
}

function texts() {
  return renderer.root.findAllByType(Text).map((node) => node.props.children);
}

describe('resolveInputState', () => {
  it.each([
    [{ isFocused: false, isInvalid: false, isValid: false }, 'idle'],
    [{ isFocused: true, isInvalid: false, isValid: false }, 'focused'],
    [{ isFocused: true, isInvalid: false, isValid: true }, 'valid'],
    [{ isFocused: true, isInvalid: true, isValid: false }, 'error'],
    [{ isFocused: false, isInvalid: true, isValid: true }, 'error'],
  ] as const)('%j resulta en %s', (input, expected) => {
    expect(resolveInputState(input)).toBe(expected);
  });
});

describe('AnimatedButton', () => {
  function pressable() {
    return renderer.root.findAll(
      (node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
    )[0];
  }

  it('ejecuta la acción en estado normal', async () => {
    const onPress = jest.fn();
    await render(<AnimatedButton label="Ingresar" onPress={onPress} />);

    pressable().props.onPress({});

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(pressable().props.disabled).toBe(false);
  });

  it('se bloquea y muestra el texto de carga mientras trabaja', async () => {
    await render(
      <AnimatedButton label="Ingresar" busyLabel="Verificando…" status="busy" onPress={jest.fn()} />,
    );

    expect(pressable().props.disabled).toBe(true);
    expect(pressable().props.accessibilityState.busy).toBe(true);
    expect(texts()).toContain('Verificando…');
  });

  it('muestra el texto de éxito y no admite otra pulsación', async () => {
    await render(
      <AnimatedButton label="Enviar" successLabel="Enviado" status="success" onPress={jest.fn()} />,
    );

    expect(pressable().props.disabled).toBe(true);
    expect(texts()).toContain('Enviado');
  });
});

describe('ExpandableContent', () => {
  it('oculta el contenido cerrado al lector de pantalla', async () => {
    await render(
      <ExpandableContent expanded={false} testID="contenido">
        <Text>Detalle</Text>
      </ExpandableContent>,
    );

    const box = renderer.root.findAll(
      (node) => node.props.testID === 'contenido' && typeof node.type === 'string',
    )[0];
    expect(box.props.accessibilityElementsHidden).toBe(true);
    expect(box.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

describe('indicadores de sincronización', () => {
  it('calcula el avance del período', () => {
    expect(syncProgressPercent(0, 0)).toBe(0);
    expect(syncProgressPercent(1, 3)).toBe(25);
    expect(syncProgressPercent(4, 0)).toBe(100);
  });

  it.each([
    ['pending', 'Pendiente'],
    ['sent', 'Enviado'],
  ] as const)('el estado %s se muestra como %s', async (status, label) => {
    await render(<SyncStatusPill status={status} />);

    expect(texts()).toContain(label);
  });
});

describe('transición circular', () => {
  let navigation: ReturnType<typeof useCircularNavigation>;

  function Capture() {
    navigation = useCircularNavigation();
    return null;
  }

  async function renderHost() {
    await render(
      <CircularTransitionHost>
        <Capture />
      </CircularTransitionHost>,
    );
    const area = renderer.root.findAll(
      (node) => typeof node.props.onLayout === 'function' && typeof node.type === 'string',
    )[0];
    await act(async () => {
      area.props.onLayout({ nativeEvent: { layout: { x: 0, y: 40, width: 400, height: 800 } } });
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    (useReducedMotion as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('el círculo alcanza la esquina más lejana del punto tocado', () => {
    expect(circleDiameter(0, 0, 300, 400)).toBe(1000);
    expect(circleDiameter(150, 200, 300, 400)).toBe(500);
  });

  it('navega cuando el círculo ya cubrió la pantalla', async () => {
    await renderHost();
    const navigate = jest.fn();

    navigation.navigateWithReveal(null, navigate);
    expect(navigate).not.toHaveBeenCalled();

    jest.advanceTimersByTime(260);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('ignora una segunda navegación mientras la transición sigue en curso', async () => {
    await renderHost();
    const navigate = jest.fn();

    navigation.navigateWithReveal(null, navigate);
    navigation.navigateWithReveal(null, navigate);
    jest.advanceTimersByTime(260);

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  describe('botón atrás de Android', () => {
    let listener: () => boolean;

    beforeEach(() => {
      mockBack.mockClear();
      mockCanGoBack = true;
      jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
        listener = handler as () => boolean;
        return { remove: jest.fn() };
      });
    });

    it('vuelve con la transición circular', async () => {
      await renderHost();

      expect(listener()).toBe(true);
      expect(mockBack).not.toHaveBeenCalled();

      jest.advanceTimersByTime(260);
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it('deja actuar al sistema si no hay pantalla anterior', async () => {
      mockCanGoBack = false;
      await renderHost();

      expect(listener()).toBe(false);
      jest.advanceTimersByTime(1000);
      expect(mockBack).not.toHaveBeenCalled();
    });
  });

  it('aplica el cambio de sesión cuando el círculo ya cubrió la pantalla', async () => {
    await renderHost();
    const change = jest.fn();

    navigation.runSessionTransition(change);
    expect(change).not.toHaveBeenCalled();

    jest.advanceTimersByTime(420);
    expect(change).toHaveBeenCalledTimes(1);
  });

  it('nunca descarta un cambio de sesión si ya hay una transición en curso', async () => {
    await renderHost();
    const change = jest.fn();

    navigation.navigateWithReveal(null, jest.fn());
    navigation.runSessionTransition(change);

    expect(change).toHaveBeenCalledTimes(1);
  });

  it('navega de inmediato si el teléfono pide reducir el movimiento', async () => {
    (useReducedMotion as jest.Mock).mockReturnValue(true);
    await renderHost();
    const navigate = jest.fn();

    navigation.navigateWithReveal(null, navigate);

    expect(navigate).toHaveBeenCalledTimes(1);
  });
});

describe('Notice', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function advance(ms: number) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  }

  it('retira sola una confirmación breve', async () => {
    await render(<Notice tone="success">Datos consultados.</Notice>);
    expect(texts()).toContain('Datos consultados.');

    await advance(CONFIRMATION_VISIBLE_MS + 300);

    expect(renderer.toJSON()).toBeNull();
  });

  it.each([
    ['un aviso', <Notice key="a" tone="warning">Sin conexión.</Notice>],
    ['un error', <Notice key="b" tone="error">No se pudo guardar.</Notice>],
    [
      'una confirmación con título',
      <Notice key="c" tone="success" title="Registro guardado.">Comparación pendiente.</Notice>,
    ],
  ])('conserva %s', async (_case, element) => {
    await render(element);

    await advance(CONFIRMATION_VISIBLE_MS + 300);

    expect(renderer.toJSON()).not.toBeNull();
  });
});

describe('RevealSection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('no ocupa espacio mientras no aplica', async () => {
    await render(
      <RevealSection visible={false}>
        <Text>Motivo</Text>
      </RevealSection>,
    );

    expect(renderer.toJSON()).toBeNull();
  });

  it('aparece al activarse y se retira tras plegarse', async () => {
    await render(
      <RevealSection visible>
        <Text>Motivo</Text>
      </RevealSection>,
    );
    expect(texts()).toContain('Motivo');

    await act(async () => {
      renderer.update(
        <RevealSection visible={false}>
          <Text>Motivo</Text>
        </RevealSection>,
      );
    });
    expect(texts()).toContain('Motivo');

    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(renderer.toJSON()).toBeNull();
  });
});
