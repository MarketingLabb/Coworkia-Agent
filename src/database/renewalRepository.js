// src/database/renewalRepository.js
// 🌙 Acceso a datos de la secuencia de renovación de Aluna.
// Todas las funciones aceptan `db` para poder probarlas con una BD en memoria.

import databaseService from './database.js';

const MAX_FAILED_ATTEMPTS = 3;

async function ready(db) {
  if (db.ensureInitialized) await db.ensureInitialized();
}

/**
 * Leads aceptados/activos/expirados con su último pago verificado (últimos ~14 meses).
 * La deduplicación por persona se hace después en pickCurrentMemberships().
 */
export async function findRenewalCandidates(db = databaseService) {
  await ready(db);
  return db.all(
    `/* renewal:candidates */
     SELECT ml.id, ml.user_phone, ml.membership_type, ml.client_name, ml.email,
            ml.monthly_fee, ml.status, ml.created_at::text AS lead_created_at,
            mp.transaction_date::text AS last_payment_date,
            mp.first_payment_date::text AS first_payment_date
       FROM membership_leads ml
       JOIN (
         SELECT membership_lead_id,
                MAX(transaction_date) AS transaction_date,
                MIN(transaction_date) AS first_payment_date
           FROM membership_payments
          WHERE status = 'verified'
          GROUP BY membership_lead_id
       ) mp ON mp.membership_lead_id = ml.id
      WHERE ml.status IN ('accepted', 'active', 'expired')
        AND mp.transaction_date >= CURRENT_DATE - INTERVAL '420 days'`,
    []
  );
}

export async function getCycleHistory(phoneKey, cycleEnd, db = databaseService) {
  await ready(db);
  const rows = await db.all(
    `/* renewal:history */
     SELECT step, channel, status, sent_at, created_at
       FROM membership_renewal_notifications
      WHERE phone_key = $1 AND cycle_end = $2`,
    [phoneKey, cycleEnd]
  );
  // Un paso cuenta como "hecho" si su WhatsApp ya está registrado en cualquier estado
  // distinto de failed (los failed se pueden reintentar, hasta MAX_FAILED_ATTEMPTS).
  const history = {};
  for (const row of rows) {
    if (row.channel !== 'whatsapp') continue;
    if (row.status === 'failed') continue;
    history[row.step] = row;
  }
  return history;
}

/**
 * 🔒 Reserva el envío ANTES de mandarlo. Devuelve el id si este proceso ganó la
 * reserva; null si otro ya lo envió/reservó. Un 'failed' (proveedor rechazó, no
 * se entregó) se puede volver a reservar hasta MAX_FAILED_ATTEMPTS veces.
 */
export async function claimNotification({ phoneKey, userPhone, leadId, cycleEnd, step, channel, message }, db = databaseService) {
  await ready(db);
  const row = await db.get(
    `/* renewal:claim */
     INSERT INTO membership_renewal_notifications
       (phone_key, user_phone, membership_lead_id, cycle_end, step, channel, status, message)
     VALUES ($1, $2, $3, $4, $5, $6, 'claimed', $7)
     ON CONFLICT (phone_key, cycle_end, step, channel) DO UPDATE
       SET status = 'claimed', attempts = membership_renewal_notifications.attempts + 1,
           message = EXCLUDED.message, error = NULL, updated_at = NOW()
       WHERE membership_renewal_notifications.status = 'failed'
         AND membership_renewal_notifications.attempts < ${MAX_FAILED_ATTEMPTS}
     RETURNING id`,
    [phoneKey, userPhone, leadId || null, cycleEnd, step, channel, message || null]
  );
  return row?.id ?? null;
}

/** status: sent | failed (no entregado, reintentable) | unknown (timeout: NO reintentar) | skipped */
export async function finishNotification(id, status, error = null, db = databaseService) {
  await ready(db);
  await db.run(
    `/* renewal:finish */
     UPDATE membership_renewal_notifications
        SET status = $2, error = $3, updated_at = NOW(),
            sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE sent_at END
      WHERE id = $1`,
    [id, status, error ? String(error).slice(0, 500) : null]
  );
}

/** Marca un paso como saltado (p.ej. d3_link cuando el cliente ya respondió). */
export async function skipStep({ phoneKey, userPhone, leadId, cycleEnd, step, reason }, db = databaseService) {
  const id = await claimNotification({ phoneKey, userPhone, leadId, cycleEnd, step, channel: 'whatsapp', message: null }, db);
  if (id) await finishNotification(id, 'skipped', reason, db);
  return !!id;
}

/** Último envío de renovación a este número (para asociar respuestas). */
export async function getLatestRenewalContact(phoneKey, db = databaseService) {
  await ready(db);
  return db.get(
    `/* renewal:latest */
     SELECT phone_key, user_phone, membership_lead_id, cycle_end::text AS cycle_end, step, sent_at
       FROM membership_renewal_notifications
      WHERE phone_key = $1 AND channel = 'whatsapp' AND status = 'sent'
      ORDER BY sent_at DESC
      LIMIT 1`,
    [phoneKey]
  );
}

export async function getPrefs(phoneKey, db = databaseService) {
  await ready(db);
  return db.get(
    `/* renewal:prefs */
     SELECT *, snooze_until::text AS snooze_until, snooze_cycle_end::text AS snooze_cycle_end,
            declined_cycle_end::text AS declined_cycle_end, offer_valid_until::text AS offer_valid_until
       FROM membership_renewal_prefs WHERE phone_key = $1`,
    [phoneKey]
  );
}

const PREF_COLUMNS = new Set([
  'opted_out_at', 'snooze_until', 'snooze_cycle_end', 'declined_cycle_end', 'decline_message',
  'offer_pct', 'offer_months', 'offer_valid_until', 'offer_accepted_at',
]);

export async function upsertPrefs(phoneKey, userPhone, fields, db = databaseService) {
  await ready(db);
  const keys = Object.keys(fields).filter(k => PREF_COLUMNS.has(k));
  if (!keys.length) return;
  const cols = keys.join(', ');
  const placeholders = keys.map((_, i) => `$${i + 3}`).join(', ');
  const updates = keys.map(k => `${k} = EXCLUDED.${k}`).join(', ');
  await db.run(
    `/* renewal:prefs-upsert */
     INSERT INTO membership_renewal_prefs (phone_key, user_phone, ${cols})
     VALUES ($1, $2, ${placeholders})
     ON CONFLICT (phone_key) DO UPDATE SET ${updates}, updated_at = NOW()`,
    [phoneKey, userPhone, ...keys.map(k => fields[k])]
  );
}

/**
 * ¿El cliente escribió algo desde `since`? Mensajes entrantes = interactions con input.
 */
export async function hasInboundSince(phoneKey, since, db = databaseService, { excludeText = null } = {}) {
  await ready(db);
  // excludeText: el mensaje que se está procesando ahora (por si ya quedó registrado).
  const row = await db.get(
    `/* renewal:inbound */
     SELECT 1 AS found FROM interactions
      WHERE RIGHT(regexp_replace(user_phone, '\\D', '', 'g'), 9) = $1
        AND COALESCE(input, '') <> ''
        AND timestamp >= $2
        AND NOT ($3::text IS NOT NULL AND input = $3 AND timestamp >= NOW() - INTERVAL '2 minutes')
      LIMIT 1`,
    [phoneKey, since, excludeText]
  );
  return !!row;
}

/**
 * Tope global: ¿otra automatización (Aurora, Paula, follow-ups…) ya le escribió
 * a este número en las últimas `hours` horas? Los mensajes de esta secuencia no cuentan.
 */
export async function hadOtherAutomatedContact(phoneKey, hours = 20, db = databaseService) {
  await ready(db);
  const row = await db.get(
    `/* renewal:global-cap */
     SELECT 1 AS found FROM interactions
      WHERE RIGHT(regexp_replace(user_phone, '\\D', '', 'g'), 9) = $1
        AND COALESCE(input, '') = ''
        AND COALESCE(output, '') <> ''
        AND COALESCE(intent_reason, '') NOT LIKE 'renewal_%'
        AND timestamp >= NOW() - ($2 * INTERVAL '1 hour')
     UNION ALL
     SELECT 1 FROM automation_deliveries
      WHERE channel = 'whatsapp' AND status = 'sent'
        AND RIGHT(regexp_replace(recipient, '\\D', '', 'g'), 9) = $1
        AND sent_at >= NOW() - ($2 * INTERVAL '1 hour')
     LIMIT 1`,
    [phoneKey, hours]
  );
  return !!row;
}

/**
 * ¿Hay un comprobante enviado después del pago vigente que aún no está verificado
 * (pending / manual_review / flagged)? Si el cliente ya pagó y está en revisión,
 * no tiene sentido recordarle que renueve.
 */
export async function hasPaymentInReviewSince(phoneKey, paymentDate, db = databaseService) {
  await ready(db);
  const row = await db.get(
    `/* renewal:payment-in-review */
     SELECT 1 AS found FROM membership_payments
      WHERE RIGHT(regexp_replace(user_phone, '\\D', '', 'g'), 9) = $1
        AND status IN ('pending', 'manual_review', 'flagged')
        AND created_at::date > $2::date
      LIMIT 1`,
    [phoneKey, paymentDate]
  );
  return !!row;
}

/** Lead de renovación pendiente de pago (si ya existe, se reutiliza). */
export async function findPendingRenewalLead(userPhone, db = databaseService) {
  await ready(db);
  return db.get(
    `/* renewal:pending-lead */
     SELECT * FROM membership_leads
      WHERE user_phone = $1 AND status = 'pending_payment'
      ORDER BY created_at DESC LIMIT 1`,
    [userPhone]
  );
}

export async function getLeadById(id, db = databaseService) {
  await ready(db);
  return db.get(`/* renewal:lead */ SELECT * FROM membership_leads WHERE id = $1`, [id]);
}

/** Cuántas renovaciones con descuento ya se pagaron desde que aceptó la oferta. */
export async function countDiscountedRenewalsSince(userPhone, since, db = databaseService) {
  await ready(db);
  const row = await db.get(
    `/* renewal:discount-used */
     SELECT COUNT(*)::int AS n FROM membership_leads
      WHERE user_phone = $1 AND renewal_discount_pct > 0
        AND status IN ('accepted', 'active', 'expired')
        AND created_at >= $2`,
    [userPhone, since]
  );
  return Number(row?.n || 0);
}

export async function insertRenewalLead(lead, db = databaseService) {
  await ready(db);
  await db.run(
    `/* renewal:insert-lead */
     INSERT INTO membership_leads (
       id, membership_code, user_phone, membership_type, client_name, email, phone,
       company_name, monthly_fee, status, notes, renewal_discount_pct, renewal_of_lead_id,
       quote_sent_at, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_payment', $10, $11, $12,
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      lead.id, lead.membershipCode, lead.userPhone, lead.membershipType, lead.clientName,
      lead.email, lead.phone, lead.companyName, lead.monthlyFee, lead.notes,
      lead.discountPct || null, lead.renewalOfLeadId,
    ]
  );
}

export async function logRenewalInteraction({ userPhone, step, message, input = '' }, db = databaseService) {
  await ready(db);
  await db.run(
    `/* renewal:interaction */
     INSERT INTO interactions (user_phone, agent, agent_name, intent_reason, input, output, meta)
     VALUES ($1, 'aluna', 'Aluna - Closer Membresías', $2, $3, $4, $5)`,
    [userPhone, `renewal_${step}`, input, message,
      JSON.stringify({ automatic: !input, followUp: true, type: `renewal_${step}`, timestamp: new Date().toISOString() })]
  );
}

export async function cancelLead(id, db = databaseService) {
  await ready(db);
  await db.run(
    `/* renewal:cancel-lead */ UPDATE membership_leads SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [id]
  );
}

export async function nextMembershipCode() {
  const { generateSequentialCode } = await import('../utils/code-generator.js');
  return generateSequentialCode('ALU', 'membership_leads', 'membership_code', 4);
}
