/**
 * 015_insurance_policy_renewal.js
 *
 * Renovación de pólizas de Adriana (D-30, D-15, D-7 antes del vencimiento).
 *
 * - insurance_leads.policy_start_date / policy_end_date: vigencia de la póliza
 *   emitida. Se llenan al marcar el lead como 'emitted' (por defecto 1 año).
 * - insurance_renewal_notifications: registro con candado. La clave única
 *   (lead_id, step, channel) se reserva ANTES de enviar, así ningún aviso
 *   sale dos veces aunque el servidor se reinicie.
 */

export const name = '015_insurance_policy_renewal';

export async function up(db) {
  // El flujo real usa estados como waiting_kyc / emitted: el CHECK original no los admite.
  await db.run(`ALTER TABLE insurance_leads DROP CONSTRAINT IF EXISTS insurance_leads_status_check`);
  await db.run(`ALTER TABLE insurance_leads ADD COLUMN IF NOT EXISTS emitted_at TIMESTAMPTZ`);
  await db.run(`ALTER TABLE insurance_leads ADD COLUMN IF NOT EXISTS policy_number TEXT`);
  await db.run(`ALTER TABLE insurance_leads ADD COLUMN IF NOT EXISTS policy_start_date DATE`);
  await db.run(`ALTER TABLE insurance_leads ADD COLUMN IF NOT EXISTS policy_end_date DATE`);

  await db.run(`
    CREATE TABLE IF NOT EXISTS insurance_renewal_notifications (
      id BIGSERIAL PRIMARY KEY,
      lead_id TEXT NOT NULL,
      quote_code TEXT,
      policy_end_date DATE NOT NULL,
      step TEXT NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
      status TEXT NOT NULL DEFAULT 'claimed'
        CHECK (status IN ('claimed', 'sent', 'failed', 'unknown')),
      attempts INTEGER NOT NULL DEFAULT 1,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (lead_id, policy_end_date, step, channel)
    )
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_insurance_leads_policy_end
    ON insurance_leads (policy_end_date) WHERE policy_end_date IS NOT NULL
  `);
}

export async function down(db) {
  await db.run(`DROP TABLE IF EXISTS insurance_renewal_notifications`);
  await db.run(`ALTER TABLE insurance_leads DROP COLUMN IF EXISTS policy_start_date`);
  await db.run(`ALTER TABLE insurance_leads DROP COLUMN IF EXISTS policy_end_date`);
}
