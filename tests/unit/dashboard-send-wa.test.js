/**
 * @file dashboard-send-wa.test.js
 * @description Auditoría completa de todos los botones "📲 WA" de los dashboards.
 *
 * Garantiza que:
 * 1. Cada endpoint envía el WA al teléfono del CLIENTE (el de la BD), no a uno hardcodeado.
 * 2. Ningún endpoint envía al ADMIN_PHONE (teléfono de Diego — leads de prueba).
 * 3. Los endpoints devuelven 404 si el lead no existe o no tiene teléfono.
 * 4. Los endpoints devuelven 403 si el lead fue creado por el administrador (TEST_LEAD).
 *
 * Agentes cubiertos: Axel, Paula, Adriana, Gabi
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// ─── Constantes de prueba ────────────────────────────────────────────────────
const CLIENT_PHONE  = '+593991234567';   // teléfono ficticio de un cliente real
const ADMIN_PHONE   = '+593987654321';   // teléfono de Diego (ADMIN_PHONE en prod)
const ADMIN_NORM    = ADMIN_PHONE.replace(/\D/g, '');

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.unstable_mockModule(
  '../../src/express-servidor/endpoints-api/wassenger.js',
  () => ({
    enviarWhatsApp:    jest.fn().mockResolvedValue({ ok: true }),
    enviarWhatsAppVoz: jest.fn().mockResolvedValue({ ok: true }),
    default:           {},
  })
);

jest.unstable_mockModule(
  '../../src/database/database.js',
  () => ({
    default: {
      initialize:        jest.fn().mockResolvedValue(),
      ensureInitialized: jest.fn().mockResolvedValue(),
      get:               jest.fn(),
      run:               jest.fn().mockResolvedValue(),
      all:               jest.fn().mockResolvedValue([]),
    },
  })
);

// ─── Import SUT AFTER mocks ──────────────────────────────────────────────────
const { enviarWhatsApp } = await import('../../src/express-servidor/endpoints-api/wassenger.js');
const dbMod              = await import('../../src/database/database.js');
const db                 = dbMod.default;

const axelRouter    = (await import('../../src/express-servidor/endpoints-api/axel-dashboard.js')).default;
const paulaRouter   = (await import('../../src/express-servidor/endpoints-api/paula-dashboard.js')).default;
const adrianaRouter = (await import('../../src/express-servidor/endpoints-api/adriana-dashboard.js')).default;
const gabiRouter    = (await import('../../src/express-servidor/endpoints-api/gabi-dashboard.js')).default;

// ─── App factory ─────────────────────────────────────────────────────────────
function buildApp(prefix, router) {
  const app = express();
  app.use(express.json());
  app.use(prefix, router);
  return app;
}

const apps = {
  axel:    buildApp('/api/axel',    axelRouter),
  paula:   buildApp('/api/paula',   paulaRouter),
  adriana: buildApp('/api/adriana', adrianaRouter),
  gabi:    buildApp('/api/gabi',    gabiRouter),
};

// ─── Fixtures de leads ───────────────────────────────────────────────────────
const LEADS = {
  axel: {
    normal:  { quote_code: 'AXL-001', user_phone: CLIENT_PHONE, client_name: 'María Cliente', vehicle_brand: 'Toyota', vehicle_model: 'Corolla', vehicle_year: 2022 },
    admin:   { quote_code: 'AXL-ADM', user_phone: ADMIN_PHONE,  client_name: 'Diego Test' },
    no_phone:{ quote_code: 'AXL-NOP', user_phone: null },
  },
  paula: {
    normal:  { id: 'P-001', phone: CLIENT_PHONE, client_name: 'Carlos Cliente', operation_type: 'compra', property_type: 'casa', preferred_zone: 'Cumbayá' },
    admin:   { id: 'P-ADM', phone: ADMIN_PHONE,  client_name: 'Diego Test' },
    no_phone:{ id: 'P-NOP', phone: null },
  },
  adriana: {
    normal:  { quote_code: 'ADR-001', phone: CLIENT_PHONE, client_name: 'Laura Cliente', insurance_type: 'vehiculo', vehicle_brand: 'Hyundai', vehicle_model: 'Creta', vehicle_year: 2022, quoted_premium: '850.00' },
    admin:   { quote_code: 'ADR-ADM', phone: ADMIN_PHONE,  client_name: 'Diego Test' },
    no_phone:{ quote_code: 'ADR-NOP', phone: null },
  },
  gabi: {
    normal:  { consultation_code: 'GAB-001', phone: CLIENT_PHONE, client_name: 'Pedro Cliente', consultation_type: 'laboral', company: 'Empresa SA' },
    admin:   { consultation_code: 'GAB-ADM', phone: ADMIN_PHONE,  client_name: 'Diego Test' },
    no_phone:{ consultation_code: 'GAB-NOP', phone: null },
  },
};

// ─── Setup: inyectar ADMIN_PHONE como env var ─────────────────────────────────
let originalAdminPhone;
beforeEach(() => {
  originalAdminPhone = process.env.ADMIN_PHONE;
  process.env.ADMIN_PHONE = ADMIN_PHONE;
  jest.clearAllMocks();
  db.run.mockResolvedValue();
});
afterEach(() => {
  process.env.ADMIN_PHONE = originalAdminPhone;
});

// ═════════════════════════════════════════════════════════════════════════════
// AXEL — send-reminder
// ═════════════════════════════════════════════════════════════════════════════
describe('📲 Axel — POST /api/axel/quotes/:code/send-reminder', () => {

  test('envía WA al teléfono del cliente, no al de admin', async () => {
    db.get.mockResolvedValueOnce(LEADS.axel.normal);
    const res = await request(apps.axel)
      .post('/api/axel/quotes/AXL-001/send-reminder');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
    const [destPhone] = enviarWhatsApp.mock.calls[0];
    expect(destPhone).toBe(CLIENT_PHONE);
    expect(destPhone.replace(/\D/g, '')).not.toBe(ADMIN_NORM);
  });

  test('devuelve 403 si el lead pertenece al administrador (TEST_LEAD)', async () => {
    db.get.mockResolvedValueOnce(LEADS.axel.admin);
    const res = await request(apps.axel)
      .post('/api/axel/quotes/AXL-ADM/send-reminder');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('TEST_LEAD');
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  test('devuelve 404 si el lead no existe', async () => {
    db.get.mockResolvedValueOnce(null);
    const res = await request(apps.axel)
      .post('/api/axel/quotes/NOTEXIST/send-reminder');
    expect(res.status).toBe(404);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  test('devuelve 404 si el lead no tiene teléfono', async () => {
    db.get.mockResolvedValueOnce(LEADS.axel.no_phone);
    const res = await request(apps.axel)
      .post('/api/axel/quotes/AXL-NOP/send-reminder');
    expect(res.status).toBe(404);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// PAULA — send-wa
// ═════════════════════════════════════════════════════════════════════════════
describe('📲 Paula — POST /api/paula/leads/:id/send-wa', () => {

  test('envía WA al teléfono del cliente, no al de admin', async () => {
    db.get.mockResolvedValueOnce(LEADS.paula.normal);
    const res = await request(apps.paula)
      .post('/api/paula/leads/P-001/send-wa');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
    const [destPhone] = enviarWhatsApp.mock.calls[0];
    expect(destPhone).toBe(CLIENT_PHONE);
    expect(destPhone.replace(/\D/g, '')).not.toBe(ADMIN_NORM);
  });

  test('devuelve 403 si el lead pertenece al administrador (TEST_LEAD)', async () => {
    db.get.mockResolvedValueOnce(LEADS.paula.admin);
    const res = await request(apps.paula)
      .post('/api/paula/leads/P-ADM/send-wa');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('TEST_LEAD');
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  test('devuelve 404 si el lead no existe', async () => {
    db.get.mockResolvedValueOnce(null);
    const res = await request(apps.paula)
      .post('/api/paula/leads/NOTEXIST/send-wa');
    expect(res.status).toBe(404);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ADRIANA — send-wa
// ═════════════════════════════════════════════════════════════════════════════
describe('📲 Adriana — POST /api/adriana/leads/:code/send-wa', () => {

  test('envía WA al teléfono del cliente, no al de admin', async () => {
    db.get.mockResolvedValueOnce(LEADS.adriana.normal);
    const res = await request(apps.adriana)
      .post('/api/adriana/leads/ADR-001/send-wa');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
    const [destPhone] = enviarWhatsApp.mock.calls[0];
    expect(destPhone).toBe(CLIENT_PHONE);
    expect(destPhone.replace(/\D/g, '')).not.toBe(ADMIN_NORM);
  });

  test('devuelve 403 si el lead pertenece al administrador (TEST_LEAD)', async () => {
    db.get.mockResolvedValueOnce(LEADS.adriana.admin);
    const res = await request(apps.adriana)
      .post('/api/adriana/leads/ADR-ADM/send-wa');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('TEST_LEAD');
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  test('devuelve 404 si el lead no existe', async () => {
    db.get.mockResolvedValueOnce(null);
    const res = await request(apps.adriana)
      .post('/api/adriana/leads/NOTEXIST/send-wa');
    expect(res.status).toBe(404);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GABI — send-wa
// ═════════════════════════════════════════════════════════════════════════════
describe('📲 Gabi — POST /api/gabi/leads/:code/send-wa', () => {

  test('envía WA al teléfono del cliente, no al de admin', async () => {
    db.get.mockResolvedValueOnce(LEADS.gabi.normal);
    const res = await request(apps.gabi)
      .post('/api/gabi/leads/GAB-001/send-wa');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
    const [destPhone] = enviarWhatsApp.mock.calls[0];
    expect(destPhone).toBe(CLIENT_PHONE);
    expect(destPhone.replace(/\D/g, '')).not.toBe(ADMIN_NORM);
  });

  test('devuelve 403 si el lead pertenece al administrador (TEST_LEAD)', async () => {
    db.get.mockResolvedValueOnce(LEADS.gabi.admin);
    const res = await request(apps.gabi)
      .post('/api/gabi/leads/GAB-ADM/send-wa');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('TEST_LEAD');
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  test('devuelve 404 si el lead no existe', async () => {
    db.get.mockResolvedValueOnce(null);
    const res = await request(apps.gabi)
      .post('/api/gabi/leads/NOTEXIST/send-wa');
    expect(res.status).toBe(404);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Guard desactivado cuando ADMIN_PHONE no está configurado
// ═════════════════════════════════════════════════════════════════════════════
describe('🛡️ Guard: sin ADMIN_PHONE configurado', () => {
  test('Axel envia aunque ADMIN_PHONE esté vacío', async () => {
    delete process.env.ADMIN_PHONE;
    db.get.mockResolvedValueOnce(LEADS.axel.admin); // mismo número que sería admin
    const res = await request(apps.axel)
      .post('/api/axel/quotes/AXL-ADM/send-reminder');
    // Sin ADMIN_PHONE configurado, no hay guard → envía normal
    expect(res.status).toBe(200);
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Boss-quotes: user_phone = admin, phone = cliente real
// ═════════════════════════════════════════════════════════════════════════════
describe('👔 Boss-quotes: user_phone=admin pero phone=cliente', () => {
  test('Axel boss-quote envía al phone del cliente, no al user_phone admin', async () => {
    const bossLead = {
      quote_code: 'AXL-BOSS-001', user_phone: ADMIN_PHONE, phone: CLIENT_PHONE,
      client_name: 'Juan Pablo Parra', vehicle_brand: 'Kia', vehicle_model: 'Picanto', vehicle_year: 2019,
    };
    db.get.mockResolvedValueOnce(bossLead);
    const res = await request(apps.axel)
      .post('/api/axel/quotes/AXL-BOSS-001/send-reminder');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
    const [destPhone] = enviarWhatsApp.mock.calls[0];
    expect(destPhone).toBe(CLIENT_PHONE);
  });

  test('Axel boss-quote sin phone → TEST_LEAD guard (user_phone es admin)', async () => {
    const bossLead = {
      quote_code: 'AXL-BOSS-NOP', user_phone: ADMIN_PHONE, phone: null,
      client_name: 'Sin Teléfono',
    };
    db.get.mockResolvedValueOnce(bossLead);
    const res = await request(apps.axel)
      .post('/api/axel/quotes/AXL-BOSS-NOP/send-reminder');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('TEST_LEAD');
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });
});
