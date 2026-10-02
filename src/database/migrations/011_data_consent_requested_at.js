/** Registra cuándo se mostró por primera vez el consentimiento LOPDP. */
export async function up(db) {
  await db.run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS data_consent_requested_at TIMESTAMPTZ`);
}

export async function down(db) {
  await db.run(`ALTER TABLE users DROP COLUMN IF EXISTS data_consent_requested_at`);
}
