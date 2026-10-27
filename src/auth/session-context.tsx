import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { checkCredentials, type Technician } from '../domain/auth';
import { clearSession, loadSession, saveSession } from '../storage/session';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type SignInResult = 'ok' | 'empty' | 'invalid';

export type SessionContextValue = {
  status: SessionStatus;
  technician: Technician | null;
  signIn: (code: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [technician, setTechnician] = useState<Technician | null>(null);

  useEffect(() => {
    let active = true;

    loadSession().then((session) => {
      if (!active) {
        return;
      }

      if (session) {
        setTechnician(session);
        setStatus('authenticated');
      } else {
        setStatus('unauthenticated');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const signIn = async (code: string, password: string): Promise<SignInResult> => {
    const result = checkCredentials(code, password);
    if (result.status !== 'ok') {
      return result.status;
    }

    await saveSession(result.technician);
    setTechnician(result.technician);
    setStatus('authenticated');
    return 'ok';
  };

  const signOut = async (): Promise<void> => {
    await clearSession();
    setTechnician(null);
    setStatus('unauthenticated');
  };

  return (
    <SessionContext.Provider value={{ status, technician, signIn, signOut }}>
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
