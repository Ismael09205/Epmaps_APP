import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  authenticate,
  createAccount,
  discardNewAccount,
  endFirebaseSession,
  getCurrentUserName,
  hasVerifiedFirebaseUser,
  refreshVerifiedUid,
  sendPasswordReset,
  sendVerificationEmail,
  SignUpError,
  toAuthError,
  updateCurrentUserName,
} from '../api/auth';
import { createTechnicianProfile, fetchTechnicianProfile } from '../api/technicians';
import {
  isValidEmail,
  type AuthFailure,
  type SignUpData,
  type SignUpFailure,
  type Technician,
} from '../domain/auth';
import { clearSession, loadSession, saveSession } from '../storage/session';

export type SessionStatus =
  | 'loading'
  | 'authenticated'
  | 'pending-verification'
  | 'unauthenticated';

export type SignInResult =
  | 'ok'
  | 'empty'
  | 'invalid-email'
  | 'unverified'
  | 'no-profile'
  | AuthFailure;

export type SignUpResult = 'unverified' | SignUpFailure;

export type VerificationResult = 'ok' | 'not-verified' | 'no-profile' | AuthFailure;

export type ResendResult = 'sent' | AuthFailure;

export type UpdateNameResult = 'ok' | AuthFailure;

export type PasswordResetResult = 'sent' | 'invalid-email' | AuthFailure;

export type PendingVerification = {
  email: string;
  emailSent: boolean;
};

export type SessionContextValue = {
  status: SessionStatus;
  technician: Technician | null;
  // Nombre elegido por el usuario en Firebase; null mientras no haya definido uno.
  displayName: string | null;
  verification: PendingVerification | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signUp: (data: SignUpData) => Promise<SignUpResult>;
  confirmEmailVerified: () => Promise<VerificationResult>;
  resendVerificationEmail: () => Promise<ResendResult>;
  requestPasswordReset: (email: string) => Promise<PasswordResetResult>;
  updateDisplayName: (name: string) => Promise<UpdateNameResult>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const hasSignedOut = useRef(false);
  const [verification, setVerification] = useState<PendingVerification | null>(null);

  useEffect(() => {
    let active = true;

    const dropSessionWithoutFirebaseUser = async () => {
      const isValid = await hasVerifiedFirebaseUser().catch(() => false);
      if (!active || hasSignedOut.current) {
        return;
      }
      if (isValid) {
        setDisplayName(getCurrentUserName());
        return;
      }

      await clearSession();
      setTechnician(null);
      setStatus('unauthenticated');
    };

    loadSession().then((session) => {
      if (!active) {
        return;
      }

      if (session) {
        // La sesión se abre sin esperar a Firebase, que intenta contactar al servidor: en campo sin
        // conexión el técnico no debe quedar detenido en la pantalla de carga.
        setTechnician(session);
        setStatus('authenticated');
        void dropSessionWithoutFirebaseUser();
      } else {
        setStatus('unauthenticated');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const openSession = async (uid: string): Promise<'ok' | 'no-profile'> => {
    const profile = await fetchTechnicianProfile(uid);
    if (!profile) {
      return 'no-profile';
    }

    await saveSession(profile);
    setTechnician(profile);
    setDisplayName(getCurrentUserName());
    setVerification(null);
    setStatus('authenticated');
    return 'ok';
  };

  const startEmailVerification = async (email: string): Promise<'unverified'> => {
    const emailSent = await sendVerificationEmail().then(
      () => true,
      () => false,
    );
    setVerification({ email, emailSent });
    setStatus('pending-verification');
    return 'unverified';
  };

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    const normalizedEmail = email.trim();
    if (normalizedEmail === '' || password === '') {
      return 'empty';
    }
    if (!isValidEmail(normalizedEmail)) {
      return 'invalid-email';
    }

    let user;
    try {
      user = await authenticate(normalizedEmail, password);
    } catch (error) {
      // Firebase rechazó el ingreso: no se abrió ninguna sesión que haya que cerrar.
      return toAuthError(error).reason;
    }

    if (!user.emailVerified) {
      return startEmailVerification(user.email);
    }

    // Si falta el perfil, la respuesta no espera el cierre: Firebase puede tardar en procesarlo.
    try {
      const result = await openSession(user.uid);
      if (result !== 'ok') {
        void endFirebaseSession();
      }
      return result;
    } catch (error) {
      void endFirebaseSession();
      return toAuthError(error).reason;
    }
  };

  // Recibe datos ya validados con validateSignUp, que entrega los errores por campo al formulario.
  const signUp = async ({ email, password, ...profile }: SignUpData): Promise<SignUpResult> => {
    let user;
    try {
      user = await createAccount(email, password);
    } catch (error) {
      return error instanceof SignUpError ? error.reason : toAuthError(error).reason;
    }

    try {
      await createTechnicianProfile(user.uid, profile);
    } catch (error) {
      await discardNewAccount();
      return toAuthError(error).reason;
    }

    return startEmailVerification(user.email);
  };

  const confirmEmailVerified = async (): Promise<VerificationResult> => {
    try {
      const uid = await refreshVerifiedUid();
      return uid === null ? 'not-verified' : await openSession(uid);
    } catch (error) {
      return toAuthError(error).reason;
    }
  };

  const resendVerificationEmail = async (): Promise<ResendResult> => {
    try {
      await sendVerificationEmail();
      return 'sent';
    } catch (error) {
      return toAuthError(error).reason;
    }
  };

  const requestPasswordReset = async (email: string): Promise<PasswordResetResult> => {
    const normalizedEmail = email.trim();
    if (!isValidEmail(normalizedEmail)) {
      return 'invalid-email';
    }

    try {
      await sendPasswordReset(normalizedEmail);
      return 'sent';
    } catch (error) {
      return toAuthError(error).reason;
    }
  };

  const updateDisplayName = async (name: string): Promise<UpdateNameResult> => {
    const normalizedName = name.trim();

    try {
      await updateCurrentUserName(normalizedName);
      setDisplayName(normalizedName);
      return 'ok';
    } catch (error) {
      return toAuthError(error).reason;
    }
  };

  // La pantalla responde de inmediato: Firebase puede tardar si sigue cargando o hay mala conexión, y
  // su cierre queda en cola antes de cualquier inicio de sesión posterior.
  const signOut = async (): Promise<void> => {
    hasSignedOut.current = true;
    setTechnician(null);
    setDisplayName(null);
    setVerification(null);
    setStatus('unauthenticated');

    await clearSession();
    await endFirebaseSession();
  };

  return (
    <SessionContext.Provider
      value={{
        status,
        technician,
        displayName,
        verification,
        signIn,
        signUp,
        confirmEmailVerified,
        resendVerificationEmail,
        requestPasswordReset,
        updateDisplayName,
        signOut,
      }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession debe usarse dentro de SessionProvider');
  }
  return context;
}
