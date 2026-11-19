/**
 * 🌍 Localizador de mensajes salientes (WhatsApp)
 *
 * Gran parte del sistema envía textos fijos en español (formularios de reserva,
 * cotizaciones de seguros, confirmaciones de pago, seguimientos...). Antes, un
 * cliente que escribía en inglés, francés, italiano, portugués o quechua recibía
 * esos mensajes en español aunque el agente le hablara en su idioma.
 *
 * Este módulo se aplica justo antes de enviar cada WhatsApp:
 *  - Si el idioma preferido del destinatario es español (o no se conoce) → no hace nada.
 *  - Si el texto ya está en su idioma (p. ej. respuesta de la IA) → no hace nada.
 *  - Si el texto está en español y el cliente usa otro idioma → lo traduce con
 *    IA conservando emojis, *negritas*, links, montos, códigos y teléfonos.
 *  - Si la traducción falla o tarda demasiado → se envía el original (nunca bloquea).
 */

import { detectLanguage } from './language-detector.js';

const TRANSLATION_TIMEOUT_MS = 12000;
const CACHE_MAX = 500;
const translationCache = new Map(); // `${lang}::${texto}` → traducción

let deps = {
  loadLanguage: async (userId) => {
    const { loadProfile } = await import('../perfiles-interacciones/memoria-sqlite.js');
    const profile = await loadProfile(userId);
    return profile?.preferredLanguage || null;
  },
  translate: async (text, lang) => {
    const { translateMessage } = await import('./language-detector.js');
    return translateMessage(text, lang);
  },
};

let depsOverridden = false;

/** Solo para tests: reemplaza la carga de idioma y la traducción. */
export function __setLocalizerDeps(overrides) {
  deps = { ...deps, ...overrides };
  depsOverridden = true;
  translationCache.clear();
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

/** ¿El texto está en español con suficiente seguridad como para traducirlo? */
export function isSpanishText(text) {
  const d = detectLanguage(text, 'es');
  if (d.language !== 'es') return false;
  // Mensajes con pocas palabras reconocibles (solo emojis, montos, links): no traducir
  return (d.matchCount || 0) >= 2;
}

/**
 * Devuelve el mensaje en el idioma del destinatario.
 * @param {string} userId - Número del destinatario
 * @param {string} text - Mensaje a enviar
 * @param {object} [opts] - { language } para forzar el idioma destino
 */
export async function localizeOutgoing(userId, text, opts = {}) {
  try {
    if (!text || typeof text !== 'string' || text.trim().length < 4) return text;
    if (process.env.OUTBOUND_TRANSLATION === 'off') return text;
    // En la suite de tests no se consulta BD ni OpenAI (salvo tests del propio localizador)
    if (process.env.NODE_ENV === 'test' && !depsOverridden) return text;

    const lang = opts.language || await withTimeout(deps.loadLanguage(userId), 3000);
    if (!lang || lang === 'es') return text;
    if (!isSpanishText(text)) return text;

    const key = `${lang}::${text}`;
    if (translationCache.has(key)) return translationCache.get(key);

    const translated = await withTimeout(deps.translate(text, lang), TRANSLATION_TIMEOUT_MS);
    if (!translated || typeof translated !== 'string' || translated.trim() === text.trim()) return text;

    if (translationCache.size >= CACHE_MAX) translationCache.delete(translationCache.keys().next().value);
    translationCache.set(key, translated);
    console.log(`[LOCALIZER] 🌍 Mensaje traducido a ${lang} para ${userId}`);
    return translated;
  } catch (err) {
    console.warn('[LOCALIZER] ⚠️ No se pudo localizar, se envía original:', err.message);
    return text;
  }
}
