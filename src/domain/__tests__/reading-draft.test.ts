import { decideDraftMeterSource } from '../reading-draft';

describe('decideDraftMeterSource', () => {
  it.each([
    [true, true, false, 'cache'],
    [true, false, true, 'cache'],
    [false, true, true, 'refresh'],
    [false, false, true, 'refresh'],
    [false, true, false, 'outdated-snapshot'],
    [false, false, false, 'requires-connection'],
  ] as const)(
    'caché vigente %p, ficha guardada %p, conexión %p → %s',
    (hasValidCache, hasSnapshot, isOnline, source) => {
      expect(decideDraftMeterSource({ hasValidCache, hasSnapshot, isOnline })).toBe(source);
    },
  );
});
