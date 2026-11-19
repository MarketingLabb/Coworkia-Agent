/**
 * 🧠 Enzo Studio — director creativo
 *
 * Convierte "quiero un arte para meta sobre X" en un concepto completo,
 * siempre dentro de los lineamientos de la cuenta (brand.json):
 *   titular, subtítulo, CTA, escena visual, copy para IG/FB, estado de WhatsApp
 *   y hashtags. Luego arma las instrucciones para el generador de imágenes.
 */

export const FORMATS = Object.freeze({
  feed:  { label: 'Post feed 1:1 (Instagram / Facebook)', size: '1024x1024', out: { width: 1080, height: 1080 } },
  story: { label: 'Story / Estado 9:16 (Instagram / Facebook / WhatsApp)', size: '1024x1536', out: { width: 1080, height: 1920 } },
});

/** Qué formatos pidió: por defecto feed + story. */
export function detectFormats(text) {
  const t = String(text || '').toLowerCase();
  const wantsStory = /\b(story|stories|historia|historias|estado|estados|reel|vertical)\b/.test(t);
  const wantsFeed = /\b(post|feed|publicaci[oó]n|cuadrad[oa])\b/.test(t);
  if (wantsStory && !wantsFeed) return ['story'];
  if (wantsFeed && !wantsStory) return ['feed'];
  return ['feed', 'story'];
}

function list(arr) {
  return (arr || []).map(x => `- ${x}`).join('\n');
}

export function buildDirectorPrompt(brand, request, { feedback = null, previous = null } = {}) {
  const servicios = (brand.servicios || []).map(s => `- ${s.nombre}: ${s.precio}`).join('\n');
  return {
    system: `Eres Enzo, community manager y director creativo senior de una agencia en Quito.
Manejas la cuenta "${brand.nombre}" y respetas sus lineamientos al pie de la letra.
Tu objetivo: piezas para Meta (Instagram, Facebook y estados de WhatsApp) con alto potencial de
compartirse: una sola idea clara, un gancho emocional o de humor identificable para el público,
y un beneficio concreto. Respondes SOLO con JSON válido.`,
    prompt: `CUENTA: ${brand.nombre} — ${brand.descripcion || ''}
Slogan: ${brand.slogan || '—'}
Ubicación: ${brand.ubicacion || '—'} · Horario: ${brand.horario || '—'} · WhatsApp: ${brand.whatsapp || '—'}

PÚBLICO:
${list(brand.publico)}

PROPUESTA DE VALOR:
${list(brand.propuesta_de_valor)}

SERVICIOS Y PRECIOS (los únicos que puedes mencionar):
${servicios || '- (sin precios en la ficha: no menciones precios)'}

COLORES: ${JSON.stringify(brand.colores || {})}
TIPOGRAFÍA: ${brand.tipografia || '—'}
ESTILO VISUAL:
${list(brand.estilo_visual)}
TONO:
${list(brand.tono)}
NO HACER:
${list(brand.no_hacer)}
CTA PREFERIDOS: ${(brand.cta_preferidos || []).join(' | ')}
HASHTAGS BASE: ${(brand.hashtags_base || []).join(' ')}

PEDIDO DEL CLIENTE: "${request}"
${previous ? `\nVERSIÓN ANTERIOR (no la repitas): ${JSON.stringify({ titular: previous.titular, concepto: previous.concepto })}` : ''}
${feedback ? `\nCORRECCIONES DEL CLIENTE SOBRE LA VERSIÓN ANTERIOR: "${feedback}"` : ''}

Devuelve este JSON:
{
  "concepto": "la idea en una frase",
  "por_que_funciona": "por qué puede compartirse/viralizarse, en una frase",
  "titular": "máximo 7 palabras, en español, gancho fuerte",
  "subtitulo": "máximo 12 palabras o null",
  "cta": "máximo 5 palabras",
  "dato_destacado": "precio u oferta EXACTA de la ficha si aplica, o null",
  "escena": "descripción en INGLÉS de la fotografía/escena de fondo: personas, lugar, luz, encuadre, emoción. Sin texto ni logos.",
  "uso_de_color": "cómo usar los colores de marca en el diseño (en inglés)",
  "copy_instagram": "texto del post para Instagram, 3-6 líneas, con emojis moderados y CTA",
  "copy_facebook": "texto del post para Facebook, puede ser un poco más largo, con CTA",
  "estado_whatsapp": "texto corto para acompañar el estado de WhatsApp (1-2 líneas)",
  "hashtags": ["5 a 8 hashtags, incluye los base"]
}`,
  };
}

function clip(text, maxWords) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

/** Valida y recorta el concepto que devuelve la IA. */
export function normalizeConcept(raw, brand) {
  let data = raw;
  if (typeof raw === 'string') {
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    data = JSON.parse((m ? m[1] : raw).trim());
  }
  if (!data || typeof data !== 'object') throw new Error('Concepto vacío');
  // El prompt pide ≤7 palabras; aquí solo cortamos casos extremos (cortar a 7 deja frases rotas)
  const titular = clip(data.titular, 10);
  if (!titular) throw new Error('El concepto no trae titular');
  const base = brand.hashtags_base || [];
  const tags = [...new Set([...(Array.isArray(data.hashtags) ? data.hashtags : []), ...base]
    .map(h => String(h).trim()).filter(Boolean).map(h => (h.startsWith('#') ? h : `#${h}`)))].slice(0, 10);
  return {
    concepto: String(data.concepto || '').trim(),
    por_que_funciona: String(data.por_que_funciona || '').trim(),
    titular,
    subtitulo: data.subtitulo ? clip(data.subtitulo, 16) : null,
    cta: clip(data.cta || (brand.cta_preferidos || [])[0] || 'Escríbenos', 5),
    dato_destacado: data.dato_destacado ? String(data.dato_destacado).trim() : null,
    escena: String(data.escena || 'Bright modern coworking space in Quito, people working on laptops, natural light, plants').trim(),
    uso_de_color: String(data.uso_de_color || '').trim(),
    copy_instagram: String(data.copy_instagram || '').trim(),
    copy_facebook: String(data.copy_facebook || data.copy_instagram || '').trim(),
    estado_whatsapp: String(data.estado_whatsapp || '').trim(),
    hashtags: tags,
  };
}

/** Instrucciones para el generador de imágenes (el logo real se pone después). */
export function buildImagePrompt(concept, brand, format) {
  const c = brand.colores || {};
  const texts = [
    `HEADLINE (large, bold): "${concept.titular}"`,
    concept.subtitulo ? `SUBHEADLINE (medium): "${concept.subtitulo}"` : null,
    concept.dato_destacado ? `HIGHLIGHT BADGE (accent color): "${concept.dato_destacado}"` : null,
    `CALL-TO-ACTION BUTTON: "${concept.cta}"`,
  ].filter(Boolean).join('\n');
  const layout = format === 'story'
    ? 'Vertical 9:16-friendly composition. Keep ALL text inside the central 70% of the height (top and bottom 15% will be cropped/covered by app UI). Leave the top 12% of the canvas free of text for the logo.'
    : 'Square composition for Instagram/Facebook feed. Leave the top-left corner (about 22% width x 15% height) completely clean (no text, no busy detail) for the logo.';
  return `Professional social media advertising graphic for "${brand.nombre}", a coworking space in Quito, Ecuador.
SCENE: ${concept.escena}
DESIGN: ${concept.uso_de_color || 'Use the brand colors in solid blocks or bands behind the text.'} Brand colors: primary ${c.primario}, dark ${c.primario_oscuro}, accent ${c.acento}, near-black ${c.oscuro}, light ${c.claro}. Typography: ${brand.tipografia || 'modern rounded sans-serif'}.
${layout}
TEXT — render ONLY these texts, in Spanish, spelled EXACTLY as written (keep accents and ñ):
${texts}
High contrast and legible on a phone. Photorealistic, warm, optimistic, premium but approachable.
Do NOT add any other words, logos, brand names, watermarks, phone numbers or URLs.`;
}
