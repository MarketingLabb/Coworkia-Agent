/**
 * 014_membership_renewal_sequence.js
 *
 * Secuencia de renovación de Aluna (D-3, D-1, D+1, D+5).
 *
 * - membership_renewal_notifications: registro con candado. La clave única
 *   (phone_key, cycle_end, step, channel) se reserva ANTES de enviar, así un
 *   mismo paso nunca sale dos veces al mismo número en el mismo ciclo, aunque
 *   la persona tenga varios leads, el servidor se reinicie o haya 2 réplicas.
 * - membership_renewal_prefs: lo que el cliente nos dijo (no escribir más,
 *   "renuevo el 25", "no voy a renovar") y la oferta de recuperación vigente.
 * - membership_leads.renewal_discount_pct / renewal_of_lead_id: leads de
 *   renovación creados por Aluna para que el comprobante se valide solo.
 */

export const name = '014_membership_renewal_sequence';

export async function up(db) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS membership_renewal_notifications (
      id BIGSERIAL PRIMARY KEY,
      phone_key TEXT NOT NULL,
      user_phone TEXT NOT NULL,
      membership_lead_id TEXT,
      cycle_end DATE NOT NULL,
      step TEXT NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
      status TEXT NOT NULL DEFAULT 'claimed'
        CHECK (status IN ('claimed', 'sent', 'failed', 'unknown', 'skipped')),
      attempts INTEGER NOT NULL DEFAULT 1,
      message TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (phone_key, cycle_end, step, channel)
    )
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_renewal_notifications_phone
    ON membership_renewal_notifications (phone_key, created_at DESC)
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS membership_renewal_prefs (
      phone_key TEXT PRIMARY KEY,
      user_phone TEXT NOT NULL,
      opted_out_at TIMESTAMPTZ,
      snooze_until DATE,
      snooze_cycle_end DATE,
      declined_cycle_end DATE,
      decline_message TEXT,
      offer_pct NUMERIC(5,2),
      offer_months INTEGER,
      offer_valid_until DATE,
      offer_accepted_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.run(`ALTER TABLE membership_leads ADD COLUMN IF NOT EXISTS renewal_discount_pct NUMERIC(5,2)`);
  await db.run(`ALTER TABLE membership_leads ADD COLUMN IF NOT EXISTS renewal_of_lead_id TEXT`);
}

export async function down(db) {
  await db.run(`DROP TABLE IF EXISTS membership_renewal_notifications`);
  await db.run(`DROP TABLE IF EXISTS membership_renewal_prefs`);
  await db.run(`ALTER TABLE membership_leads DROP COLUMN IF EXISTS renewal_discount_pct`);
  await db.run(`ALTER TABLE membership_leads DROP COLUMN IF EXISTS renewal_of_lead_id`);
}
