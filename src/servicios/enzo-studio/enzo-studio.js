/**
 * 🎨 Enzo Studio — community manager interno por WhatsApp
 *
 * Solo para el equipo (ADMIN_PHONE + ENZO_TEAM_PHONES). Ejemplos:
 *   @enzo quiero un arte para meta sobre la sala de reuniones
 *   @enzo story para el Plan 20
 *   @enzo otra versión                → nueva variante del último arte
 *   @enzo más corto el titular        → corrige el último arte
 *   @enzo ideas para esta semana      → 5 ideas de contenido (solo texto)
 *   @enzo marca                       → muestra los lineamientos de la cuenta
 *   @enzo arte para <cuenta> sobre …  → usa otra cuenta de marcas/<cuenta>
 *
 * Las piezas se entregan listas para publicar a mano (imagen + copy + hashtags).
 */

import { loadBrand, listBrands, brandSummary, DEFAULT_BRAND } from './brand-store.js';
import { buildDirectorPrompt, normalizeConcept, buildImagePrompt, detectFormats, FORMATS } from './creative-director.js';
import { renderArts } from './art-renderer.js';

const LOG = '[ENZO-STUDIO]';
const LAST_JOB_TTL_MS = 6 * 3600000;
const lastJobs = new Map(); // phoneKey → { brandSlug, request, concept, formats, ts }
const busy = new Set();

function phoneKey(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : d;
}

/** ¿El número puede usar a Enzo? (ADMIN_PHONE + ENZO_TEAM_PHONES separados por coma) */
export function isEnzoTeamMember(phone, env = process.env) {
  const key = phoneKey(phone);
  if (!key) return false;
  const list = [env.ADMIN_PHONE, ...(env.ENZO_TEAM_PHONES || '').split(',')].map(phoneKey).filter(Boolean);
  return list.includes(key);
}

export function stripMention(text) {
  return String(text || '').replace(/^\s*@enzo\b[\s,:-]*/i, '').trim();
}

/** Clasifica lo que pide el equipo. */
export function parseEnzoCommand(text, { hasLastJob = false } = {}) {
  const t = stripMention(text);
  const n = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!n || /^(hola|ayuda|help|menu|que haces|como funcionas)\b/.test(n)) return { type: 'help' };
  if (/^(marca|lineamientos|brand|manual)\b/.test(n)) return { type: 'brand' };
  if (/^(cuentas|marcas|clientes)\b/.test(n)) return { type: 'accounts' };
  if (/\b(ideas|calendario|plan de contenido|que publico|que publicamos)\b/.test(n)) return { type: 'ideas', text: t };
  if (hasLastJob && /^(otra|otra version|otra opcion|variacion|variante|de nuevo|repite|regenera)\b/.test(n)) return { type: 'variation' };
  if (hasLastJob && /^(mas|menos|cambia|cambiale|pon|ponle|quita|quitale|sin|usa|que sea|mejor|ahora|el titular|la foto|el color|agrega|agregale)\b/.test(n)) {
    return { type: 'refine', feedback: t };
  }
  return { type: 'new', request: t };
}

/** Detecta "para <cuenta>" si esa cuenta existe en marcas/. */
export function detectBrandSlug(text, available) {
  const n = String(text || '').toLowerCase();
  for (const slug of available) {
    if (slug !== DEFAULT_BRAND && new RegExp(`\\b${slug}\\b`).test(n)) return slug;
  }
  return DEFAULT_BRAND;
}

const HELP = `🎨 *Hola, soy Enzo — tu community manager*

Pídeme artes así:
• _@enzo arte para meta sobre la sala de reuniones_
• _@enzo story del Plan 20 para el lunes_
• _@enzo post: trabajar en pijama vs trabajar en Coworkia_

Te entrego *post 1:1 + story/estado 9:16* con el logo real, copy para Instagram y Facebook, texto para el estado de WhatsApp y hashtags. Tú lo publicas.

Después puedes decirme:
• _otra versión_ → otra idea
• _más corto el titular_, _cambia la foto por una mujer_ … → lo corrijo
• _ideas para esta semana_ → te propongo contenidos
• _marca_ → te muestro los lineamientos que uso`;

function deliveryText(concept, brand) {
  return [
    `💡 *Concepto:* ${concept.concepto}`,
    concept.por_que_funciona ? `🚀 *Por qué funciona:* ${concept.por_que_funciona}` : null,
    ``,
    `📸 *Copy Instagram:*`,
    concept.copy_instagram,
    ``,
    `👍 *Copy Facebook:*`,
    concept.copy_facebook,
    ``,
    `🟢 *Estado de WhatsApp:*`,
    concept.estado_whatsapp,
    ``,
    `#️⃣ ${concept.hashtags.join(' ')}`,
    ``,
    `¿Ajusto algo? Escribe *otra versión* o dime qué cambiar (ej: _más corto el titular_).`,
  ].filter(l => l !== null).join('\n');
}

/**
 * Maneja un mensaje del equipo para Enzo.
 * @param {object} p
 * @param {string} p.userId
 * @param {string} p.text
 * @param {object} p.io - { sendText(userId, text), sendImage(userId, buffer, {filename, caption}) }
 * @param {object} [p.deps] - inyección para tests: { complete, generate, compose, loadBrand, listBrands }
 * @returns {Promise<boolean>} true si Enzo respondió
 */
export async function handleEnzoStudio({ userId, text, io, deps = {} }) {
  const key = phoneKey(userId);
  const last = lastJobs.get(key);
  const hasLastJob = !!last && Date.now() - last.ts < LAST_JOB_TTL_MS;
  const cmd = parseEnzoCommand(text, { hasLastJob });
  const _loadBrand = deps.loadBrand || loadBrand;
  const _listBrands = deps.listBrands || listBrands;
  const complete = deps.complete || (async (prompt, opts) => (await import('../../servicios-ia/openai.js')).complete(prompt, opts));

  if (cmd.type === 'help') { await io.sendText(userId, HELP); return true; }

  if (cmd.type === 'accounts') {
    const slugs = await _listBrands();
    await io.sendText(userId, `📁 *Cuentas que manejo:* ${slugs.join(', ') || DEFAULT_BRAND}\n\nPara usar otra: _@enzo arte para <cuenta> sobre …_`);
    return true;
  }

  if (cmd.type === 'brand') {
    const brand = await _loadBrand(last?.brandSlug || DEFAULT_BRAND);
    await io.sendText(userId, brandSummary(brand));
    return true;
  }

  if (cmd.type === 'ideas') {
    const brand = await _loadBrand(detectBrandSlug(cmd.text, await _listBrands()));
    const { system, prompt } = buildDirectorPrompt(brand, cmd.text);
    const ideas = await complete(`${prompt}\n\nEn lugar del JSON, propone 5 ideas de contenido para Meta numeradas, cada una con: formato (post/story/carrusel/reel), titular y por qué funcionaría. Breve, para WhatsApp, usa *negritas*.`,
      { system: system.replace('Respondes SOLO con JSON válido.', 'Respondes en texto para WhatsApp.'), temperature: 0.9, max_tokens: 900 });
    await io.sendText(userId, `💡 *Ideas para ${brand.nombre}*\n\n${ideas}\n\nDime el número que te guste y lo diseño 🎨`);
    lastJobs.set(key, { ...(last || {}), brandSlug: brand.slug, ideas, ts: Date.now() });
    return true;
  }

  if (busy.has(key)) {
    await io.sendText(userId, '⏳ Todavía estoy terminando el arte anterior. Te aviso apenas esté listo.');
    return true;
  }

  // ── Nuevo arte, variación o corrección ──
  let request; let brandSlug; let formats; let feedback = null; let previous = null;
  if (cmd.type === 'new') {
    // "la 2" / "la idea 3" después de pedir ideas
    const pick = cmd.request.match(/^(?:la\s+)?(?:idea\s+)?(?:n[uú]mero\s+)?([1-5])\b/i);
    request = (pick && last?.ideas) ? `Diseña la idea ${pick[1]} de esta lista:\n${last.ideas}` : cmd.request;
    brandSlug = detectBrandSlug(cmd.request, await _listBrands());
    formats = detectFormats(cmd.request);
  } else {
    request = last.request;
    brandSlug = last.brandSlug;
    formats = last.formats;
    previous = last.concept;
    feedback = cmd.type === 'refine' ? cmd.feedback : 'Haz una versión distinta: otro ángulo creativo, otro titular y otra escena.';
  }

  busy.add(key);
  try {
    const brand = await _loadBrand(brandSlug);
    await io.sendText(userId, `🎨 Manos a la obra con *${brand.nombre}*: ${formats.map(f => FORMATS[f].label).join(' + ')}.\nTe lo envío en 1–2 minutos ⏳`);

    const { system, prompt } = buildDirectorPrompt(brand, request, { feedback, previous });
    const raw = await complete(prompt, { system, temperature: 0.9, max_tokens: 1200 });
    const concept = normalizeConcept(raw, brand);

    const arts = await renderArts({
      brand, concept, formats,
      buildPrompt: buildImagePrompt,
      ...(deps.generate ? { generate: deps.generate } : {}),
      ...(deps.compose ? { compose: deps.compose } : {}),
    });

    for (const art of arts) {
      await io.sendImage(userId, art.buffer, { filename: art.filename, caption: `${art.format === 'feed' ? '🟩 Post 1:1' : '📱 Story / Estado 9:16'} — ${concept.titular}` });
    }
    await io.sendText(userId, deliveryText(concept, brand));

    lastJobs.set(key, { brandSlug: brand.slug, request, concept, formats, ts: Date.now() });
    console.log(`${LOG} ✅ ${arts.length} arte(s) para ${brand.slug} → ${userId}`);
    return true;
  } catch (err) {
    console.error(`${LOG} ❌`, err);
    const reason = /safety|policy|rejected/i.test(err.message || '')
      ? 'La IA de imágenes rechazó la escena. Prueba describiéndola de otra forma.'
      : 'Algo falló generando el arte. Intenta de nuevo en un momento.';
    await io.sendText(userId, `⚠️ ${reason}`);
    return true;
  } finally {
    busy.delete(key);
  }
}

/** Solo para tests */
export function __resetEnzoStudio() {
  lastJobs.clear();
  busy.clear();
}
