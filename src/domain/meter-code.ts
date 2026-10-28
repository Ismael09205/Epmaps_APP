export type MeterCodeStatus = 'incomplete' | 'invalid' | 'valid';

export function normalizeMeterCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function classifyMeterCode(raw: string): MeterCodeStatus {
  const code = normalizeMeterCode(raw);

  if (/^MED-\d{6}$/.test(code)) {
    return 'valid';
  }

  if (
    (code.length < 4 && 'MED-'.startsWith(code)) ||
    /^MED-\d{0,5}$/.test(code)
  ) {
    return 'incomplete';
  }

  return 'invalid';
}
