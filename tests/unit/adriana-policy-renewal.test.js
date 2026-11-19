import { describe, expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../../src/database/database.js', () => ({ default: {} }));

const {
  dueStep, buildWA, buildEmail, waStatus, processPolicyRenewals, addOneYear,
} = await import('../../src/servicios/adriana-policy-renewal.js');

const at = (iso, hhmm = '10:20') => new Date(`${iso}T${hhmm}:00-05:00`);

function fakeRepo(policies) {
  const rows = new Map();
  let seq = 1;
  return {
    rows,
    async findPoliciesEndingSoon() { return policies; },
    async sentSteps(db, leadId, endDate) {
      return new Set([...rows.values()].filter(r => r.leadId === leadId && r.endDate === endDate && r.channel === 'whatsapp' && r.status !== 'failed').map(r => r.step));
    },
    async claim(db, { leadId, endDate, step, channel }) {
      const k = [leadId, endDate, step, channel].join('|');
      const ex = rows.get(k);
      if (ex && !(ex.status === 'failed' && ex.attempts < 3)) return null;
      const row = ex || { id: seq++, leadId, endDate, step, channel, attempts: 0 };
      Object.assign(row, { status: 'claimed', attempts: row.attempts + 1 });
      rows.set(k, row);
      return row.id;
    },
    async finish(db, id, status) { for (const r of rows.values()) if (r.id === id) r.status = status; },
  };
}

const policy = {
  id: 'L1', quote_code: 'ADR-0001', client_name: 'Diego Villota', phone: '+593987770788', email: 'diego@example.com',
  vehicle_brand: 'Kia', vehicle_model: 'Sportage', vehicle_year: 2022, policy_number: 'VAZ-123', policy_end_date: '2026-12-31',
};

async function runDays(repo, fromIso, days, out) {
  for (let i = 0; i < days; i++) {
    const d = new Date(`${fromIso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    for (const hhmm of ['10:20', '15:00']) {
      await processPolicyRenewals({ db: {}, now: at(iso, hhmm), deps: {
        repo, pauseMs: 0, fromInfo: { AGENT_FROM_NAMES: {}, ADRIANA_FROM_EMAIL: 'x@y.z' },
        sendWhatsApp: async (phone, msg) => { out.wa.push({ iso, msg }); return { ok: true }; },
        sendEmail: async (opts) => { out.mail.push({ iso, subject: opts.subject }); return { success: true }; },
      } });
    }
  }
}

describe('renovación de pólizas — reglas', () => {
  test('ventanas D-30, D-15, D-7', () => {
    expect(dueStep('2026-11-30', '2026-12-31')).toBeNull();      // D-31
    expect(dueStep('2026-12-01', '2026-12-31')).toBe('r30');     // D-30
    expect(dueStep('2026-12-16', '2026-12-31')).toBe('r15');     // D-15
    expect(dueStep('2026-12-24', '2026-12-31')).toBe('r7');      // D-7
    expect(dueStep('2026-12-31', '2026-12-31')).toBeNull();      // vence hoy: fuera
    expect(dueStep('2026-12-24', '2026-12-31', new Set(['r7']))).toBeNull();
  });

  test('vigencia por defecto de 1 año', () => {
    expect(addOneYear('2026-11-19')).toBe('2027-11-19');
  });

  test('mensajes con fecha y días reales, sin urgencia inventada', () => {
    const wa = buildWA('r7', policy, '2026-12-24');
    expect(wa).toContain('7 días');
    expect(wa).toContain('31 de diciembre de 2026');
    expect(wa).toContain('VAZ-123');
    expect(wa).not.toContain('12%');
    const mail = buildEmail('r30', policy, '2026-12-01');
    expect(mail.subject).toContain('31 de diciembre de 2026');
    expect(mail.html).toContain('#1E3A8A'); // mismo layout SegPopular
  });

  test('estado del envío de WhatsApp', () => {
    expect(waStatus({ ok: true })).toEqual({ status: 'sent' });
    expect(waStatus({ ok: false, error: 'timeout' })).toEqual({ status: 'unknown', error: 'timeout' });
    expect(waStatus({ ok: false, data: {} })).toEqual({ status: 'failed', error: 'REJECTED' });
  });
});

describe('renovación de pólizas — anti-duplicados', () => {
  test('en 40 días con 2 corridas diarias sale cada aviso UNA sola vez', async () => {
    const repo = fakeRepo([policy]);
    const out = { wa: [], mail: [] };
    await runDays(repo, '2026-11-25', 40, out);
    expect(out.wa.map(m => m.iso)).toEqual(['2026-12-01', '2026-12-16', '2026-12-24']);
    expect(out.mail).toHaveLength(3);
  });

  test('si WhatsApp no confirma (timeout) no se reintenta', async () => {
    const repo = fakeRepo([policy]);
    let calls = 0;
    for (const hhmm of ['10:20', '11:00', '12:00']) {
      await processPolicyRenewals({ db: {}, now: at('2026-12-01', hhmm), deps: {
        repo, pauseMs: 0, fromInfo: { AGENT_FROM_NAMES: {}, ADRIANA_FROM_EMAIL: 'x@y.z' },
        sendWhatsApp: async () => { calls++; return { ok: false, error: 'timeout' }; },
        sendEmail: async () => ({ success: true }),
      } });
    }
    expect(calls).toBe(1);
  });
});
