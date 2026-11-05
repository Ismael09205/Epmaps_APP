import { LEAFLET_JS } from '../map/leaflet-assets';
import { buildLeafletHtml, parseMapMessage } from '../map/leaflet-html';

const html = buildLeafletHtml({ marker: '#1E72BA', accuracy: '#1E72BA', missingTile: '#F5F7FB' });

describe('página del mapa', () => {
  it('incluye Leaflet en la página, sin cargar recursos externos', () => {
    expect(LEAFLET_JS.length).toBeGreaterThan(100_000);
    expect(html).toContain(LEAFLET_JS);
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
    expect(html).not.toMatch(/unpkg|cdn/i);
  });

  it('permite fijar el marcador en modo de solo lectura', () => {
    expect(html).toContain('var interactive = true;');
    expect(
      buildLeafletHtml(
        { marker: '#1E72BA', accuracy: '#1E72BA', missingTile: '#F5F7FB' },
        { interactive: false },
      ),
    ).toContain('var interactive = false;');
  });

  it('muestra la atribución de OpenStreetMap', () => {
    expect(html).toContain('OpenStreetMap');
  });

  it('el script del mapa es JavaScript válido', () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);

    expect(scripts).toHaveLength(2);
    for (const script of scripts) {
      expect(() => new Function(script)).not.toThrow();
    }
  });
});

describe('parseMapMessage', () => {
  it('acepta los mensajes del mapa', () => {
    expect(parseMapMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(parseMapMessage('{"type":"tile","id":1,"z":16,"x":2,"y":3}')).toEqual({
      type: 'tile',
      id: 1,
      z: 16,
      x: 2,
      y: 3,
    });
    expect(parseMapMessage('{"type":"manual","latitude":-0.18,"longitude":-78.46}')).toEqual({
      type: 'manual',
      latitude: -0.18,
      longitude: -78.46,
    });
  });

  it('descarta mensajes inválidos', () => {
    expect(parseMapMessage('no es json')).toBeNull();
    expect(parseMapMessage('{"type":"manual","latitude":"x","longitude":1}')).toBeNull();
    expect(parseMapMessage('{"type":"otro"}')).toBeNull();
  });
});
