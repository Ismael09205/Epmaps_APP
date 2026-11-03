import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';

import ResetPasswordScreen from '../../app/recuperar-clave';

const mockRequestPasswordReset = jest.fn();
const mockDismissTo = jest.fn();
let mockParams: { email?: string } = {};

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ requestPasswordReset: mockRequestPasswordReset }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), dismissTo: mockDismissTo }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

jest.mock('@/global.css', () => ({}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const INVALID_MESSAGE = 'Ingrese un correo válido, por ejemplo nombre@dominio.com';
const NETWORK_MESSAGE = 'No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.';

let renderer: ReactTestRenderer;

async function renderScreen() {
  await act(async () => {
    renderer = create(<ResetPasswordScreen />);
  });
}

function emailInput() {
  return renderer.root.findByType(TextInput);
}

async function typeEmail(value: string) {
  await act(async () => {
    emailInput().props.onChangeText(value);
  });
}

async function submit() {
  await act(async () => {
    await emailInput().props.onSubmitEditing();
  });
}

function hasText(text: string) {
  return renderer.root.findAll((node) => node.props.children === text).length > 0;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
});

describe('recuperación de la clave', () => {
  it('conserva el correo escrito en el inicio de sesión', async () => {
    mockParams = { email: 'ana@epmaps.com.ec' };

    await renderScreen();

    expect(emailInput().props.value).toBe('ana@epmaps.com.ec');
  });

  it('valida el correo mientras se escribe y no lo envía si es inválido', async () => {
    await renderScreen();

    await typeEmail('ana@');
    expect(hasText(INVALID_MESSAGE)).toBe(true);

    await submit();
    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
  });

  it('vuelve al inicio de sesión con el aviso al enviar el enlace', async () => {
    mockRequestPasswordReset.mockResolvedValue('sent');
    await renderScreen();
    await typeEmail(' ana@epmaps.com.ec ');

    await submit();

    expect(mockRequestPasswordReset).toHaveBeenCalledWith(' ana@epmaps.com.ec ');
    expect(mockDismissTo).not.toHaveBeenCalled();

    // El botón muestra el éxito un momento antes de volver.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 650));
    });
    expect(mockDismissTo).toHaveBeenCalledWith({
      pathname: '/login',
      params: { email: 'ana@epmaps.com.ec', notice: 'password-reset-sent' },
    });
  });

  it('informa el error de conexión', async () => {
    mockRequestPasswordReset.mockResolvedValue('network');
    await renderScreen();
    await typeEmail('ana@epmaps.com.ec');

    await submit();

    expect(hasText(NETWORK_MESSAGE)).toBe(true);
    expect(mockDismissTo).not.toHaveBeenCalled();
  });
});
