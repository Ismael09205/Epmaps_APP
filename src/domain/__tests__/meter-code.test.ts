import { classifyMeterCode, normalizeMeterCode } from '../meter-code';

describe('meter code', () => {
  describe('normalizeMeterCode', () => {
    it('recorta espacios exteriores y convierte el código a mayúsculas', () => {
      expect(normalizeMeterCode('  med-123456 \t')).toBe('MED-123456');
    });

    it('conserva los espacios interiores', () => {
      expect(normalizeMeterCode('MED- 12345')).toBe('MED- 12345');
    });
  });

  describe('classifyMeterCode', () => {
    it('clasifica un código completo como válido', () => {
      expect(classifyMeterCode('MED-123456')).toBe('valid');
    });

    it('acepta minúsculas y espacios exteriores tras normalizar', () => {
      expect(classifyMeterCode('  med-123456  ')).toBe('valid');
    });

    it.each(['', 'M', 'MED', 'MED-', 'MED-12', 'med-123', 'MED-12345'])(
      'clasifica %p como incompleto',
      (code) => {
        expect(classifyMeterCode(code)).toBe('incomplete');
      },
    );

    it.each([
      'MED-12345A',
      'MED-1234567',
      'MED123456',
      'MED-12A456',
      'XYZ-123456',
      'MED-1234566',
      'MED- 12345',
    ])('clasifica %p como inválido', (code) => {
      expect(classifyMeterCode(code)).toBe('invalid');
    });

    it('solo devuelve los estados definidos', () => {
      const codes = ['', 'MED-123', 'MED-123456', 'MED-12A456'];

      for (const code of codes) {
        expect(['incomplete', 'invalid', 'valid']).toContain(classifyMeterCode(code));
      }
    });
  });
});
