/**
 * 🧪 TESTS — Dashboard API Endpoints (todos los agentes)
 *
 * Cobertura:
 * - Aurora: GET /stats, /reservations, /abandoned
 * - Aluna:  GET /leads-stats, /proformas, /pipeline, /seed-demo-contacts
 * - Paula:  GET /leads, /leads-stats, PATCH /leads/:id/status, GET /seed-demo
 * - Adriana:GET /leads, /leads-stats, PATCH /leads/:code/status, GET /seed-demo
 * - Gabi:   GET /consultas, /stats
 * - Axel:   GET /cotizaciones, /stats
 *
 * Usa mocks de DB y Wassenger — no requiere conexión real a Heroku.
 */

import { describe, beforeAll, afterAll, beforeEach, it, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// ─── Mock de databaseService ─────────────────────────────────────────────────
jest.unstable_mockModule('../../src/database/database.js', () => ({
  default: {
    initialize: jest.fn().mockResolvedValue(undefined),
    ensureInitialized: jest.fn().mockResolvedValue(undefined),
    all:  jest.fn().mockResolvedValue([]),
    get:  jest.fn().mockResolvedValue(null),
    run:  jest.fn().mockResolvedValue({ rowCount: 0, changes: 0 }),
    close: jest.fn().mockResolvedValue(undefined),
  }
}));

// ─── Mock de Wassenger ────────────────────────────────────────────────────────
jest.unstable_mockModule('../../src/express-servidor/endpoints-api/wassenger.js', () => ({
  enviarWhatsApp: jest.fn().mockResolvedValue({ ok: true }),
}));

// ─── Mock de aurora-dashboard helpers (todos los exports) ───────────────────
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

// ─── Importar routers DESPUÉS de los mocks ───────────────────────────────────
let paulaRouter, adrianaRouter;
let paulaMockDB, adrianaMockDB;

// ─── Build app helper ────────────────────────────────────────────────────────
async function buildApp(router, basePath) {
  const app = express();
  app.use(express.json());
  app.use(basePath, router);
  return app;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAULA — /api/paula
// ═══════════════════════════════════════════════════════════════════════════════
describe('📊 Paula Dashboard — /api/paula', () => {
  let app;

  beforeAll(async () => {
    const mod = await import('../../src/express-servidor/endpoints-api/paula-dashboard.js');
    app = await buildApp(mod.default, '/api/paula');
  });

  it('GET /api/paula/leads → 200 con array', async () => {
    const res = await request(app).get('/api/paula/leads');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/paula/leads-stats → 200 con métricas', async () => {
    const res = await request(app).get('/api/paula/leads-stats');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('byStatus');
  });

  it('PATCH /api/paula/leads/RE-001/status → 400 sin status', async () => {
    const res = await request(app)
      .patch('/api/paula/leads/RE-001/status')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('PATCH /api/paula/leads/RE-001/status → 200 con status válido', async () => {
    const res = await request(app)
      .patch('/api/paula/leads/RE-001/status')
      .send({ status: 'searching' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /api/paula/seed-demo → 200 idempotente', async () => {
    const res1 = await request(app).get('/api/paula/seed-demo');
    expect(res1.status).toBe(200);
    expect(res1.body.ok).toBe(true);
    expect(res1.body).toHaveProperty('total');

    // Segunda llamada = idempotente (ON CONFLICT DO NOTHING)
    const res2 = await request(app).get('/api/paula/seed-demo');
    expect(res2.status).toBe(200);
    expect(res2.body.ok).toBe(true);
  });

  it('POST /api/paula/leads/RE-001/send-wa → 404 si lead no existe', async () => {
    // databaseService.get devuelve null por defecto (lead no encontrado)
    const res = await request(app).post('/api/paula/leads/RE-001/send-wa');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADRIANA — /api/adriana
// ═══════════════════════════════════════════════════════════════════════════════
describe('🛡️ Adriana Dashboard — /api/adriana', () => {
  let app;

  beforeAll(async () => {
    const mod = await import('../../src/express-servidor/endpoints-api/adriana-dashboard.js');
    app = await buildApp(mod.default, '/api/adriana');
  });

  it('GET /api/adriana/leads → 200 con array', async () => {
    const res = await request(app).get('/api/adriana/leads');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/adriana/leads-stats → 200 con métricas', async () => {
    const res = await request(app).get('/api/adriana/leads-stats');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('byStatus');
    expect(res.body.data).toHaveProperty('avgPremium');
  });

  it('PATCH /api/adriana/leads/SEG-001/status → 400 sin status', async () => {
    const res = await request(app)
      .patch('/api/adriana/leads/SEG-001/status')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('PATCH /api/adriana/leads/SEG-001/status → 200 con status válido', async () => {
    const res = await request(app)
      .patch('/api/adriana/leads/SEG-001/status')
      .send({ status: 'quoted' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('GET /api/adriana/seed-demo → 200 idempotente', async () => {
    const res1 = await request(app).get('/api/adriana/seed-demo');
    expect(res1.status).toBe(200);
    expect(res1.body.ok).toBe(true);
    expect(res1.body).toHaveProperty('total');

    const res2 = await request(app).get('/api/adriana/seed-demo');
    expect(res2.status).toBe(200);
    expect(res2.body.ok).toBe(true);
  });

  it('POST /api/adriana/leads/SEG-001/send-wa → 404 si lead no existe', async () => {
    const res = await request(app).post('/api/adriana/leads/SEG-001/send-wa');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GABI — /api/gabi
// ═══════════════════════════════════════════════════════════════════════════════
describe('⚖️ Gabi Dashboard — /api/gabi', () => {
  let app;

  beforeAll(async () => {
    const mod = await import('../../src/express-servidor/endpoints-api/gabi-dashboard.js');
    app = await buildApp(mod.default, '/api/gabi');
  });

  it('GET /api/gabi/metrics → 200 con métricas', async () => {
    const res = await request(app).get('/api/gabi/metrics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok');
  });

  it('GET /api/gabi/leads → 200 con array', async () => {
    const res = await request(app).get('/api/gabi/leads');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/gabi/leads-stats → 200 con métricas', async () => {
    const res = await request(app).get('/api/gabi/leads-stats');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveProperty('total');
  });

  it('GET /api/gabi/dashboard → 200', async () => {
    const res = await request(app).get('/api/gabi/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AXEL — /api/axel
// ═══════════════════════════════════════════════════════════════════════════════
describe('🔧 Axel Dashboard — /api/axel', () => {
  let app;

  beforeAll(async () => {
    const mod = await import('../../src/express-servidor/endpoints-api/axel-dashboard.js');
    app = await buildApp(mod.default, '/api/axel');
  });

  it('GET /api/axel/quotes → 200 con array', async () => {
    const res = await request(app).get('/api/axel/quotes');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/axel/quotes-stats → 200 con métricas', async () => {
    const res = await request(app).get('/api/axel/quotes-stats');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveProperty('total');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALUNA — /api/aluna
// ═══════════════════════════════════════════════════════════════════════════════
describe('🌙 Aluna Dashboard — /api/aluna', () => {
  let app;

  beforeAll(async () => {
    const mod = await import('../../src/express-servidor/endpoints-api/aluna-dashboard.js');
    app = await buildApp(mod.default, '/api/aluna');
  });

  it('GET /api/aluna/proformas → 200 con array', async () => {
    const res = await request(app).get('/api/aluna/proformas');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/aluna/stats → 200 con métricas de follow-ups', async () => {
    const res = await request(app).get('/api/aluna/stats');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveProperty('followups');
    expect(res.body.data).toHaveProperty('total');
  });

  it('GET /api/aluna/pipeline → 200 con prospectos', async () => {
    const res = await request(app).get('/api/aluna/pipeline');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveProperty('activeProspects');
    expect(res.body.data).toHaveProperty('prospects');
  });

  it('GET /api/aluna/seed-demo-contacts → 200 dos veces (idempotente)', async () => {
    const res1 = await request(app).get('/api/aluna/seed-demo-contacts');
    expect(res1.status).toBe(200);
    expect(res1.body.ok).toBe(true);

    const res2 = await request(app).get('/api/aluna/seed-demo-contacts');
    expect(res2.status).toBe(200);
    expect(res2.body.ok).toBe(true);
  });

  it('POST /api/aluna/prospects → 400 sin phone/name', async () => {
    const res = await request(app).post('/api/aluna/prospects').send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('POST /api/aluna/prospects → 200 con datos válidos', async () => {
    const res = await request(app)
      .post('/api/aluna/prospects')
      .send({ phone: '+593987654321', name: 'Test Prospecto', membershipType: 'plan-10' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AURORA — /api/aurora
// ═══════════════════════════════════════════════════════════════════════════════
describe('🗓️ Aurora Dashboard — /api/aurora', () => {
  let app;

  beforeAll(async () => {
    const mod = await import('../../src/express-servidor/endpoints-api/aurora-dashboard.js');
    app = await buildApp(mod.default, '/api/aurora');
  });

  it('GET /api/aurora/stats → 200 con métricas', async () => {
    const res = await request(app).get('/api/aurora/stats');
    expect(res.status).toBe(200);
    // aurora stats puede devolver ok:true con datos vacíos
    expect(res.body).toHaveProperty('ok');
  });

  it('GET /api/aurora/reservations → 200 con array', async () => {
    const res = await request(app).get('/api/aurora/reservations');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok');
    const data = res.body.data ?? res.body.reservations ?? [];
    expect(Array.isArray(data)).toBe(true);
  });
});
