// ──────────────────────────────────────────────────────────────
// 🏛️  COWORKIA FACTS — Fuente ÚNICA de verdad del negocio
// ──────────────────────────────────────────────────────────────
//
// Todos los hechos del negocio (contacto, ubicación, horario, planes,
// precios, pruebas gratuitas) viven AQUÍ y SOLO aquí.
//
// REGLA DE ORO:
//   - Ningún template, prompt ni LLM debe inventar ni redefinir estos datos.
//   - Cualquier servicio/email/prompt que necesite un dato del negocio lo
//     importa desde este módulo.
//   - Si un dato cambia (precio, dirección, teléfono), se cambia UNA vez aquí.
//
// Todos los objetos están congelados (Object.freeze) para evitar mutaciones.
// ──────────────────────────────────────────────────────────────

import { COWORKIA_ADDRESS, COWORKIA_ADDRESS_FULL, COWORKIA_MAPS_URL } from './constants.js';

// ── 📞 Contacto ───────────────────────────────────────────────
export const CONTACT = Object.freeze({
  phoneDisplay: '+593 99 483 7117',   // formato humano para mostrar
  phoneWhatsApp: '593994837117',       // formato wa.me (sin + ni espacios)
  whatsappUrl: 'https://wa.me/593994837117',
  email: 'coworkia.ec@gmail.com',
  // Coworkia no tiene sitio web propio.
});

// ── 📍 Ubicación ──────────────────────────────────────────────
export const LOCATION = Object.freeze({
  address: COWORKIA_ADDRESS,            // 'Whymper 403, Edificio Finistere'
  addressFull: COWORKIA_ADDRESS_FULL,   // '...Planta Baja, Quito'
  mapsUrl: COWORKIA_MAPS_URL,
  city: 'Quito',
});

// ── 🕐 Horario ────────────────────────────────────────────────
export const HOURS = Object.freeze({
  display: 'Lunes a Viernes 8:30 AM – 6:00 PM',
  days: 'Lunes a Viernes',
  open: '8:30 AM',
  close: '6:00 PM',
  open24: '08:30',
  close24: '18:00',
});

// ── 📶 WiFi ───────────────────────────────────────────────────
// Decisión 01-jun: la velocidad NO se comunica. Sin Mbps.
export const WIFI = Object.freeze({
  display: 'WiFi de alta velocidad incluido',
});

// ── 💼 Planes de membresía (Aluna) — TABLA MAESTRA ────────────
// `price` = número (USD). `priceDisplay` = texto para mostrar.
export const MEMBERSHIP_PLANS = Object.freeze({
  plan10: Object.freeze({
    key: 'plan10',
    name: 'Plan 10',
    price: 140,
    period: 'mes',
    priceDisplay: '$140 USD / mes',
    days: '10 días + 1 GRATIS = 11 días al mes de Hot Desk',
    hours: 'Jornada completa en cada visita (horario de oficina)',
    ideal: 'Freelancers y profesionales independientes con horario flexible',
    benefits: Object.freeze([
      'Locker o cajonera privada (a elegir)',
      '2 invitados gratis al mes (registro obligatorio)',
      '2 usos de Sala de Reuniones por mes (2 horas c/u, vía Aurora)',
      `${WIFI.display} + café ilimitado incluido`,
      'Impresiones básicas incluidas',
      'Secretaria Virtual con IA (en contratos de 9+ meses)',
    ]),
  }),
  plan20: Object.freeze({
    key: 'plan20',
    name: 'Plan 20',
    price: 250,
    period: 'mes',
    priceDisplay: '$250 USD / mes',
    days: '20 días + 2 GRATIS = 22 días al mes de Hot Desk',
    hours: 'Jornada completa en cada visita (horario de oficina)',
    ideal: 'Profesionales con rutina de trabajo regular que necesitan presencia constante',
    benefits: Object.freeze([
      'Locker o cajonera privada (a elegir)',
      '4 invitados gratis al mes (registro obligatorio)',
      '4 usos de Sala de Reuniones por mes (2 horas c/u, vía Aurora)',
      `${WIFI.display} + café ilimitado incluido`,
      'Impresiones básicas incluidas',
      'Secretaria Virtual con IA (en contratos de 9+ meses)',
    ]),
  }),
  oficinavirtual: Object.freeze({
    key: 'oficinavirtual',
    name: 'Oficina Virtual',
    price: 365,
    period: 'año',
    priceDisplay: '$365 USD / año ($1 por día equivalente)',
    days: 'Dirección comercial oficial — sin acceso físico diario',
    hours: 'Sala de Reuniones incluida: 1 vez al mes por 2 horas',
    ideal: 'Emprendedores remotos, startups o empresas extranjeras que necesitan presencia legal en Quito',
    benefits: Object.freeze([
      `Dirección comercial oficial (${COWORKIA_ADDRESS_FULL})`,
      'Recepción y notificación de correspondencia física',
      'Cumplimiento legal con SRI y entidades de control',
      'Sala de Reuniones incluida (1 x mes, 2 horas)',
      'Acceso a red de contactos y comunidad Coworkia',
    ]),
  }),
  salareuniones: Object.freeze({
    key: 'salareuniones',
    name: 'Sala de Reuniones',
    price: 29,
    period: 'sesión',
    priceDisplay: '$29 USD / sesión',
    days: 'Reserva por sesión individual — sin contrato',
    hours: '2 horas por sesión, capacidad: 3-4 personas',
    ideal: 'Reuniones de trabajo, presentaciones, entrevistas o workshops puntuales',
    benefits: Object.freeze([
      'Pantalla para presentaciones incluida',
      WIFI.display,
      'Espacio privado y profesional',
      'Reserva previa vía Aurora (WhatsApp)',
      'Sin contrato ni permanencia',
    ]),
  }),
});

// ── 🎁 Pruebas gratuitas ──────────────────────────────────────
export const FREE_TRIALS = Object.freeze({
  // Aurora: primera visita gratuita con reserva previa.
  aurora: Object.freeze({
    label: 'primera visita gratis',
    duration: '2 horas',
    window: HOURS.display,
    scope: 'Primera visita · Hot Desk',
    requiresBooking: true,
    note: `Primera visita gratis de 2 horas en Hot Desk, dentro del horario ${HOURS.display}, previa reserva.`,
  }),
  // Aluna: prueba de día completo que Aluna agenda ella misma.
  aluna: Object.freeze({
    label: '1 día completo gratis',
    duration: '1 día completo',
    window: HOURS.display,
    scope: 'Hot Desk — jornada completa',
    requiresBooking: true,
    scheduledBy: 'aluna', // Aluna agenda directamente, sin handoff a Aurora
    note: 'Un día completo de prueba gratis que coordino contigo directamente, dentro del horario de oficina.',
  }),
});

// ── 🔧 Helpers ────────────────────────────────────────────────

/**
 * Normaliza el texto de un plan a su key interno.
 * Acepta variaciones: "plan10", "Plan 10", "oficina", "sala", etc.
 * @param {string} rawPlan
 * @returns {string} key válido de MEMBERSHIP_PLANS
 */
export function normalizePlanKey(rawPlan) {
  if (!rawPlan) return 'plan10';
  const t = String(rawPlan)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');
  if (t.includes('20')) return 'plan20';
  if (t.includes('10')) return 'plan10';
  if (t.includes('oficina') || t.includes('virtual') || t.includes('ov')) return 'oficinavirtual';
  if (t.includes('sala') || t.includes('reunion')) return 'salareuniones';
  if (t.includes('plan') || t.includes('mensual') || t.includes('membresia')) return 'plan10';
  return 'plan10';
}

/**
 * Devuelve el objeto de plan canónico para una key/alias dado.
 * @param {string} key
 * @returns {object} plan de MEMBERSHIP_PLANS
 */
export function getPlan(key) {
  return MEMBERSHIP_PLANS[normalizePlanKey(key)];
}

// ── 📦 Export agregado ────────────────────────────────────────
export const COWORKIA_FACTS = Object.freeze({
  CONTACT,
  LOCATION,
  HOURS,
  WIFI,
  MEMBERSHIP_PLANS,
  FREE_TRIALS,
});

export default COWORKIA_FACTS;
