import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from 'react-native';

import CreateAccountScreen from '../../app/crear-cuenta';

const mockSignUp = jest.fn();

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ signUp: mockSignUp }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));

jest.mock('@/global.css', () => ({}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const NAME_ERROR = 'El nombre debe tener al menos 3 letras';

let renderer: ReactTestRenderer;

async function type(label: string, value: string) {
  const input = renderer.root
    .findAllByType(TextInput)
    .find((candidate) => candidate.props.accessibilityLabel === label);
  await act(async () => {
    input?.props.onChangeText(value);
  });
}

function findError(message: string) {
  return renderer.root.findAll(
    (node) => node.props.accessibilityLiveRegion === 'polite' && node.props.children === message,
  )[0];
}

beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => {
    renderer = create(<CreateAccountScreen />);
  });
});

describe('cuadro de requisitos de la clave', () => {
  function rowFor(label: string) {
    return renderer.root.findAll(
      (node) =>
        typeof node.props.accessibilityLabel === 'string' &&
        typeof node.type === 'string' &&
        node.props.accessibilityLabel.endsWith(label),
    )[0];
  }

  async function setPasswordFocus(focused: boolean) {
    const input = renderer.root
      .findAllByType(TextInput)
      .find((candidate) => candidate.props.accessibilityLabel === 'Clave');
    await act(async () => {
      if (focused) {
        input?.props.onFocus();
      } else {
        input?.props.onBlur();
      }
    });
  }

  function isBoxOpen() {
    const box = renderer.root.findAll(
      (node) => node.props.testID === 'password-requirements' && typeof node.type === 'string',
    )[0];
    return box.props.accessibilityElementsHidden === false;
  }

  it('no aparece hasta tocar el campo de la clave', async () => {
    expect(isBoxOpen()).toBe(false);

    await type('Nombre', 'Luis');

    expect(isBoxOpen()).toBe(false);
  });

  it('aparece al tocar el campo con los requisitos pendientes', async () => {
    await setPasswordFocus(true);

    expect(isBoxOpen()).toBe(true);
    expect(rowFor('Un número').props.accessibilityLabel).toBe('Pendiente: Un número');
  });

  it('desaparece al salir del campo e informa si la clave no es válida', async () => {
    await setPasswordFocus(true);
    await type('Clave', 'a1');
    await setPasswordFocus(false);

    expect(isBoxOpen()).toBe(false);
    expect(findError('La clave no cumple todos los requisitos')).toBeDefined();
  });

  it('no muestra el texto de error mientras el cuadro está visible', async () => {
    await setPasswordFocus(true);
    await type('Clave', 'a1');

    expect(findError('La clave no cumple todos los requisitos')).toBeUndefined();
  });

  it('marca cada requisito como cumplido en cuanto la clave lo satisface', async () => {
    await setPasswordFocus(true);
    await type('Clave', 'a1');

    expect(rowFor('Un número').props.accessibilityLabel).toBe('Cumplido: Un número');
    expect(rowFor('Una letra minúscula').props.accessibilityLabel).toBe(
      'Cumplido: Una letra minúscula',
    );
    expect(rowFor('Una letra mayúscula').props.accessibilityLabel).toBe(
      'Pendiente: Una letra mayúscula',
    );
  });

  it('vuelve a marcar como pendiente un requisito que deja de cumplirse', async () => {
    await setPasswordFocus(true);
    await type('Clave', 'a1');
    await type('Clave', 'a');

    expect(rowFor('Un número').props.accessibilityLabel).toBe('Pendiente: Un número');
  });
});

describe('validación automática del registro', () => {
  it('no muestra errores antes de que el técnico use el formulario', () => {
    expect(findError(NAME_ERROR)).toBeUndefined();
  });

  it('muestra el error mientras se escribe, sin pulsar el botón', async () => {
    await type('Nombre', 'An');

    expect(findError(NAME_ERROR)).toBeDefined();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('mantiene el mismo mensaje en pantalla al escribir en otros campos', async () => {
    await type('Nombre', 'An');
    const error = findError(NAME_ERROR);

    await type('Apellido', 'Guamán');
    await type('Correo electrónico', 'ana@epmaps.com');

    expect(findError(NAME_ERROR).instance).toBe(error.instance);
  });

  it('mantiene el mismo mensaje al seguir escribiendo en el campo con error', async () => {
    await type('Nombre', 'A');
    const error = findError(NAME_ERROR);

    await type('Nombre', 'An');

    expect(findError(NAME_ERROR).instance).toBe(error.instance);
  });

  it('quita el mensaje cuando el dato queda corregido', async () => {
    await type('Nombre', 'An');
    await type('Nombre', 'Anita');

    expect(findError(NAME_ERROR)).toBeUndefined();
  });

  it('no muestra errores de campos que el técnico aún no ha usado', async () => {
    await type('Nombre', 'Luis');

    expect(findError('Ingrese su apellido')).toBeUndefined();
  });

  it('avisa que las claves no coinciden al cambiar la primera clave', async () => {
    await type('Clave', 'Segura#2026');
    await type('Confirmar clave', 'Segura#2026');
    expect(findError('Las claves no coinciden')).toBeUndefined();

    await type('Clave', 'Segura#2027');

    expect(findError('Las claves no coinciden')).toBeDefined();
  });
});
