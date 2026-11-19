/**
 * 🛡️ ADRIANA COTIZACIÓN EMAIL SERVICE — SegPopular
 *
 * El jefe dicta desde WhatsApp el vehículo y datos del cliente:
 *   "cotización seguro Toyota RAV4 2023 $45000 para Ana Martínez
 *    ana@empresa.ec 0987654321 Quito"
 *
 * OpenAI extrae los datos estructurados.
 * Se calcula la prima anual y se genera un email HTML profesional
 * con la marca SegPopular (amarillo/azul marino).
 */

import { complete } from '../servicios-ia/openai.js';
import { buildEmailTemplate } from './email-template-system.js';
import { sendEmail, AGENT_FROM_NAMES, ADRIANA_FROM_EMAIL } from './email.js';
import { calculateVehiclePremium, COVERAGE_TYPES, VEHICLE_CATEGORIES, inferVehicleCategory } from './adriana-quote-calculator.js';
import { createOrUpdateInsuranceLead } from '../database/adrianaRepository.js';
import { generateMultiQuotes, formatQuotesForTemplate } from './adriana-multi-quote-engine.js';

const SEG_ADMIN_CC = process.env.ADRIANA_CC_EMAIL || 'info@segpopular.com';
const ADMIN_WA     = (process.env.BOT_PHONE || '593994837117').replace('+', '');

// ─── CÁLCULO DE PRIMA (delegado al calculador VAZ con tarifas por antigüedad) ─
function calculatePremium(commercialValue, vehicleYear) {
  const category = inferVehicleCategory('');
  const result = calculateVehiclePremium({
    commercialValue,
    vehicleYear: vehicleYear || (new Date().getFullYear() - 2),
    vehicleCategory: category,
    coverage: COVERAGE_TYPES.STANDARD
  });
  if (result.success) {
    return { annual: result.annual_total, monthly: result.monthly_installment };
  }
  // Fallback: tarifa plana 3.27% + IVA 15% + costos fijos
  const base   = commercialValue * 0.0327;
  const annual = Math.round(base * 1.15 + 40);
  return { annual, monthly: Math.round(annual / 12) };
}

// ─── DETECCIÓN ────────────────────────────────────────────────────────────────

/**
 * Detecta si el mensaje del jefe es un comando de cotización para Adriana.
 * Requiere: keyword "cotización/coti" + email + keyword de seguro/vehículo.
 */
export function isAdrianaBossQuoteCommand(mensaje) {
  if (!mensaje) return false;
  const hasKeyword = /cotiz[ao]ci[oó]n|coti\b|manda|env[ií]a|brochure|propuesta|proforma|para\s+\w/i.test(mensaje);
  const hasEmail   = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/.test(mensaje);
  return hasKeyword && hasEmail;
}

// ─── OPENAI: PARSEO INTELIGENTE ───────────────────────────────────────────────

async function parseDatosSeguro(mensajeJefe) {
  const systemPrompt = `Eres Adriana, asesora de SegPopular Ecuador. Recibes un mensaje del CEO con los datos de un cliente para cotizar seguro vehicular.
Extrae todos los datos disponibles y devuelve ÚNICAMENTE este JSON (sin markdown, sin texto extra):
{
  "nombre": "Ana Martínez",
  "email": "ana@empresa.ec",
  "telefono": "0987654321",
  "vehicleBrand": "TOYOTA",
  "vehicleModel": "RAV4",
  "vehicleYear": 2023,
  "commercialValue": 45000,
  "city": "Quito",
  "insuranceType": "Vehículo Liviano",
  "intro_personalizada": "párrafo de 2-3 líneas cálido y profesional dirigido al cliente, conectando su vehículo específico con la tranquilidad del seguro, tono confiable y cercano"
}

REGLAS:
- vehicleBrand y vehicleModel en MAYÚSCULAS
- vehicleYear como número
- commercialValue como número (sin $, sin comillas)
- Si no hay ciudad menciona "Ecuador"
- Si el valor no está claro, usa 40000 como default
- insuranceType: siempre "Vehículo Liviano" para autos/camionetas
- La intro_personalizada menciona el vehículo y ciudad si se conocen`;

  try {
    const raw = await complete(mensajeJefe, {
      system: systemPrompt,
      temperature: 0.3,
      max_tokens: 400,
      model: 'gpt-4o',
    });
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[ADRIANA-COTI] ❌ Error parseando JSON de OpenAI:', err.message);
    return null;
  }
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────

/**
 * 🛡️ Procesa el comando del jefe y envía cotización de seguro vehicular
 * @param {string} mensajeCompleto - Texto crudo del jefe en WA
 * @param {object} [opts]
 * @param {string} [opts.quoteCode] - Código secuencial de documento
 */
export async function sendAdrianaCotizacion(mensajeCompleto, { quoteCode = '' } = {}) {
  console.log('[ADRIANA-COTI] 🛡️ Procesando cotización de seguro con OpenAI...');

  const datos = await parseDatosSeguro(mensajeCompleto);
  if (!datos || !datos.email) {
    console.error('[ADRIANA-COTI] ❌ No se pudo extraer email/datos del mensaje');
    return { success: false, error: 'No se pudo extraer email/datos del mensaje' };
  }

  console.log(`[ADRIANA-COTI] 📧 Enviando cotización → ${datos.vehicleBrand} ${datos.vehicleModel} (${datos.email})`);

  const premium   = calculatePremium(datos.commercialValue || 40000, datos.vehicleYear);
  const code      = quoteCode || `ADR-BOSS-${Date.now().toString(36).toUpperCase()}`;
  const codeLabel = `${code} — `;
  const subject   = `Cotización 🛡️ ${codeLabel}${datos.vehicleBrand} ${datos.vehicleModel} ${datos.vehicleYear} · ${datos.nombre} | Adriana - SegPopular`;

  // Comparativo: mismas aseguradoras activas que usa el flujo de WhatsApp.
  // Si la BD no responde, el correo sale igual (solo VAZ).
  let competitors = [];
  try {
    const allQuotes = await generateMultiQuotes({
      commercialValue: Number(datos.commercialValue || 40000),
      vehicleYear: Number(datos.vehicleYear) || new Date().getFullYear(),
      vehicleCategory: 'liviano',
    });
    competitors = formatQuotesForTemplate(allQuotes).competitors;
  } catch (err) {
    console.warn('[ADRIANA-COTI] ⚠️ Sin comparativo multi-aseguradora:', err.message);
  }

  // Usar template V2 (comparativo profesional)
  const html = buildEmailTemplate('ADRIANA', 'COMPARISON_V2', {
    nombre:            datos.nombre,
    marca:             datos.vehicleBrand,
    modelo:            datos.vehicleModel,
    anio:              datos.vehicleYear,
    valor_asegurado:   datos.commercialValue ? `$${Number(datos.commercialValue).toLocaleString()}` : '',
    vaz_prima_anual:   `$${premium.annual.toLocaleString()}`,
    vaz_prima_mensual: `$${premium.monthly.toLocaleString()}`,
    vaz_deducible:     '7%',
    analisis_broker:   datos.intro_personalizada || `${datos.nombre?.split(' ')[0] || 'Cliente'}, analicé el mercado ecuatoriano y el Plan Elemental de VAZ Seguros es la mejor opción para tu ${[datos.vehicleBrand, datos.vehicleModel].filter(Boolean).join(' ')}. Asistencia 24/7, taller propio en Quito y hasta 12 meses para pagar.`,
    competitors,
    fecha_cotizacion:  new Date().toLocaleDateString('es-EC'),
    bot_phone:         ADMIN_WA,
    adriana_email:     process.env.ADRIANA_EMAIL || '',
    adriana_phone:     process.env.ADRIANA_PHONE || '',
  });

  const result = await sendEmail({
    to:   datos.email,
    cc:   SEG_ADMIN_CC,
    subject,
    html,
    from: { name: AGENT_FROM_NAMES.adriana, address: ADRIANA_FROM_EMAIL },
    agent: 'adriana',
  });

  // Guardar lead en BD para tracking en dashboard
  await createOrUpdateInsuranceLead({
    quoteCode:      code,
    userPhone:      datos.telefono ? datos.telefono.replace(/\D/g, '') : null,
    status:         'quoted',
    clientName:     datos.nombre,
    email:          datos.email,
    phone:          datos.telefono,
    vehicleBrand:   datos.vehicleBrand,
    vehicleModel:   datos.vehicleModel,
    vehicleYear:    datos.vehicleYear,
    commercialValue: datos.commercialValue,
    city:           datos.city,
    insuranceType:  datos.insuranceType || 'Vehículo Liviano',
    quotedPremium:  premium.annual,
  }).catch(err => console.warn('[ADRIANA-COTI] ⚠️ No se pudo guardar lead en BD:', err.message));

  return {
    ...result,
    nombre:          datos.nombre,
    email:           datos.email,
    telefono:        datos.telefono || null,
    vehiculo:        `${datos.vehicleBrand} ${datos.vehicleModel} ${datos.vehicleYear}`,
    commercialValue: datos.commercialValue,
    primaAnual:      premium.annual,
    quoteCode:       code,
  };
}
