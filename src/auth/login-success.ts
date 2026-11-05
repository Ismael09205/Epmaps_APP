// Confirmación del acceso correcto: mientras el login la muestra, el cambio a la pantalla
// principal espera a que termine.
let holding = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

// Se activa antes de validar las credenciales para que la sesión no cambie de pantalla antes de
// mostrar la confirmación.
export function holdSessionTransition(): void {
  holding = true;
  notify();
}

export function releaseSessionTransition(): void {
  holding = false;
  notify();
}

export function isSessionTransitionHeld(): boolean {
  return holding;
}

export function subscribeSessionTransitionHold(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
