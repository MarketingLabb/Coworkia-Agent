/**
 * 🧪 TESTS — Botones de Acción Dashboard (send-wa, send-reminder, send-followup, send-comparison)
 *
 * Covers every "action button" in all dashboards.
 * DB is mocked to return real-looking leads so the full handler logic runs.
 * Wassenger & email are mocked — no real messages sent.
 */

import { describe, beforeAll, it, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ─── Mock DB ─────────────────────────────────────────────────────────────────
const mockDB = {
  initialize: jest.fn().mockResolvedValue(undefined),
  ensureInitialized: jest.fn().mockResolvedValue(undefined),
  all:  jest.fn().mockResolvedValue([]),
  get:  jest.fn().mockResolvedValue(null),
  run:  jest.fn().mockResolvedValue({ rowCount: 1, changes: 1 }),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.unstable_mockModule('../../src/database/database.js', () => ({ default: mockDB }));

// ─── Mock user memory ────────────────────────────────────────────────────────
jest.unstable_mockModule('../../src/perfiles-interacciones/memoria-sqlite.js', () => ({
  getUserPreferredLanguage: jest.fn().mockResolvedValue('es'),
}));

// ─── Mock Wassenger ───────────────────────────────────────────────────────────
const mockEnviarWhatsApp = jest.fn().mockResolvedValue({ ok: true });
jest.unstable_mockModule('../../src/express-servidor/endpoints-api/wassenger.js', () => ({
  enviarWhatsApp: mockEnviarWhatsApp,
}));

// ─── Mock Email ───────────────────────────────────────────────────────────────
const mockSendEmail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
jest.unstable_mockModule('../../src/servicios/email.js', () => ({
  sendEmail: mockSendEmail,
  getAdminCC: jest.fn(() => []),
  DEFAULT_FROM_EMAIL: 'test@coworkia.com',
  AGENT_FROM_NAMES: { adriana: 'Adriana · SegPopular', aluna: 'Aluna · Coworkia' },
}));

// ─── Mock email-template-system ──────────────────────────────────────────────
jest.unstable_mockModule('../../src/servicios/email-template-system.js', () => ({
  buildEmailTemplate: jest.fn().mockReturnValue('<html>template</html>'),
}));

// ─── Mock aurora followup service (needed by aurora-dashboard) ───────────────
const mockSendOneHourFollowup = jest.fn().mockResolvedValue({ ok: true });
const mockSendRebookingReminder = jest.fn().mockResolvedValue({ ok: true });
jest.unstable_mockModule('../../src/servicios/aurora-followup-service.js', () => ({
  sendOneHourFollowup: mockSendOneHourFollowup,
  sendRebookingReminder: mockSendRebookingReminder,
}));

// ─── Mock auroraRepository ───────────────────────────────────────────────────
jest.unstable_mockModule('../../src/database/auroraRepository.js', () => ({
  savePartialReservation: jest.fn().mockResolvedValue(undefined),
  getPartialReservation: jest.fn().mockResolvedValue(null),
  clearPartialReservation: jest.fn().mockResolvedValue(undefined),
  cleanExpiredPartialReservations: jest.fn().mockResolvedValue(undefined),
  savePendingConfirmation: jest.fn().mockResolvedValue(undefined),
  getPendingConfirmation: jest.fn().mockResolvedValue(null),
  clearPendingConfirmation: jest.fn().mockResolvedValue(undefined),
  findReservationsForOneHourFollowup: jest.fn().mockResolvedValue([]),
  markFollowup1hSent: jest.fn().mockResolvedValue(undefined),
  findReservationsForRebookingReminder: jest.fn().mockResolvedValue([]),
  markRebookReminderSent: jest.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildApp(router, base) {
  const app = express();
  app.use(express.json());
  app.use(base, router);
  return app;
}

// Expected client phone (different from ADMIN_PHONE)
const CLIENT_PHONE = '+593987000001';

// ═══════════════════════════════════════════════════════════════════════════════
// ADRIANA — send-wa & send-comparison
// ═══════════════════════════════════════════════════════════════════════════════
describe('🛡️ Adriana — botones de acción', () => {
  let app;

  beforeAll(async () => {
    const mod = await import('../../src/express-servidor/endpoints-api/adriana-dashboard.js');
    app = buildApp(mod.default, '/api/adriana');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDB.ensureInitialized.mockResolvedValue(undefined);
    mockDB.run.mockResolvedValue({ rowCount: 1, changes: 1 });
  });

  it('POST /api/adriana/leads/ADR-001/send-wa → 404 cuando lead no existe', async () => {
    mockDB.get.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/adriana/leads/ADR-001/send-wa');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/adriana/leads/ADR-001/send-wa → 200 con lead real y envía WA', async () => {
    mockDB.get.mockResolvedValueOnce({
      quote_code: 'ADR-001',
      client_name: 'Carlos Test',
      phone: CLIENT_PHONE,
      insurance_type: 'Seguro vehicular',
      vehicle_brand: 'Toyota',
      vehicle_model: 'Corolla',
      vehicle_year: 2022,
      quoted_premium: 480.00,
    });
    const res = await request(app).post('/api/adriana/leads/ADR-001/send-wa');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockEnviarWhatsApp).toHaveBeenCalledTimes(1);
    const [phone, msg] = mockEnviarWhatsApp.mock.calls[0];
    expect(phone).toBe(CLIENT_PHONE);
    expect(msg).toContain('@adriana');
    expect(msg).toContain('Carlos');
  });

  it('POST /api/adriana/leads/ADR-001/send-comparison → 404 cuando lead no existe', async () => {
    mockDB.get.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/adriana/leads/ADR-001/send-comparison');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/adriana/leads/ADR-001/send-comparison → 400 cuando lead no tiene email', async () => {
    mockDB.get.mockResolvedValueOnce({
      quote_code: 'ADR-001',
      client_name: 'Sin Email',
      phone: CLIENT_PHONE,
      email: null,
    });
    const res = await request(app).post('/api/adriana/leads/ADR-001/send-comparison');
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/correo/i);
  });

  it('POST /api/adriana/leads/ADR-001/send-comparison → 200 con lead completo y envía email', async () => {
    mockDB.get.mockResolvedValueOnce({
      quote_code: 'ADR-001',
      client_name: 'Carlos Test',
      email: 'carlos@test.com',
      phone: CLIENT_PHONE,
      insurance_type: 'Seguro vehicular',
      vehicle_brand: 'Toyota',
      vehicle_model: 'Corolla',
      vehicle_year: 2022,
      commercial_value: 22000,
      quoted_premium: 480.00,
      competitor_quotes: '[]',
      city: 'Quito',
    });
    const res = await request(app).post('/api/adriana/leads/ADR-001/send-comparison');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.email).toBe('carlos@test.com');
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailCall = mockSendEmail.mock.calls[0][0];
    expect(emailCall.to).toBe('carlos@test.com');
    expect(emailCall.subject).toContain('ADR-001');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AXEL — send-reminder & patch status
// ═══════════════════════════════════════════════════════════════════════════════
describe('🔧 Axel — botones de acción', () => {
  let app;

  beforeAll(async () => {
    const mod = await import('../../src/express-servidor/endpoints-api/axel-dashboard.js');
    app = buildApp(mod.default, '/api/axel');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDB.ensureInitialized.mockResolvedValue(undefined);
    mockDB.run.mockResolvedValue({ rowCount: 1, changes: 1 });
  });

  it('POST /api/axel/quotes/AXL-001/send-reminder → 404 cuando cotización no existe', async () => {
    mockDB.get.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/axel/quotes/AXL-001/send-reminder');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/axel/quotes/AXL-001/send-reminder → 200 con cotización real y envía WA', async () => {
    mockDB.get.mockResolvedValueOnce({
      quote_code: 'AXL-001',
      client_name: 'Pedro Automotriz',
      user_phone: CLIENT_PHONE,
      phone: CLIENT_PHONE,
      vehicle_brand: 'Chevrolet',
      vehicle_model: 'Optra',
      vehicle_year: 2019,
      price_min: 800,
      price_max: 1200,
    });
    const res = await request(app).post('/api/axel/quotes/AXL-001/send-reminder');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockEnviarWhatsApp).toHaveBeenCalledTimes(1);
    const [phone, msg] = mockEnviarWhatsApp.mock.calls[0];
    expect(phone).toBe(CLIENT_PHONE);
    expect(msg).toContain('@axel');
    expect(msg).toContain('Pedro');
  });

  it('PATCH /api/axel/quotes/AXL-001/status → 400 sin status', async () => {
    const res = await request(app).patch('/api/axel/quotes/AXL-001/status').send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('PATCH /api/axel/quotes/AXL-001/status → 200 con status válido', async () => {
    const res = await request(app)
      .patch('/api/axel/quotes/AXL-001/status')
      .send({ status: 'accepted' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAULA — send-wa
// ═══════════════════════════════════════════════════════════════════════════════
describe('🏠 Paula — botones de acción', () => {
  let app;

  beforeAll(async () => {
    const mod = await import('../../src/express-servidor/endpoints-api/paula-dashboard.js');
    app = buildApp(mod.default, '/api/paula');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDB.ensureInitialized.mockResolvedValue(undefined);
    mockDB.run.mockResolvedValue({ rowCount: 1, changes: 1 });
  });

  it('POST /api/paula/leads/RE-001/send-wa → 404 cuando lead no existe', async () => {
    mockDB.get.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/paula/leads/RE-001/send-wa');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/paula/leads/RE-001/send-wa → 200 con lead y envía WA', async () => {
    mockDB.get.mockResolvedValueOnce({
      id: 'RE-001',
      client_name: 'Marcelo Inmobiliaria',
      phone: CLIENT_PHONE,
      operation_type: 'arriendo',
      property_type: 'departamento',
      preferred_zone: 'La Carolina',
      budget_range: '$500-$700',
    });
    const res = await request(app).post('/api/paula/leads/RE-001/send-wa');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockEnviarWhatsApp).toHaveBeenCalledTimes(1);
    const [phone, msg] = mockEnviarWhatsApp.mock.calls[0];
    expect(phone).toBe(CLIENT_PHONE);
    expect(msg).toContain('@paula');
    expect(msg).toContain('Marcelo');
    expect(msg).toContain('La Carolina');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GABI — send-wa
// ═══════════════════════════════════════════════════════════════════════════════
describe('⚖️ Gabi — botones de acción', () => {
  let app;

  beforeAll(async () => {
    const mod = await import('../../src/express-servidor/endpoints-api/gabi-dashboard.js');
    app = buildApp(mod.default, '/api/gabi');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDB.ensureInitialized.mockResolvedValue(undefined);
    mockDB.run.mockResolvedValue({ rowCount: 1, changes: 1 });
  });

  it('POST /api/gabi/leads/GAB-001/send-wa → 404 cuando lead no existe', async () => {
    mockDB.get.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/gabi/leads/GAB-001/send-wa');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/gabi/leads/GAB-001/send-wa → 200 con lead y envía WA', async () => {
    mockDB.get.mockResolvedValueOnce({
      consultation_code: 'GAB-001',
      client_name: 'Sofia Legal',
      phone: CLIENT_PHONE,
      consultation_type: 'derecho laboral',
      urgency: 'alta',
      company: 'Empresa S.A.',
    });
    const res = await request(app).post('/api/gabi/leads/GAB-001/send-wa');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockEnviarWhatsApp).toHaveBeenCalledTimes(1);
    const [phone, msg] = mockEnviarWhatsApp.mock.calls[0];
    expect(phone).toBe(CLIENT_PHONE);
    expect(msg).toContain('@gabi');
    expect(msg).toContain('Sofia');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALUNA — send-d1-whatsapp & send-d3-whatsapp
// ═══════════════════════════════════════════════════════════════════════════════
describe('🌙 Aluna — botones de acción follow-up', () => {
  let app;

  beforeAll(async () => {
    const mod = await import('../../src/express-servidor/endpoints-api/aluna-dashboard.js');
    app = buildApp(mod.default, '/api/aluna');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDB.ensureInitialized.mockResolvedValue(undefined);
    mockDB.run.mockResolvedValue({ rowCount: 1, changes: 1 });
    // Pipeline template mock (needed by send-d1)
    mockDB.all.mockResolvedValue([]);
  });

  it('POST /api/aluna/send-d1-whatsapp → 400 sin leadId o message', async () => {
    const res = await request(app)
      .post('/api/aluna/send-d1-whatsapp')
      .send({ userPhone: CLIENT_PHONE });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/aluna/send-d1-whatsapp → 200 con leadId, message, userPhone y envía WA', async () => {
    const res = await request(app)
      .post('/api/aluna/send-d1-whatsapp')
      .send({
        leadId: 42,
        userPhone: CLIENT_PHONE,
        message: 'Hola Andrea, te hago seguimiento de tu membresía',
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockEnviarWhatsApp).toHaveBeenCalledTimes(1);
    const [phone, msg] = mockEnviarWhatsApp.mock.calls[0];
    expect(phone).toBe(CLIENT_PHONE);
    expect(msg).toContain('@aluna');
  });

  it('POST /api/aluna/send-d3-whatsapp → 400 sin leadId o message', async () => {
    const res = await request(app)
      .post('/api/aluna/send-d3-whatsapp')
      .send({ userPhone: CLIENT_PHONE });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/aluna/send-d3-whatsapp → 200 con leadId, message, userPhone y envía WA', async () => {
    const res = await request(app)
      .post('/api/aluna/send-d3-whatsapp')
      .send({
        leadId: 42,
        userPhone: CLIENT_PHONE,
        message: 'Andrea, oferta especial D+3 para tu membresía',
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockEnviarWhatsApp).toHaveBeenCalledTimes(1);
    const [phone, msg] = mockEnviarWhatsApp.mock.calls[0];
    expect(phone).toBe(CLIENT_PHONE);
    expect(msg).toContain('@aluna');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AURORA — send-followup-1h & send-rebooking
// ═══════════════════════════════════════════════════════════════════════════════
describe('🗓️ Aurora — botones de acción follow-up', () => {
  let app;

  beforeAll(async () => {
    const mod = await import('../../src/express-servidor/endpoints-api/aurora-dashboard.js');
    app = buildApp(mod.default, '/api/aurora');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDB.ensureInitialized.mockResolvedValue(undefined);
    mockDB.run.mockResolvedValue({ rowCount: 1, changes: 1 });
  });

  it('POST /api/aurora/reservations/1/send-followup-1h → 404 cuando reserva no existe', async () => {
    mockDB.get.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/aurora/reservations/1/send-followup-1h');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/aurora/reservations/1/send-followup-1h → 200 con reserva válida', async () => {
    mockDB.get.mockResolvedValueOnce({
      id: 1,
      user_phone: CLIENT_PHONE,
      service_type: 'hot_desk',
      date: new Date().toISOString().split('T')[0],
      start_time: '09:00',
      status: 'confirmed',
    });
    const res = await request(app).post('/api/aurora/reservations/1/send-followup-1h');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('POST /api/aurora/reservations/1/send-rebooking → 404 cuando reserva no existe', async () => {
    mockDB.get.mockResolvedValueOnce(null);
    const res = await request(app).post('/api/aurora/reservations/1/send-rebooking');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/aurora/reservations/1/send-rebooking → 200 con reserva válida', async () => {
    mockDB.get.mockResolvedValueOnce({
      id: 1,
      user_phone: CLIENT_PHONE,
      service_type: 'sala_reunion',
      date: new Date().toISOString().split('T')[0],
      start_time: '14:00',
      status: 'completed',
    });
    const res = await request(app).post('/api/aurora/reservations/1/send-rebooking');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
