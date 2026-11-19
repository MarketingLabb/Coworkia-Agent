import { describe, test, expect } from '@jest/globals';
import { isEnzoTeamMember, parseEnzoCommand, handleEnzoStudio, __resetEnzoStudio, detectBrandSlug } from '../../src/servicios/enzo-studio/enzo-studio.js';
import { detectFormats, normalizeConcept, buildImagePrompt, buildDirectorPrompt } from '../../src/servicios/enzo-studio/creative-director.js';
import { loadBrand, brandSummary } from '../../src/servicios/enzo-studio/brand-store.js';

const CONCEPT = {
  concepto: 'Trabajar en pijama vs trabajar en Coworkia',
  por_que_funciona: 'Todo freelancer se identifica',
  titular: 'Tu sofá no es una oficina de verdad hoy',
  subtitulo: 'Ven a concentrarte en serio',
  cta: 'Reserva tu espacio hoy',
  dato_destacado: '$10 por 2 horas',
  escena: 'Young woman working on a laptop in a bright coworking',
  copy_instagram: 'Copy IG', copy_facebook: 'Copy FB', estado_whatsapp: 'Estado WA',
  hashtags: ['#Freelance'],
};

function fakeIo() {
  const out = { texts: [], images: [] };
  return { out, io: { sendText: async (to, t) => out.texts.push(t), sendImage: async (to, b, o) => out.images.push(o) } };
}
const deps = (completeCalls) => ({
  complete: async (prompt, opts) => { completeCalls.push(prompt); return JSON.stringify(CONCEPT); },
  generate: async (prompt, format) => Buffer.from(`${format}:${prompt.length}`),
  compose: async (buf) => buf,
});

describe('acceso y comandos', () => {
  test('solo ADMIN_PHONE y ENZO_TEAM_PHONES', () => {
    const env = { ADMIN_PHONE: '+593987770788', ENZO_TEAM_PHONES: '0991112233, +593 98 444 5566' };
    expect(isEnzoTeamMember('593987770788', env)).toBe(true);
    expect(isEnzoTeamMember('+593991112233', env)).toBe(true);
    expect(isEnzoTeamMember('0984445566', env)).toBe(true);
    expect(isEnzoTeamMember('+593990000000', env)).toBe(false);
  });

  test('clasifica pedidos', () => {
    expect(parseEnzoCommand('@enzo').type).toBe('help');
    expect(parseEnzoCommand('@enzo marca').type).toBe('brand');
    expect(parseEnzoCommand('@enzo ideas para esta semana').type).toBe('ideas');
    expect(parseEnzoCommand('@enzo quiero un arte para meta sobre la sala').type).toBe('new');
    expect(parseEnzoCommand('otra versión', { hasLastJob: true }).type).toBe('variation');
    expect(parseEnzoCommand('más corto el titular', { hasLastJob: true })).toEqual({ type: 'refine', feedback: 'más corto el titular' });
    expect(parseEnzoCommand('otra versión', { hasLastJob: false }).type).toBe('new');
  });

  test('formatos: feed + story por defecto', () => {
    expect(detectFormats('arte para meta sobre el plan 20')).toEqual(['feed', 'story']);
    expect(detectFormats('un estado de whatsapp')).toEqual(['story']);
    expect(detectFormats('post para instagram')).toEqual(['feed']);
  });

  test('cuenta por defecto coworkia; otra si se nombra', () => {
    expect(detectBrandSlug('arte sobre la sala', ['coworkia', 'segpopular'])).toBe('coworkia');
    expect(detectBrandSlug('arte para segpopular', ['coworkia', 'segpopular'])).toBe('segpopular');
  });
});

describe('marca y concepto', () => {
  test('la ficha de Coworkia carga con colores y logos', async () => {
    const brand = await loadBrand('coworkia');
    expect(brand.colores.primario).toBe('#047857');
    expect(brand.logoClaroPath).toMatch(/logo-blanco\.png$/);
    expect(brandSummary(brand)).toContain('marcas/coworkia/brand.json');
  });

  test('el director recibe precios reales y reglas de la marca', async () => {
    const brand = await loadBrand('coworkia');
    const { prompt } = buildDirectorPrompt(brand, 'arte sobre el plan 20');
    expect(prompt).toContain('Plan 20: $99');
    expect(prompt).toContain('No inventar promociones');
  });

  test('normaliza: corta solo titulares extremos (>10 palabras) y agrega hashtags base', async () => {
    const brand = await loadBrand('coworkia');
    const c = normalizeConcept('```json\n' + JSON.stringify({ ...CONCEPT, titular: 'uno dos tres cuatro cinco seis siete ocho nueve diez once doce' }) + '\n```', brand);
    expect(c.titular.split(' ')).toHaveLength(10);
    expect(c.hashtags).toContain('#Coworkia');
    expect(c.hashtags).toContain('#Freelance');
  });

  test('el prompt de imagen pide los textos exactos y deja espacio para el logo', async () => {
    const brand = await loadBrand('coworkia');
    const p = buildImagePrompt(normalizeConcept(CONCEPT, brand), brand, 'feed');
    expect(p).toContain('"Tu sofá no es una oficina de verdad hoy"');
    expect(p).toContain('#047857');
    expect(p).toContain('top-left corner');
    expect(p).toContain('Do NOT add any other words, logos');
  });
});

describe('flujo completo por WhatsApp', () => {
  test('pedido nuevo → post + story + copy; luego "otra versión" usa la anterior', async () => {
    __resetEnzoStudio();
    const calls = [];
    const { out, io } = fakeIo();
    await handleEnzoStudio({ userId: '+593987770788', text: '@enzo quiero un arte para meta sobre trabajar en pijama', io, deps: deps(calls) });
    expect(out.images.map(i => i.filename.split('-')[1])).toEqual(['feed', 'story']);
    expect(out.texts.at(-1)).toContain('Copy IG');
    expect(out.texts.at(-1)).toContain('#Coworkia');

    await handleEnzoStudio({ userId: '+593987770788', text: 'otra versión', io, deps: deps(calls) });
    expect(calls.at(-1)).toContain('VERSIÓN ANTERIOR');
    expect(out.images).toHaveLength(4);
  });

  test('si la IA falla, avisa sin romper', async () => {
    __resetEnzoStudio();
    const { out, io } = fakeIo();
    await handleEnzoStudio({ userId: '+593987770788', text: '@enzo arte sobre la sala', io, deps: { complete: async () => 'no es json' } });
    expect(out.texts.at(-1)).toContain('⚠️');
  });
});
