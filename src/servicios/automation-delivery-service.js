import { randomUUID } from 'node:crypto';
import databaseService from '../database/database.js';

const LEASE_SECONDS = 5 * 60;
const RETRY_SECONDS = 15 * 60;
const ENTITY_TYPE = 'reservation';
const ALLOWED_LEGACY_COLUMNS = new Set([
  'followup_1h_sent_at',
  'rebook_reminder_sent_at',
  'followup_d1_sent_at',
  'followup_d3_sent_at',
  'reminder_24h_sent_at',
  'reminder_2h_sent_at',
  'reminder_10min_sent_at',
  'no_show_detected_at',
  'upsell_aluna_sent_at',
  'payment_reminder_sent_at',
]);

function assertLegacyColumn(column) {
  if (!ALLOWED_LEGACY_COLUMNS.has(column)) {
    throw new Error('Invalid automation legacy column');
  }
}

function normalizePayload(payload) {
  return typeof payload === 'string' ? payload : JSON.stringify(payload || {});
}

async function prepareBatch({ entityId, automationKey, legacyColumn, deliveries, db }) {
  assertLegacyColumn(legacyColumn);
  if (!deliveries.length) throw new Error('Automation batch requires at least one delivery');

  const params = [];
  const values = deliveries.map((delivery, index) => {
    const offset = index * 7;
    params.push(
      ENTITY_TYPE,
      String(entityId),
      automationKey,
      delivery.channel,
      delivery.recipient,
      normalizePayload(delivery.payload),
      legacyColumn
    );
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}::jsonb, $${offset + 7})`;
  });

  await db.run(`
    /* automation-delivery:prepare */
    INSERT INTO automation_deliveries
      (entity_type, entity_id, automation_key, channel, recipient, payload, legacy_column)
    VALUES ${values.join(', ')}
    ON CONFLICT (entity_type, entity_id, automation_key, channel) DO NOTHING
  `, params);
}

async function acquireLease({ entityId, automationKey, channel, db }) {
  const leaseToken = randomUUID();
  const row = await db.get(`
    /* automation-delivery:claim */
    UPDATE automation_deliveries
       SET status = 'processing',
           lease_token = $5,
           lease_expires_at = NOW() + ($6 * INTERVAL '1 second'),
           attempt_count = attempt_count + 1,
           last_attempt_at = NOW(),
           last_error_code = NULL,
           updated_at = NOW()
     WHERE entity_type = $1
       AND entity_id = $2
       AND automation_key = $3
       AND channel = $4
       AND (
         (status = 'pending' AND next_attempt_at <= NOW())
         OR (status = 'processing' AND lease_expires_at <= NOW())
       )
    RETURNING *
  `, [ENTITY_TYPE, String(entityId), automationKey, channel, leaseToken, LEASE_SECONDS]);
  return row ? { ...row, lease_token: leaseToken } : null;
}

async function getDeliveryState({ entityId, automationKey, channel, db }) {
  return db.get(`
    /* automation-delivery:state */
    SELECT status, next_attempt_at, lease_expires_at
      FROM automation_deliveries
     WHERE entity_type = $1 AND entity_id = $2 AND automation_key = $3 AND channel = $4
  `, [ENTITY_TYPE, String(entityId), automationKey, channel]);
}

async function markSent(row, providerMessageId, db) {
  const result = await db.run(`
    /* automation-delivery:sent */
    UPDATE automation_deliveries
       SET status = 'sent', sent_at = NOW(), provider_message_id = $3,
           lease_token = NULL, lease_expires_at = NULL, last_error_code = NULL,
           updated_at = NOW()
     WHERE id = $1 AND status = 'processing' AND lease_token = $2
  `, [row.id, row.lease_token, providerMessageId || null]);
  return (result?.rowCount ?? result?.changes ?? 0) === 1;
}

async function releaseForRetry(row, errorCode, db) {
  await db.run(`
    /* automation-delivery:retry */
    UPDATE automation_deliveries
       SET status = 'pending',
           next_attempt_at = NOW() + ($3 * INTERVAL '1 second'),
           lease_token = NULL,
           lease_expires_at = NULL,
           last_error_code = $4,
           updated_at = NOW()
     WHERE id = $1 AND status = 'processing' AND lease_token = $2
  `, [row.id, row.lease_token, RETRY_SECONDS, errorCode]);
}

async function isBatchComplete({ entityId, automationKey, db }) {
  const counts = await db.get(`
    /* automation-delivery:complete */
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'sent')::int AS sent
      FROM automation_deliveries
     WHERE entity_type = $1 AND entity_id = $2 AND automation_key = $3
  `, [ENTITY_TYPE, String(entityId), automationKey]);
  return Number(counts?.total) > 0 && Number(counts.total) === Number(counts.sent);
}

async function finalizeLegacyMarker({ entityId, automationKey, legacyColumn, db }) {
  assertLegacyColumn(legacyColumn);
  if (!await isBatchComplete({ entityId, automationKey, db })) return false;
  const result = await db.run(`
    /* automation-delivery:finalize */
    UPDATE reservations
       SET ${legacyColumn} = COALESCE(${legacyColumn}, NOW())
     WHERE id = $1 AND ${legacyColumn} IS NULL
  `, [entityId]);
  return (result?.rowCount ?? result?.changes ?? 0) <= 1;
}

function safeErrorCode(error, providerResult) {
  if (providerResult && providerResult.success === false) return 'PROVIDER_REJECTED';
  if (providerResult && providerResult.ok === false) return 'PROVIDER_REJECTED';
  if (error?.name === 'AbortError') return 'PROVIDER_TIMEOUT';
  return 'PROVIDER_EXCEPTION';
}

function providerSucceeded(channel, result) {
  return channel === 'whatsapp' ? result?.ok === true : result?.success === true;
}

function providerMessageId(result) {
  return result?.messageId || result?.data?.id || result?.data?._id || null;
}

async function processDelivery({ entityId, automationKey, channel, dispatch, db }) {
  const claimed = await acquireLease({ entityId, automationKey, channel, db });
  if (!claimed) {
    const state = await getDeliveryState({ entityId, automationKey, channel, db });
    return { channel, sent: state?.status === 'sent', deferred: state?.status !== 'sent' };
  }

  let providerResult;
  try {
    providerResult = await dispatch(claimed);
    if (!providerSucceeded(channel, providerResult)) {
      const error = new Error('Provider rejected automation delivery');
      error.code = 'PROVIDER_REJECTED';
      throw error;
    }
    const saved = await markSent(claimed, providerMessageId(providerResult), db);
    if (!saved) throw new Error('Delivery lease was lost before completion');
    return { channel, sent: true, attempted: true };
  } catch (error) {
    await releaseForRetry(claimed, safeErrorCode(error, providerResult), db);
    return { channel, sent: false, attempted: true, failed: true, errorCode: safeErrorCode(error, providerResult) };
  }
}

export async function processAutomationBatch({
  entityId,
  automationKey,
  legacyColumn,
  deliveries = null,
  dispatch,
  db = databaseService,
}) {
  await db.initialize?.();
  assertLegacyColumn(legacyColumn);
  if (deliveries) {
    await prepareBatch({ entityId, automationKey, legacyColumn, deliveries, db });
  }

  const rows = deliveries || await db.all(`
    /* automation-delivery:batch */
    SELECT channel FROM automation_deliveries
     WHERE entity_type = $1 AND entity_id = $2 AND automation_key = $3
     ORDER BY id ASC
  `, [ENTITY_TYPE, String(entityId), automationKey]);

  const outcomes = [];
  for (const delivery of rows) {
    outcomes.push(await processDelivery({
      entityId, automationKey, channel: delivery.channel, dispatch, db,
    }));
  }

  const complete = await isBatchComplete({ entityId, automationKey, db });
  if (complete) {
    await finalizeLegacyMarker({ entityId, automationKey, legacyColumn, db });
  }
  return {
    complete,
    outcomes,
    failed: outcomes.some(outcome => outcome.failed),
    attempted: outcomes.some(outcome => outcome.attempted),
  };
}

export async function findDueAutomationBatches({ db = databaseService, limit = 50 } = {}) {
  await db.initialize?.();
  return db.all(`
    /* automation-delivery:due */
    SELECT DISTINCT entity_id, automation_key, legacy_column
      FROM automation_deliveries
     WHERE entity_type = $1
       AND (
         (status = 'pending' AND next_attempt_at <= NOW())
         OR (status = 'processing' AND lease_expires_at <= NOW())
       )
     ORDER BY entity_id, automation_key
     LIMIT $2
  `, [ENTITY_TYPE, limit]);
}

export const AUTOMATION_DELIVERY_TIMING = Object.freeze({
  leaseSeconds: LEASE_SECONDS,
  retrySeconds: RETRY_SECONDS,
});
