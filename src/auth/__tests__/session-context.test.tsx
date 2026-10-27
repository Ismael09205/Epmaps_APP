import { act, create } from 'react-test-renderer';
import type { ReactNode } from 'react';

import { TECHNICIANS } from '../../domain/auth';
import * as sessionStorage from '../../storage/session';
import { SessionProvider, useSession } from '../session-context';

jest.mock('../../storage/session', () => ({
  saveSession: jest.fn(),
  loadSession: jest.fn(),
  clearSession: jest.fn(),
}));

const mockedLoadSession = sessionStorage.loadSession as jest.Mock;
const mockedSaveSession = sessionStorage.saveSession as jest.Mock;
const mockedClearSession = sessionStorage.clearSession as jest.Mock;

const technician = TECHNICIANS[0];
const persistedTechnician = {
  employeeCode: technician.employeeCode,
  name: technician.name,
  surname: technician.surname,
};

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let sessionValue: ReturnType<typeof useSession>;

function CaptureSession() {
  sessionValue = useSession();
  return null;
}

async function renderProvider() {
  let renderer: ReturnType<typeof create> | undefined;
  await act(async () => {
    renderer = create(
      <SessionProvider>
        <CaptureSession />
      </SessionProvider>,
    );
  });
  return renderer;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SessionProvider', () => {
  it('deja la sesión sin iniciar cuando no hay sesión persistida', async () => {
    mockedLoadSession.mockResolvedValue(null);

    await renderProvider();

    expect(sessionValue.status).toBe('unauthenticated');
    expect(sessionValue.technician).toBeNull();
  });

  it('autentica con la sesión persistida al cargar, sin pedir credenciales', async () => {
    mockedLoadSession.mockResolvedValue(persistedTechnician);

    await renderProvider();

    expect(sessionValue.status).toBe('authenticated');
    expect(sessionValue.technician).toEqual(persistedTechnician);
    expect(mockedSaveSession).not.toHaveBeenCalled();
    expect(mockedClearSession).not.toHaveBeenCalled();
  });

  it('expone el código de empleado sin exponer la clave', async () => {
    mockedLoadSession.mockResolvedValue(persistedTechnician);

    await renderProvider();

    expect(sessionValue.technician?.employeeCode).toBe(technician.employeeCode);
    expect('password' in (sessionValue.technician ?? {})).toBe(false);
  });

  it('signIn con credencial válida persiste los datos del técnico y autentica', async () => {
    mockedLoadSession.mockResolvedValue(null);
    await renderProvider();

    let result: string | undefined;
    await act(async () => {
      result = await sessionValue.signIn(technician.employeeCode, technician.password);
    });

    expect(result).toBe('ok');
    expect(mockedSaveSession).toHaveBeenCalledTimes(1);
    expect(mockedSaveSession).toHaveBeenCalledWith(persistedTechnician);
    expect(sessionValue.status).toBe('authenticated');
    expect(sessionValue.technician).toEqual(persistedTechnician);
  });

  it('signIn con campos vacíos devuelve empty sin persistir', async () => {
    mockedLoadSession.mockResolvedValue(null);
    await renderProvider();

    let result: string | undefined;
    await act(async () => {
      result = await sessionValue.signIn('   ', '');
    });

    expect(result).toBe('empty');
    expect(mockedSaveSession).not.toHaveBeenCalled();
    expect(sessionValue.status).toBe('unauthenticated');
  });

  it('signIn con credenciales inválidas devuelve invalid sin persistir', async () => {
    mockedLoadSession.mockResolvedValue(null);
    await renderProvider();

    let result: string | undefined;
    await act(async () => {
      result = await sessionValue.signIn(technician.employeeCode, 'clave-equivocada');
    });

    expect(result).toBe('invalid');
    expect(mockedSaveSession).not.toHaveBeenCalled();
    expect(sessionValue.status).toBe('unauthenticated');
  });

  it('signOut limpia la sesión y desautentica', async () => {
    mockedLoadSession.mockResolvedValue(persistedTechnician);
    await renderProvider();

    await act(async () => {
      await sessionValue.signOut();
    });

    expect(mockedClearSession).toHaveBeenCalledTimes(1);
    expect(mockedSaveSession).not.toHaveBeenCalled();
    expect(sessionValue.status).toBe('unauthenticated');
    expect(sessionValue.technician).toBeNull();
  });
});
