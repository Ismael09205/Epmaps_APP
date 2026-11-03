import * as v from 'valibot';

export type Technician = {
  employeeCode: string;
  name: string;
  surname: string;
};

export type AuthFailure = 'invalid' | 'network' | 'too-many-requests' | 'unavailable';

const INVALID_CREDENTIAL_CODES = new Set([
  'auth/invalid-credential',
  'auth/invalid-email',
  'auth/user-disabled',
  'auth/user-not-found',
  'auth/wrong-password',
]);

// Firestore informa la falta de red con el código `unavailable`, sin el prefijo de Authentication.
const NETWORK_CODES = new Set(['auth/network-request-failed', 'unavailable']);

export function mapAuthErrorCode(code: unknown): AuthFailure {
  if (typeof code !== 'string') {
    return 'unavailable';
  }
  if (INVALID_CREDENTIAL_CODES.has(code)) {
    return 'invalid';
  }
  if (NETWORK_CODES.has(code)) {
    return 'network';
  }
  return code === 'auth/too-many-requests' ? 'too-many-requests' : 'unavailable';
}

export type SignUpFailure = 'email-in-use' | 'weak-password' | AuthFailure;

export function mapSignUpErrorCode(code: unknown): SignUpFailure {
  if (code === 'auth/email-already-in-use') {
    return 'email-in-use';
  }
  if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') {
    return 'weak-password';
  }
  return mapAuthErrorCode(code);
}

const RequiredText = v.pipe(v.string(), v.trim(), v.nonEmpty());

const TechnicianProfileSchema = v.object({
  employeeCode: RequiredText,
  name: RequiredText,
  surname: RequiredText,
});

export function parseTechnicianProfile(data: unknown): Technician | null {
  const result = v.safeParse(TechnicianProfileSchema, data);
  return result.success ? result.output : null;
}

// Valor del parámetro con el que la recuperación de clave avisa al inicio de sesión.
export const PASSWORD_RESET_SENT_NOTICE = 'password-reset-sent';

export const EMPLOYEE_CODE_MAX_LENGTH = 8;
export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 12;
export const PASSWORD_MIN_LENGTH = 8;

const PASSWORD_RULES: readonly { label: string; isMet: (password: string) => boolean }[] = [
  {
    label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    isMet: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  { label: 'Una letra mayúscula', isMet: (password) => /[A-Z]/.test(password) },
  { label: 'Una letra minúscula', isMet: (password) => /[a-z]/.test(password) },
  { label: 'Un número', isMet: (password) => /[0-9]/.test(password) },
  {
    label: 'Un símbolo, por ejemplo ! # $ %',
    isMet: (password) => /[!-/:-@[-`{-~]/.test(password),
  },
];

export type PasswordRequirement = { label: string; met: boolean };

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return PASSWORD_RULES.map(({ label, isMet }) => ({ label, met: isMet(password) }));
}

const NAME_LETTERS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
const NAME_PATTERN = new RegExp(`^[${NAME_LETTERS}]+( [${NAME_LETTERS}]+)*$`);
const NAME_FORBIDDEN_CHARACTERS = new RegExp(`[^${NAME_LETTERS} ]`, 'g');

// Impide escribir números y caracteres especiales en el nombre y el apellido.
export function sanitizeNameInput(value: string): string {
  return value.replace(NAME_FORBIDDEN_CHARACTERS, '');
}

export const DISPLAY_NAME_MIN_LENGTH = 3;
export const DISPLAY_NAME_MAX_LENGTH = 40;

// Devuelve el problema del nombre visible, o null si es válido.
export function validateDisplayName(value: string): string | null {
  const name = value.trim();
  if (name === '') {
    return 'Ingrese su nombre';
  }
  if (name.length < DISPLAY_NAME_MIN_LENGTH) {
    return `El nombre debe tener al menos ${DISPLAY_NAME_MIN_LENGTH} letras`;
  }
  if (name.length > DISPLAY_NAME_MAX_LENGTH) {
    return `El nombre admite máximo ${DISPLAY_NAME_MAX_LENGTH} caracteres`;
  }
  return NAME_PATTERN.test(name) ? null : 'El nombre solo admite letras';
}

const EmailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Ingrese su correo electrónico'),
  v.email('Ingrese un correo válido, por ejemplo nombre@dominio.com'),
);

export function isValidEmail(email: string): boolean {
  return v.safeParse(EmailSchema, email).success;
}

function nameSchema(label: string) {
  return v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(`Ingrese su ${label}`),
    v.minLength(NAME_MIN_LENGTH, `El ${label} debe tener al menos ${NAME_MIN_LENGTH} letras`),
    v.maxLength(NAME_MAX_LENGTH, `El ${label} admite máximo ${NAME_MAX_LENGTH} caracteres`),
    v.regex(NAME_PATTERN, `El ${label} solo admite letras`),
  );
}

const SignUpSchema = v.pipe(
  v.object({
    name: nameSchema('nombre'),
    surname: nameSchema('apellido'),
    employeeCode: v.pipe(
      v.string(),
      v.trim(),
      v.nonEmpty('Ingrese su código de empleado'),
      v.maxLength(
        EMPLOYEE_CODE_MAX_LENGTH,
        `El código admite máximo ${EMPLOYEE_CODE_MAX_LENGTH} caracteres`,
      ),
    ),
    email: EmailSchema,
    // La clave no se recorta: Firebase la compara exactamente como se escribió.
    password: v.pipe(
      v.string(),
      v.check(
        (password) => PASSWORD_RULES.every(({ isMet }) => isMet(password)),
        'La clave no cumple todos los requisitos',
      ),
    ),
    passwordConfirmation: v.string(),
  }),
  v.forward(
    v.check((form) => form.password === form.passwordConfirmation, 'Las claves no coinciden'),
    ['passwordConfirmation'],
  ),
);

export type SignUpForm = v.InferInput<typeof SignUpSchema>;
export type SignUpData = Technician & { email: string; password: string };
export type SignUpFieldErrors = Partial<Record<keyof SignUpForm, string>>;

export type SignUpValidation =
  | { status: 'valid'; data: SignUpData }
  | { status: 'invalid'; errors: SignUpFieldErrors };

export function validateSignUp(form: SignUpForm): SignUpValidation {
  const result = v.safeParse(SignUpSchema, form);
  if (result.success) {
    const { passwordConfirmation: _confirmation, ...data } = result.output;
    return { status: 'valid', data };
  }

  // Se muestra un solo mensaje por campo: el primer requisito que no se cumple.
  const errors: SignUpFieldErrors = {};
  for (const issue of result.issues) {
    const field = v.getDotPath(issue) as keyof SignUpForm | null;
    if (field) {
      errors[field] ??= issue.message;
    }
  }
  return { status: 'invalid', errors };
}
