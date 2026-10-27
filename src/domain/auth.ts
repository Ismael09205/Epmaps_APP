export type Technician = {
  employeeCode: string;
  name: string;
  surname: string;
};

export type TechnicianCredential = Technician & { password: string };

export type CredentialCheck =
  | { status: 'ok'; technician: Technician }
  | { status: 'empty' }
  | { status: 'invalid' };

// Credenciales de prueba quemadas (D-01). La clave nunca se persiste ni se expone (RF-05, RNF-02).
export const TECHNICIANS: readonly TechnicianCredential[] = [
  { employeeCode: 'EPM-1001', password: 'epmaps2026', name: 'Ana', surname: 'Guamán' },
  { employeeCode: 'EPM-1002', password: 'pruebas2026', name: 'Luis', surname: 'Narváez' },
];

// D-11: la comparación distingue mayúsculas y solo ignora los espacios de los bordes.
export function checkCredentials(code: string, password: string): CredentialCheck {
  const normalizedCode = code.trim();
  const normalizedPassword = password.trim();

  if (normalizedCode === '' || normalizedPassword === '') {
    return { status: 'empty' };
  }

  const match = TECHNICIANS.find(
    (technician) =>
      technician.employeeCode === normalizedCode && technician.password === normalizedPassword,
  );

  if (!match) {
    return { status: 'invalid' };
  }

  const { employeeCode, name, surname } = match;
  return { status: 'ok', technician: { employeeCode, name, surname } };
}

