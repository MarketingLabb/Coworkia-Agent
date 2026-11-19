import { describe, expect, jest, test } from '@jest/globals';

// La BD real nunca se toca: los tests inyectan un repositorio en memoria.
jest.unstable_mockModule('../../src/database/database.js', () => ({ default: {} }));

const {
  decideStep, pickCurrentMemberships, parseSnoozeDate, classifyRenewalReply,
  buildWhatsAppMessage, computeExpiry, isExcludedPhone, todayEC,
} = await import('../../src/servicios/aluna-renewal/renewal-rules.js');
const { processRenewalSequence, handleRenewalReply, renewalAmount } = await import('../../src/servicios/aluna-renewal/renewal-sequence.js');

// Hora fija: 10:00 Ecuador = 15:00 UTC
const at = (isoDate, hhmm = '10:00') => new Date(`${isoDate}T${hhmm}:00-05:00`);

// ─── BD en memoria con la misma semántica de candado que PostgreSQL ──────────
function createFakeRepo({ candidates = [], inbound = [], otherAutomated = false, inReview = false } = {}) {
  const notifications = new Map(); // key → row
  const prefs = new Map();
  const leads = [];
  let seq = 1;
  const key = (p, c, s, ch) => [p, c, s, ch].join('|');
  const clock = { now: new Date() };

  return {
    notifications, prefs, leads, clock, inbound,
    async findRenewalCandidates() { return candidates; },
    async getCycleHistory(phoneKey, cycleEnd) {
      const h = {};
      for (const row of notifications.values()) {
        if (row.phone_key === phoneKey && row.cycle_end === cycleEnd && row.channel === 'whatsapp' && row.status !== 'failed') h[row.step] = row;
      }
      return h;
    },
    async claimNotification({ phoneKey, userPhone, cycleEnd, step, channel, message }) {
      const k = key(phoneKey, cycleEnd, step, channel);
      const existing = notifications.get(k);
      if (existing && !(existing.status === 'failed' && existing.attempts < 3)) return null;
      const row = existing || { id: seq++, phone_key: phoneKey, user_phone: userPhone, cycle_end: cycleEnd, step, channel, attempts: 0 };
      Object.assign(row, { status: 'claimed', attempts: row.attempts + 1, message });
      notifications.set(k, row);
      return row.id;
    },
    async finishNotification(id, status, error) {
      for (const row of notifications.values()) {
        if (row.id === id) Object.assign(row, { status, error, sent_at: status === 'sent' ? new Date(clock.now) : row.sent_at });
      }
    },
    async skipStep(args) {
      const id = await this.claimNotification({ ...args, channel: 'whatsapp' });
      if (id) await this.finishNotification(id, 'skipped', args.reason);
      return !!id;
    },
    async getLatestRenewalContact(phoneKey) {
      const sent = [...notifications.values()]
        .filter(r => r.phone_key === phoneKey && r.channel === 'whatsapp' && r.status === 'sent')
        .sort((a, b) => b.sent_at - a.sent_at);
      return sent[0] ? { ...sent[0] } : null;
    },
    async getPrefs(phoneKey) { return prefs.get(phoneKey) || null; },
    async upsertPrefs(phoneKey, userPhone, fields) {
      prefs.set(phoneKey, { ...(prefs.get(phoneKey) || { phone_key: phoneKey, user_phone: userPhone }), ...fields });
    },
    async hasInboundSince(phoneKey, since) {
      return inbound.some(m => m.phoneKey === phoneKey && m.at >= new Date(since));
    },
    async hadOtherAutomatedContact() { return otherAutomated; },
    async hasPaymentInReviewSince() { return inReview; },
    async findPendingRenewalLead(userPhone) { return leads.find(l => l.user_phone === userPhone && l.status === 'pending_payment') || null; },
    async getLeadById() { return null; },
    async cancelLead(id) { const l = leads.find(x => x.id === id); if (l) l.status = 'cancelled'; },
    async nextMembershipCode() { return `ALU-${String(leads.length + 1).padStart(4, '0')}`; },
    async countDiscountedRenewalsSince() { return 0; },
    async insertRenewalLead(lead) {
      leads.push({ id: lead.id, renewal_of_lead_id: lead.renewalOfLeadId, user_phone: lead.userPhone, membership_type: lead.membershipType, status: 'pending_payment', renewal_discount_pct: lead.discountPct || null, monthly_fee: lead.monthlyFee });
    },
    async logRenewalInteraction() {},
  };
}

function diegoCandidates() {
  // Mismo número con 3 leads (pruebas + membresía real) en distintos formatos
  return [
    { id: 'L1', user_phone: '+593987423072', membership_type: 'Plan 20', client_name: 'Diego Villota', last_payment_date: '2026-10-10', lead_created_at: '2026-10-10' },
    { id: 'L2', user_phone: '0987423072', membership_type: 'Plan 20', client_name: 'Diego Villota', last_payment_date: '2026-10-14', lead_created_at: '2026-10-14' },
    { id: 'L3', user_phone: '593987423072', membership_type: 'Plan 10', client_name: 'Diego', last_payment_date: '2026-10-01', lead_created_at: '2026-10-01' },
  ];
}

async function runDays(repo, fromIso, days, { times = ['09:00', '09:10', '09:20', '13:00', '19:50'], sent = [] } = {}) {
  for (let d = 0; d < days; d++) {
    const day = new Date(`${fromIso}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + d);
    const iso = day.toISOString().slice(0, 10);
    for (const hhmm of times) {
      const now = at(iso, hhmm);
      repo.clock.now = now;
      await processRenewalSequence({
        db: {}, now,
        deps: { repo, pauseMs: 0, excludedPhones: '', startDate: '2000-01-01', sendWhatsApp: async (phone, message) => { sent.push({ phone, message, at: iso, hhmm }); return { status: 'sent' }; } },
      });
    }
  }
  return sent;
}

describe('reglas de renovación', () => {
  test('varios leads del mismo número = una sola membresía vigente (la del último pago)', () => {
    const current = pickCurrentMemberships(diegoCandidates());
    expect(current).toHaveLength(1);
    expect(current[0].id).toBe('L2');
    expect(current[0].expiry_date).toBe('2026-11-13');
  });

  test('Oficina Virtual es anual y planes no recurrentes no se recuerdan', () => {
    expect(computeExpiry('2026-01-10', 'Oficina Virtual')).toBe('2027-01-10');
    expect(computeExpiry('2026-01-10', 'consulta-inicial')).toBeNull();
  });

  test('ventanas: D-3, link solo 8 min después, D-1, D+1, D+5 y nada fuera de ventana', () => {
    const expiry = '2026-11-20';
    expect(decideStep({ today: '2026-11-16', expiry })).toEqual({ skip: 'nothing_due' });
    expect(decideStep({ today: '2026-11-17', expiry })).toEqual({ step: 'd3_offer' });
    const sentAt = at('2026-11-17', '09:00');
    const history = { d3_offer: { status: 'sent', sent_at: sentAt } };
    expect(decideStep({ today: '2026-11-17', now: at('2026-11-17', '09:05'), expiry, history })).toEqual({ skip: 'nothing_due' });
    expect(decideStep({ today: '2026-11-17', now: at('2026-11-17', '09:10'), expiry, history })).toEqual({ step: 'd3_link' });
    expect(decideStep({ today: '2026-11-19', expiry })).toEqual({ step: 'd1' });
    expect(decideStep({ today: '2026-11-21', expiry })).toEqual({ step: 'dp1' });
    expect(decideStep({ today: '2026-11-25', expiry })).toEqual({ step: 'dp5' });
    expect(decideStep({ today: '2026-11-30', expiry })).toEqual({ skip: 'nothing_due' });
  });

  test('respeta opt-out, "no voy a renovar" y "renuevo el X"', () => {
    const expiry = '2026-11-20';
    expect(decideStep({ today: '2026-11-19', expiry, prefs: { opted_out_at: '2026-11-17' } })).toEqual({ skip: 'opted_out' });
    expect(decideStep({ today: '2026-11-21', expiry, prefs: { declined_cycle_end: expiry } })).toEqual({ skip: 'declined' });
    const prefs = { snooze_until: '2026-11-22', snooze_cycle_end: expiry };
    expect(decideStep({ today: '2026-11-19', expiry, prefs })).toEqual({ skip: 'snoozed' });
    expect(decideStep({ today: '2026-11-22', expiry, prefs })).toEqual({ step: 'snooze' });
  });

  test('el mensaje dice los días reales que faltan', () => {
    const msg = buildWhatsAppMessage('d3_offer', { name: 'Diego Villota', plan: 'Plan 20', expiry: '2026-11-20', today: '2026-11-18' });
    expect(msg).toContain('Hola Diego');
    expect(msg).toContain('en 2 días');
    expect(msg).not.toContain('5 días');
  });

  test('interpreta fechas para posponer', () => {
    const today = '2026-11-18'; // miércoles
    expect(parseSnoozeDate('renuevo el 25', today)).toBe('2026-11-25');
    expect(parseSnoozeDate('te pago el viernes', today)).toBe('2026-11-20');
    expect(parseSnoozeDate('mañana te transfiero', today)).toBe('2026-11-19');
    expect(parseSnoozeDate('la próxima semana', today)).toBe('2026-11-23');
    expect(parseSnoozeDate('en 3 días', today)).toBe('2026-11-21');
    expect(parseSnoozeDate('a fin de mes', today)).toBe('2026-11-30');
    expect(parseSnoozeDate('el 5 de diciembre', today)).toBe('2026-12-05');
    expect(parseSnoozeDate('el 10', today)).toBe('2026-12-10');
    expect(parseSnoozeDate('hola', today)).toBeNull();
  });

  test('clasifica respuestas', () => {
    const today = '2026-11-18';
    expect(classifyRenewalReply('Sí, prepárala', today)).toEqual({ type: 'renew' });
    expect(classifyRenewalReply('dale', today)).toEqual({ type: 'renew' });
    expect(classifyRenewalReply('pásame el link de pago', today)).toEqual({ type: 'renew' });
    expect(classifyRenewalReply('Renuevo el 25, ahora estoy corto', today)).toEqual({ type: 'snooze', date: '2026-11-25' });
    expect(classifyRenewalReply('No voy a renovar este mes', today)).toEqual({ type: 'decline' });
    expect(classifyRenewalReply('por favor no me escribas más', today)).toEqual({ type: 'optout' });
    expect(classifyRenewalReply('¿tienen sala de reuniones libre mañana?', today)).toBeNull();
  });

  test('lista de números internos/excluidos', () => {
    expect(isExcludedPhone('0987423072', '+593987423072,+593999000111')).toBe(true);
    expect(isExcludedPhone('0987000000', '+593987423072')).toBe(false);
  });

  test('montos con descuento de recuperación', () => {
    expect(renewalAmount('Plan 20')).toBe(250);
    expect(renewalAmount('Plan 20', 10)).toBe(225);
    expect(renewalAmount('Plan 10', 10)).toBe(162);
  });

  test('todayEC usa hora de Ecuador', () => {
    expect(todayEC(new Date('2026-11-19T03:00:00Z'))).toBe('2026-11-18');
  });
});

describe('secuencia completa (anti-duplicados)', () => {
  test('caso Diego: 3 leads y el cron cada 10 min → cada paso sale UNA sola vez', async () => {
    const repo = createFakeRepo({ candidates: diegoCandidates() });
    // vence 2026-11-13: simulamos del 8 al 22 de noviembre
    const sent = await runDays(repo, '2026-11-08', 15);
    const steps = [...repo.notifications.values()].filter(r => r.channel === 'whatsapp' && r.status === 'sent').map(r => r.step);
    expect(steps.sort()).toEqual(['d1', 'd3_link', 'd3_offer', 'dp1', 'dp5']);
    expect(sent).toHaveLength(5);
    // D-3 en dos mensajes, el link 8+ minutos después
    expect(sent[0]).toMatchObject({ at: '2026-11-10', hhmm: '09:00' });
    expect(sent[1]).toMatchObject({ at: '2026-11-10', hhmm: '09:10' });
    expect(sent[1].message).toContain('Payphone');
    expect(sent[1].message).toContain('$250');
    // se creó un lead pendiente de pago para que el comprobante se valide solo
    expect(repo.leads.filter(l => l.status === 'pending_payment')).toHaveLength(1);
    expect(sent[4].message).toContain('10% de descuento durante 3 meses');
  });

  test('si Wassenger no confirma (timeout) NO se reintenta', async () => {
    const repo = createFakeRepo({ candidates: diegoCandidates() });
    let calls = 0;
    for (const hhmm of ['09:00', '09:10', '09:20']) {
      const now = at('2026-11-10', hhmm);
      repo.clock.now = now;
      await processRenewalSequence({ db: {}, now, deps: { repo, pauseMs: 0, excludedPhones: '', startDate: '2000-01-01', sendWhatsApp: async () => { calls++; return { status: 'unknown', error: 'TIMEOUT' }; } } });
    }
    expect(calls).toBe(1);
  });

  test('si Wassenger rechaza (4xx) se reintenta como máximo 3 veces', async () => {
    const repo = createFakeRepo({ candidates: diegoCandidates() });
    let calls = 0;
    for (const hhmm of ['09:00', '09:10', '09:20', '09:30', '09:40']) {
      const now = at('2026-11-10', hhmm);
      repo.clock.now = now;
      await processRenewalSequence({ db: {}, now, deps: { repo, pauseMs: 0, excludedPhones: '', startDate: '2000-01-01', sendWhatsApp: async () => { calls++; return { status: 'failed', error: 'HTTP_400' }; } } });
    }
    expect(calls).toBe(3);
  });

  test('si el cliente respondió al primer mensaje, no se manda el link automático', async () => {
    const repo = createFakeRepo({ candidates: diegoCandidates() });
    const sent = [];
    await runDays(repo, '2026-11-10', 1, { times: ['09:00'], sent });
    repo.inbound.push({ phoneKey: '987423072', at: at('2026-11-10', '09:03') });
    await runDays(repo, '2026-11-10', 1, { times: ['09:10', '09:20'], sent });
    expect(sent.map(s => s.message)).toHaveLength(1);
  });

  test('número excluido (interno/pruebas) no recibe nada', async () => {
    const repo = createFakeRepo({ candidates: diegoCandidates() });
    const now = at('2026-11-10', '09:00');
    const res = await processRenewalSequence({ db: {}, now, deps: { repo, pauseMs: 0, excludedPhones: '0987423072', startDate: '2000-01-01', sendWhatsApp: async () => ({ status: 'sent' }) } });
    expect(res.sent).toBe(0);
  });

  test('si ya mandó su comprobante (en revisión), se detiene', async () => {
    const repo = createFakeRepo({ candidates: diegoCandidates(), inReview: true });
    const sent = await runDays(repo, '2026-11-08', 15);
    expect(sent).toHaveLength(0);
  });

  test('fuera de horario (antes de 9:00 o después de 19:59) no envía', async () => {
    const repo = createFakeRepo({ candidates: diegoCandidates() });
    const res = await processRenewalSequence({ db: {}, now: at('2026-11-10', '07:30'), deps: { repo, pauseMs: 0, startDate: '2000-01-01', sendWhatsApp: async () => ({ status: 'sent' }) } });
    expect(res.outsideHours).toBe(true);
  });
});

describe('solo clientes afiliados desde la fecha de inicio', () => {
  test('clientes anteriores al 2026-11-19 no reciben automatizaciones', async () => {
    const repo = createFakeRepo({ candidates: diegoCandidates() });
    let calls = 0;
    const now = at('2026-11-10', '09:00');
    await processRenewalSequence({ db: {}, now, deps: { repo, pauseMs: 0, excludedPhones: '', sendWhatsApp: async () => { calls++; return { status: 'sent' }; } } });
    expect(calls).toBe(0);
  });

  test('un cliente afiliado desde el 2026-11-19 sí entra en la secuencia', async () => {
    const repo = createFakeRepo({ candidates: [
      { id: 'N1', user_phone: '+593987770788', membership_type: 'Plan 20', client_name: 'Nuevo', last_payment_date: '2026-11-20', first_payment_date: '2026-11-20' },
    ] });
    let calls = 0;
    const now = at('2026-12-17', '09:00'); // vence 2026-12-20 → D-3
    await processRenewalSequence({ db: {}, now, deps: { repo, pauseMs: 0, excludedPhones: '', sendWhatsApp: async () => { calls++; return { status: 'sent' }; } } });
    expect(calls).toBe(1);
  });
});

describe('respuestas del cliente', () => {
  async function afterOffer() {
    const repo = createFakeRepo({ candidates: diegoCandidates() });
    await runDays(repo, '2026-11-10', 1, { times: ['09:00'] });
    return repo;
  }

  test('"renuevo el 25" pospone y ese día le llega el link', async () => {
    const repo = await afterOffer();
    const res = await handleRenewalReply({ userId: '+593987423072', text: 'Renuevo el 12, ahora no puedo', db: {}, now: at('2026-11-10', '09:05'), deps: { repo, startDate: '2000-01-01' } });
    expect(res.type).toBe('snooze');
    expect(res.reply).toContain('jueves 12 de noviembre');
    repo.inbound.push({ phoneKey: '987423072', at: at('2026-11-10', '09:05') });
    const sent = await runDays(repo, '2026-11-10', 3);
    expect(sent).toHaveLength(1);
    expect(sent[0].at).toBe('2026-11-12');
    expect(sent[0].message).toContain('Como quedamos');
  });

  test('"sí" envía el link al instante y evita el link automático', async () => {
    const repo = await afterOffer();
    const res = await handleRenewalReply({ userId: '0987423072', text: 'sí', db: {}, now: at('2026-11-10', '09:04'), deps: { repo, startDate: '2000-01-01' } });
    expect(res.type).toBe('renew');
    expect(res.reply).toContain('Payphone');
    repo.inbound.push({ phoneKey: '987423072', at: at('2026-11-10', '09:04') });
    const sent = await runDays(repo, '2026-11-10', 1, { times: ['09:10', '09:20'] });
    expect(sent).toHaveLength(0);
  });

  test('"no me escribas más" detiene todo', async () => {
    const repo = await afterOffer();
    const res = await handleRenewalReply({ userId: '+593987423072', text: 'no me escribas más por favor', db: {}, now: at('2026-11-10', '11:00'), deps: { repo, startDate: '2000-01-01' } });
    expect(res.type).toBe('optout');
    const sent = await runDays(repo, '2026-11-11', 12);
    expect(sent).toHaveLength(0);
  });

  test('sin aviso de renovación reciente, el mensaje sigue el flujo normal', async () => {
    const repo = createFakeRepo({ candidates: diegoCandidates() });
    const res = await handleRenewalReply({ userId: '+593987423072', text: 'sí', db: {}, now: at('2026-11-10', '09:05'), deps: { repo, startDate: '2000-01-01' } });
    expect(res).toBeNull();
  });

  test('D+5: al decir "sí" se aplica el 10% en el lead de renovación', async () => {
    const repo = createFakeRepo({ candidates: diegoCandidates() });
    repo.prefs.set('987423072', { declined_cycle_end: null });
    const sent = await runDays(repo, '2026-11-18', 1, { times: ['09:00'] });
    expect(sent[0].message).toContain('10% de descuento');
    const res = await handleRenewalReply({ userId: '+593987423072', text: 'sí, lo tomo', db: {}, now: at('2026-11-18', '10:00'), deps: { repo, startDate: '2000-01-01' } });
    expect(res.reply).toContain('$225');
    expect(repo.leads[0].renewal_discount_pct).toBe(10);
  });
});
