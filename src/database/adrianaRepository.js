/**
 * 🛡️ Adriana Repository - Gestión de seguros SegPopular
 * Maneja insurance_leads completas
 */

import databaseService from './database.js';
import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from './BaseRepository.js';

const _base = new BaseRepository({
  table:      'insurance_leads',
  codeColumn: 'quote_code',
  userColumn: 'user_phone',
  logPrefix:  'ADRIANA-REPO',
});

/**
 * 💾 Guardar lead de seguro completo
 */
export async function saveInsuranceLead(leadData) {
  await databaseService.ensureInitialized();
  
  const {
    quoteCode,
    userId,
    insuranceType,
    city,
    commercialValue,
    plate,
    vehicleBrand,
    vehicleModel,
    vehicleYear,
    motor,
    chasis,
    originCountry,
    licenseType,
    licenseExpiry,
    clientName,
    cedula,
    email,
    phone,
    matriculaImages = [],
    licenciaImages = [],
    quotedPremium,
    premiumBreakdown = {}
  } = leadData;

  const id = uuidv4();

  await databaseService.run(
    `INSERT INTO insurance_leads (
      id, quote_code, user_phone, agent_name, insurance_type,
      city, commercial_value, plate, vehicle_brand, vehicle_model,
      vehicle_year, motor, chasis, origin_country, license_type,
      license_expiry, client_name, cedula, email, phone,
      matricula_images, licencia_images, quoted_premium, premium_breakdown,
      status, quote_sent_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, CURRENT_TIMESTAMP)`,
    [
      id, quoteCode, userId, 'ADRIANA', insuranceType,
      city, commercialValue, plate, vehicleBrand, vehicleModel,
      vehicleYear, motor, chasis, originCountry, licenseType,
      licenseExpiry, clientName, cedula, email, phone,
      JSON.stringify(matriculaImages), JSON.stringify(licenciaImages),
      quotedPremium, JSON.stringify(premiumBreakdown),
      'quoted'
    ]
  );

  console.log(`[ADRIANA-REPO] ✅ Lead de seguro guardado: ${quoteCode}`);
  return { id, quoteCode };
}

/**
 * 🔍 Obtener lead de seguro por código
 */
export async function getInsuranceLead(quoteCode) {
  await databaseService.ensureInitialized();
  
  const result = await databaseService.get(
    `SELECT * FROM insurance_leads WHERE quote_code = $1`,
    [quoteCode]
  );

  if (result) {
    // Parse JSONB fields
    result.matricula_images = typeof result.matricula_images === 'string' 
      ? JSON.parse(result.matricula_images) 
      : result.matricula_images;
    result.licencia_images = typeof result.licencia_images === 'string'
      ? JSON.parse(result.licencia_images)
      : result.licencia_images;
    result.premium_breakdown = typeof result.premium_breakdown === 'string'
      ? JSON.parse(result.premium_breakdown)
      : result.premium_breakdown;
  }

  return result || null;
}

/** 🔍 Obtener leads por usuario */
export const getInsuranceLeadsByUser = (userId) => _base.getByUser(userId);

/** 🔄 Actualizar estado de lead */
export const updateInsuranceLeadStatus = (quoteCode, status, notes) => _base.updateStatus(quoteCode, status, notes);

/**
 * 📊 Obtener estadísticas de leads
 */
export async function getInsuranceLeadsStats() {
  await databaseService.ensureInitialized();
  
  const stats = await databaseService.get(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN status = 'quoted' THEN 1 END) as quoted,
      COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
      AVG(quoted_premium) as avg_premium
    FROM insurance_leads
  `);

  return stats || {};
}

// ─────────────────────────────────────────────────────────────
// FORMULARIO CONVERSACIONAL — adriana_quote_leads
// ─────────────────────────────────────────────────────────────

/**
 * 🔍 Obtener estado activo de cotización por teléfono
 */
export async function getQuoteLead(phone) {
  await databaseService.ensureInitialized();
  return await databaseService.get(
    `SELECT * FROM adriana_quote_leads WHERE phone = $1`,
    [phone]
  );
}

/**
 * 💾 Crear o actualizar lead de cotización conversacional
 */
export async function upsertQuoteLead(phone, data = {}) {
  await databaseService.ensureInitialized();
  await databaseService.run(
    `INSERT INTO adriana_quote_leads
       (phone, status, client_name, client_email, vehicle_data, id_card_data,
        selected_coverage, premium_data, quote_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (phone) DO UPDATE SET
       status            = EXCLUDED.status,
       client_name       = COALESCE(EXCLUDED.client_name,       adriana_quote_leads.client_name),
       client_email      = COALESCE(EXCLUDED.client_email,      adriana_quote_leads.client_email),
       vehicle_data      = COALESCE(EXCLUDED.vehicle_data,      adriana_quote_leads.vehicle_data),
       id_card_data      = COALESCE(EXCLUDED.id_card_data,      adriana_quote_leads.id_card_data),
       selected_coverage = COALESCE(EXCLUDED.selected_coverage, adriana_quote_leads.selected_coverage),
       premium_data      = COALESCE(EXCLUDED.premium_data,      adriana_quote_leads.premium_data),
       quote_code        = COALESCE(EXCLUDED.quote_code,        adriana_quote_leads.quote_code),
       updated_at        = CURRENT_TIMESTAMP`,
    [
      phone,
      data.status           || 'gathering_vehicle',
      data.clientName       || null,
      data.clientEmail      || null,
      data.vehicleData      ? JSON.stringify(data.vehicleData)  : null,
      data.idCardData       ? JSON.stringify(data.idCardData)   : null,
      data.selectedCoverage || null,
      data.premiumData      ? JSON.stringify(data.premiumData)  : null,
      data.quoteCode        || null,
    ]
  );
}

/**
 * ✏️ Actualizar campos específicos de un quote lead
 */
export async function updateQuoteLeadData(phone, updates = {}) {
  await databaseService.ensureInitialized();
  const set = ['updated_at = CURRENT_TIMESTAMP'];
  const vals = [phone];
  let i = 2;
  const add = (col, val) => { set.push(`${col} = $${i++}`); vals.push(val); };

  if (updates.status           !== undefined) add('status',            updates.status);
  if (updates.clientName       !== undefined) add('client_name',       updates.clientName);
  if (updates.clientEmail      !== undefined) add('client_email',      updates.clientEmail);
  if (updates.vehicleData      !== undefined) add('vehicle_data',      JSON.stringify(updates.vehicleData));
  if (updates.idCardData       !== undefined) add('id_card_data',      JSON.stringify(updates.idCardData));
  if (updates.selectedCoverage !== undefined) add('selected_coverage', updates.selectedCoverage);
  if (updates.premiumData      !== undefined) add('premium_data',      JSON.stringify(updates.premiumData));
  if (updates.quoteCode        !== undefined) add('quote_code',        updates.quoteCode);

  await databaseService.run(
    `UPDATE adriana_quote_leads SET ${set.join(', ')} WHERE phone = $1`,
    vals
  );
}

/**
 * 🗑️ Eliminar lead de cotización (flujo completado o cancelado)
 */
export async function deleteQuoteLead(phone) {
  await databaseService.ensureInitialized();
  await databaseService.run(
    `DELETE FROM adriana_quote_leads WHERE phone = $1`,
    [phone]
  );
}

// ─────────────────────────────────────────────────────────────
// FLUJO COMPLETO ADRIANA — nuevas funciones BLOQUE 1
// ─────────────────────────────────────────────────────────────

/**
 * 🔍 Buscar lead por teléfono
 */
export async function findLeadByPhone(phone) {
  await databaseService.ensureInitialized();
  const result = await databaseService.get(
    `SELECT * FROM insurance_leads WHERE user_phone = $1 ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  
  if (result) {
    // Parse JSONB fields
    if (result.competitor_quotes && typeof result.competitor_quotes === 'string') {
      result.competitor_quotes = JSON.parse(result.competitor_quotes);
    }
    if (result.matricula_images && typeof result.matricula_images === 'string') {
      result.matricula_images = JSON.parse(result.matricula_images);
    }
    if (result.licencia_images && typeof result.licencia_images === 'string') {
      result.licencia_images = JSON.parse(result.licencia_images);
    }
    if (result.premium_breakdown && typeof result.premium_breakdown === 'string') {
      result.premium_breakdown = JSON.parse(result.premium_breakdown);
    }
  }
  
  return result || null;
}

/**
 * 💾 Crear o actualizar lead (upsert por quote_code)
 */
export async function createOrUpdateInsuranceLead(data) {
  await databaseService.ensureInitialized();
  
  const {
    quoteCode = `ADR-${Date.now().toString(36).toUpperCase()}`,
    userPhone,
    insuranceType = 'vehicle',
    status = 'waiting_matricula',
    clientName,
    email,
    phone,
    city,
    commercialValue,
    plate,
    vehicleBrand,
    vehicleModel,
    vehicleYear,
    motor,
    chasis,
    originCountry,
    cedula,
    quotedPremium,
    premiumBreakdown = {},
    competitorQuotes = [],
    matriculaImages = [],
    licenciaImages = [],
  } = data;
  
  const id = uuidv4();
  
  // Migración: asegurar que columnas existan
  await databaseService.run(`
    ALTER TABLE insurance_leads
      ADD COLUMN IF NOT EXISTS competitor_quotes        JSONB,
      ADD COLUMN IF NOT EXISTS kyc_cedula               TEXT,
      ADD COLUMN IF NOT EXISTS kyc_fecha_nacimiento      DATE,
      ADD COLUMN IF NOT EXISTS kyc_estado_civil          TEXT,
      ADD COLUMN IF NOT EXISTS kyc_direccion             TEXT,
      ADD COLUMN IF NOT EXISTS kyc_ciudad                TEXT,
      ADD COLUMN IF NOT EXISTS kyc_matricula             TEXT,
      ADD COLUMN IF NOT EXISTS competitor_quote_amount   NUMERIC(10,2),
      ADD COLUMN IF NOT EXISTS competitor_insurer        TEXT,
      ADD COLUMN IF NOT EXISTS quote_sent_at             TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS accepted_at               TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS emitted_at                TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS policy_number             TEXT
  `);
  
  await databaseService.run(
    `INSERT INTO insurance_leads (
      id, quote_code, user_phone, agent_name, insurance_type, status,
      client_name, email, phone, city, commercial_value,
      plate, vehicle_brand, vehicle_model, vehicle_year,
      motor, chasis, origin_country, cedula,
      matricula_images, licencia_images, quoted_premium, premium_breakdown,
      competitor_quotes, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      $16, $17, $18, $19, $20, $21, $22, $23, $24, CURRENT_TIMESTAMP
    )
    ON CONFLICT (quote_code) DO UPDATE SET
      status            = EXCLUDED.status,
      client_name       = COALESCE(EXCLUDED.client_name, insurance_leads.client_name),
      email             = COALESCE(EXCLUDED.email, insurance_leads.email),
      phone             = COALESCE(EXCLUDED.phone, insurance_leads.phone),
      city              = COALESCE(EXCLUDED.city, insurance_leads.city),
      commercial_value  = COALESCE(EXCLUDED.commercial_value, insurance_leads.commercial_value),
      plate             = COALESCE(EXCLUDED.plate, insurance_leads.plate),
      vehicle_brand     = COALESCE(EXCLUDED.vehicle_brand, insurance_leads.vehicle_brand),
      vehicle_model     = COALESCE(EXCLUDED.vehicle_model, insurance_leads.vehicle_model),
      vehicle_year      = COALESCE(EXCLUDED.vehicle_year, insurance_leads.vehicle_year),
      motor             = COALESCE(EXCLUDED.motor, insurance_leads.motor),
      chasis            = COALESCE(EXCLUDED.chasis, insurance_leads.chasis),
      origin_country    = COALESCE(EXCLUDED.origin_country, insurance_leads.origin_country),
      cedula            = COALESCE(EXCLUDED.cedula, insurance_leads.cedula),
      matricula_images  = COALESCE(EXCLUDED.matricula_images, insurance_leads.matricula_images),
      licencia_images   = COALESCE(EXCLUDED.licencia_images, insurance_leads.licencia_images),
      quoted_premium    = COALESCE(EXCLUDED.quoted_premium, insurance_leads.quoted_premium),
      premium_breakdown = COALESCE(EXCLUDED.premium_breakdown, insurance_leads.premium_breakdown),
      competitor_quotes = COALESCE(EXCLUDED.competitor_quotes, insurance_leads.competitor_quotes),
      updated_at        = CURRENT_TIMESTAMP
    RETURNING quote_code`,
    [
      id, quoteCode, userPhone, 'ADRIANA', insuranceType, status,
      clientName, email, phone, city, commercialValue,
      plate, vehicleBrand, vehicleModel, vehicleYear,
      motor, chasis, originCountry, cedula,
      JSON.stringify(matriculaImages), JSON.stringify(licenciaImages),
      quotedPremium, JSON.stringify(premiumBreakdown),
      JSON.stringify(competitorQuotes),
    ]
  );
  
  console.log(`[ADRIANA-REPO] ✅ Lead upserted: ${quoteCode}`);
  return { quoteCode };
}

/**
 * 💾 Guardar cotizaciones de competencia
 */
export async function saveCompetitorQuotes(quoteCode, quotes) {
  await databaseService.ensureInitialized();
  await databaseService.run(
    `UPDATE insurance_leads SET competitor_quotes = $1, updated_at = CURRENT_TIMESTAMP WHERE quote_code = $2`,
    [JSON.stringify(quotes), quoteCode]
  );
  console.log(`[ADRIANA-REPO] ✅ Competitor quotes saved for ${quoteCode}`);
}

/**
 * 💾 Guardar datos KYC progresivamente
 */
export async function saveKYCData(quoteCode, kycData) {
  await databaseService.ensureInitialized();
  
  const updates = [];
  const values = [];
  let idx = 1;
  
  if (kycData.cedula)           { updates.push(`kyc_cedula = $${idx++}`);          values.push(kycData.cedula); }
  if (kycData.fechaNacimiento)  { updates.push(`kyc_fecha_nacimiento = $${idx++}`); values.push(kycData.fechaNacimiento); }
  if (kycData.estadoCivil)      { updates.push(`kyc_estado_civil = $${idx++}`);    values.push(kycData.estadoCivil); }
  if (kycData.direccion)        { updates.push(`kyc_direccion = $${idx++}`);       values.push(kycData.direccion); }
  if (kycData.ciudad)           { updates.push(`kyc_ciudad = $${idx++}`);          values.push(kycData.ciudad); }
  if (kycData.matricula)        { updates.push(`kyc_matricula = $${idx++}`);       values.push(kycData.matricula); }
  
  if (updates.length > 0) {
    updates.push(`updated_at = $${idx++}`);
    values.push(new Date());
    values.push(quoteCode);
    
    await databaseService.run(
      `UPDATE insurance_leads SET ${updates.join(', ')} WHERE quote_code = $${idx}`,
      values
    );
    console.log(`[ADRIANA-REPO] ✅ KYC data saved for ${quoteCode}`);
  }
}

/**
 * � Buscar lead por código (para dashboard)
 */
export async function findLeadByCode(quoteCode) {
  await databaseService.ensureInitialized();
  const result = await databaseService.get(
    `SELECT * FROM insurance_leads WHERE quote_code = $1`,
    [quoteCode]
  );
  if (result) {
    const jsonbFields = ['competitor_quotes', 'matricula_images', 'licencia_images', 'premium_breakdown'];
    for (const f of jsonbFields) {
      if (result[f] && typeof result[f] === 'string') {
        try { result[f] = JSON.parse(result[f]); } catch {}
      }
    }
  }
  return result || null;
}

/**
 * 🔄 Actualizar estado de lead con timestamps automáticos
 * @param {string} quoteCode
 * @param {'waiting_matricula'|'waiting_cedula'|'waiting_competitor'|'quoted'|'waiting_kyc'|'accepted'|'emitted'|'rejected'} status
 * @param {object} [extra]  — campos adicionales a setear (clientName, email, etc.)
 */
export async function updateLeadStatus(quoteCode, status, extra = {}) {
  await databaseService.ensureInitialized();

  const sets  = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
  const vals  = [quoteCode, status];
  let   idx   = 3;

  if (status === 'quoted')   { sets.push(`quote_sent_at = COALESCE(quote_sent_at, CURRENT_TIMESTAMP)`); }
  if (status === 'accepted') { sets.push(`accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP)`); }
  if (status === 'emitted')  {
    sets.push(`emitted_at  = COALESCE(emitted_at,  CURRENT_TIMESTAMP)`);
    // Vigencia por defecto: 1 año desde la emisión (usada por la renovación de pólizas)
    sets.push(`policy_start_date = COALESCE(policy_start_date, CURRENT_DATE)`);
    sets.push(`policy_end_date = COALESCE(policy_end_date, (COALESCE(policy_start_date, CURRENT_DATE) + INTERVAL '1 year')::date)`);
  }

  const allowedExtra = ['client_name', 'email', 'phone', 'plate', 'cedula', 'policy_number',
    'kyc_cedula', 'kyc_estado_civil', 'kyc_direccion', 'kyc_ciudad', 'kyc_fecha_nacimiento',
    'kyc_matricula', 'competitor_quote_amount', 'competitor_insurer'];
  for (const key of allowedExtra) {
    if (extra[key] !== undefined) {
      sets.push(`${key} = $${idx++}`);
      vals.push(extra[key]);
    }
  }

  await databaseService.run(
    `UPDATE insurance_leads SET ${sets.join(', ')} WHERE quote_code = $1`,
    vals
  );
  console.log(`[ADRIANA-REPO] ✅ Lead status → ${status}: ${quoteCode}`);
}

/** * 💾 updateKYC — alias moderno de saveKYCData con soporte matrícula
 * @param {string} quoteCode
 * @param {{ cedula?, fechaNacimiento?, estadoCivil?, direccion?, ciudad?, matricula? }} kycData
 */
export const updateKYC = saveKYCData;

/**
 * 💾 Guardar cotización de competidor (campos individuales)
 * @param {string} quoteCode
 * @param {{ amount: number, insurer: string }} competitorData
 */
export async function saveCompetitorQuote(quoteCode, { amount, insurer } = {}) {
  await databaseService.ensureInitialized();
  await databaseService.run(
    `UPDATE insurance_leads
        SET competitor_quote_amount = $1,
            competitor_insurer      = $2,
            updated_at              = CURRENT_TIMESTAMP
      WHERE quote_code = $3`,
    [amount ?? null, insurer ?? null, quoteCode]
  );
  console.log(`[ADRIANA-REPO] ✅ Competitor quote saved for ${quoteCode}: ${insurer} $${amount}`);
}

/** * �📊 Leads para daily report
 */
export async function findLeadsForDailyReport() {
  await databaseService.ensureInitialized();
  
  const results = await databaseService.all(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'quoted' THEN 1 END) as quoted_today,
      COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_today,
      COUNT(CASE WHEN created_at::date = CURRENT_DATE THEN 1 END) as new_today
    FROM insurance_leads
    WHERE created_at > CURRENT_DATE - INTERVAL '1 day'
  `);
  
  return results[0] || { total: 0, quoted_today: 0, accepted_today: 0, new_today: 0 };
}

export default {
  saveInsuranceLead,
  getInsuranceLead,
  getInsuranceLeadsByUser,
  updateInsuranceLeadStatus,
  getInsuranceLeadsStats,
  getQuoteLead,
  upsertQuoteLead,
  updateQuoteLeadData,
  deleteQuoteLead,
  // Nuevas funciones BLOQUE 1
  findLeadByPhone,
  findLeadByCode,
  createOrUpdateInsuranceLead,
  updateLeadStatus,
  saveCompetitorQuotes,
  saveKYCData,
  updateKYC,
  saveCompetitorQuote,
  findLeadsForDailyReport,
};
