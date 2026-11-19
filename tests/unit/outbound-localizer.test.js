import { describe, test, expect } from '@jest/globals';
import { localizeOutgoing, isSpanishText, __setLocalizerDeps } from '../../src/utils/outbound-localizer.js';

function setup(langByPhone) {
  const calls = [];
  __setLocalizerDeps({
    loadLanguage: async (phone) => langByPhone[phone] ?? null,
    translate: async (text, lang) => { calls.push(lang); return `[${lang}] ${text}`; },
  });
  return calls;
}

const ES = '✅ ¡Listo! Tu reserva de la sala quedó confirmada para mañana a las 10:00. Te esperamos 😊';

describe('localizador de mensajes salientes', () => {
  test('cliente en español: no se traduce', async () => {
    const calls = setup({ '+593900000001': 'es' });
    expect(await localizeOutgoing('+593900000001', ES)).toBe(ES);
    expect(calls).toHaveLength(0);
  });

  test('cliente en inglés: el mensaje fijo en español se traduce', async () => {
    const calls = setup({ '+593900000002': 'en' });
    expect(await localizeOutgoing('+593900000002', ES)).toBe(`[en] ${ES}`);
    expect(calls).toEqual(['en']);
  });

  test('texto que ya está en el idioma del cliente: no se toca', async () => {
    const calls = setup({ '+593900000003': 'en' });
    const msg = 'Great! Your meeting room is booked for tomorrow at 10:00.';
    expect(await localizeOutgoing('+593900000003', msg)).toBe(msg);
    expect(calls).toHaveLength(0);
  });

  test('si la traducción falla se envía el original', async () => {
    __setLocalizerDeps({ loadLanguage: async () => 'fr', translate: async () => { throw new Error('boom'); } });
    expect(await localizeOutgoing('+593900000004', ES)).toBe(ES);
  });

  test('idioma desconocido o mensajes sin texto: no se tocan', async () => {
    const calls = setup({});
    expect(await localizeOutgoing('+593900000005', ES)).toBe(ES);
    expect(await localizeOutgoing('+593900000005', '👍')).toBe('👍');
    expect(calls).toHaveLength(0);
  });

  test('traducciones repetidas salen de caché', async () => {
    const calls = setup({ '+593900000006': 'pt' });
    await localizeOutgoing('+593900000006', ES);
    await localizeOutgoing('+593900000006', ES);
    expect(calls).toEqual(['pt']);
  });

  test('detecta español en mensajes fijos', () => {
    expect(isSpanishText(ES)).toBe(true);
    expect(isSpanishText('https://wa.me/593994837117 💵 $99')).toBe(false);
  });
});
