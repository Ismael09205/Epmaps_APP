import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';

import LoginScreen from '../../app/login';

const mockSetParams = jest.fn();
const mockSignIn = jest.fn();
let mockParams: { email?: string; notice?: string } = {};

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ signIn: mockSignIn }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), setParams: mockSetParams }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

jest.mock('@/global.css', () => ({}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let renderer: ReactTestRenderer;

async function renderScreen() {
  await act(async () => {
    renderer = create(<LoginScreen />);
  });
}

function input(label: string) {
  return renderer.root
    .findAllByType(TextInput)
    .find((candidate) => candidate.props.accessibilityLabel === label);
}

function hasNotice() {
  return renderer.root.findAll((node) => node.props.children === 'Revise su correo').length > 0;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

describe('regreso desde la recuperación de clave', () => {
  it('sin parámetros no muestra el aviso', async () => {
    await renderScreen();

    expect(hasNotice()).toBe(false);
    expect(input('Correo electrónico')?.props.value).toBe('');
  });

  it('muestra el aviso y deja escrito el correo', async () => {
    mockParams = { email: 'ana@epmaps.com.ec', notice: 'password-reset-sent' };

    await renderScreen();

    expect(hasNotice()).toBe(true);
    expect(input('Correo electrónico')?.props.value).toBe('ana@epmaps.com.ec');
  });

  it('quita el aviso cuando el técnico empieza a escribir', async () => {
    mockParams = { email: 'ana@epmaps.com.ec', notice: 'password-reset-sent' };
    await renderScreen();

    await act(async () => {
      input('Clave')?.props.onChangeText('a');
    });

    expect(mockSetParams).toHaveBeenCalledWith({ notice: undefined });
  });
});

describe('envío del formulario', () => {
  const button = () =>
    renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Ingresar' && typeof node.props.onPress === 'function',
    )[0];

  async function pressSubmit() {
    await act(async () => {
      await button().props.onPress({});
    });
  }

  it('con campos vacíos avisa sin contactar a Firebase ni pasar por el estado de carga', async () => {
    await renderScreen();

    await pressSubmit();

    expect(mockSignIn).not.toHaveBeenCalled();
    expect(button().props.accessibilityState.busy).toBe(false);
    expect(
      renderer.root.findAll((node) => node.props.children === 'El correo y la clave son obligatorios')
        .length,
    ).toBeGreaterThan(0);
  });

  it('con un correo mal formado no contacta a Firebase', async () => {
    await renderScreen();
    await act(async () => {
      input('Correo electrónico')?.props.onChangeText('ana@');
      input('Clave')?.props.onChangeText('Segura#2026');
    });

    await pressSubmit();

    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('con datos completos inicia sesión', async () => {
    mockSignIn.mockResolvedValue('ok');
    await renderScreen();
    await act(async () => {
      input('Correo electrónico')?.props.onChangeText('ana@epmaps.com.ec');
      input('Clave')?.props.onChangeText('Segura#2026');
    });

    await pressSubmit();

    expect(mockSignIn).toHaveBeenCalledWith('ana@epmaps.com.ec', 'Segura#2026');
  });

  it('solo la palabra Crear cuenta es un enlace', async () => {
    await renderScreen();

    const link = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Crear cuenta' && typeof node.props.onPress === 'function',
    )[0];

    expect(link.findAll((node) => node.props.children === 'Crear cuenta').length).toBeGreaterThan(0);
    expect(link.findAll((node) => node.props.children === '¿No tiene una cuenta?')).toHaveLength(0);
  });
});
