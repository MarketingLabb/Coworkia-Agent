/**
 * 🛡️ Adriana Follow-up Service — Seguros VAZ / SegPopular
 *
 * Automatización de seguimientos post-cotización
 *
 * SECUENCIA:
 * - S1 — D+1 (24h):  Recordatorio cálido. "¿Tienes dudas sobre tu cotización?"
 * - S2 — D+3 (72h):  Recordatorio con prima y asistencia incluida. "¿Activamos tu seguro?"
 * - S3 — D+7 (7d):   Reconexión. Beneficios reales de VAZ + asesoría corporativa gratuita
 *
 * CRON (registrar en index.js):
 * - 10:00 AM ECT: S1 (D+1 follow-ups)
 * - 11:30 AM ECT: S2 (D+3 follow-ups)
 * - 09:30 AM ECT: S3 (D+7 follow-ups)
 */

import { enviarWhatsApp } from '../express-servidor/endpoints-api/wassenger.js';
import { sendEmail, AGENT_FROM_NAMES, ADRIANA_FROM_EMAIL } from './email.js';
import databaseService from '../database/database.js';

const ADMIN_CC  = process.env.ADRIANA_CC_EMAIL || 'info@segpopular.com';
const BOT_PHONE = (process.env.BOT_PHONE || '593994837117').replace('+', '');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function firstName(name) {
  return (name || 'hola').split(' ')[0];
}

function vehicleLabel(l) {
  return [l.vehicle_brand, l.vehicle_model, l.vehicle_year].filter(Boolean).join(' ') || 'tu vehículo';
}

// ─── DB QUERIES ───────────────────────────────────────────────────────────────

async function findLeadsInWindow(hoursMin, hoursMax) {
  await databaseService.ensureInitialized();
  return databaseService.all(`
    SELECT id, quote_code, client_name, email, phone, insurance_type,
           vehicle_brand, vehicle_model, vehicle_year, quoted_premium,
           status, quote_sent_at, created_at
    FROM insurance_leads
    WHERE status = 'quoted'
      AND quote_sent_at IS NOT NULL
      AND quote_sent_at >= NOW() - INTERVAL '${hoursMax} hours'
      AND quote_sent_at <  NOW() - INTERVAL '${hoursMin} hours'
      -- Excluir pruebas: DEMO en nombre O en notas (NULL cuenta como vacío)
      AND COALESCE(client_name, '') NOT ILIKE '%DEMO%'
      AND COALESCE(notes, '') NOT ILIKE '%DEMO%'
    ORDER BY quote_sent_at ASC
    LIMIT 50
  `, []);
}

// ─── WA MESSAGES ──────────────────────────────────────────────────────────────

function buildWA_S1(l) {
  const fn  = firstName(l.client_name);
  const veh = vehicleLabel(l);
  const pri = l.quoted_premium ? `$${parseFloat(l.quoted_premium).toFixed(0)}` : null;
  return `Hola ${fn} 👋

Te escribo porque ayer te enviamos la cotización de seguro para tu *${veh}* y quería saber si tuviste la oportunidad de revisarla.

${pri ? `💰 Tu prima anual VAZ: *${pri}*\n` : ''}
¿Tienes alguna duda sobre las coberturas o el proceso de activación? Con gusto te explico en menos de 5 minutos 😊

_Adriana · SegPopular_`;
}

function buildWA_S2(l) {
  const fn  = firstName(l.client_name);
  const veh = vehicleLabel(l);
  const pri = l.quoted_premium ? `$${parseFloat(l.quoted_premium).toFixed(0)}` : null;
  const ctrl = encodeURIComponent(`Hola Adriana, acepto la cotización VAZ para mi ${veh} — código ${l.quote_code}`);
  return `Hola ${fn} 👋

Sigo pendiente de tu cotización de seguro para tu *${veh}* (código ${l.quote_code}).

${pri ? `💰 Prima anual VAZ cotizada: *${pri}*\n` : ''}🚐 Incluye asistencia vial VAZ 24/7: grúa, auxilio mecánico y cerrajería.

Si quieres activarla, respóndeme *ACEPTO* y te guío con la emisión:
➡️ wa.me/${BOT_PHONE}?text=${ctrl}

Si algo no te convence (precio, deducible o coberturas), cuéntame y buscamos la mejor opción para ti 😊

_Adriana · SegPopular_`;
}

function buildWA_S3(l) {
  const fn  = firstName(l.client_name);
  const veh = vehicleLabel(l);
  const cup = encodeURIComponent(`Hola Adriana, quisiera usar mi cupón de asesoría gratuita en seguros corporativos 🎁`);
  return `Hola ${fn} 🙂

Una semana atrás te enviamos una cotización de seguro para tu *${veh}* y no quiero cerrar ese pendiente sin asegurarme de que estés bien cubierto.

📌 Recuerda que con VAZ tienes asistencia vial 24/7 incluida: grúa, auxilio mecánico y cerrajería si la necesitas en carretera.

Si la cotización no se ajustó a tu presupuesto, cuéntame — tenemos opciones. Y si ya contrataste con otra aseguradora, me alegra que estés protegido 👍

🎁 También tienes disponible una *asesoría gratuita* si tu empresa tiene activos, flota o equipos que asegurar:
➡️ wa.me/${BOT_PHONE}?text=${cup}

_Adriana · SegPopular_`;
}

// ─── EMAIL TEMPLATES ──────────────────────────────────────────────────────────

function buildEmailS1HTML(l) {
  const fn  = firstName(l.client_name);
  const veh = vehicleLabel(l);
  const pri = l.quoted_premium ? `$${parseFloat(l.quoted_premium).toFixed(0)}` : '—';
  const cta = encodeURIComponent(`Hola Adriana, tengo preguntas sobre mi cotización ${l.quote_code}`);
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div class="em-wrap" style="max-width:580px;margin:0 auto;padding:20px 12px 40px;">
  <div style="background-color:#1E3A8A;background:linear-gradient(135deg,#1E3A8A,#1d4ed8);padding:36px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <img src="https://coworkia-agent-e97d15dac56f.herokuapp.com/assets/logos/segpopular.png" alt="SegPopular" style="height:42px;margin-bottom:14px;filter:brightness(0) invert(1);opacity:0.95;display:block;margin-left:auto;margin-right:auto;" />
    <div style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;margin-bottom:12px;">🛡️ ADRIANA · SEGPOPULAR ECUADOR</div>
    <h1 style="color:#FCD34D;margin:0;font-size:24px;font-weight:900;">¿Tuviste la oportunidad de revisar tu cotización, ${fn}?</h1>
  </div>
  <div style="background:white;padding:32px 28px;border-radius:0 0 12px 12px;">
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 20px;">Hola <strong>${fn}</strong>, ayer te enviamos la propuesta de seguro vehicular para tu <strong>${veh}</strong> con una prima anual de <strong style="color:#16a34a;">${pri}</strong> con VAZ Seguros.</p>
    <p style="font-size:14px;color:#6b7280;line-height:1.7;margin:0 0 24px;">Entiendo que son muchas cosas por revisar. Si tienes alguna duda sobre coberturas, el proceso de emisión, o simplemente quieres que te explique la diferencia entre aseguradoras, con gusto lo hacemos.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://wa.me/${BOT_PHONE}?text=${cta}" style="display:inline-block;background:#1E3A8A;color:#FCD34D;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:800;font-size:15px;">💬 Hablar con Adriana →</a>
    </div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">Ref. ${l.quote_code} · SegPopular Ecuador</p>
  </div>
</div></body></html>`;
}

function buildEmailS2HTML(l) {
  const fn  = firstName(l.client_name);
  const veh = vehicleLabel(l);
  const pri = l.quoted_premium ? `$${parseFloat(l.quoted_premium).toFixed(0)}` : '—';
  const cta = encodeURIComponent(`Hola Adriana, acepto la cotización VAZ para mi ${veh} — código ${l.quote_code}`);
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div class="em-wrap" style="max-width:580px;margin:0 auto;padding:20px 12px 40px;">
    <div style="background-color:#dc2626;background:linear-gradient(135deg,#dc2626,#b91c1c);padding:36px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <img src="https://coworkia-agent-e97d15dac56f.herokuapp.com/assets/logos/segpopular.png" alt="SegPopular" style="height:42px;margin-bottom:14px;filter:brightness(0) invert(1);opacity:0.95;display:block;margin-left:auto;margin-right:auto;" />
    <div style="color:rgba(255,255,255,0.8);font-size:28px;margin-bottom:8px;">⏰</div>
    <h1 style="color:white;margin:0;font-size:22px;font-weight:900;">¿Activamos tu seguro, ${fn}?</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Tu cotización sigue disponible · Código ${l.quote_code}</p>
  </div>
  <div style="background:white;padding:32px 28px;border-radius:0 0 12px 12px;">
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#c2410c;font-weight:600;">ℹ️ Antes de emitir tu póliza te confirmamos el valor final con la aseguradora.</p>
    </div>
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px;">Mientras el seguro no esté activo, tu <strong>${veh}</strong> circula sin cobertura. Un accidente sin seguro puede costar mucho más que la prima anual — y con VAZ tienes asistencia vial 24/7 incluida.</p>
    <div style="background-color:#f0fdf4;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #16a34a;border-radius:10px;padding:18px;margin:20px 0;text-align:center;">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">Tu prima anual VAZ cotizada</div>
      <div style="font-size:34px;font-weight:900;color:#16a34a;">${pri}</div>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://wa.me/${BOT_PHONE}?text=${cta}" style="display:inline-block;background-color:#dc2626;background:linear-gradient(135deg,#dc2626,#b91c1c);color:white;padding:16px 40px;border-radius:8px;text-decoration:none;font-weight:900;font-size:16px;box-shadow:0 4px 14px rgba(220,38,38,0.4);">🛡️ ACTIVAR MI SEGURO →</a>
    </div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;">SegPopular · ${l.quote_code}</p>
  </div>
</div></body></html>`;
}

function buildEmailS3HTML(l) {
  const fn  = firstName(l.client_name);
  const veh = vehicleLabel(l);
  const cup = encodeURIComponent(`Hola Adriana, quisiera usar mi cupón de asesoría gratuita en seguros corporativos 🎁`);
  const cta = encodeURIComponent(`Hola Adriana, quisiera revisar opciones de seguro para mi ${veh}`);
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div class="em-wrap" style="max-width:580px;margin:0 auto;padding:20px 12px 40px;">
  <div style="background-color:#1E3A8A;background:linear-gradient(135deg,#1E3A8A,#1d4ed8);padding:36px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <img src="https://coworkia-agent-e97d15dac56f.herokuapp.com/assets/logos/segpopular.png" alt="SegPopular" style="height:42px;margin-bottom:14px;filter:brightness(0) invert(1);opacity:0.95;display:block;margin-left:auto;margin-right:auto;" />
    <h1 style="color:#FCD34D;margin:0;font-size:22px;font-weight:900;">Un mensaje final de Adriana 🤝</h1>
  </div>
  <div style="background:white;padding:32px 28px;border-radius:0 0 12px 12px;">
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 20px;">Hola <strong>${fn}</strong>, han pasado 7 días desde que te enviamos la cotización para tu <strong>${veh}</strong> y no quiero cerrar este pendiente sin saber si estás bien cubierto.</p>
    <div style="background:#eff6ff;border-left:4px solid #1d4ed8;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#374151;line-height:1.7;">🚐 Con VAZ tienes asistencia vial 24/7 incluida en todos los planes: grúa, auxilio mecánico y cerrajería cuando lo necesites en carretera.</p>
      <div style="font-size:11px;color:#6b7280;margin-top:8px;">— Adriana · SegPopular</div>
    </div>
    <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px;">Si el precio no se ajustó a tu presupuesto, podemos revisar opciones. Si ya contrataste otro seguro, me alegra que estés protegido 👍</p>
    <div style="text-align:center;margin:20px 0 24px;">
      <a href="https://wa.me/${BOT_PHONE}?text=${cta}" style="display:inline-block;background:#1E3A8A;color:#FCD34D;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:800;font-size:15px;">💬 Revisar opciones →</a>
    </div>
    <div style="background-color:#faf5ff;background:linear-gradient(135deg,#faf5ff,#f3e8ff);border:1.5px dashed #a855f7;border-radius:10px;padding:18px 20px;margin-top:16px;">
      <div style="font-size:11px;color:#7e22ce;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">🎁 CUPÓN EXCLUSIVO</div>
      <p style="margin:0 0 10px;font-size:13px;color:#581c87;font-weight:600;">Asesoría GRATUITA en Seguros Corporativos</p>
      <p style="margin:0 0 12px;font-size:12px;color:#6b7280;line-height:1.6;">Si tu empresa tiene flota vehicular, maquinaria o activos que proteger, te ofrecemos una sesión de análisis gratuita.</p>
      <a href="https://wa.me/${BOT_PHONE}?text=${cup}" style="display:inline-block;background:#7c3aed;color:white;padding:8px 20px;border-radius:7px;text-decoration:none;font-weight:700;font-size:12px;">🎁 Usar mi cupón →</a>
    </div>
    <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:20px;">SegPopular Ecuador · ${l.quote_code}</p>
  </div>
</div></body></html>`;
}

// ─── FOLLOW-UP RUNNERS ────────────────────────────────────────────────────────

/**
 * S1 — D+1 (20–28h después de envío de cotización)
 * Recordatorio cálido, sin presión
 */
export async function sendAdrianaS1Followups() {
  console.log('[ADRIANA-FOLLOWUP] 📅 Iniciando S1 (D+1)...');
  const leads = await findLeadsInWindow(20, 28);
  if (!leads?.length) { console.log('[ADRIANA-FOLLOWUP] ℹ️ Sin leads S1'); return { sent: 0 }; }

  let sent = 0;
  for (const l of leads) {
    try {
      if (l.phone) await enviarWhatsApp(l.phone, buildWA_S1(l));
      if (l.email) {
        await sendEmail({
          to: l.email, cc: ADMIN_CC,
          subject: `${firstName(l.client_name)}, ¿tienes dudas sobre tu cotización de seguro? 🛡️`,
          html: buildEmailS1HTML(l),
          from: { name: AGENT_FROM_NAMES.adriana || 'Adriana · SegPopular', address: ADRIANA_FROM_EMAIL },
          agent: 'adriana',
        });
      }
      sent++;
      console.log(`[ADRIANA-FOLLOWUP] ✅ S1: ${l.client_name} (${l.quote_code})`);
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[ADRIANA-FOLLOWUP] ❌ S1 error (${l.quote_code}):`, err.message);
    }
  }
  console.log(`[ADRIANA-FOLLOWUP] S1 completado: ${sent}/${leads.length}`);
  return { sent };
}

/**
 * S2 — D+3 (68–76h después de envío)
 * Recordatorio con prima, asistencia incluida y CTA para aceptar (sin urgencia falsa)
 */
export async function sendAdrianaS2Followups() {
  console.log('[ADRIANA-FOLLOWUP] ⏰ Iniciando S2 (D+3)...');
  const leads = await findLeadsInWindow(68, 76);
  if (!leads?.length) { console.log('[ADRIANA-FOLLOWUP] ℹ️ Sin leads S2'); return { sent: 0 }; }

  let sent = 0;
  for (const l of leads) {
    try {
      if (l.phone) await enviarWhatsApp(l.phone, buildWA_S2(l));
      if (l.email) {
        await sendEmail({
          to: l.email, cc: ADMIN_CC,
          subject: `🛡️ ${firstName(l.client_name)}, ¿activamos tu seguro? — Código ${l.quote_code}`,
          html: buildEmailS2HTML(l),
          from: { name: AGENT_FROM_NAMES.adriana || 'Adriana · SegPopular', address: ADRIANA_FROM_EMAIL },
          agent: 'adriana',
        });
      }
      sent++;
      console.log(`[ADRIANA-FOLLOWUP] ✅ S2: ${l.client_name} (${l.quote_code})`);
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[ADRIANA-FOLLOWUP] ❌ S2 error (${l.quote_code}):`, err.message);
    }
  }
  console.log(`[ADRIANA-FOLLOWUP] S2 completado: ${sent}/${leads.length}`);
  return { sent };
}

/**
 * S3 — D+7 (164–172h después de envío)
 * Reconexión empática + caso de éxito + cupón corporativo
 */
export async function sendAdrianaS3Followups() {
  console.log('[ADRIANA-FOLLOWUP] 🤝 Iniciando S3 (D+7)...');
  const leads = await findLeadsInWindow(164, 172);
  if (!leads?.length) { console.log('[ADRIANA-FOLLOWUP] ℹ️ Sin leads S3'); return { sent: 0 }; }

  let sent = 0;
  for (const l of leads) {
    try {
      if (l.phone) await enviarWhatsApp(l.phone, buildWA_S3(l));
      if (l.email) {
        await sendEmail({
          to: l.email, cc: ADMIN_CC,
          subject: `Un último mensaje de Adriana — y un regalo para ti 🎁`,
          html: buildEmailS3HTML(l),
          from: { name: AGENT_FROM_NAMES.adriana || 'Adriana · SegPopular', address: ADRIANA_FROM_EMAIL },
          agent: 'adriana',
        });
      }
      sent++;
      console.log(`[ADRIANA-FOLLOWUP] ✅ S3: ${l.client_name} (${l.quote_code})`);
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[ADRIANA-FOLLOWUP] ❌ S3 error (${l.quote_code}):`, err.message);
    }
  }
  console.log(`[ADRIANA-FOLLOWUP] S3 completado: ${sent}/${leads.length}`);
  return { sent };
}
