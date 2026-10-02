import { describe, expect, jest, test } from '@jest/globals';
import { processAutomationBatch } from '../../src/servicios/automation-delivery-service.js';

function createMemoryDeliveryDb() {
  let now = Date.parse('2026-10-01T12:00:00Z');
  let sequence = 1;
  const rows = new Map();
  const markers = new Set();
  const keyFor = (entityType, entityId, automationKey, channel) =>
    [entityType, entityId, automationKey, channel].join('|');

  return {
    rows,
    markers,
    advance(ms) { now += ms; },
    expireLease(entityId, automationKey, channel) {
      const row = rows.get(keyFor('reservation', String(entityId), automationKey, channel));
      row.status = 'processing';
      row.lease_expires_at = new Date(now - 1);
    },
    async initialize() {},
    async run(sql, params = []) {
      const query = String(sql);
      if (query.includes('automation-delivery:prepare')) {
        for (let index = 0; index < params.length; index += 7) {
          const [entityType, entityId, automationKey, channel, recipient, payload, legacyColumn] = params.slice(index, index + 7);
          const key = keyFor(entityType, entityId, automationKey, channel);
          if (!rows.has(key)) {
            rows.set(key, {
              id: sequence++, entity_type: entityType, entity_id: entityId,
              automation_key: automationKey, channel, recipient,
              payload: JSON.parse(payload), legacy_column: legacyColumn,
              status: 'pending', attempt_count: 0,
              next_attempt_at: new Date(now), lease_expires_at: null,
            });
          }
        }
        return { changes: params.length / 7 };
      }
      if (query.includes('automation-delivery:sent')) {
        const row = [...rows.values()].find(item => item.id === params[0]);
        if (!row || row.status !== 'processing' || row.lease_token !== params[1]) return { changes: 0 };
        Object.assign(row, { status: 'sent', sent_at: new Date(now), provider_message_id: params[2], lease_token: null, lease_expires_at: null, last_error_code: null });
        return { changes: 1 };
      }
      if (query.includes('automation-delivery:retry')) {
        const row = [...rows.values()].find(item => item.id === params[0]);
        if (!row || row.status !== 'processing' || row.lease_token !== params[1]) return { changes: 0 };
        Object.assign(row, { status: 'pending', next_attempt_at: new Date(now + params[2] * 1000), lease_token: null, lease_expires_at: null, last_error_code: params[3] });
        return { changes: 1 };
      }
      if (query.includes('automation-delivery:finalize')) {
        const before = markers.size;
        markers.add(String(params[0]));
        return { changes: markers.size > before ? 1 : 0 };
      }
      throw new Error(`Unexpected run query: ${query}`);
    },
    async get(sql, params = []) {
      const query = String(sql);
      if (query.includes('automation-delivery:claim')) {
        const [entityType, entityId, automationKey, channel, leaseToken, leaseSeconds] = params;
        const row = rows.get(keyFor(entityType, entityId, automationKey, channel));
        const due = row?.status === 'pending' && row.next_attempt_at.getTime() <= now;
        const expired = row?.status === 'processing' && row.lease_expires_at.getTime() <= now;
        if (!row || (!due && !expired)) return undefined;
        Object.assign(row, {
          status: 'processing', lease_token: leaseToken,
          lease_expires_at: new Date(now + leaseSeconds * 1000),
          attempt_count: row.attempt_count + 1, last_error_code: null,
        });
        return { ...row };
      }
      if (query.includes('automation-delivery:state')) {
        const row = rows.get(keyFor(...params));
        return row ? { ...row } : undefined;
      }
      if (query.includes('automation-delivery:complete')) {
        const [entityType, entityId, automationKey] = params;
        const batch = [...rows.values()].filter(row => row.entity_type === entityType && row.entity_id === entityId && row.automation_key === automationKey);
        return { total: batch.length, sent: batch.filter(row => row.status === 'sent').length };
      }
      throw new Error(`Unexpected get query: ${query}`);
    },
    async all(sql, params = []) {
      const query = String(sql);
      if (query.includes('automation-delivery:batch')) {
        const [entityType, entityId, automationKey] = params;
        return [...rows.values()].filter(row => row.entity_type === entityType && row.entity_id === entityId && row.automation_key === automationKey);
      }
      return [];
    },
  };
}

const whatsapp = recipient => ({ channel: 'whatsapp', recipient, payload: { recipient, message: 'Hola' } });
const email = recipient => ({ channel: 'email', recipient, payload: { to: recipient, subject: 'Coworkia', html: '<p>Hola</p>', agent: 'aurora' } });

describe('outbox de automatizaciones Aurora', () => {
  test('dos workers concurrentes realizan una sola entrega y una sola finalización', async () => {
    const db = createMemoryDeliveryDb();
    const dispatch = jest.fn(async () => ({ ok: true, data: { id: 'WA-1' } }));
    const input = {
      entityId: 'R-1', automationKey: 'aurora_d1', legacyColumn: 'followup_d1_sent_at',
      deliveries: [whatsapp('+593991111111')], dispatch, db,
    };

    const results = await Promise.all([processAutomationBatch(input), processAutomationBatch(input)]);

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(results.some(result => result.complete)).toBe(true);
    expect(db.rows.values().next().value).toMatchObject({ status: 'sent', attempt_count: 1 });
    expect(db.markers).toEqual(new Set(['R-1']));
  });

  test('un fallo de email no lo marca enviado ni reenvía WhatsApp; reintenta tras backoff', async () => {
    const db = createMemoryDeliveryDb();
    const dispatch = jest.fn(async row => row.channel === 'whatsapp'
      ? { ok: true, data: { id: 'WA-2' } }
      : { success: false });
    const input = {
      entityId: 'R-2', automationKey: 'aurora_d3', legacyColumn: 'followup_d3_sent_at',
      deliveries: [whatsapp('+593992222222'), email('cliente@example.com')], dispatch, db,
    };

    const failed = await processAutomationBatch(input);
    expect(failed).toMatchObject({ complete: false, failed: true });
    expect(db.markers.size).toBe(0);
    expect([...db.rows.values()].find(row => row.channel === 'email')).toMatchObject({ status: 'pending', last_error_code: 'PROVIDER_REJECTED' });

    await processAutomationBatch(input);
    expect(dispatch).toHaveBeenCalledTimes(2);

    db.advance(15 * 60 * 1000 + 1);
    dispatch.mockImplementation(async row => row.channel === 'email'
      ? { success: true, messageId: 'MAIL-1' }
      : { ok: true });
    const retried = await processAutomationBatch(input);

    expect(retried.complete).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch.mock.calls.filter(([row]) => row.channel === 'whatsapp')).toHaveLength(1);
    expect(db.markers).toEqual(new Set(['R-2']));
  });

  test('un lease vencido se recupera y conserva la trazabilidad de intentos', async () => {
    const db = createMemoryDeliveryDb();
    const firstDispatch = jest.fn(async () => ({ ok: false }));
    const input = {
      entityId: 'R-3', automationKey: 'aurora_24h', legacyColumn: 'reminder_24h_sent_at',
      deliveries: [whatsapp('+593993333333')], dispatch: firstDispatch, db,
    };
    await processAutomationBatch(input);
    db.expireLease('R-3', 'aurora_24h', 'whatsapp');

    const recoveryDispatch = jest.fn(async () => ({ ok: true, data: { id: 'WA-3' } }));
    const recovered = await processAutomationBatch({ ...input, dispatch: recoveryDispatch });

    expect(recovered.complete).toBe(true);
    expect(recoveryDispatch).toHaveBeenCalledTimes(1);
    expect(db.rows.values().next().value).toMatchObject({ status: 'sent', attempt_count: 2 });
  });
});
