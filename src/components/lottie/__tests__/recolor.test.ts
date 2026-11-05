import { hexToRgb, recolorLottie } from '../recolor';

const cloudSync = require('../../../../assets/animations/lottie/Cloud Sync Loading Loop Animation.json');

function colorsOf(animation: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node && typeof node === 'object') {
      const record = node as Record<string, any>;
      if ((record.ty === 'fl' || record.ty === 'st') && Array.isArray(record.c?.k)) {
        found.push(record.c.k.slice(0, 3).map((part: number) => part.toFixed(3)).join(','));
      }
      Object.values(record).forEach(walk);
    }
  };
  walk(animation);
  return [...new Set(found)];
}

describe('recolorLottie', () => {
  it('convierte colores hexadecimales a RGB normalizado', () => {
    expect(hexToRgb('#1E72BA')).toEqual([30 / 255, 114 / 255, 186 / 255]);
    expect(hexToRgb('#fff')).toEqual([1, 1, 1]);
    expect(() => hexToRgb('azul')).toThrow(RangeError);
  });

  it('aplica la paleta de la app a la animación de sincronización sin modificar el original', () => {
    const original = JSON.stringify(cloudSync);
    const recolored = recolorLottie(cloudSync, [
      { from: [0, 0.72, 1], to: '#1E72BA' },
      { from: [0.955, 0.712, 0.143], to: '#243376' },
      { from: [1, 1, 1], to: '#E8EEF7' },
    ]);

    expect(colorsOf(recolored).sort()).toEqual(
      [hexToRgb('#1E72BA'), hexToRgb('#243376'), hexToRgb('#E8EEF7')]
        .map((rgb) => rgb.map((part) => part.toFixed(3)).join(','))
        .sort(),
    );
    expect(JSON.stringify(cloudSync)).toBe(original);
  });

  it('reemplaza también los colores animados y conserva la opacidad', () => {
    const animation = {
      layers: [
        { ty: 'fl', c: { a: 1, k: [{ s: [1, 1, 1, 0.5], e: [0, 0.72, 1, 1] }] } },
        { ty: 'st', c: { a: 0, k: [0.2, 0.2, 0.2, 1] } },
      ],
    };

    const recolored = recolorLottie(animation, [
      { from: [1, 1, 1], to: '#000000' },
      { from: [0, 0.72, 1], to: '#ffffff' },
    ]);

    expect(recolored.layers[0].c.k).toEqual([{ s: [0, 0, 0, 0.5], e: [1, 1, 1, 1] }]);
    expect(recolored.layers[1].c.k).toEqual([0.2, 0.2, 0.2, 1]);
  });
});
