import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import {
  mapAuthErrorCode,
  mapSignUpErrorCode,
  type AuthFailure,
  type SignUpFailure,
} from '@/domain/auth';

import { getFirebaseAuth } from './firebase';

export class AuthError extends Error {
  constructor(readonly reason: AuthFailure) {
    super(`La autenticación falló: ${reason}.`);
    this.name = 'AuthError';
  }
}

// Límite para las operaciones de Firebase: su propio tiempo de espera no cubre la cola interna ni
// las lecturas de Firestore, y sin esto la pantalla podría quedarse cargando indefinidamente.
const OPERATION_TIMEOUT_MS = 25000;

export async function withTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      console.warn(`Firebase no respondió a tiempo: ${label}.`);
      reject(new AuthError('network'));
    }, OPERATION_TIMEOUT_MS);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) {
    return error;
  }

  const code = (error as { code?: unknown } | null)?.code;
  const reason = mapAuthErrorCode(code);
  if (reason === 'unavailable' || reason === 'network') {
    // La causa técnica no se le puede explicar al técnico: queda para el diagnóstico.
    console.warn('Error de Firebase:', typeof code === 'string' ? code : error);
  }
  return new AuthError(reason);
}

async function withAuthErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toAuthError(error);
  }
}

// La app abre la sesión guardada sin esperar a Firebase, que todavía puede estar cargando su usuario:
// hasta que termine, `currentUser` es null aunque la cuenta exista.
async function requireCurrentUser(): Promise<User> {
  const auth = getFirebaseAuth();
  await withTimeout(auth.authStateReady(), 'carga del usuario');
  if (!auth.currentUser) {
    console.warn('Firebase no tiene un usuario activo para esta operación.');
    throw new AuthError('unavailable');
  }
  return auth.currentUser;
}

export type AuthenticatedUser = {
  uid: string;
  email: string;
  emailVerified: boolean;
};

export function authenticate(email: string, password: string): Promise<AuthenticatedUser> {
  return withAuthErrors(async () => {
    const { user } = await withTimeout(
      signInWithEmailAndPassword(getFirebaseAuth(), email, password),
      'inicio de sesión',
    );
    return { uid: user.uid, email: user.email ?? email, emailVerified: user.emailVerified };
  });
}

export class SignUpError extends Error {
  constructor(readonly reason: SignUpFailure) {
    super(`No se pudo crear la cuenta: ${reason}.`);
    this.name = 'SignUpError';
  }
}

export async function createAccount(email: string, password: string): Promise<AuthenticatedUser> {
  try {
    const { user } = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
    return { uid: user.uid, email: user.email ?? email, emailVerified: user.emailVerified };
  } catch (error) {
    throw new SignUpError(mapSignUpErrorCode((error as { code?: unknown } | null)?.code));
  }
}

// Revierte un registro incompleto: sin esto, el correo quedaría ocupado por una cuenta sin perfil.
export async function discardNewAccount(): Promise<void> {
  try {
    await deleteUser(await requireCurrentUser());
  } catch (error) {
    console.error('No se pudo revertir la cuenta nueva:', error);
    await endFirebaseSession();
  }
}

// Una cuenta inexistente se responde igual que una enviada, para no revelar qué correos están
// registrados.
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code !== 'auth/user-not-found') {
      throw toAuthError(error);
    }
  }
}

export function sendVerificationEmail(): Promise<void> {
  return withAuthErrors(async () => sendEmailVerification(await requireCurrentUser()));
}

// Devuelve el uid solo si el correo ya está verificado. El token se renueva para que las reglas de
// Firestore reciban el estado de verificación actualizado.
export function refreshVerifiedUid(): Promise<string | null> {
  return withAuthErrors(async () => {
    const user = await requireCurrentUser();
    await user.reload();
    if (!user.emailVerified) {
      return null;
    }
    await user.getIdToken(true);
    return user.uid;
  });
}

export function updateCurrentUserName(displayName: string): Promise<void> {
  return withAuthErrors(async () => updateProfile(await requireCurrentUser(), { displayName }));
}

// Firebase conserva el nombre en el teléfono, así que también está disponible sin conexión.
export function getCurrentUserName(): string | null {
  return getFirebaseAuth().currentUser?.displayName ?? null;
}

export async function hasVerifiedFirebaseUser(): Promise<boolean> {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  return auth.currentUser?.emailVerified === true;
}

export async function endFirebaseSession(): Promise<void> {
  try {
    await firebaseSignOut(getFirebaseAuth());
  } catch (error) {
    console.error('No se pudo cerrar la sesión de Firebase:', error);
  }
}
