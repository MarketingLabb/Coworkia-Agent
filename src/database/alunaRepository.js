/**
 * 💼 Aluna Repository - Gestión especializada de membresías
 * Maneja aluna_partial_memberships y pending_confirmations
 */

import databaseService from './database.js';
import { normalizePhoneEC } from '../utils/validators.js';

/**
 * 💾 Guardar membresía parcial/cancelada
 */
export async function savePartialMembership(userId, membershipData) {
  await databaseService.ensureInitialized();
  
  const {
    membershipType,
    startDate,
    clientName,
    email,
    phone,
    companyName,
    specialRequirements,
    monthlyFee,
    formProgress,
    cancellationReason,
    expiresAt
  } = membershipData;

  await databaseService.run(
    `INSERT INTO aluna_partial_memberships (
      user_phone, membership_type, start_date, client_name, email, phone,
      company_name, special_requirements, monthly_fee, form_progress,
      cancellation_reason, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (user_phone) 
    DO UPDATE SET
      membership_type = EXCLUDED.membership_type,
      start_date = EXCLUDED.start_date,
      client_name = EXCLUDED.client_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      company_name = EXCLUDED.company_name,
      special_requirements = EXCLUDED.special_requirements,
      monthly_fee = EXCLUDED.monthly_fee,
      form_progress = EXCLUDED.form_progress,
      cancellation_reason = EXCLUDED.cancellation_reason,
      cancelled_at = CURRENT_TIMESTAMP,
      expires_at = EXCLUDED.expires_at`,
    [
      userId, membershipType, startDate, clientName, email, phone,
      companyName, specialRequirements, monthlyFee, formProgress,
      cancellationReason, expiresAt
    ]
  );

  console.log(`[ALUNA-REPO] ✅ Membresía parcial guardada: ${userId}`);
}

/**
 * 🔍 Obtener membresía parcial
 */
export async function getPartialMembership(userId) {
  await databaseService.ensureInitialized();
  
  const result = await databaseService.get(
    `SELECT * FROM aluna_partial_memberships WHERE user_phone = $1`,
    [userId]
  );

  return result || null;
}

/**
 * 🗑️ Limpiar membresía parcial
 */
export async function clearPartialMembership(userId) {
  await databaseService.ensureInitialized();
  
  await databaseService.run(
    'DELETE FROM aluna_partial_memberships WHERE user_phone = $1',
    [userId]
  );

  console.log(`[ALUNA-REPO] 🗑️ Membresía parcial eliminada: ${userId}`);
}

/**
 * 🧹 Limpiar membresías parciales expiradas
 */
export async function cleanExpiredPartialMemberships() {
  await databaseService.ensureInitialized();
  
  const result = await databaseService.run(
    'DELETE FROM aluna_partial_memberships WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP'
  );

  console.log(`[ALUNA-REPO] 🧹 Membresías parciales expiradas eliminadas: ${result.changes || 0}`);
  return result.changes || 0;
}

/**
 * 💾 Guardar confirmación pendiente de membresía
 */
export async function savePendingConfirmation(userId, membershipData) {
  await databaseService.ensureInitialized();
  
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos

  await databaseService.run(
    `INSERT INTO pending_confirmations (
      user_phone, agent_type, agent_name, reservation_data, 
      confirmation_type, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_phone) 
    DO UPDATE SET
      agent_type = EXCLUDED.agent_type,
      agent_name = EXCLUDED.agent_name,
      reservation_data = EXCLUDED.reservation_data,
      confirmation_type = EXCLUDED.confirmation_type,
      created_at = CURRENT_TIMESTAMP,
      expires_at = EXCLUDED.expires_at`,
    [
      userId,
      'ALUNA',
      'Aluna - Closer Membresías',
      JSON.stringify(membershipData),
      'membership',
      expiresAt
    ]
  );

  console.log(`[ALUNA-REPO] ⏳ Confirmación pendiente guardada: ${userId}`);
}

/**
 * 🔍 Obtener confirmación pendiente
 */
export async function getPendingConfirmation(userId) {
  await databaseService.ensureInitialized();
  
  const result = await databaseService.get(
    `SELECT reservation_data, expires_at, agent_type, agent_name, confirmation_type 
     FROM pending_confirmations 
     WHERE user_phone = $1 AND agent_type = 'ALUNA'`,
    [userId]
  );

  if (!result) return null;

  return {
    ...JSON.parse(result.reservation_data),
    expiresAt: result.expires_at,
    agentType: result.agent_type,
    agentName: result.agent_name,
    confirmationType: result.confirmation_type
  };
}

/**
 * 🗑️ Limpiar confirmación pendiente
 */
export async function clearPendingConfirmation(userId) {
  await databaseService.ensureInitialized();
  
  await databaseService.run(
    'DELETE FROM pending_confirmations WHERE user_phone = $1 AND agent_type = $2',
    [userId, 'ALUNA']
  );

  console.log(`[ALUNA-REPO] 🗑️ Confirmación pendiente eliminada: ${userId}`);
}

// ============================================================================
// MEMBERSHIP LEADS - Leads de membresía completas
// ============================================================================

/**
 * 💾 Guardar lead de membresía completa
 */
export async function saveMembershipLead(leadData) {
  await databaseService.ensureInitialized();
  
  const {
    id,
    membershipCode,
    userId,
    membershipType,
    startDate,
    clientName,
    email,
    phone,
    companyName,
    specialRequirements,
    monthlyFee
  } = leadData;

  await databaseService.run(
    `INSERT INTO membership_leads (
      id, membership_code, user_phone, membership_type,
      start_date, client_name, email, phone,
      company_name, special_requirements, monthly_fee,
      status, quote_sent_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)`,
    [
      id, membershipCode, userId, membershipType,
      startDate, clientName, email, phone,
      companyName, specialRequirements, monthlyFee,
      'pending'
    ]
  );

  console.log(`[ALUNA-REPO] ✅ Lead de membresía guardado: ${membershipCode}`);
  return { id, membershipCode };
}

/**
 * 🔍 Obtener lead por código
 */
export async function getMembershipLead(membershipCode) {
  await databaseService.ensureInitialized();
  
  const result = await databaseService.get(
    `SELECT * FROM membership_leads WHERE membership_code = $1`,
    [membershipCode]
  );

  return result || null;
}

/**
 * 🔍 Obtener leads por usuario
 */
export async function getMembershipLeadsByUser(userId) {
  await databaseService.ensureInitialized();
  
  const results = await databaseService.all(
    `SELECT * FROM membership_leads WHERE user_phone = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return results || [];
}

/**
 * 🔄 Actualizar estado de lead
 */
export async function updateMembershipLeadStatus(membershipCode, status, notes = null) {
  await databaseService.ensureInitialized();
  
  const params = [status, membershipCode];
  let query = `UPDATE membership_leads SET status = $1, updated_at = CURRENT_TIMESTAMP`;
  
  if (notes) {
    query += `, notes = $3`;
    params.push(notes);
  }
  
  query += ` WHERE membership_code = $2`;
  
  await databaseService.run(query, params);
  console.log(`[ALUNA-REPO] ✅ Lead actualizado: ${membershipCode} → ${status}`);
}

// ============================================================================
// ALUNA PROSPECT FOLLOW-UPS - Seguimiento de usuarios con interés en membresías
// ============================================================================

/**
 * 📌 Registrar (o actualizar nombre/tipo/email/código) a un prospecto de Aluna.
 * Idempotente: si el usuario ya existe, solo actualiza los campos no nulos.
 */
export async function trackAlunaProspect(userPhone, userName = null, membershipType = null, membershipCode = null, email = null) {
  await databaseService.ensureInitialized();
  try {
    await databaseService.run(
      `INSERT INTO aluna_prospect_followups (user_phone, user_name, membership_type, membership_code, email, interest_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_phone) DO UPDATE
         SET user_name       = COALESCE($2, aluna_prospect_followups.user_name),
             membership_type = COALESCE($3, aluna_prospect_followups.membership_type),
             membership_code = COALESCE($4, aluna_prospect_followups.membership_code),
             email           = COALESCE($5, aluna_prospect_followups.email),
             updated_at      = CURRENT_TIMESTAMP
         WHERE aluna_prospect_followups.converted_at IS NULL`,
      [userPhone, userName, membershipType, membershipCode, email]
    );
    console.log(`[ALUNA-REPO] 📌 Prospecto Aluna registrado/actualizado: ${userPhone}`);
  } catch (err) {
    console.warn('[ALUNA-REPO] ⚠️ trackAlunaProspect no crítico:', err.message);
  }
}

/**
 * 🎯 Capturar lead de Aluna con keywords detectadas en Wassenger (tiempo real)
 * Crea/actualiza entrada en membership_leads para dashboard
 */
export async function captureAlunaLeadFromKeywords(userPhone, userName, messageText) {
  await databaseService.ensureInitialized();
  
  const ALUNA_KEYWORDS = ['membresía', 'membresia', 'membresias', 'membresías', 'plan mensual', 'planes mensuales', 'plan 10', 'plan 20', 'plan10', 'plan20', 'oficina virtual', 'coworking'];
  const textLower = (messageText || '').toLowerCase();
  const hasKeyword = ALUNA_KEYWORDS.some(kw => textLower.includes(kw));
  
  if (!hasKeyword) return; // No keywords, no crear lead
  
  try {
    // Verificar si ya existe el lead
    const existing = await databaseService.get(
      'SELECT id FROM membership_leads WHERE user_phone = $1',
      [userPhone]
    );
    
    if (existing) {
      // Ya existe, solo actualizar last_interaction_at
      await databaseService.run(
        `UPDATE membership_leads 
         SET last_interaction_at = CURRENT_TIMESTAMP 
         WHERE user_phone = $1`,
        [userPhone]
      );
      console.log(`[ALUNA-CAPTURE] 🔄 Lead existente actualizado: ${userPhone}`);
    } else {
      // Crear nuevo lead
      const leadId = `ML-WS-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      const email = `wassenger+${userPhone.replace(/[^0-9]/g, '')}@coworkia.space`;
      
      await databaseService.run(
        `INSERT INTO membership_leads (
          id, membership_code, user_phone, client_name, phone,
          status, monthly_fee, membership_type,
          last_interaction_at, quote_sent_at,
          special_requirements, notes,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          leadId,
          leadId,
          userPhone,
          userName || 'Sin nombre',
          userPhone,
          'pending',
          0,
          'consulta-inicial',  // ← FIX: valor por defecto en lugar de null
          new Date().toISOString(),
          new Date().toISOString(),
          'Capturado automáticamente - Keywords detectadas en conversación',
          `Keywords: ${ALUNA_KEYWORDS.filter(kw => textLower.includes(kw)).join(', ')}. Mensaje: ${messageText.substring(0, 200)}`
        ]
      );
      
      console.log(`[ALUNA-CAPTURE] ✅ Nuevo lead capturado: ${leadId} (${userName || userPhone})`);
    }
  } catch (err) {
    console.warn('[ALUNA-CAPTURE] ⚠️ Error capturando lead (no crítico):', err.message);
  }
}

/**
 * 🔍 Prospectos que necesitan follow-up de 24 horas
 * (han pasado ≥24h desde interest_at, sin followup_24h aún, sin conversión)
 */
export async function findProspectsFor24hFollowUp() {
  await databaseService.ensureInitialized();
  return databaseService.all(
    `SELECT user_phone, user_name, membership_type, membership_code, email, interest_at
       FROM aluna_prospect_followups
      WHERE followup_24h_sent_at IS NULL
        AND converted_at IS NULL
        AND interest_at <= NOW() - INTERVAL '24 hours'
        -- Ventana: solo prospectos de las últimas 48h. Sin este tope, los que
        -- quedaron atascados (p.ej. por errores 400 de Wassenger) recibían un
        -- "Ayer conversamos..." semanas después al destrabarse el envío.
        AND interest_at >= NOW() - INTERVAL '48 hours'
      ORDER BY interest_at ASC
      LIMIT 50`,
    []
  );
}

/**
 * 🔍 Prospectos que necesitan follow-up de 3 días
 * (han pasado ≥72h desde followup_24h_sent_at, sin followup_3d aún, sin conversión)
 */
export async function findProspectsFor3dFollowUp() {
  await databaseService.ensureInitialized();
  return databaseService.all(
    `SELECT user_phone, user_name, membership_type, membership_code, email, interest_at, followup_24h_sent_at
       FROM aluna_prospect_followups
      WHERE followup_24h_sent_at IS NOT NULL
        AND followup_3d_sent_at IS NULL
        AND converted_at IS NULL
        AND followup_24h_sent_at <= NOW() - INTERVAL '72 hours'
        AND followup_24h_sent_at >= NOW() - INTERVAL '96 hours'
        -- El flujo normal es interés + 24h + 72h ≈ 4 días; si el interés es
        -- más viejo, el 24h salió tarde (backlog) y no se insiste.
        AND interest_at >= NOW() - INTERVAL '6 days'
      ORDER BY followup_24h_sent_at ASC
      LIMIT 50`,
    []
  );
}

/** Marca el follow-up WA de 24h como enviado */
export async function markProspect24hSent(userPhone) {
  await databaseService.ensureInitialized();
  await databaseService.run(
    `UPDATE aluna_prospect_followups
        SET followup_24h_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_phone = $1`,
    [userPhone]
  );
}

/** Marca el follow-up WA de 3 días como enviado */
export async function markProspect3dSent(userPhone) {
  await databaseService.ensureInitialized();
  await databaseService.run(
    `UPDATE aluna_prospect_followups
        SET followup_3d_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_phone = $1`,
    [userPhone]
  );
}

/** Marca el email de follow-up 24h como enviado */
export async function markProspect24hEmailSent(userPhone) {
  await databaseService.ensureInitialized();
  await databaseService.run(
    `UPDATE aluna_prospect_followups
        SET followup_24h_email_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_phone = $1`,
    [userPhone]
  );
}

/** Marca el email de follow-up 7d como enviado */
export async function markProspect3dEmailSent(userPhone) {
  await databaseService.ensureInitialized();
  await databaseService.run(
    `UPDATE aluna_prospect_followups
        SET followup_3d_email_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_phone = $1`,
    [userPhone]
  );
}

/** Marca al prospecto como convertido (pagó/activó membresía) */
export async function markAlunaProspectConverted(userPhone) {
  await databaseService.ensureInitialized();
  try {
    await databaseService.run(
      `UPDATE aluna_prospect_followups
          SET converted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE user_phone = $1 AND converted_at IS NULL`,
      [userPhone]
    );
    console.log(`[ALUNA-REPO] ✅ Prospecto marcado como convertido: ${userPhone}`);
  } catch (err) {
    console.warn('[ALUNA-REPO] ⚠️ markAlunaProspectConverted no crítico:', err.message);
  }
}

/** 
 * Marca cuando un prospecto responde después de recibir follow-ups
 * Tracking para medir efectividad de secuencia automatizada D+1 y D+3
 * @param {string} userPhone - Teléfono del prospecto
 * @param {string} channel - Canal de respuesta: 'whatsapp' o 'email'
 */
export async function markAlunaClientResponse(userPhone, channel = 'whatsapp') {
  await databaseService.ensureInitialized();
  try {
    const updateFields = ['client_response_at = CURRENT_TIMESTAMP', 'updated_at = CURRENT_TIMESTAMP'];
    if (channel === 'whatsapp') {
      updateFields.push('client_whatsapp_reply = TRUE');
    }
    
    await databaseService.run(
      `UPDATE aluna_prospect_followups
          SET ${updateFields.join(', ')}
        WHERE user_phone = $1 AND client_response_at IS NULL`,
      [userPhone]
    );
    console.log(`[ALUNA-REPO] 💬 Cliente respondió (${channel}): ${userPhone}`);
  } catch (err) {
    console.warn('[ALUNA-REPO] ⚠️ markAlunaClientResponse no crítico:', err.message);
  }
}

function buildPhoneVariants(rawPhone) {
  const variants = new Set();
  const raw = String(rawPhone || '').trim();
  const normalized = normalizePhoneEC(raw);
  const digits = raw.replace(/\D/g, '');

  if (raw) variants.add(raw);
  if (normalized) variants.add(normalized);
  if (digits) {
    variants.add(digits);
    variants.add(`+${digits}`);
  }

  return [...variants].filter(Boolean);
}

function buildFollowupResponseNote(messageText, channel) {
  const cleaned = String(messageText || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const snippet = cleaned.slice(0, 500);
  return `[ALUNA-FOLLOWUP-RESPONSE ${channel}] ${snippet}`;
}

/**
 * Marca la primera respuesta de un lead de membresia que ya recibio D+1.
 * Es idempotente: no sobrescribe client_response_at ni toca leads sin D+1.
 */
export async function markAlunaMembershipLeadClientResponse(userPhone, channel = 'whatsapp', messageText = '') {
  await databaseService.ensureInitialized();

  const phoneVariants = buildPhoneVariants(userPhone);
  if (phoneVariants.length === 0) {
    return { updated: false, reason: 'invalid_phone' };
  }

  const safeChannel = channel === 'email' ? 'email' : 'whatsapp';
  const responseNote = buildFollowupResponseNote(messageText, safeChannel);

  try {
    const result = await databaseService.get(
      `WITH eligible AS (
         SELECT id
           FROM membership_leads
          WHERE (user_phone = ANY($1::text[]) OR phone = ANY($1::text[]))
            AND followup_24h_sent_at IS NOT NULL
            AND client_response_at IS NULL
            AND status NOT IN ('active', 'cancelled', 'expired', 'accepted', 'pending_payment', 'converted')
          ORDER BY followup_24h_sent_at DESC NULLS LAST, created_at DESC
          LIMIT 1
       )
       UPDATE membership_leads ml
          SET client_response_at = CURRENT_TIMESTAMP,
              client_whatsapp_reply = CASE WHEN $2 = 'whatsapp' THEN TRUE ELSE ml.client_whatsapp_reply END,
              client_email_reply = CASE WHEN $2 = 'email' THEN TRUE ELSE ml.client_email_reply END,
              last_interaction_at = CURRENT_TIMESTAMP,
              notes = CASE
                WHEN $3::text = '' THEN ml.notes
                ELSE CONCAT(
                  COALESCE(ml.notes, ''),
                  CASE WHEN COALESCE(ml.notes, '') = '' THEN '' ELSE E'\n' END,
                  $3::text
                )
              END
         FROM eligible
        WHERE ml.id = eligible.id
        RETURNING ml.id, ml.client_response_at, ml.client_whatsapp_reply, ml.client_email_reply, ml.last_interaction_at`,
      [phoneVariants, safeChannel, responseNote]
    );

    if (!result) {
      return { updated: false, reason: 'not_eligible' };
    }

    console.log('[ALUNA-REPO] Respuesta de follow-up registrada en membership_leads');
    return {
      updated: true,
      leadId: result.id,
      clientResponseAt: result.client_response_at,
      clientWhatsappReply: result.client_whatsapp_reply,
      clientEmailReply: result.client_email_reply,
      lastInteractionAt: result.last_interaction_at,
    };
  } catch (err) {
    console.warn('[ALUNA-REPO] markAlunaMembershipLeadClientResponse error:', err.message);
    return { updated: false, reason: 'error', error: err.message };
  }
}

/**
 * Marca un lead de membresía como "negotiating" (alto interés detectado)
 * Se usa cuando el sistema detecta keywords de high intent
 * @param {string} userPhone - Teléfono del prospecto
 */
export async function markAlunaLeadAsNegotiating(userPhone) {
  await databaseService.ensureInitialized();
  try {
    await databaseService.run(
      `UPDATE membership_leads
          SET status = 'negotiating', updated_at = CURRENT_TIMESTAMP
        WHERE user_phone = $1 AND status NOT IN ('active', 'cancelled')`,
      [userPhone]
    );
    console.log(`[ALUNA-REPO] 🔥 Lead marcado como NEGOTIATING (high intent): ${userPhone}`);
  } catch (err) {
    console.warn('[ALUNA-REPO] ⚠️ markAlunaLeadAsNegotiating no crítico:', err.message);
  }
}

/**
 * Obtiene información de un prospecto para notificaciones
 * Combina datos de membership_leads y aluna_prospect_followups
 * @param {string} userPhone - Teléfono del prospecto
 * @returns {object|null} Información del prospecto
 */
export async function getAlunaProspectInfo(userPhone) {
  await databaseService.ensureInitialized();
  try {
    // Intentar primero desde membership_leads (tiene más info)
    const lead = await databaseService.get(
      `SELECT user_phone, client_name, membership_type, membership_code, email, status
       FROM membership_leads WHERE user_phone = $1
       ORDER BY created_at DESC LIMIT 1`,
      [userPhone]
    );
    
    if (lead) return lead;
    
    // Fallback: intentar desde aluna_prospect_followups
    const prospect = await databaseService.get(
      `SELECT user_phone, user_name as client_name, membership_type, membership_code, email
       FROM aluna_prospect_followups WHERE user_phone = $1`,
      [userPhone]
    );
    
    return prospect || null;
  } catch (err) {
    console.warn('[ALUNA-REPO] ⚠️ getAlunaProspectInfo error:', err.message);
    return null;
  }
}

// ============================================================================
// ALUNA RENEWAL REMINDERS — Recordatorios de renovación de membresías activas
// ============================================================================

/**
 * 🔍 Miembros con pago verificado hace ≥25 días sin recordatorio 1 en este ciclo
 * (5 días antes del vencimiento)
 */
export async function findMembersForRenewalReminder1() {
  await databaseService.ensureInitialized();
  return databaseService.all(
    `SELECT
       ml.id,
       ml.user_phone,
       ml.membership_type,
       ml.client_name,
       mp.transaction_date AS last_payment_date
     FROM membership_leads ml
     JOIN (
       SELECT DISTINCT ON (membership_lead_id)
         membership_lead_id, transaction_date
       FROM membership_payments
       WHERE status = 'verified'
       ORDER BY membership_lead_id, transaction_date DESC
     ) mp ON mp.membership_lead_id = ml.id
     WHERE ml.status = 'accepted'
       AND mp.transaction_date <= CURRENT_DATE - INTERVAL '25 days'
       -- Ventana de 5 días: no avisar "vence pronto" a membresías vencidas hace meses
       AND mp.transaction_date >= CURRENT_DATE - INTERVAL '29 days'
       AND (ml.renewal_reminder_1_sent_at IS NULL
            OR ml.renewal_reminder_1_sent_at < mp.transaction_date::timestamp)
     ORDER BY mp.transaction_date ASC
     LIMIT 50`,
    []
  );
}

/**
 * 🔍 Miembros con pago verificado hace ≥30 días sin recordatorio 2 en este ciclo
 * (día de vencimiento)
 */
export async function findMembersForRenewalReminder2() {
  await databaseService.ensureInitialized();
  return databaseService.all(
    `SELECT
       ml.id,
       ml.user_phone,
       ml.membership_type,
       ml.client_name,
       mp.transaction_date AS last_payment_date
     FROM membership_leads ml
     JOIN (
       SELECT DISTINCT ON (membership_lead_id)
         membership_lead_id, transaction_date
       FROM membership_payments
       WHERE status = 'verified'
       ORDER BY membership_lead_id, transaction_date DESC
     ) mp ON mp.membership_lead_id = ml.id
     WHERE ml.status = 'accepted'
       AND mp.transaction_date <= CURRENT_DATE - INTERVAL '30 days'
       AND mp.transaction_date >= CURRENT_DATE - INTERVAL '33 days'
       AND (ml.renewal_reminder_2_sent_at IS NULL
            OR ml.renewal_reminder_2_sent_at < mp.transaction_date::timestamp)
     ORDER BY mp.transaction_date ASC
     LIMIT 50`,
    []
  );
}

/** Marca el recordatorio 1 de renovación como enviado para este ciclo */
export async function markRenewalReminder1Sent(membershipLeadId) {
  await databaseService.ensureInitialized();
  await databaseService.run(
    `UPDATE membership_leads
        SET renewal_reminder_1_sent_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [membershipLeadId]
  );
}

/** Marca el recordatorio 2 de renovación como enviado para este ciclo */
export async function markRenewalReminder2Sent(membershipLeadId) {
  await databaseService.ensureInitialized();
  await databaseService.run(
    `UPDATE membership_leads
        SET renewal_reminder_2_sent_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
    [membershipLeadId]
  );
}

/**
 * 🔔 Miembros cuya membresía vence MAÑANA (29 días post-pago)
 * Para enviar reminder 1 día antes con email HTML + WhatsApp
 */
export async function findMembersExpiringTomorrow() {
  await databaseService.ensureInitialized();
  return databaseService.all(
    `SELECT
       ml.id,
       ml.user_phone,
       ml.membership_type,
       ml.client_name,
       ml.email,
       ml.monthly_fee,
       mp.transaction_date AS last_payment_date,
       (mp.transaction_date + INTERVAL '30 days')::date AS expiration_date
     FROM membership_leads ml
     JOIN (
       SELECT DISTINCT ON (membership_lead_id)
         membership_lead_id, transaction_date
       FROM membership_payments
       WHERE status = 'verified'
       ORDER BY membership_lead_id, transaction_date DESC
     ) mp ON mp.membership_lead_id = ml.id
     WHERE ml.status IN ('accepted', 'active')
       AND (mp.transaction_date + INTERVAL '30 days')::date = CURRENT_DATE + INTERVAL '1 day'
       AND (ml.renewal_reminder_2_sent_at IS NULL
            OR ml.renewal_reminder_2_sent_at < mp.transaction_date::timestamp)
     ORDER BY mp.transaction_date ASC
     LIMIT 50`,
    []
  );
}

/**
 * 📊 Obtener estadísticas de leads
 */
export async function getMembershipLeadsStats() {
  await databaseService.ensureInitialized();
  
  const stats = await databaseService.get(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'quoted' THEN 1 END) as quoted,
      COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
      AVG(monthly_fee) as avg_monthly_fee
    FROM membership_leads
  `);

  return stats || {};
}
