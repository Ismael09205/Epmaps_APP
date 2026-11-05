type Rgb = readonly [number, number, number];

export type ColorReplacement = { from: Rgb; to: string };

const TOLERANCE = 0.06;

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) {
    throw new RangeError(`Color no válido: ${hex}`);
  }

  return [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16) / 255) as unknown as Rgb;
}

function isColor(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    (value.length === 3 || value.length === 4) &&
    value.every((part) => typeof part === 'number')
  );
}

function replaceColor(color: number[], replacements: { from: Rgb; to: Rgb }[]): number[] {
  const match = replacements.find(({ from }) =>
    from.every((part, index) => Math.abs(part - color[index]) <= TOLERANCE),
  );
  if (!match) {
    return color;
  }

  return color.length === 4 ? [...match.to, color[3]] : [...match.to];
}

// Copia de una animación Lottie con los colores de relleno y trazo reemplazados por los de la
// paleta. Los colores sin reemplazo se conservan.
export function recolorLottie<T>(animation: T, replacements: readonly ColorReplacement[]): T {
  const targets = replacements.map(({ from, to }) => ({ from, to: hexToRgb(to) }));

  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      return node.map(walk);
    }

    if (typeof node !== 'object' || node === null) {
      return node;
    }

    const record = node as Record<string, unknown>;
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      copy[key] = walk(value);
    }

    // Relleno (fl) o trazo (st): color fijo en `c.k` o animado en los fotogramas `s`/`e`.
    if ((record.ty === 'fl' || record.ty === 'st') && typeof copy.c === 'object' && copy.c) {
      const color = copy.c as Record<string, unknown>;
      if (isColor(color.k)) {
        color.k = replaceColor(color.k, targets);
      } else if (Array.isArray(color.k)) {
        color.k = color.k.map((frame: unknown) => {
          if (typeof frame !== 'object' || frame === null) {
            return frame;
          }
          const keyframe = { ...(frame as Record<string, unknown>) };
          for (const side of ['s', 'e'] as const) {
            if (isColor(keyframe[side])) {
              keyframe[side] = replaceColor(keyframe[side], targets);
            }
          }
          return keyframe;
        });
      }
    }

    return copy;
  };

  return walk(animation) as T;
}
