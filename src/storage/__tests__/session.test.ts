import * as SecureStore from 'expo-secure-store';

import { clearSession, loadSession, saveSession } from '../session';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedGetItemAsync = SecureStore.getItemAsync as jest.Mock;
const mockedSetItemAsync = SecureStore.setItemAsync as jest.Mock;
const mockedDeleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

const technician = { employeeCode: 'EPM-1001', name: 'Ana', surname: 'Guamán' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('session storage', () => {
  it('saveSession guarda únicamente los datos del técnico en la clave de sesión', async () => {
    await saveSession(technician);

    expect(mockedSetItemAsync).toHaveBeenCalledTimes(1);
    expect(mockedSetItemAsync).toHaveBeenCalledWith(
      'epmaps.session',
      JSON.stringify(technician),
    );
  });

  it('saveSession no guarda la clave del técnico', async () => {
    await saveSession(technician);

    expect(JSON.stringify(mockedSetItemAsync.mock.calls[0][1])).not.toContain('password');
  });

  it('loadSession devuelve el técnico guardado', async () => {
    mockedGetItemAsync.mockResolvedValue(JSON.stringify(technician));

    await expect(loadSession()).resolves.toEqual(technician);
  });

  it('loadSession devuelve null cuando no existe sesión', async () => {
    mockedGetItemAsync.mockResolvedValue(null);

    await expect(loadSession()).resolves.toBeNull();
  });

  it('loadSession devuelve null con JSON corrupto', async () => {
    mockedGetItemAsync.mockResolvedValue('{json-invalido');

    await expect(loadSession()).resolves.toBeNull();
  });

  it('loadSession devuelve null si el JSON guardado no contiene los datos del técnico', async () => {
    mockedGetItemAsync.mockResolvedValue(JSON.stringify({ unexpected: true }));

    await expect(loadSession()).resolves.toBeNull();
  });

  it('clearSession elimina únicamente la clave de la sesión', async () => {
    await clearSession();

    expect(mockedDeleteItemAsync).toHaveBeenCalledTimes(1);
    expect(mockedDeleteItemAsync).toHaveBeenCalledWith('epmaps.session');
  });
});
