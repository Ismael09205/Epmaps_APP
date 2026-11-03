import { doc, getDoc, setDoc } from 'firebase/firestore';

import { parseTechnicianProfile, type Technician } from '@/domain/auth';

import { toAuthError, withTimeout } from './auth';
import { getFirebaseDb } from './firebase';

const WRITE_TIMEOUT_MS = 15000;

// Firestore deja una escritura en cola sin responder si se pierde la conexión; sin este límite, el
// registro quedaría esperando indefinidamente.
export async function createTechnicianProfile(uid: string, profile: Technician): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject({ code: 'unavailable' }), WRITE_TIMEOUT_MS);
  });

  try {
    await Promise.race([setDoc(doc(getFirebaseDb(), 'technicians', uid), profile), timeout]);
  } catch (error) {
    throw toAuthError(error);
  } finally {
    clearTimeout(timer);
  }
}

// Devuelve null si el técnico no tiene un perfil válido en `technicians/{uid}`.
export async function fetchTechnicianProfile(uid: string): Promise<Technician | null> {
  try {
    const snapshot = await withTimeout(
      getDoc(doc(getFirebaseDb(), 'technicians', uid)),
      'lectura del perfil',
    );
    return snapshot.exists() ? parseTechnicianProfile(snapshot.data()) : null;
  } catch (error) {
    throw toAuthError(error);
  }
}
