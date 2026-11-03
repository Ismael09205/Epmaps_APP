import {
  getPasswordRequirements,
  isValidEmail,
  mapAuthErrorCode,
  mapSignUpErrorCode,
  parseTechnicianProfile,
  sanitizeNameInput,
  validateDisplayName,
  validateSignUp,
} from '../auth';

describe('mapAuthErrorCode', () => {
  it.each([
    'auth/invalid-credential',
    'auth/invalid-email',
    'auth/user-disabled',
    'auth/user-not-found',
    'auth/wrong-password',
  ])('clasifica %s como credencial inválida', (code) => {
    expect(mapAuthErrorCode(code)).toBe('invalid');
  });

  it('clasifica la falta de red de Authentication y de Firestore como network', () => {
    expect(mapAuthErrorCode('auth/network-request-failed')).toBe('network');
    expect(mapAuthErrorCode('unavailable')).toBe('network');
  });

  it('clasifica el exceso de intentos', () => {
    expect(mapAuthErrorCode('auth/too-many-requests')).toBe('too-many-requests');
  });

  it('clasifica como unavailable los códigos desconocidos o ausentes', () => {
    expect(mapAuthErrorCode('permission-denied')).toBe('unavailable');
    expect(mapAuthErrorCode('auth/invalid-api-key')).toBe('unavailable');
    expect(mapAuthErrorCode(undefined)).toBe('unavailable');
  });
});

describe('mapSignUpErrorCode', () => {
  it('clasifica los errores propios del registro', () => {
    expect(mapSignUpErrorCode('auth/email-already-in-use')).toBe('email-in-use');
    expect(mapSignUpErrorCode('auth/weak-password')).toBe('weak-password');
    expect(mapSignUpErrorCode('auth/password-does-not-meet-requirements')).toBe('weak-password');
  });

  it('reutiliza la clasificación general para el resto de errores', () => {
    expect(mapSignUpErrorCode('auth/invalid-email')).toBe('invalid');
    expect(mapSignUpErrorCode('auth/network-request-failed')).toBe('network');
    expect(mapSignUpErrorCode('auth/operation-not-allowed')).toBe('unavailable');
  });
});

describe('parseTechnicianProfile', () => {
  const profile = { employeeCode: 'EPM-1001', name: 'Ana', surname: 'Guamán' };

  it('devuelve los datos del técnico', () => {
    expect(parseTechnicianProfile(profile)).toEqual(profile);
  });

  it('descarta los campos que no pertenecen al perfil', () => {
    expect(parseTechnicianProfile({ ...profile, role: 'admin' })).toEqual(profile);
  });

  it('ignora los espacios de los bordes para no separar las lecturas del técnico', () => {
    expect(parseTechnicianProfile({ ...profile, employeeCode: ' EPM-1001 ' })).toEqual(profile);
  });

  it.each([
    ['sin código', { name: 'Ana', surname: 'Guamán' }],
    ['con código vacío', { ...profile, employeeCode: '   ' }],
    ['con código numérico', { ...profile, employeeCode: 1001 }],
    ['sin datos', undefined],
  ])('devuelve null para un perfil %s', (_case, data) => {
    expect(parseTechnicianProfile(data)).toBeNull();
  });
});

describe('isValidEmail', () => {
  it.each(['ana@epmaps.com.ec', ' ana.guaman+1@dominio.com '])('acepta %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', 'ana', 'ana@', '@dominio.com', 'ana@dominio', 'ana @dominio.com'])(
    'rechaza "%s"',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );
});

describe('validateDisplayName', () => {
  it.each(['Ana', 'Ana María Guamán', '  Luis Narváez  '])('acepta "%s"', (name) => {
    expect(validateDisplayName(name)).toBeNull();
  });

  it.each([
    ['', 'Ingrese'],
    ['   ', 'Ingrese'],
    ['Jo', 'al menos 3'],
    ['A'.repeat(41), 'máximo 40'],
    ['Ana1', 'solo admite letras'],
    ['Ana  Luz', 'solo admite letras'],
  ])('rechaza "%s"', (name, message) => {
    expect(validateDisplayName(name)).toContain(message);
  });
});

describe('sanitizeNameInput', () => {
  it('elimina números y caracteres especiales', () => {
    expect(sanitizeNameInput('An@a1-_!')).toBe('Ana');
  });

  it('conserva tildes, eñes y espacios', () => {
    expect(sanitizeNameInput('José Ñuñez')).toBe('José Ñuñez');
  });
});

describe('getPasswordRequirements', () => {
  function metLabels(password: string) {
    return getPasswordRequirements(password)
      .filter((requirement) => requirement.met)
      .map((requirement) => requirement.label);
  }

  it('marca todos los requisitos como pendientes con la clave vacía', () => {
    expect(metLabels('')).toEqual([]);
    expect(getPasswordRequirements('')).toHaveLength(5);
  });

  it('marca únicamente los requisitos que la clave ya cumple', () => {
    expect(metLabels('a1')).toEqual(['Una letra minúscula', 'Un número']);
  });

  it('marca todos los requisitos como cumplidos con una clave segura', () => {
    expect(metLabels('Segura#2026')).toHaveLength(5);
  });
});

describe('validateSignUp', () => {
  const form = {
    name: 'María José',
    surname: 'Guamán',
    employeeCode: 'EPM-1001',
    email: ' ana@epmaps.com.ec ',
    password: 'Segura#2026',
    passwordConfirmation: 'Segura#2026',
  };

  function errorsFor(changes: Partial<typeof form>) {
    const result = validateSignUp({ ...form, ...changes });
    return result.status === 'invalid' ? result.errors : {};
  }

  it('entrega los datos normalizados y sin la confirmación de la clave', () => {
    expect(validateSignUp(form)).toEqual({
      status: 'valid',
      data: {
        name: 'María José',
        surname: 'Guamán',
        employeeCode: 'EPM-1001',
        email: 'ana@epmaps.com.ec',
        password: 'Segura#2026',
      },
    });
  });

  it.each([
    ['muy corto', 'Jo', 'al menos 3'],
    ['muy largo', 'Maximiliano Jr', 'máximo 12'],
    ['con números', 'Luis1', 'solo admite letras'],
    ['con caracteres especiales', 'Ana-María', 'solo admite letras'],
    ['con espacios dobles', 'Ana  Luz', 'solo admite letras'],
    ['vacío', '   ', 'Ingrese'],
  ])('rechaza un nombre o apellido %s', (_case, value, message) => {
    expect(errorsFor({ name: value }).name).toContain(message);
    expect(errorsFor({ surname: value }).surname).toContain(message);
  });

  it('acepta nombres de 3 y de 12 caracteres', () => {
    expect(errorsFor({ name: 'Ana' }).name).toBeUndefined();
    expect(errorsFor({ name: 'Maximilianos' }).name).toBeUndefined();
  });

  it('limita el código de empleado a 8 caracteres y lo exige', () => {
    expect(errorsFor({ employeeCode: 'EPM-10011' }).employeeCode).toContain('máximo 8');
    expect(errorsFor({ employeeCode: ' ' }).employeeCode).toContain('Ingrese');
    expect(errorsFor({ employeeCode: 'EPM-1001' }).employeeCode).toBeUndefined();
  });

  it('rechaza un correo mal formado', () => {
    expect(errorsFor({ email: 'ana@dominio' }).email).toContain('correo válido');
  });

  it.each([
    ['corta', 'Ab#1234'],
    ['sin mayúscula', 'segura#2026'],
    ['sin minúscula', 'SEGURA#2026'],
    ['sin número', 'Segura#clave'],
    ['sin símbolo', 'Segura2026'],
  ])('rechaza una clave %s', (_case, password) => {
    expect(errorsFor({ password, passwordConfirmation: password }).password).toBe(
      'La clave no cumple todos los requisitos',
    );
  });

  it('rechaza claves que no coinciden', () => {
    expect(errorsFor({ passwordConfirmation: 'Otra#2026x' }).passwordConfirmation).toBe(
      'Las claves no coinciden',
    );
  });

  it('detecta que las claves no coinciden aunque otros campos sean inválidos', () => {
    const errors = errorsFor({ name: '', passwordConfirmation: 'Otra#2026x' });

    expect(errors.name).toBeDefined();
    expect(errors.passwordConfirmation).toBe('Las claves no coinciden');
  });

  it('informa los errores de todos los campos a la vez', () => {
    const errors = errorsFor({ name: '', surname: '', employeeCode: '', email: '' });

    expect(Object.keys(errors).sort()).toEqual(['email', 'employeeCode', 'name', 'surname']);
  });
});
