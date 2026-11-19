/**
 * 🛡️ Adriana — Renovación de pólizas (SegPopular / VAZ)
 *
 * Avisos antes de que venza la póliza anual emitida:
 *   r30 → 30 días antes  (ventana D-30..D-23)  WhatsApp + email
 *   r15 → 15 días antes  (ventana D-15..D-10)  WhatsApp + email
 *   r7  →  7 días antes  (ventana D-7..D-1)    WhatsApp + email
 *
 * Garantías (mismo modelo que la renovación de Aluna):
 *  - Cada aviso sale UNA sola vez: se reserva en insurance_renewal_notifications
 *    antes de enviarlo (clave única lead + vencimiento + paso + canal).
 *  - Si WhatsApp no confirma por error de red, NO se reintenta (mejor perder un
 *    aviso que duplicarlo). Si fue rechazado, se reintenta hasta 3 veces.
 *  - No escribe si el vehículo ya tiene una póliza más reciente (ya renovó).
 *  - Solo aplica a pólizas con policy_end_date (se llena al marcar 'emitted').
 *  - Excluye leads DEMO.
 */

import databaseService from '../database/database.js';

const LOG = '[ADRIANA-RENEWAL]';
const MAX_FAILED_ATTEMPTS = 3;
const ADMIN_CC  = process.env.ADRIANA_CC_EMAIL || 'info@segpopular.com';
const BOT_PHONE = (process.env.BOT_PHONE || '593994837117').replace('+', '');

export const STEPS = Object.freeze({
  r30: { from: -30, to: -23 },
  r15: { from: -15, to: -10 },
  r7:  { from: -7,  to: -1 },
});
const STEP_ORDER = ['r30', 'r15', 'r7'];

// ─── Fechas (Ecuador) ────────────────────────────────────────────────────────

export function todayEC(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function toIsoDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
export function diffDays(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 86400000);
}
export function addOneYear(isoDate) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function formatDateEs(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** Paso que toca hoy, o null. `sent` = pasos ya registrados (WhatsApp) para esta póliza. */
export function dueStep(today, endDate, sent = new Set()) {
  const offset = diffDays(endDate, today); // negativo = antes de vencer
  for (const step of STEP_ORDER) {
    const w = STEPS[step];
    if (sent.has(step)) continue;
    if (offset >= w.from && offset <= w.to) return step;
  }
  return null;
}

// ─── Mensajes ────────────────────────────────────────────────────────────────

function firstName(name) { return (name || 'hola').split(' ')[0]; }
function vehicleLabel(l) {
  return [l.vehicle_brand, l.vehicle_model, l.vehicle_year].filter(Boolean).join(' ') || 'tu vehículo';
}

export function buildWA(step, l, today) {
  const fn = firstName(l.client_name);
  const veh = vehicleLabel(l);
  const end = toIsoDate(l.policy_end_date);
  const days = diffDays(today, end);
  const pol = l.policy_number ? ` (póliza ${l.policy_number})` : '';
  const cta = encodeURIComponent(`Hola Adriana, quiero renovar el seguro de mi ${veh}${l.policy_number ? ` — póliza ${l.policy_number}` : ''}`);
  const intro = {
    r30: `Hola ${fn} 👋\n\nTe escribo con tiempo: el seguro de tu *${veh}*${pol} vence el *${formatDateEs(end)}* (en ${days} días).`,
    r15: `Hola ${fn} 🛡️\n\nTu seguro vehicular para tu *${veh}*${pol} vence el *${formatDateEs(end)}* — faltan ${days} días.`,
    r7:  `Hola ${fn} ⏰\n\nTu seguro para tu *${veh}*${pol} vence en *${days} ${days === 1 ? 'día' : 'días'}* (${formatDateEs(end)}). Para que no te quedes sin cobertura, renovémoslo ahora.`,
  }[step];
  return `${intro}

Puedo revisar la renovación con VAZ y, si quieres, comparar con otras aseguradoras para que elijas la mejor opción 😊

👇 Respóndeme *RENOVAR* o escríbeme aquí:
➡️ wa.me/${BOT_PHONE}?text=${cta}

_Adriana · SegPopular_`;
}

export function buildEmail(step, l, today) {
  const fn = firstName(l.client_name);
  const veh = vehicleLabel(l);
  const end = toIsoDate(l.policy_end_date);
  const days = diffDays(today, end);
  const cta = encodeURIComponent(`Hola Adriana, quiero renovar el seguro de mi ${veh}${l.policy_number ? ` — póliza ${l.policy_number}` : ''}`);
  const subject = {
    r30: `🛡️ ${fn}, tu seguro vehicular vence el ${formatDateEs(end)}`,
    r15: `🛡️ ${fn}, faltan ${days} días para que venza tu seguro`,
    r7:  `⏰ ${fn}, tu seguro vence en ${days} ${days === 1 ? 'día' : 'días'} — renovémoslo`,
  }[step];
  const title = {
    r30: `Tu seguro vence el ${formatDateEs(end)}, ${fn}`,
    r15: `Faltan ${days} días para renovar tu seguro, ${fn}`,
    r7:  `Tu seguro vence en ${days} ${days === 1 ? 'día' : 'días'}, ${fn}`,
  }[step];
  // Mismo layout que el seguimiento S1 de Adriana (colores y estructura SegPopular)
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div class="em-wrap" style="max-width:580px;margin:0 auto;padding:20px 12px 40px;">
  <div style="background-color:#1E3A8A;background:linear-gradient(135deg,#1E3A8A,#1d4ed8);padding:36px 28px;border-radius:12px 12px 0 0;text-align:center;">
    <img src="https://coworkia-agent-e97d15dac56f.herokuapp.com/assets/logos/segpopular.png" alt="SegPopular" style="height:42px;margin-bottom:14px;filter:brightness(0) invert(1);opacity:0.95;display:block;margin-left:auto;margin-right:auto;" />
    <div style="color:rgba(255,255,255,0.7);font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;margin-bottom:12px;">🛡️ ADRIANA · SEGPOPULAR ECUADOR</div>
    <h1 style="color:#FCD34D;margin:0;font-size:24px;font-weight:900;">${title}</h1>
  </div>
  <div style="background:white;padding:32px 28px;border-radius:0 0 12px 12px;">
    <p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 20px;">Hola <strong>${fn}</strong>, la póliza de seguro vehicular de tu <strong>${veh}</strong>${l.policy_number ? ` (N.º <strong>${l.policy_number}</strong>)` : ''} vence el <strong style="color:#1E3A8A;">${formatDateEs(end)}</strong>.</p>
    <p style="font-size:14px;color:#6b7280;line-height:1.7;margin:0 0 24px;">Te ayudo con la renovación para que sigas protegido sin interrupciones, incluida la asistencia vial VAZ 24/7. Si quieres, también comparamos con otras aseguradoras antes de decidir.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="https://wa.me/${BOT_PHONE}?text=${cta}" style="display:inline-block;background:#1E3A8A;color:#FCD34D;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:800;font-size:15px;">🔄 Renovar mi seguro →</a>
    </div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0;">Ref. ${l.quote_code} · SegPopular Ecuador</p>
  </div>
</div></body></html>`;
  return { subject, html };
}

// ─── BD ──────────────────────────────────────────────────────────────────────

export const repo = {
  async findPoliciesEndingSoon(db) {
    await db.ensureInitialized?.();
    return db.all(
      `/* adriana-renewal:candidates */
       SELECT l.id, l.quote_code, l.client_name, l.email, l.phone, l.user_phone, l.plate,
              l.vehicle_brand, l.vehicle_model, l.vehicle_year, l.policy_number,
              l.policy_end_date::text AS policy_end_date, l.emitted_at
         FROM insurance_leads l
        WHERE l.status = 'emitted'
          AND l.policy_end_date IS NOT NULL
          AND l.policy_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '31 days'
          AND COALESCE(l.client_name, '') NOT ILIKE '%DEMO%'
          AND COALESCE(l.notes, '') NOT ILIKE '%DEMO%'
          -- Ya renovó: hay otra póliza emitida para la misma placa con vencimiento posterior
          AND NOT EXISTS (
            SELECT 1 FROM insurance_leads n
             WHERE n.id <> l.id AND n.status = 'emitted'
               AND l.plate IS NOT NULL AND UPPER(n.plate) = UPPER(l.plate)
               AND n.policy_end_date > l.policy_end_date
          )`,
      []
    );
  },
  async sentSteps(db, leadId, endDate) {
    const rows = await db.all(
      `SELECT step, status FROM insurance_renewal_notifications
        WHERE lead_id = $1 AND policy_end_date = $2 AND channel = 'whatsapp'`,
      [leadId, endDate]
    );
    return new Set(rows.filter(r => r.status !== 'failed').map(r => r.step));
  },
  async claim(db, { leadId, quoteCode, endDate, step, channel }) {
    const row = await db.get(
      `INSERT INTO insurance_renewal_notifications (lead_id, quote_code, policy_end_date, step, channel)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (lead_id, policy_end_date, step, channel) DO UPDATE
         SET status = 'claimed', attempts = insurance_renewal_notifications.attempts + 1,
             error = NULL, updated_at = NOW()
         WHERE insurance_renewal_notifications.status = 'failed'
           AND insurance_renewal_notifications.attempts < ${MAX_FAILED_ATTEMPTS}
       RETURNING id`,
      [leadId, quoteCode, endDate, step, channel]
    );
    return row?.id ?? null;
  },
  async finish(db, id, status, error = null) {
    await db.run(
      `UPDATE insurance_renewal_notifications
          SET status = $2, error = $3, updated_at = NOW(),
              sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE sent_at END
        WHERE id = $1`,
      [id, status, error ? String(error).slice(0, 500) : null]
    );
  },
};

// ─── Proceso diario ──────────────────────────────────────────────────────────

/** Convierte el resultado de enviarWhatsApp en estado del registro. */
export function waStatus(result) {
  if (result?.ok) return { status: 'sent' };
  // Excepción de red/timeout: no sabemos si llegó → no reintentar
  if (result?.error && result.error !== 'NO_WASSENGER_CONFIG' && result.error !== 'SELF_MESSAGE_BLOCKED') {
    return { status: 'unknown', error: result.error };
  }
  return { status: 'failed', error: result?.error || 'REJECTED' };
}

export async function processPolicyRenewals({ db = databaseService, now = new Date(), deps = {} } = {}) {
  const r = deps.repo || repo;
  const sendWA = deps.sendWhatsApp || (async (phone, msg) => {
    const { enviarWhatsApp } = await import('../express-servidor/endpoints-api/wassenger.js');
    return enviarWhatsApp(phone, msg);
  });
  const sendMail = deps.sendEmail || (async (opts) => {
    const { sendEmail } = await import('./email.js');
    return sendEmail(opts);
  });
  const today = todayEC(now);
  const summary = { sent: 0, failed: 0, byStep: {} };

  const policies = await r.findPoliciesEndingSoon(db);
  for (const l of policies) {
    try {
      const endDate = toIsoDate(l.policy_end_date);
      const step = dueStep(today, endDate, await r.sentSteps(db, l.id, endDate));
      if (!step) continue;
      const phone = l.phone || l.user_phone;
      const base = { leadId: l.id, quoteCode: l.quote_code, endDate, step };

      if (phone) {
        const claimId = await r.claim(db, { ...base, channel: 'whatsapp' });
        if (claimId) {
          const res = waStatus(await sendWA(phone, buildWA(step, l, today)));
          await r.finish(db, claimId, res.status, res.error);
          if (res.status === 'sent') {
            summary.sent++;
            summary.byStep[step] = (summary.byStep[step] || 0) + 1;
          } else {
            summary.failed++;
            console.warn(`${LOG} ⚠️ ${step} WA ${l.quote_code}: ${res.status} (${res.error})`);
          }
        }
      }

      if (l.email) {
        const emailClaim = await r.claim(db, { ...base, channel: 'email' });
        if (emailClaim) {
          const { subject, html } = buildEmail(step, l, today);
          let res;
          try {
            const { AGENT_FROM_NAMES, ADRIANA_FROM_EMAIL } = deps.fromInfo || await import('./email.js');
            const out = await sendMail({
              to: l.email, cc: ADMIN_CC, subject, html,
              from: { name: AGENT_FROM_NAMES?.adriana || 'Adriana · SegPopular', address: ADRIANA_FROM_EMAIL },
              agent: 'adriana',
            });
            res = out?.success ? { status: 'sent' } : { status: 'failed', error: out?.error || 'EMAIL_FAILED' };
          } catch (err) {
            res = { status: 'failed', error: err.message };
          }
          await r.finish(db, emailClaim, res.status, res.error);
        }
      }
      if (deps.pauseMs !== 0) await new Promise(res => setTimeout(res, deps.pauseMs ?? 1500));
    } catch (err) {
      summary.failed++;
      console.error(`${LOG} ❌ ${l.quote_code}:`, err.message);
    }
  }
  console.log(`${LOG} 📊 ${JSON.stringify(summary)}`);
  return summary;
}
