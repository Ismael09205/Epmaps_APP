import { TECHNICIANS, checkCredentials } from '../auth';

const technician = TECHNICIANS[0];

describe('checkCredentials', () => {
  it('devuelve ok con los datos del técnico y sin la clave para una credencial válida', () => {
    const result = checkCredentials(technician.employeeCode, technician.password);

    expect(result).toEqual({
      status: 'ok',
      technician: {
        employeeCode: technician.employeeCode,
        name: technician.name,
        surname: technician.surname,
      },
    });
    expect(JSON.stringify(result)).not.toContain(technician.password);
  });

  it('ignora los espacios al inicio y al final del código y de la clave', () => {
    const result = checkCredentials(
      `  ${technician.employeeCode}  `,
      `\t${technician.password}\n`,
    );

    expect(result.status).toBe('ok');
  });

  it('distingue mayúsculas de minúsculas en el código de empleado', () => {
    const result = checkCredentials(technician.employeeCode.toLowerCase(), technician.password);

    expect(result.status).toBe('invalid');
  });

  it('distingue mayúsculas de minúsculas en la clave', () => {
    const result = checkCredentials(technician.employeeCode, technician.password.toUpperCase());

    expect(result.status).toBe('invalid');
  });

  it('conserva los espacios intermedios del código y de la clave', () => {
    const codeWithInnerSpace = `${technician.employeeCode.slice(0, 3)} ${technician.employeeCode.slice(3)}`;
    const passwordWithInnerSpace = `${technician.password.slice(0, 3)} ${technician.password.slice(3)}`;

    expect(checkCredentials(codeWithInnerSpace, technician.password).status).toBe('invalid');
    expect(checkCredentials(technician.employeeCode, passwordWithInnerSpace).status).toBe('invalid');
  });

  it('devuelve empty cuando el código está vacío', () => {
    expect(checkCredentials('', technician.password)).toEqual({ status: 'empty' });
  });

  it('devuelve empty cuando la clave está vacía', () => {
    expect(checkCredentials(technician.employeeCode, '')).toEqual({ status: 'empty' });
  });

  it('devuelve empty cuando ambos campos solo contienen espacios', () => {
    expect(checkCredentials('   ', '  ')).toEqual({ status: 'empty' });
  });

  it('devuelve invalid cuando la clave es correcta pero el código no existe', () => {
    expect(checkCredentials('no-existe', technician.password)).toEqual({ status: 'invalid' });
  });

  it('devuelve invalid cuando el código es correcto pero la clave no coincide', () => {
    expect(checkCredentials(technician.employeeCode, 'clave-equivocada')).toEqual({
      status: 'invalid',
    });
  });

  it('devuelve invalid para una credencial que no coincide con ningún técnico', () => {
    expect(checkCredentials('otro-codigo', 'otra-clave')).toEqual({ status: 'invalid' });
  });
});
