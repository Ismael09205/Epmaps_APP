import { getAuth, initializeAuth } from 'firebase/auth';

jest.mock('@react-native-async-storage/async-storage', () => ({}));

jest.mock('firebase/app', () => ({
  getApps: () => [],
  initializeApp: () => ({}),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ languageCode: null, reused: true })),
  getReactNativePersistence: () => ({}),
  initializeAuth: jest.fn(() => ({ languageCode: null })),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
}));

const mockedInitializeAuth = initializeAuth as jest.Mock;

describe('getFirebaseAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('configura Firebase en español para los correos y sus páginas', () => {
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'clave';
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'proyecto';
    jest.isolateModules(() => {
      const { getFirebaseAuth } = jest.requireActual('../firebase');

      expect(getFirebaseAuth().languageCode).toBe('es');
      getFirebaseAuth();
    });

    expect(initializeAuth).toHaveBeenCalledTimes(1);
  });

  it('reutiliza la instancia de Firebase si el módulo se recargó', () => {
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'clave';
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'proyecto';
    mockedInitializeAuth.mockImplementationOnce(() => {
      throw { code: 'auth/already-initialized' };
    });

    jest.isolateModules(() => {
      const { getFirebaseAuth } = jest.requireActual('../firebase');

      expect(getFirebaseAuth()).toEqual({ languageCode: 'es', reused: true });
    });

    expect(getAuth).toHaveBeenCalledTimes(1);
  });

  it('no oculta otros errores de inicialización', () => {
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'clave';
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'proyecto';
    mockedInitializeAuth.mockImplementationOnce(() => {
      throw { code: 'auth/invalid-api-key' };
    });

    jest.isolateModules(() => {
      const { getFirebaseAuth } = jest.requireActual('../firebase');

      expect(() => getFirebaseAuth()).toThrow();
    });

    expect(getAuth).not.toHaveBeenCalled();
  });
});
