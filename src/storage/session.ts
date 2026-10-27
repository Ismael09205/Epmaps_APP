import * as SecureStore from 'expo-secure-store';

import type { Technician } from '../domain/auth';

const SESSION_STORAGE_KEY = 'epmaps.session';

export async function saveSession(technician: Technician): Promise<void> {
  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(technician));
}

export async function loadSession(): Promise<Technician | null> {
  const stored = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
  if (stored === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const { employeeCode, name, surname } = parsed as Record<string, unknown>;
    if (
      typeof employeeCode !== 'string' ||
      typeof name !== 'string' ||
      typeof surname !== 'string'
    ) {
      return null;
    }

    return { employeeCode, name, surname };
  } catch {
    return null;
  }
}

// RF-08/D-07: borra solo la clave de la sesión; ningún otro dato local se toca.
export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}
