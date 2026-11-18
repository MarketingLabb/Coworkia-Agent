// src/servicios/aluna-renewal/renewal-rules.js
// 🌙 Reglas puras de la secuencia de renovación de Aluna (sin BD ni red).
//
// Secuencia por ciclo (E = fecha de vencimiento):
//   d3_offer  → E-3  WhatsApp: anticipa y ofrece dejar lista la renovación
//   d3_link   → +8 min después de d3_offer: link de pago + mensaje cálido
//   d1        → E-1  WhatsApp + email "vence mañana"
//   dp1       → E+1  WhatsApp + email recordatorio "venció ayer"
//   dp5       → E+5  WhatsApp + email recuperación: 10% dcto x 3 meses
//   snooze    → el día que el cliente pidió ("renuevo el 25") con link de pago
//
// No hay check-in: nada aquí depende de uso real del espacio.

export const TIMEZONE = 'America/Guayaquil';
export const D3_LINK_DELAY_MINUTES = 8;
export const RECOVERY_DISCOUNT_PCT = 10;
export const RECOVERY_DISCOUNT_MONTHS = 3;
export const RECOVERY_OFFER_VALID_DAYS = 7; // la oferta D+5 vale hasta E+12
export const REPLY_CONTEXT_DAYS = 14;       // cuánto tiempo una respuesta se asocia a la secuencia

/** Pasos con su ventana (offset en días respecto a E, inclusive). Fuera de ventana = no se envía. */
export const STEPS = Object.freeze({
  d3_offer: { from: -3, to: -2, channels: ['whatsapp'] },
  d3_link:  { from: -3, to: -2, channels: ['whatsapp'], after: 'd3_offer' },
  d1:       { from: -1, to: 0,  channels: ['whatsapp', 'email'] },
  dp1:      { from: 1,  to: 2,  channels: ['whatsapp', 'email'] },
  dp5:      { from: 5,  to: 7,  channels: ['whatsapp', 'email'] },
});
export const STEP_ORDER = ['d3_offer', 'd3_link', 'd1', 'dp1', 'dp5'];

const RECURRING_PLANS = {
  'plan 10': 30,
  'plan 20': 30,
  'oficina virtual': 365,
};

/** Días de duración de un ciclo según el plan. null = plan no recurrente (no se recuerda). */
export function cycleDaysForPlan(membershipType) {
  const key = String(membershipType || '').trim().toLowerCase();
  if (!key || key === 'consulta-inicial') return null;
  return RECURRING_PLANS[key] ?? 30;
}

// ─── Fechas (YYYY-MM-DD, siempre en hora de Ecuador) ─────────────────────────

export function todayEC(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function hourEC(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hour: '2-digit', hourCycle: 'h23' }).format(now));
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 86400000);
}

export function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function computeExpiry(paymentDate, membershipType) {
  const days = cycleDaysForPlan(membershipType);
  const start = toIsoDate(paymentDate);
  if (!days || !start) return null;
  return addDays(start, days);
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "viernes 21 de noviembre" */
export function formatDateEs(isoDate) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}

export function inDaysText(n) {
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  return `en ${n} días`;
}

// ─── Selección de miembros ───────────────────────────────────────────────────

export function phoneKey(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null;
}

/**
 * Agrupa filas (lead + último pago verificado) por teléfono y deja SOLO la membresía
 * vigente de cada persona (el pago más reciente). Así varios leads del mismo número
 * nunca generan varios recordatorios.
 */
export function pickCurrentMemberships(rows) {
  const byPhone = new Map();
  for (const row of rows) {
    const key = phoneKey(row.user_phone);
    const paymentDate = toIsoDate(row.last_payment_date);
    if (!key || !paymentDate) continue;
    const prev = byPhone.get(key);
    const newer = !prev
      || paymentDate > prev.paymentDate
      || (paymentDate === prev.paymentDate && String(row.lead_created_at || '') > String(prev.row.lead_created_at || ''));
    if (newer) byPhone.set(key, { row, paymentDate });
  }
  const result = [];
  for (const [key, { row, paymentDate }] of byPhone) {
    const expiry = computeExpiry(paymentDate, row.membership_type);
    if (!expiry) continue;
    result.push({ ...row, phone_key: key, payment_date: paymentDate, expiry_date: expiry });
  }
  return result;
}

export function isExcludedPhone(phone, excludedList = process.env.RENEWAL_EXCLUDED_PHONES || '') {
  const key = phoneKey(phone);
  if (!key) return true;
  return String(excludedList).split(',').map(phoneKey).filter(Boolean).includes(key);
}

/**
 * Decide qué paso toca hoy para una membresía.
 * @param {object} p
 * @param {string} p.today            YYYY-MM-DD Ecuador
 * @param {Date}   p.now
 * @param {string} p.expiry           YYYY-MM-DD
 * @param {Object<string,{status:string,sent_at?:string|Date}>} p.history  pasos ya registrados en este ciclo
 * @param {object} p.prefs            fila de membership_renewal_prefs (o null)
 * @returns {{step:string, reason?:string}|{skip:string}}
 */
export function decideStep({ today, now = new Date(), expiry, history = {}, prefs = null }) {
  if (prefs?.opted_out_at) return { skip: 'opted_out' };
  if (prefs?.declined_cycle_end && toIsoDate(prefs.declined_cycle_end) === expiry) return { skip: 'declined' };

  const offset = diffDays(expiry, today); // negativo = antes de vencer

  // Cliente pidió que le escribamos otro día ("renuevo el 25")
  const snoozeUntil = toIsoDate(prefs?.snooze_until);
  if (snoozeUntil && toIsoDate(prefs?.snooze_cycle_end) === expiry) {
    if (today < snoozeUntil) return { skip: 'snoozed' };
    if (!history.snooze && diffDays(snoozeUntil, today) <= 1) return { step: 'snooze' };
  }

  for (const step of STEP_ORDER) {
    const def = STEPS[step];
    if (history[step]) continue;
    if (offset < def.from || offset > def.to) continue;
    if (def.after) {
      const prev = history[def.after];
      if (!prev || prev.status !== 'sent') continue;
      const sentAt = new Date(prev.sent_at).getTime();
      if (Number.isNaN(sentAt) || now.getTime() - sentAt < D3_LINK_DELAY_MINUTES * 60000) continue;
    }
    return { step };
  }
  return { skip: 'nothing_due' };
}

// ─── Mensajes ────────────────────────────────────────────────────────────────

export function firstName(name) {
  const n = String(name || '').trim().split(/\s+/)[0];
  return n && n.toLowerCase() !== 'sin' ? n : '';
}

function hola(name) {
  const n = firstName(name);
  return n ? `Hola ${n}` : 'Hola';
}

export function formatMoney(n) {
  const v = Number(n);
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

export function paymentBlock({ amount, payphoneLink, bankInfo, discountPct = 0 }) {
  const lines = [];
  if (amount) {
    lines.push(discountPct
      ? `💰 *Valor:* ${formatMoney(amount)} (ya incluye tu ${discountPct}% de descuento)`
      : `💰 *Valor:* ${formatMoney(amount)}`);
  }
  if (payphoneLink) lines.push(`💳 *Tarjeta (Payphone):* ${payphoneLink}`);
  if (bankInfo) lines.push(`🏦 *Transferencia:*\n${bankInfo}`);
  lines.push('📸 Cuando pagues, envíame la foto del comprobante y yo me encargo del resto.');
  return lines.join('\n\n');
}

/**
 * @param {string} step
 * @param {object} ctx { name, plan, expiry, today, amount, payphoneLink, bankInfo, discountPct, offerValidUntil }
 */
export function buildWhatsAppMessage(step, ctx) {
  const plan = ctx.plan ? `*${ctx.plan}*` : 'tu membresía';
  const n = diffDays(ctx.today, ctx.expiry);
  const fecha = formatDateEs(ctx.expiry);
  switch (step) {
    case 'd3_offer':
      return `${hola(ctx.name)} 🌙 Tu ${plan} vence ${inDaysText(n)}, el ${fecha}.\n\nPara que no pierdas tu espacio ni un solo día, puedo dejar tu renovación lista desde ya. ¿Te la preparo? 😊`;
    case 'd3_link':
      return `Para que sea súper fácil, aquí tienes todo listo para renovar tu ${plan} 💚\n\n${paymentBlock(ctx)}\n\nGracias por ser parte de Coworkia, ¡nos encanta tenerte aquí! ✨`;
    case 'd1':
      return `${hola(ctx.name)} ⏰ Tu ${plan} vence ${n <= 0 ? '*hoy*' : '*mañana*'} (${fecha}).\n\nSi renuevas hoy mantienes tu espacio sin interrupciones. ¿Te envío el link de pago? 🙌`;
    case 'dp1':
      return `${hola(ctx.name)} 🌙 Tu ${plan} venció el ${fecha}.\n\nTodavía estás a tiempo de renovarla y seguir trabajando con nosotros. Respóndeme *renovar* y te envío el link al instante 😊`;
    case 'dp5':
      return `${hola(ctx.name)} 💚 Te extrañamos en Coworkia.\n\nQueremos que vuelvas: si renuevas tu ${plan} hasta el ${formatDateEs(ctx.offerValidUntil)}, te damos *${RECOVERY_DISCOUNT_PCT}% de descuento durante ${RECOVERY_DISCOUNT_MONTHS} meses* de tu nueva temporada.\n\n¿Te lo reservo? Respóndeme *sí* y te envío todo ✨`;
    case 'snooze':
      return `${hola(ctx.name)} 🌙 Como quedamos, hoy te escribo para renovar tu ${plan}.\n\n${paymentBlock(ctx)}\n\n¡Gracias por seguir con nosotros! ✨`;
    default:
      throw new Error(`Paso de renovación desconocido: ${step}`);
  }
}

export function buildEmailContent(step, ctx) {
  const plan = ctx.plan || 'membresía';
  const fn = firstName(ctx.name);
  const fecha = formatDateEs(ctx.expiry);
  switch (step) {
    case 'd1':
      return { subject: `⏰ ${fn ? `${fn}, tu` : 'Tu'} ${plan} vence mañana — renueva sin interrupciones`, template: 'RENEWAL' };
    case 'dp1':
      return {
        subject: `🌙 ${fn ? `${fn}, tu` : 'Tu'} ${plan} venció — aún estás a tiempo`,
        template: 'RENEWAL_STEP',
        badge: 'RECORDATORIO',
        title: `Tu ${plan} venció el ${fecha}`,
        message: 'Todavía estás a tiempo de renovar y seguir trabajando en Coworkia. Tu espacio te espera: renueva con un mensaje y te enviamos el link de pago al instante.',
      };
    case 'dp5':
      return {
        subject: `💚 ${fn ? `${fn}, te` : 'Te'} extrañamos — ${RECOVERY_DISCOUNT_PCT}% de descuento por ${RECOVERY_DISCOUNT_MONTHS} meses`,
        template: 'RENEWAL_STEP',
        badge: `${RECOVERY_DISCOUNT_PCT}% DCTO · ${RECOVERY_DISCOUNT_MONTHS} MESES`,
        title: `Vuelve a Coworkia con ${RECOVERY_DISCOUNT_PCT}% de descuento`,
        message: `Si renuevas tu ${plan} hasta el ${formatDateEs(ctx.offerValidUntil)}, te damos ${RECOVERY_DISCOUNT_PCT}% de descuento durante ${RECOVERY_DISCOUNT_MONTHS} meses de tu nueva temporada. Escríbenos y lo dejamos listo.`,
      };
    default:
      return null;
  }
}

// ─── Respuestas del cliente ─────────────────────────────────────────────────

export function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[¡!¿?.,;:()"'*_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const OPTOUT_PATTERNS = [
  /\bno me (escribas|escriban|envies|envien|mandes|manden|molestes|molesten)\b/,
  /\bdej(a|en) de (escribirme|enviarme|mandarme)\b/,
  /\b(no|ya no) (quiero|deseo) (recibir|mas) (mensajes|recordatorios)\b/,
  /\b(dar(me)? de baja|darse de baja|desuscrib)/,
];

const DECLINE_PATTERNS = [
  /\bno (voy a|vamos a|pienso|quiero|deseo|puedo|podre) renovar\b/,
  /\bno (renovare|renuevo|renovaremos)\b/,
  /\bya no (voy a seguir|seguire|continuare|necesito|lo necesito|me interesa)\b/,
  /\bno me interesa\b/,
  /^(no|no gracias|nop|no por ahora|por ahora no|ahora no)$/,
];

const RENEW_PATTERNS = [
  /^(si|sii+|claro|dale|ok|okay|okey|listo|de una|va|vale|por favor|porfa|porfavor|perfecto)( (por favor|porfa|gracias|claro|dale|preparala|renovemos))?$/,
  /\b(si|claro|dale)\b.*\b(renov|prepar|link|pag)/,
  /\b(quiero|deseo|voy a|vamos a|me gustaria|necesito) (renovar|pagar|seguir|continuar|volver)\b/,
  /\brenovar\b/,
  /\b(link|enlace|datos) (de|para) (pago|pagar|transferencia)\b/,
  /\b(como|donde) (pago|te pago|transfiero|renuevo)\b/,
  /\b(reservamelo|reservalo|aprovecho|lo tomo|me apunto)\b/,
];

const SNOOZE_CUE = /\b(renuev|renovar|pag|transfier|deposit|cancel|te (aviso|escribo|confirmo)|le (aviso|escribo|confirmo)|me (escribes|escribe|recuerdas|recuerda|avisas)|escribeme|recuerdame|hablamos)/;

/**
 * Interpreta fechas tipo "el 25", "el 25 de noviembre", "el viernes", "mañana",
 * "pasado mañana", "la próxima semana", "en 3 días", "a fin de mes", "el lunes que viene".
 * @returns {string|null} YYYY-MM-DD (siempre >= mañana) o null si no hay fecha clara
 */
export function parseSnoozeDate(text, today) {
  const t = normalizeText(text);
  const tomorrow = addDays(today, 1);
  let result = null;

  if (/\bpasado manana\b/.test(t)) result = addDays(today, 2);
  else if (/\bmanana\b/.test(t)) result = tomorrow;

  if (!result) {
    const m = t.match(/\ben (\d{1,2}|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|diez|quince) (dias|dia|semanas|semana)\b/);
    if (m) {
      const words = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, diez: 10, quince: 15 };
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : words[m[1]];
      result = addDays(today, m[2].startsWith('semana') ? n * 7 : n);
    }
  }

  if (!result && /\b(proxima semana|semana que viene|siguiente semana)\b/.test(t)) {
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    result = addDays(today, ((8 - dow) % 7) || 7); // próximo lunes
  }

  if (!result && /\b(fin de mes|finales de mes|fin del mes)\b/.test(t)) {
    const d = new Date(`${today}T12:00:00Z`);
    result = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
    if (result <= today) result = tomorrow;
  }

  if (!result) {
    const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const m = t.match(/\b(el |este |el proximo |este proximo |)(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
    if (m) {
      const target = dayNames.indexOf(m[2]);
      const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
      result = addDays(today, ((target - dow + 7) % 7) || 7);
    }
  }

  if (!result) {
    const m = t.match(/\b(?:el|hasta el|para el|dia) (\d{1,2})(?: de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre))?\b/);
    if (m) {
      const day = Number(m[1]);
      if (day >= 1 && day <= 31) {
        const d = new Date(`${today}T12:00:00Z`);
        let year = d.getUTCFullYear();
        let month = d.getUTCMonth();
        if (m[2]) {
          const name = m[2] === 'setiembre' ? 'septiembre' : m[2];
          month = MONTHS.indexOf(name);
          if (month < d.getUTCMonth() || (month === d.getUTCMonth() && day <= d.getUTCDate())) year += 1;
        } else if (day <= d.getUTCDate()) {
          month += 1;
        }
        const candidate = new Date(Date.UTC(year, month, day, 12));
        if (candidate.getUTCDate() === day) result = candidate.toISOString().slice(0, 10);
      }
    }
  }

  if (!result) return null;
  if (result < tomorrow) return null;
  if (diffDays(today, result) > 45) return null; // demasiado lejos: mejor que lo lleve una persona
  return result;
}

/**
 * Clasifica una respuesta del cliente a la secuencia de renovación.
 * @returns {{type:'optout'}|{type:'decline'}|{type:'snooze', date:string}|{type:'renew'}|null}
 */
export function classifyRenewalReply(text, today) {
  const t = normalizeText(text);
  if (!t || t.length > 280) return null;
  if (OPTOUT_PATTERNS.some(p => p.test(t))) return { type: 'optout' };
  if (DECLINE_PATTERNS.some(p => p.test(t))) return { type: 'decline' };
  if (SNOOZE_CUE.test(t) || /\b(despues|luego|mas adelante|todavia no|aun no|en unos dias)\b/.test(t)) {
    const date = parseSnoozeDate(t, today);
    if (date) return { type: 'snooze', date };
  }
  if (RENEW_PATTERNS.some(p => p.test(t))) return { type: 'renew' };
  return null;
}
