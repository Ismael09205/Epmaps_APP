import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Expo solo incluye en el paquete las variables EXPO_PUBLIC_ leídas con esta notación exacta.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let auth: Auth | undefined;

function getFirebaseApp(): FirebaseApp {
  return getApps()[0] ?? initializeApp(firebaseConfig);
}

// Al recargar este módulo en desarrollo se pierde `auth`, pero Firebase conserva la instancia: la
// segunda inicialización falla porque cada llamada crea una persistencia distinta.
function createAuth(): Auth {
  const app = getFirebaseApp();
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === 'auth/already-initialized') {
      return getAuth(app);
    }
    throw error;
  }
}

// La inicialización es diferida: una configuración incompleta en el .env se reporta como un error
// de inicio de sesión y no impide abrir la aplicación.
export function getFirebaseAuth(): Auth {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error('Falta la configuración de Firebase en el archivo .env.');
  }

  if (!auth) {
    auth = createAuth();
    // Idioma de los correos de Firebase y de las páginas que abren sus enlaces.
    auth.languageCode = 'es';
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
