/**
 * Peticiones de clientes a Paula que NO deben quedar solo en manos del LLM
 * (incidente 10-nov-2026: Paula prometía "te lo envío por correo" y nunca se
 * enviaba; y al pedir cambio de email respondía "contacta a soporte").
 *
 * Funciones puras → fáciles de testear. El cableado vive en wassenger.js.
 */

const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/;

export function extractEmail(text) {
  const m = String(text || '').match(EMAIL_RE);
  return m ? m[0].toLowerCase() : null;
}

/**
 * "change my email to x@y.com", "my new email is x@y.com",
 * "cambia mi correo a x@y.com", "mi nuevo correo es x@y.com"
 * → devuelve el email nuevo, o null.
 */
export function detectEmailChange(text) {
  const t = String(text || '');
  const email = extractEmail(t);
  if (!email) return null;
  const en = /\b(change|update|replace|switch|new)\b[^.?!]{0,40}\b(e-?mail|mail|address)\b|\b(e-?mail|mail)\b[^.?!]{0,40}\b(change|update|now)\b|\bchange it to\b/i;
  const es = /\b(cambi[aeo]r?|actualiz[aeo]r?|nuevo|nueva|reemplaz[aeo]r?)\b[^.?!]{0,40}\b(correo|e-?mail|mail)\b|\b(correo|e-?mail|mail)\b[^.?!]{0,40}\b(nuevo|ahora es|cambi)/i;
  return en.test(t) || es.test(t) ? email : null;
}

/**
 * "email me the quotation", "send me the brochure", "send it to my email",
 * "mándame la cotización", "envíamelo al correo", "por correo"
 */
export function isPaulaEmailRequest(text) {
  const t = String(text || '');
  const en = /\b(e-?mail|mail)\s+(me|it|the|this)\b|\bsend\b[^.?!]{0,40}\b(e-?mail|mail|inbox)\b|\bsend\s+(me\s+)?(the\s+|a\s+)?(quot(ation|e)|brochure|proposal|details|info)/i;
  const es = /\b(m[aá]nd|env[ií])a(me|lo|la|melo|mela)?\b[^.?!]{0,50}\b(correo|e-?mail|mail|cotizaci[oó]n|brochure|ficha|propuesta)\b|\b(por|al|a mi)\s+(correo|e-?mail|mail)\b/i;
  return en.test(t) || es.test(t);
}

/**
 * Busca la casa (#1/#3/#6/#7 de El Morenal) en los textos, del más reciente
 * al más antiguo. Devuelve '1' | '3' | '6' | '7' | null.
 */
export function findPropertyNumber(texts = []) {
  const re = /(?:#\s*|\bcasa\s*(?:jard[ií]n\s*)?#?\s*|\bhouse\s*#?\s*|\bjard[ií]n\s*#?\s*)([1367])(?!\d)/i;
  for (const raw of texts) {
    const m = String(raw || '').match(re);
    if (m) return m[1];
  }
  return null;
}

const COPY = {
  en: {
    askEmail: 'Of course! 📧 Which email should I send the quotation to?',
    sending: email => `🏡 Preparing your quotation now — it will arrive at *${email}* in a moment.`,
    sent: (prop, email) => `✅ Done! I sent the quotation for *${prop}* to *${email}*. Please check your inbox (and spam folder just in case).\n\nWould you like to schedule a visit? 🗓️`,
    failed: '😔 I had a problem sending the email. I have notified the team and we will send it to you shortly.',
    emailUpdated: email => `✅ Done! Your email is now *${email}*. I'll use it from now on.`,
  },
  es: {
    askEmail: '¡Claro! 📧 ¿A qué correo te envío la cotización?',
    sending: email => `🏡 Preparando tu cotización — llegará a *${email}* en un momento.`,
    sent: (prop, email) => `✅ ¡Listo! Te envié la cotización de *${prop}* a *${email}*. Revisa tu bandeja de entrada (y spam por si acaso).\n\n¿Te gustaría agendar una visita? 🗓️`,
    failed: '😔 Tuve un problema enviando el correo. Ya avisé al equipo y te lo enviamos en breve.',
    emailUpdated: email => `✅ ¡Listo! Tu correo ahora es *${email}*. Lo usaré desde ahora.`,
  },
};

export function paulaCopy(lang) {
  return COPY[lang === 'en' ? 'en' : 'es'];
}

/** Mensaje sintético que entiende sendPaulaCotizacion/parsePaulaQuoteData. */
export function buildQuoteCommand({ propertyNumber, name, email }) {
  const target = propertyNumber ? `casa #${propertyNumber}` : 'overview de las casas';
  return `Envía cotización ${target} para ${name || 'Cliente'} ${email}`;
}
