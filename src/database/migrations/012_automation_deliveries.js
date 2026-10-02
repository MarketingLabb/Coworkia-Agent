/**
 * 012_automation_deliveries.js
 *
 * Outbox persistente para automatizaciones. Separa el claim temporal del
 * resultado definitivo y permite recuperar leases abandonados sin duplicar
 * entregas concurrentes.
 */

export async function up(db) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS automation_deliveries (
      id BIGSERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      automation_key TEXT NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
      recipient TEXT NOT NULL,
      payload JSONB NOT NULL,
      legacy_column TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'sent')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lease_token TEXT,
      lease_expires_at TIMESTAMPTZ,
      last_attempt_at TIMESTAMPTZ,
      last_error_code TEXT,
      provider_message_id TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (entity_type, entity_id, automation_key, channel)
    )
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_automation_deliveries_due
    ON automation_deliveries (next_attempt_at, lease_expires_at)
    WHERE status <> 'sent'
  `);
}

export async function down(db) {
  await db.run(`DROP TABLE IF EXISTS automation_deliveries`);
}
