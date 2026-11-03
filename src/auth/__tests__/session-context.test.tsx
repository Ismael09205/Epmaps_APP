import { act, create } from 'react-test-renderer';

import * as authApi from '../../api/auth';
import * as techniciansApi from '../../api/technicians';
import * as sessionStorage from '../../storage/session';
import { SessionProvider, useSession } from '../session-context';

jest.mock('../../storage/session', () => ({
  saveSession: jest.fn(),
  loadSession: jest.fn(),
  clearSession: jest.fn(),
}));

jest.mock('../../api/auth', () => {
  class AuthError extends Error {
    reason: string;

    constructor(failure: string) {
      super(failure);
      this.reason = failure;
    }
  }
  class SignUpError extends AuthError {}
  return {
    AuthError,
    SignUpError,
    toAuthError: (error: unknown) =>
      error instanceof AuthError ? error : new AuthError('unavailable'),
    authenticate: jest.fn(),
    createAccount: jest.fn(),
    discardNewAccount: jest.fn(),
    sendVerificationEmail: jest.fn(),
    sendPasswordReset: jest.fn(),
    refreshVerifiedUid: jest.fn(),
    hasVerifiedFirebaseUser: jest.fn(),
    endFirebaseSession: jest.fn(),
    getCurrentUserName: jest.fn(() => null),
    updateCurrentUserName: jest.fn(),
  };
});

jest.mock('../../api/technicians', () => ({
  createTechnicianProfile: jest.fn(),
  fetchTechnicianProfile: jest.fn(),
}));

const mockedLoadSession = sessionStorage.loadSession as jest.Mock;
const mockedSaveSession = sessionStorage.saveSession as jest.Mock;
const mockedClearSession = sessionStorage.clearSession as jest.Mock;
const mockedAuthenticate = authApi.authenticate as jest.Mock;
const mockedSendVerificationEmail = authApi.sendVerificationEmail as jest.Mock;
const mockedSendPasswordReset = authApi.sendPasswordReset as jest.Mock;
const mockedRefreshVerifiedUid = authApi.refreshVerifiedUid as jest.Mock;
const mockedHasVerifiedFirebaseUser = authApi.hasVerifiedFirebaseUser as jest.Mock;
const mockedEndFirebaseSession = authApi.endFirebaseSession as jest.Mock;
const mockedCreateAccount = authApi.createAccount as jest.Mock;
const mockedDiscardNewAccount = authApi.discardNewAccount as jest.Mock;
const mockedCreateProfile = techniciansApi.createTechnicianProfile as jest.Mock;
const mockedFetchProfile = techniciansApi.fetchTechnicianProfile as jest.Mock;

const EMAIL = 'ana@epmaps.test';
const PASSWORD = 'clave-de-prueba';
const profile = { employeeCode: 'EPM-1001', name: 'Ana', surname: 'Guamán' };
const verifiedUser = { uid: 'uid-1', email: EMAIL, emailVerified: true };
const unverifiedUser = { ...verifiedUser, emailVerified: false };

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let sessionValue: ReturnType<typeof useSession>;

function CaptureSession() {
  sessionValue = useSession();
  return null;
}

async function renderProvider() {
  await act(async () => {
    create(
      <SessionProvider>
        <CaptureSession />
      </SessionProvider>,
    );
  });
}

async function signIn(email = EMAIL, password = PASSWORD) {
  let result: string | undefined;
  await act(async () => {
    result = await sessionValue.signIn(email, password);
  });
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedLoadSession.mockResolvedValue(null);
  mockedHasVerifiedFirebaseUser.mockResolvedValue(true);
  mockedSendVerificationEmail.mockResolvedValue(undefined);
  mockedEndFirebaseSession.mockResolvedValue(undefined);
  mockedFetchProfile.mockResolvedValue(profile);
});

describe('restauración de la sesión', () => {
  it('queda sin autenticar cuando no hay sesión persistida', async () => {
    await renderProvider();

    expect(sessionValue.status).toBe('unauthenticated');
    expect(sessionValue.technician).toBeNull();
  });

  it('autentica con la sesión persistida sin pedir credenciales', async () => {
    mockedLoadSession.mockResolvedValue(profile);

    await renderProvider();

    expect(sessionValue.status).toBe('authenticated');
    expect(sessionValue.technician).toEqual(profile);
    expect(mockedClearSession).not.toHaveBeenCalled();
  });

  it('abre la sesión guardada aunque Firebase todavía no responda (sin conexión)', async () => {
    mockedLoadSession.mockResolvedValue(profile);
    mockedHasVerifiedFirebaseUser.mockReturnValue(new Promise(() => {}));

    await renderProvider();

    expect(sessionValue.status).toBe('authenticated');
  });

  it('cierra una sesión guardada que no tiene usuario de Firebase verificado', async () => {
    mockedLoadSession.mockResolvedValue(profile);
    mockedHasVerifiedFirebaseUser.mockResolvedValue(false);

    await renderProvider();

    expect(mockedClearSession).toHaveBeenCalledTimes(1);
    expect(sessionValue.status).toBe('unauthenticated');
    expect(sessionValue.technician).toBeNull();
  });
});

describe('signIn', () => {
  it('con correo verificado guarda el perfil y autentica', async () => {
    mockedAuthenticate.mockResolvedValue(verifiedUser);
    await renderProvider();

    expect(await signIn()).toBe('ok');

    expect(mockedFetchProfile).toHaveBeenCalledWith('uid-1');
    expect(mockedSaveSession).toHaveBeenCalledWith(profile);
    expect(sessionValue.status).toBe('authenticated');
    expect(sessionValue.technician).toEqual(profile);
  });

  it('normaliza el correo y conserva la clave tal como se escribió', async () => {
    mockedAuthenticate.mockResolvedValue(verifiedUser);
    await renderProvider();

    await signIn(`  ${EMAIL} `, ' clave con espacios ');

    expect(mockedAuthenticate).toHaveBeenCalledWith(EMAIL, ' clave con espacios ');
  });

  it('con correo sin verificar no abre la sesión y envía el correo', async () => {
    mockedAuthenticate.mockResolvedValue(unverifiedUser);
    await renderProvider();

    expect(await signIn()).toBe('unverified');

    expect(mockedSendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(mockedSaveSession).not.toHaveBeenCalled();
    expect(mockedFetchProfile).not.toHaveBeenCalled();
    expect(sessionValue.status).toBe('pending-verification');
    expect(sessionValue.technician).toBeNull();
    expect(sessionValue.verification).toEqual({ email: EMAIL, emailSent: true });
  });

  it('informa cuando no se pudo enviar el correo de verificación', async () => {
    mockedAuthenticate.mockResolvedValue(unverifiedUser);
    mockedSendVerificationEmail.mockRejectedValue(new authApi.AuthError('too-many-requests'));
    await renderProvider();

    expect(await signIn()).toBe('unverified');

    expect(sessionValue.status).toBe('pending-verification');
    expect(sessionValue.verification?.emailSent).toBe(false);
  });

  it('con correo mal formado no contacta a Firebase', async () => {
    await renderProvider();

    expect(await signIn('correo-sin-dominio', PASSWORD)).toBe('invalid-email');

    expect(mockedAuthenticate).not.toHaveBeenCalled();
  });

  it('con campos vacíos no contacta a Firebase', async () => {
    await renderProvider();

    expect(await signIn('   ', '')).toBe('empty');

    expect(mockedAuthenticate).not.toHaveBeenCalled();
    expect(sessionValue.status).toBe('unauthenticated');
  });

  it.each(['invalid', 'network', 'too-many-requests', 'unavailable'] as const)(
    'devuelve %s sin persistir cuando Firebase rechaza el ingreso',
    async (reason) => {
      mockedAuthenticate.mockRejectedValue(new authApi.AuthError(reason));
      await renderProvider();

      expect(await signIn()).toBe(reason);

      expect(mockedSaveSession).not.toHaveBeenCalled();
      expect(sessionValue.status).toBe('unauthenticated');
    },
  );

  it('responde a una clave incorrecta sin esperar a Firebase ni cerrar sesión', async () => {
    mockedAuthenticate.mockRejectedValue(new authApi.AuthError('invalid'));
    mockedEndFirebaseSession.mockReturnValue(new Promise(() => {}));
    await renderProvider();

    expect(await signIn()).toBe('invalid');

    expect(mockedEndFirebaseSession).not.toHaveBeenCalled();
  });

  it('sin perfil de técnico cierra Firebase y no abre la sesión', async () => {
    mockedAuthenticate.mockResolvedValue(verifiedUser);
    mockedFetchProfile.mockResolvedValue(null);
    await renderProvider();

    expect(await signIn()).toBe('no-profile');

    expect(mockedEndFirebaseSession).toHaveBeenCalledTimes(1);
    expect(mockedSaveSession).not.toHaveBeenCalled();
    expect(sessionValue.status).toBe('unauthenticated');
  });

  it('si falla la lectura del perfil cierra Firebase y no abre la sesión', async () => {
    mockedAuthenticate.mockResolvedValue(verifiedUser);
    mockedFetchProfile.mockRejectedValue(new authApi.AuthError('network'));
    await renderProvider();

    expect(await signIn()).toBe('network');

    expect(mockedEndFirebaseSession).toHaveBeenCalledTimes(1);
    expect(sessionValue.status).toBe('unauthenticated');
  });
});

describe('signUp', () => {
  const input = { ...profile, email: EMAIL, password: PASSWORD };

  async function signUp(values = input) {
    let result: string | undefined;
    await act(async () => {
      result = await sessionValue.signUp(values);
    });
    return result;
  }

  beforeEach(() => {
    mockedCreateAccount.mockResolvedValue(unverifiedUser);
    mockedCreateProfile.mockResolvedValue(undefined);
  });

  it('crea la cuenta y el perfil, y exige verificar el correo antes de ingresar', async () => {
    await renderProvider();

    expect(await signUp()).toBe('unverified');

    expect(mockedCreateAccount).toHaveBeenCalledWith(EMAIL, PASSWORD);
    expect(mockedCreateProfile).toHaveBeenCalledWith('uid-1', profile);
    expect(mockedSendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(mockedSaveSession).not.toHaveBeenCalled();
    expect(sessionValue.status).toBe('pending-verification');
    expect(sessionValue.technician).toBeNull();
  });

  it.each(['email-in-use', 'weak-password', 'invalid', 'network'] as const)(
    'devuelve %s sin crear el perfil cuando Firebase rechaza el registro',
    async (reason) => {
      mockedCreateAccount.mockRejectedValue(new authApi.SignUpError(reason));
      await renderProvider();

      expect(await signUp()).toBe(reason);

      expect(mockedCreateProfile).not.toHaveBeenCalled();
      expect(sessionValue.status).toBe('unauthenticated');
    },
  );

  it('revierte la cuenta si no se pudo guardar el perfil', async () => {
    mockedCreateProfile.mockRejectedValue(new authApi.AuthError('unavailable'));
    await renderProvider();

    expect(await signUp()).toBe('unavailable');

    expect(mockedDiscardNewAccount).toHaveBeenCalledTimes(1);
    expect(mockedSendVerificationEmail).not.toHaveBeenCalled();
    expect(sessionValue.status).toBe('unauthenticated');
  });
});

describe('verificación del correo', () => {
  async function renderPendingVerification() {
    mockedAuthenticate.mockResolvedValue(unverifiedUser);
    await renderProvider();
    await signIn();
  }

  async function confirm() {
    let result: string | undefined;
    await act(async () => {
      result = await sessionValue.confirmEmailVerified();
    });
    return result;
  }

  it('no deja ingresar mientras el correo no esté verificado', async () => {
    await renderPendingVerification();
    mockedRefreshVerifiedUid.mockResolvedValue(null);

    expect(await confirm()).toBe('not-verified');

    expect(mockedSaveSession).not.toHaveBeenCalled();
    expect(sessionValue.status).toBe('pending-verification');
  });

  it('abre la sesión cuando el correo ya está verificado', async () => {
    await renderPendingVerification();
    mockedRefreshVerifiedUid.mockResolvedValue('uid-1');

    expect(await confirm()).toBe('ok');

    expect(mockedSaveSession).toHaveBeenCalledWith(profile);
    expect(sessionValue.status).toBe('authenticated');
    expect(sessionValue.verification).toBeNull();
  });

  it('sigue pendiente si no hay perfil de técnico', async () => {
    await renderPendingVerification();
    mockedRefreshVerifiedUid.mockResolvedValue('uid-1');
    mockedFetchProfile.mockResolvedValue(null);

    expect(await confirm()).toBe('no-profile');

    expect(sessionValue.status).toBe('pending-verification');
  });

  it('sigue pendiente si no hay conexión', async () => {
    await renderPendingVerification();
    mockedRefreshVerifiedUid.mockRejectedValue(new authApi.AuthError('network'));

    expect(await confirm()).toBe('network');

    expect(sessionValue.status).toBe('pending-verification');
  });

  it('reenvía el correo e informa el resultado', async () => {
    await renderPendingVerification();
    mockedSendVerificationEmail.mockClear();

    let result: string | undefined;
    await act(async () => {
      result = await sessionValue.resendVerificationEmail();
    });
    expect(result).toBe('sent');
    expect(mockedSendVerificationEmail).toHaveBeenCalledTimes(1);

    mockedSendVerificationEmail.mockRejectedValue(new authApi.AuthError('too-many-requests'));
    await act(async () => {
      result = await sessionValue.resendVerificationEmail();
    });
    expect(result).toBe('too-many-requests');
  });
});

describe('requestPasswordReset', () => {
  async function requestReset(email: string) {
    let result: string | undefined;
    await act(async () => {
      result = await sessionValue.requestPasswordReset(email);
    });
    return result;
  }

  it('envía el correo al correo normalizado sin cambiar la sesión', async () => {
    mockedSendPasswordReset.mockResolvedValue(undefined);
    await renderProvider();

    expect(await requestReset(`  ${EMAIL} `)).toBe('sent');

    expect(mockedSendPasswordReset).toHaveBeenCalledWith(EMAIL);
    expect(sessionValue.status).toBe('unauthenticated');
  });

  it.each(['', '   ', 'correo-sin-dominio'])('no contacta a Firebase con "%s"', async (email) => {
    await renderProvider();

    expect(await requestReset(email)).toBe('invalid-email');

    expect(mockedSendPasswordReset).not.toHaveBeenCalled();
  });

  it.each(['network', 'too-many-requests', 'unavailable'] as const)(
    'devuelve %s cuando Firebase no puede enviar el correo',
    async (reason) => {
      mockedSendPasswordReset.mockRejectedValue(new authApi.AuthError(reason));
      await renderProvider();

      expect(await requestReset(EMAIL)).toBe(reason);
    },
  );
});

describe('updateDisplayName', () => {
  const mockedUpdateName = authApi.updateCurrentUserName as jest.Mock;

  async function updateName(name: string) {
    let result: string | undefined;
    await act(async () => {
      result = await sessionValue.updateDisplayName(name);
    });
    return result;
  }

  it('guarda el nombre normalizado y lo expone a la app', async () => {
    mockedUpdateName.mockResolvedValue(undefined);
    await renderProvider();

    expect(await updateName('  Ana María ')).toBe('ok');

    expect(mockedUpdateName).toHaveBeenCalledWith('Ana María');
    expect(sessionValue.displayName).toBe('Ana María');
  });

  it('conserva el nombre anterior si Firebase no puede guardarlo', async () => {
    mockedUpdateName.mockRejectedValue(new authApi.AuthError('network'));
    await renderProvider();

    expect(await updateName('Ana María')).toBe('network');

    expect(sessionValue.displayName).toBeNull();
  });
});

describe('signOut', () => {
  it('sale de inmediato aunque Firebase siga ocupado', async () => {
    mockedLoadSession.mockResolvedValue(profile);
    mockedEndFirebaseSession.mockReturnValue(new Promise(() => {}));
    await renderProvider();

    await act(async () => {
      void sessionValue.signOut();
    });

    expect(sessionValue.status).toBe('unauthenticated');
    expect(mockedClearSession).toHaveBeenCalledTimes(1);
  });

  it('cierra Firebase, limpia la sesión y desautentica', async () => {
    mockedLoadSession.mockResolvedValue(profile);
    await renderProvider();

    await act(async () => {
      await sessionValue.signOut();
    });

    expect(mockedEndFirebaseSession).toHaveBeenCalledTimes(1);
    expect(mockedClearSession).toHaveBeenCalledTimes(1);
    expect(sessionValue.status).toBe('unauthenticated');
    expect(sessionValue.technician).toBeNull();
  });
});
