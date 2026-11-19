/**
 * 🎯 INTENT DETECTION HELPERS
 * 
 * Funciones auxiliares para detección de intenciones específicas.
 * Consolidación de detectores especializados extraídos de detectar-intencion.js
 * 
 * PROPÓSITO:
 * - Separar lógica de detección de patrones complejos
 * - Reutilizar en múltiples flows (orquestador, wassenger, tests)
 * - Mantener detectar-intencion.js focused en routing de agentes
 * 
 * @date 12 Feb 2026
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚫 PATTERNS: CANCELACIÓN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CANCELACION_PATTERNS = [
  /^cancela$/,
  /^cancelar$/,
  /^cancel$/,
  /cancela.*reserva/,
  /cancelar.*reserva/,
  /ya\s+no\s+quiero/,
  /mejor\s+no/,
  /olvida/,
  /olvidalo/,
  /olvidalo/,
  /dejalo/,
  /dejalo/,
  /no\s+importa/,
  /no\s+sigo/,
  /no\s+continuo/,
  /no\s+continuo/,
  /prefiero\s+no/,
  /no\s+gracias.*ya/,
  /no.*por\s+ahora/,
  /cambio.*de\s+opinion/,
  /cambio.*de\s+opinion/,
  /cambie.*de\s+opinion/,
  /cambie.*de\s+opinion/,
  // Patrones ampliados
  /^no\s*quiero$/,
  /^no$/,
  /^borra$/,
  /^borrar$/,
  /^elimina$/,
  /^eliminar$/,
  /^descartar$/,
  /^stop$/,
  /^alto$/,
  /ya\s*no/,
  /borra.*todo/,
  /elimina.*todo/,
  /limpia.*todo/
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👋 PATTERNS: SALUDOS CASUALES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CASUAL_GREETING_PATTERNS = [
  /^hola\b/,  // hola, hola aurora, hola como estas
  /^hi\b/,    // hi, hi there
  /^hello\b/, // hello, hello aurora
  /^hey\b/,   // hey, hey there
  /^buenas\b/, // buenas, buenas tardes aurora
  /^buenos\s+dias\b/,
  /^buenas\s+tardes\b/,
  /^buenas\s+noches\b/,
  /^buen\s+dia\b/,
  /^que\s+tal\b/,     // que tal, que tal como estas
  /^como\s+estas\b/,  // como estas, como estas aurora
  /^como\s+esta\b/,
  /^saludos\b/,
  /^hola\s+de\s+nuevo\b/,
  /^hola\s+otra\s+vez\b/
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ❓ PATTERNS: PREGUNTAS DE IDENTIDAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const IDENTITY_QUESTION_PATTERNS = [
  /quien\s+eres/,
  /que\s+eres/,
  /que\s+haces/,
  /que\s+sabes\s+hacer/,
  /que\s+puedes\s+hacer/,
  /dime\s+quien\s+eres/,
  /quiero\s+saber\s+quien\s+eres/,
  /quiero\s+que\s+me\s+digas\s+quien\s+eres/,
  /que\s+me\s+puedes\s+ofrecer/,
  /que\s+servicios\s+tienen/,
  /que\s+servicios\s+ofrecen/,
  /cuales\s+son\s+tus\s+servicios/,
  /que\s+es\s+coworkia/
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧾 PATTERNS: SOLICITUD RECIBO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const RECEIPT_REQUEST_PATTERNS = [
  /recibo/,
  /factura/,
  /comprobante/,
  /recibo.*pago/,
  /factura.*pago/,
  /necesito.*recibo/,
  /quiero.*recibo/,
  /dame.*recibo/,
  /envia.*recibo/,
  /reenviar.*recibo/,
  /donde.*recibo/,
  /como.*recibo/,
  /mi.*recibo/,
  /mis.*recibos/,
  /receipt/,
  /invoice/,
  /payment.*receipt/,
  /send.*receipt/,
  /resend.*receipt/,
  // fr / it / pt (texto ya sin acentos)
  /\brecus?\b/,
  /\bfacture/,
  /ricevut/,
  /fattur/,
  /\bfatura/,
  /comprovante/
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌟 PATTERNS: SALUDO CON INTERÉS EN SERVICIO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SALUDO_CON_INTERES_PATTERNS = [
  // Patrón principal: Hola/Buenos/Buenas + coworkia + quiero/necesito + probar/servicio
  /(?:hola|buenos|buenas).*(coworkia).*(quiero|necesito|me interesa).*(probar|servicio)/i,
  // Variante: Hola + quiero/necesito + servicio/probar + mención cowork/espacio
  /(?:hola|buenos|buenas).*(quiero|necesito).*(servicio|probar|usar).*(cowork|espacio|oficina)/i,
  // Directo: "quiero probar el servicio" (sin saludo)
  /quiero\s+probar\s+(el\s+)?servicio/i,
  // Variante corta: "hola coworkia quiero/necesito" (cualquier verbo)
  /hola.*(coworkia).*(quiero|necesito|me interesa)/i
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🤖 KEYWORDS: VENTA AGENTES VIRTUALES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VIRTUAL_AGENT_KEYWORDS = {
  mention: [
    'aurora',
    'agente virtual',
    'agente como tu',
    'agente como ti',
    'sistema como tu',
    'sistema como ti',
    'bot como este',
    'bot como tu',
    'bot como ti',
    'asistente virtual',
    'virtual agent',
    'agent like you',
    'system like you',
    'chatbot like',
    'como este'
  ],
  capability: [
    'que puede hacer',
    'que puedes hacer',
    'como funciona',
    'que hace',
    'capacidades',
    'funcionalidades',
    'que ofrece',
    'que ofreces',
    'what can you do',
    'what can do',
    'how does it work',
    'capabilities',
    'features'
  ],
  business: [
    'para mi empresa',
    'para mi negocio',
    'para la empresa',
    'para el negocio',
    'implementar',
    'contratar',
    'adquirir',
    'comprar',
    'sistema para',
    'quiero uno',
    'quiero un sistema',
    'necesito uno',
    'for my business',
    'for my company',
    'for the business'
  ],
  technical: [
    'chatbot',
    'bot',
    'sistema de ia',
    'sistema ia',
    'inteligencia artificial',
    'agente virtual',
    'virtual agent',
    'asistente virtual',
    'virtual assistant',
    'crear agente',
    'cotizar',
    'cotizacion',
    'quote',
    'pricing'
  ],
  interest: [
    'me interesa',
    'muestrame',
    'dame informacion',
    'cuentame',
    'explicame',
    'quiero que me digas',
    'quiero conocer'
  ]
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔧 HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Normaliza texto: lowercase, sin acentos, trim
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quitar acentos
}

/**
 * Normaliza texto para búsqueda: quita signos, espacios múltiples
 */
function normalizeForSearch(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[¿?¡!,.:;]/g, ' ') // quitar signos de puntuación
    .replace(/\s+/g, ' ') // normalizar espacios múltiples
    .trim();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📦 EXPORTED FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Detecta si el usuario quiere cancelar un flujo activo
 * @param {string} text - Mensaje del usuario 
 * @returns {boolean} true si es una cancelación
 */
export function detectarCancelacion(text) {
  const normalized = normalizeText(text);
  return CANCELACION_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Detecta si el mensaje es un saludo casual (hola, buenos días, etc.)
 * @param {string} text - Mensaje del usuario
 * @returns {boolean} true si es un saludo casual
 */
export function detectarSaludoCasual(text) {
  const normalized = normalizeText(text);
  return CASUAL_GREETING_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Detecta si el usuario está preguntando sobre la identidad/servicios de Aurora
 * @param {string} text - Mensaje del usuario
 * @returns {boolean} true si es una pregunta de identidad
 */
export function detectarPreguntaIdentidad(text) {
  const normalized = normalizeText(text);
  return IDENTITY_QUESTION_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Detecta si el usuario solicita un recibo de pago
 * @param {string} text - Mensaje del usuario
 * @returns {boolean} true si solicita recibo
 */
export function detectarSolicitudRecibo(text) {
  const normalized = normalizeText(text);
  return RECEIPT_REQUEST_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Detecta si el usuario saluda CON interés explícito en probar servicios
 * 
 * Ejemplos detectados:
 * - "¡Hola Coworkia! quiero probar el servicio" ✅
 * - "¡Hola Coworkia! quiero probar el servicio ☕️" ✅
 * - "Hola necesito el servicio de coworking" ✅
 * - "Buenos días quiero probar" ✅
 * - "Quiero probar el servicio" ✅
 * 
 * @param {string} text - Mensaje del usuario
 * @returns {boolean} true si es saludo con interés en servicio
 */
export function detectarSaludoConInteresServicio(text) {
  const normalized = normalizeText(text);
  return SALUDO_CON_INTERES_PATTERNS.some(pattern => pattern.test(normalized));
}

/**
 * Detecta si el usuario pregunta por VENTA de agentes virtuales
 * (No info de coworking, sino venta del sistema OneMind)
 * 
 * Usa scoring system con keywords por categorías:
 * - Mención de Aurora/agente virtual (obligatorio)
 * - Pregunta sobre capacidades
 * - Contexto empresarial
 * - Palabras de interés
 * 
 * @param {string} text - Mensaje del usuario
 * @returns {object} { detected: boolean, confidence: number, score: number, reasons: string, reason: string }
 */
export function detectVirtualAgentSalesPromo(text) {
  const normalized = normalizeForSearch(text);
  
  let score = 0;
  const reasons = [];
  
  // Categoría 1: Mención de Aurora o agente virtual (OBLIGATORIO)
  const hasMention = VIRTUAL_AGENT_KEYWORDS.mention.some(k => normalized.includes(k));
  if (hasMention) {
    score += 3;
    reasons.push('mencion_agente');
  } else {
    // Si no menciona agente/aurora, no es venta de sistema
    return { detected: false, confidence: 0, score: 0, reasons: '', reason: 'no_agent_mention' };
  }
  
  // Categoría 2: Pregunta sobre capacidades (alta prioridad)
  if (VIRTUAL_AGENT_KEYWORDS.capability.some(k => normalized.includes(k))) {
    score += 2;
    reasons.push('pregunta_capacidades');
  }
  
  // Categoría 3: Contexto empresarial
  if (VIRTUAL_AGENT_KEYWORDS.business.some(k => normalized.includes(k))) {
    score += 2;
    reasons.push('contexto_empresarial');
  }
  
  // Categoría 3.5: Términos técnicos relacionados con agentes virtuales
  if (VIRTUAL_AGENT_KEYWORDS.technical.some(k => normalized.includes(k))) {
    score += 1;
    reasons.push('terminos_tecnicos');
  }
  
  // Categoría 4: Palabras que indican interés en el producto
  if (VIRTUAL_AGENT_KEYWORDS.interest.some(k => normalized.includes(k))) {
    score += 1;
    reasons.push('interes_producto');
  }
  
  // Decisión: score >= 4 = detectado (mención + contexto adicional significativo)
  const detected = score >= 4;
  const confidence = Math.min(score / 9, 1); // Normalizar 0-1 (máximo posible: 9 = 3+2+2+1+1)
  
  if (detected) {
    console.log(`[VIRTUAL-AGENT-PROMO] ✅ Detectado (score: ${score}/9, confidence: ${(confidence * 100).toFixed(0)}%, reasons: ${reasons.join(', ')})`);
  } else {
    console.log(`[VIRTUAL-AGENT-PROMO] ❌ No detectado (score: ${score}/9, insuficiente)`);
  }
  
  return {
    detected,
    confidence,
    score,
    reasons: reasons.join(', '),
    reason: detected ? 'virtual_agent_sales_detected' : 'insufficient_score'
  };
}

/**
 * Verifica si un mensaje es email address
 * (para skip detecciones implícitas)
 */
export function isEmailAddress(text) {
  return /@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
}

/**
 * Detecta si el mensaje es exactamente la palabra "IA"
 * (keyword de campaña publicitaria en ventanal de Coworkia)
 */
export function detectKeywordIA(text) {
  return /^\s*IA\s*$/i.test(text);
}

export default {
  detectarCancelacion,
  detectarSaludoCasual,
  detectarPreguntaIdentidad,
  detectarSolicitudRecibo,
  detectarSaludoConInteresServicio,
  detectVirtualAgentSalesPromo,
  isEmailAddress,
  detectKeywordIA
};
