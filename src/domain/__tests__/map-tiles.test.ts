import { isValidTile, tilesAround, toTile } from '../map-tiles';

describe('teselas del mapa', () => {
  it('convierte coordenadas de Quito a la tesela XYZ', () => {
    expect(toTile(-0.180653, -78.467834, 16)).toEqual({ z: 16, x: 18483, y: 32800 });
  });

  it('valida los índices de la tesela', () => {
    expect(isValidTile({ z: 2, x: 3, y: 3 })).toBe(true);
    expect(isValidTile({ z: 2, x: 4, y: 0 })).toBe(false);
    expect(isValidTile({ z: 20, x: 0, y: 0 })).toBe(false);
  });

  it('cubre la zona de trabajo en cada nivel de zoom sin repetir teselas', () => {
    const tiles = tilesAround(-0.180653, -78.467834);
    const keys = new Set(tiles.map(({ z, x, y }) => `${z}/${x}/${y}`));

    expect(keys.size).toBe(tiles.length);
    expect(new Set(tiles.map((tile) => tile.z))).toEqual(new Set([14, 15, 16, 17]));
    expect(tiles).toContainEqual(toTile(-0.180653, -78.467834, 17));
  });

  it('rechaza una zona demasiado grande', () => {
    expect(() => tilesAround(-0.18, -78.46, 20_000)).toThrow(RangeError);
  });
});
