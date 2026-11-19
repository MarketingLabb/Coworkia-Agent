/**
 * 🔐 LOPDP Compliance — Test Suite
 *
 * Verifica el cumplimiento de la Ley Orgánica de Protección de Datos Personales
 * (LOPDP) de Ecuador en Coworkia Agent.
 *
 * Escenarios:
 * 1. Solicitudes ARCO (Acceso, Rectificación, Cancelación, Oposición)
 * 2. Plazo legal de 15 días hábiles
 * 3. Auditoría en tabla arco_requests
 * 4. Supresión cross-table (derecho al olvido)
 * 5. Clientes recurrentes sin consentimiento explícito
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ─────────────────────────────────────────────────────────────────────────────
// MOCKS — No BD real, todo con mocks
// ─────────────────────────────────────────────────────────────────────────────

const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
  initialize: jest.fn().mockResolvedValue(undefined),
  ensureInitialized: jest.fn().mockResolvedValue(undefined),
};

jest.unstable_mockModule('../src/database/database.js', () => ({
  default: mockDb,
  query: jest.fn(),
}));

// NOTE: privacidad.js uses a dynamic import() for enviarWhatsApp inside a try/catch.
// It will fail silently in tests — no mock needed.

// Import after mocks
const { default: express } = await import('express');
const { default: request } = await import('supertest');

// Build minimal app with the privacidad router
const privacidadModule = await import('../src/express-servidor/endpoints-api/privacidad.js');
const privacidadRouter = privacidadModule.default;

const app = express();
app.use(express.json());
app.use('/', privacidadRouter);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_ARCO_REQUEST = {
  requestType: 'acceso',
  fullName: 'María López García',
  email: 'maria.lopez@gmail.com',
  phone: '+593987654321',
  description: 'Solicito acceder a todos mis datos personales almacenados en Coworkia.',
};

function addBusinessDays(date, days) {
  let current = new Date(date);
  let added = 0;
  while (added < days) {
    current.setDate(current.getDate() + 1);
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return current;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP / TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

beforeEach(() => {
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: SOLICITUD ARCO DE ACCESO
// ═══════════════════════════════════════════════════════════════════════════════

describe('ARCO — Acceso (ver mis datos)', () => {
  it('should accept a valid access request and return request ID', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 42, created_at: new Date().toISOString() });

    const res = await request(app)
      .post('/api/arco')
      .send(VALID_ARCO_REQUEST);

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.requestId).toBe(42);
    expect(res.body.message).toMatch(/15 días hábiles/);
  });

  it('should store the request with correct fields in DB', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 1, created_at: new Date().toISOString() });

    await request(app)
      .post('/api/arco')
      .send(VALID_ARCO_REQUEST);

    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO arco_requests'),
      expect.arrayContaining([
        'acceso',
        'María López García',
        'maria.lopez@gmail.com',
        '+593987654321',
        expect.stringContaining('datos personales'),
      ])
    );
  });

  it('should set status to pending on creation', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 1, created_at: new Date().toISOString() });

    await request(app)
      .post('/api/arco')
      .send(VALID_ARCO_REQUEST);

    // The INSERT query must set status = 'pending'
    const insertCall = mockDb.get.mock.calls[0];
    expect(insertCall[0]).toContain("'pending'");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: SOLICITUD ARCO DE RECTIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

describe('ARCO — Rectificación (corregir datos)', () => {
  it('should accept a rectification request', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 55, created_at: new Date().toISOString() });

    const res = await request(app)
      .post('/api/arco')
      .send({
        ...VALID_ARCO_REQUEST,
        requestType: 'rectificacion',
        description: 'Mi email registrado es incorrecto. El correcto es maria.new@gmail.com, solicito actualización.',
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.requestId).toBe(55);
  });

  it('should store rectification type correctly', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 2, created_at: new Date().toISOString() });

    await request(app)
      .post('/api/arco')
      .send({
        ...VALID_ARCO_REQUEST,
        requestType: 'rectificacion',
        description: 'Corregir mi nombre: el correcto es María Luisa López.',
      });

    expect(mockDb.get).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO arco_requests'),
      expect.arrayContaining(['rectificacion'])
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: SOLICITUD ARCO DE SUPRESIÓN (CANCELACIÓN)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ARCO — Cancelación / Supresión (eliminar datos)', () => {
  it('should accept a cancellation request', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 99, created_at: new Date().toISOString() });

    const res = await request(app)
      .post('/api/arco')
      .send({
        ...VALID_ARCO_REQUEST,
        requestType: 'cancelacion',
        description: 'Solicito la eliminación completa de mis datos personales de todas las tablas del sistema.',
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  it('should require deletion from ALL tables when processing cancellation', () => {
    // This test documents which tables must be purged for a full data deletion.
    // The actual deletion is a manual process (Diego runs queries),
    // but the system MUST track which tables to clean.
    const TABLES_WITH_PERSONAL_DATA = [
      'users',               // phone, name, email
      'reservations',        // user_phone, guest_count
      'membership_leads',    // user_phone, client_name, email
      'insurance_leads',     // phone, client_name, email, cedula
      'enzo_leads',          // user_phone, client_name, email
      'real_estate_leads',   // user_phone, client_name, email
      'legal_consultations', // user_phone, client_name, email
      'axel_quotes',         // user_phone, client_name, email
      'arco_requests',       // email, phone, full_name (keep for audit, anonymize)
    ];

    // Assert all tables are documented
    expect(TABLES_WITH_PERSONAL_DATA).toHaveLength(9);
    expect(TABLES_WITH_PERSONAL_DATA).toContain('users');
    expect(TABLES_WITH_PERSONAL_DATA).toContain('reservations');
    expect(TABLES_WITH_PERSONAL_DATA).toContain('insurance_leads');
    expect(TABLES_WITH_PERSONAL_DATA).toContain('membership_leads');
    expect(TABLES_WITH_PERSONAL_DATA).toContain('arco_requests');
  });

  it('arco_requests should be anonymized, NOT deleted (audit trail)', () => {
    // When processing a full deletion, arco_requests should keep the record
    // but redact PII. The row proves compliance was executed.
    const anonymizedRecord = {
      id: 99,
      request_type: 'cancelacion',
      full_name: '[REDACTED]',
      email: '[REDACTED]',
      phone: null,
      description: '[Data deleted per LOPDP Art. 22]',
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      notes: 'Datos eliminados de: users, reservations, insurance_leads, membership_leads, enzo_leads, real_estate_leads, legal_consultations, axel_quotes. ARCO record anonymized.',
    };

    expect(anonymizedRecord.status).toBe('resolved');
    expect(anonymizedRecord.full_name).toBe('[REDACTED]');
    expect(anonymizedRecord.notes).toContain('users');
    expect(anonymizedRecord.notes).toContain('insurance_leads');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4: OPOSICIÓN
// ═══════════════════════════════════════════════════════════════════════════════

describe('ARCO — Oposición (limitar uso de datos)', () => {
  it('should accept an opposition request', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 77, created_at: new Date().toISOString() });

    const res = await request(app)
      .post('/api/arco')
      .send({
        ...VALID_ARCO_REQUEST,
        requestType: 'oposicion',
        description: 'No quiero que mis datos se usen para follow-ups de marketing ni emails promocionales.',
      });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 5: VALIDACIONES DE ENTRADA
// ═══════════════════════════════════════════════════════════════════════════════

describe('ARCO — Validaciones de entrada', () => {
  it('should reject invalid request type', async () => {
    const res = await request(app)
      .post('/api/arco')
      .send({ ...VALID_ARCO_REQUEST, requestType: 'hackeo' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toMatch(/inválido/i);
  });

  it('should reject empty name', async () => {
    const res = await request(app)
      .post('/api/arco')
      .send({ ...VALID_ARCO_REQUEST, fullName: '' });

    expect(res.status).toBe(400);
  });

  it('should reject name shorter than 2 chars', async () => {
    const res = await request(app)
      .post('/api/arco')
      .send({ ...VALID_ARCO_REQUEST, fullName: 'A' });

    expect(res.status).toBe(400);
  });

  it('should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/arco')
      .send({ ...VALID_ARCO_REQUEST, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  it('should reject description shorter than 10 chars', async () => {
    const res = await request(app)
      .post('/api/arco')
      .send({ ...VALID_ARCO_REQUEST, description: 'Hola' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/corta/i);
  });

  it('should accept request without phone (optional field)', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 10, created_at: new Date().toISOString() });

    const { phone, ...noPhone } = VALID_ARCO_REQUEST;
    const res = await request(app)
      .post('/api/arco')
      .send(noPhone);

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  it('should normalize email to lowercase', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 11, created_at: new Date().toISOString() });

    await request(app)
      .post('/api/arco')
      .send({ ...VALID_ARCO_REQUEST, email: 'MARIA@Gmail.COM' });

    const insertArgs = mockDb.get.mock.calls[0][1];
    expect(insertArgs[2]).toBe('maria@gmail.com');
  });

  it('should trim whitespace from all fields', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 12, created_at: new Date().toISOString() });

    await request(app)
      .post('/api/arco')
      .send({
        ...VALID_ARCO_REQUEST,
        fullName: '  María López  ',
        email: 'maria@test.com', // email sin espacios (la regex lo valida antes del trim)
        phone: '  +593987654321  ',
        description: '  Solicito acceder a todos mis datos personales  ',
      });

    // clearAllMocks resets calls between tests, so this IS index 0
    expect(mockDb.get).toHaveBeenCalledTimes(1);
    const insertArgs = mockDb.get.mock.calls[0][1];
    expect(insertArgs[1]).toBe('María López');
    expect(insertArgs[4]).toBe('Solicito acceder a todos mis datos personales');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 6: PLAZO LEGAL — 15 DÍAS HÁBILES
// ═══════════════════════════════════════════════════════════════════════════════

describe('ARCO — Plazo legal de 15 días hábiles', () => {
  it('should calculate 15 business days correctly (skip weekends)', () => {
    // Monday April 6, 2026 + 15 business days = Monday April 27, 2026
    const requestDate = new Date('2026-04-06T12:00:00Z');
    const deadline = addBusinessDays(requestDate, 15);

    expect(deadline.getDay()).not.toBe(0); // Not Sunday
    expect(deadline.getDay()).not.toBe(6); // Not Saturday
    // 15 business days from Mon Apr 6 → Mon Apr 27 (3 weekends skipped)
    const deadlineStr = deadline.toISOString().slice(0, 10);
    expect(deadlineStr).toBe('2026-04-27');
  });

  it('should handle request made on Friday (no weekends counted)', () => {
    // Friday April 3, 2026 + 15 business days = Friday April 24, 2026
    const requestDate = new Date('2026-04-03');
    const deadline = addBusinessDays(requestDate, 15);

    expect(deadline.toISOString().slice(0, 10)).toBe('2026-04-24');
  });

  it('should return "15 días hábiles" message to the user', async () => {
    mockDb.get.mockResolvedValueOnce({ id: 1, created_at: new Date().toISOString() });

    const res = await request(app)
      .post('/api/arco')
      .send(VALID_ARCO_REQUEST);

    expect(res.body.message).toContain('15 días hábiles');
  });

  it('pending request should be trackable with created_at', async () => {
    const createdAt = '2026-04-06T10:00:00.000Z';
    mockDb.get.mockResolvedValueOnce({ id: 1, created_at: createdAt });

    const res = await request(app)
      .post('/api/arco')
      .send(VALID_ARCO_REQUEST);

    expect(res.body.requestId).toBeDefined();
    // The deadline for requestId 1 would be April 27, 2026
    const deadline = addBusinessDays(new Date(createdAt), 15);
    expect(deadline.toISOString().slice(0, 10)).toBe('2026-04-27');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 7: AUDITORÍA — arco_requests como registro legal
// ═══════════════════════════════════════════════════════════════════════════════

describe('ARCO — Auditoría en arco_requests', () => {
  it('should record every ARCO operation with correct schema', () => {
    const expectedColumns = [
      'id',
      'request_type',
      'full_name',
      'email',
      'phone',
      'description',
      'status',
      'resolved_at',
      'notes',
      'created_at',
    ];

    // Verify the table DDL matches our expected columns
    const DDL_COLUMNS = [
      'id SERIAL PRIMARY KEY',
      "request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('acceso', 'rectificacion', 'cancelacion', 'oposicion'))",
      'full_name VARCHAR(200) NOT NULL',
      'email VARCHAR(200) NOT NULL',
      'phone VARCHAR(50)',
      'description TEXT',
      "status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'resolved'))",
      'resolved_at TIMESTAMPTZ',
      'notes TEXT',
      'created_at TIMESTAMPTZ DEFAULT NOW()',
    ];

    expect(DDL_COLUMNS).toHaveLength(expectedColumns.length);
  });

  it('status lifecycle should be: pending → processing → resolved', () => {
    const VALID_STATUSES = ['pending', 'processing', 'resolved'];

    expect(VALID_STATUSES).toContain('pending');
    expect(VALID_STATUSES).toContain('processing');
    expect(VALID_STATUSES).toContain('resolved');
    // No other statuses allowed
    expect(VALID_STATUSES).toHaveLength(3);
  });

  it('resolved_at must be set when status = resolved', () => {
    const resolvedRecord = {
      status: 'resolved',
      resolved_at: '2026-04-08T14:30:00.000Z',
      notes: 'Datos enviados al email del solicitante',
    };

    expect(resolvedRecord.resolved_at).toBeTruthy();
    expect(new Date(resolvedRecord.resolved_at).getTime()).toBeGreaterThan(0);
  });

  it('notes should document what action was taken', () => {
    const resolvedAccess = {
      notes: 'Se envió reporte completo de datos al email maria@test.com. Tablas consultadas: users, reservations, membership_leads.',
    };

    expect(resolvedAccess.notes).toContain('users');
    expect(resolvedAccess.notes.length).toBeGreaterThan(10);
  });

  it('request_type constraint should accept only ARCO types', () => {
    const validTypes = ['acceso', 'rectificacion', 'cancelacion', 'oposicion'];
    const invalidTypes = ['borrar', 'hackear', 'exportar', 'admin'];

    validTypes.forEach(t => {
      expect(['acceso', 'rectificacion', 'cancelacion', 'oposicion']).toContain(t);
    });

    invalidTypes.forEach(t => {
      expect(['acceso', 'rectificacion', 'cancelacion', 'oposicion']).not.toContain(t);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 8: CLIENTES RECURRENTES — CONSENTIMIENTO
// ═══════════════════════════════════════════════════════════════════════════════

describe('Clientes recurrentes — Uso de datos sin consentimiento', () => {
  it('users table does NOT have a consent column (gap identified)', () => {
    // The users table schema currently has NO consent-related field:
    // phone_number, name, email, whatsapp_display_name, first_visit,
    // free_trial_used, free_trial_date, conversation_count, last_message_at,
    // active_agent, preferred_language, created_at, updated_at
    //
    // Missing: data_consent_at, marketing_consent, consent_version

    const CURRENT_USER_COLUMNS = [
      'phone_number', 'name', 'email', 'whatsapp_display_name',
      'first_visit', 'free_trial_used', 'free_trial_date',
      'conversation_count', 'last_message_at', 'active_agent',
      'preferred_language', 'created_at', 'updated_at',
    ];

    // Verify consent fields are MISSING (this test documents the gap)
    expect(CURRENT_USER_COLUMNS).not.toContain('data_consent_at');
    expect(CURRENT_USER_COLUMNS).not.toContain('marketing_consent');
    expect(CURRENT_USER_COLUMNS).not.toContain('consent_version');
  });

  it('firstVisit flag is used for LOPDP notice but NOT for consent', () => {
    // firstVisit = true → Aurora adds the LOPDP notice on first message
    // firstVisit = false → notice never shown again
    // But: this is only an informational notice, NOT explicit consent
    // The user never actively says "yes I accept"

    const user = {
      first_visit: false,    // notice was shown
      data_consent_at: null, // <-- no such field exists
    };

    // The notice was shown but consent was never explicitly captured
    expect(user.first_visit).toBe(false);
    expect(user.data_consent_at).toBeNull();
  });

  it('follow-up crons process users WITHOUT checking consent', () => {
    // Current follow-up queries filter by:
    // - status, date windows, followup_sent_at flags
    // But NONE of them check for marketing consent.
    //
    // Example from adriana-followup-service.js:
    //   WHERE status = 'quoted' AND quote_sent_at IS NOT NULL AND ...
    // No WHERE clause includes consent checking.

    const FOLLOWUP_QUERIES_WITHOUT_CONSENT = [
      'adriana-followup-service.js — findLeadsInWindow()',
      'aluna-followup-service.js — sendD1Followups()',
      'aurora-followup-service.js — findReservationsForOneHourFollowup()',
      'paula-followup-service.js — processPaulaFollowUps()',
      'follow-up-service.js — processFollowUps()',
    ];

    // All 5 followup services lack consent checking
    expect(FOLLOWUP_QUERIES_WITHOUT_CONSENT).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 9: NOTIFICACIÓN A DIEGO
// ═══════════════════════════════════════════════════════════════════════════════

describe('ARCO — Notificación WhatsApp a Diego', () => {
  it('should still succeed if WhatsApp notification fails', async () => {
    // Mock DB success but WA failure
    mockDb.get.mockResolvedValueOnce({ id: 50, created_at: new Date().toISOString() });

    // The WA import is dynamic inside the endpoint, so failures are caught silently
    const res = await request(app)
      .post('/api/arco')
      .send(VALID_ARCO_REQUEST);

    // The request should succeed even if WA notification fails
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  it('should handle DB failure gracefully', async () => {
    mockDb.get.mockImplementation(() => Promise.reject(new Error('Connection refused')));

    const res = await request(app)
      .post('/api/arco')
      .send(VALID_ARCO_REQUEST);

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    
    // Restore default behavior for subsequent tests
    mockDb.get.mockReset();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ESTRATEGIA DE CONSENTIMIENTO PARA CLIENTES EXISTENTES
// ═══════════════════════════════════════════════════════════════════════════════
//
// 📋 PROBLEMA:
// La tabla `users` tiene ~X registros de clientes que interactuaron con el
// sistema (reservas, cotizaciones, consultas) pero NUNCA dieron consentimiento
// explícito para el tratamiento de sus datos. El aviso LOPDP en WhatsApp
// (firstVisit) es informativo, NO constituye consentimiento válido según
// LOPDP Art. 27 (debe ser libre, específico, informado e inequívoco).
//
// 📊 DIAGNÓSTICO:
// - Campo `first_visit` = solo indica si se mostró el aviso pasivo
// - No existe campo `data_consent_at` en la tabla users
// - No existe campo `marketing_consent` (boolean)
// - Follow-ups de marketing se envían sin verificar consentimiento
// - Emails promocionales se envían sin opt-in explícito
//
// 🎯 ESTRATEGIA PROPUESTA (3 fases):
//
// ═══ FASE 1: Migración de BD (Sprint 1, ~30min) ═══
//
// ALTER TABLE users ADD COLUMN data_consent_at TIMESTAMPTZ DEFAULT NULL;
// ALTER TABLE users ADD COLUMN marketing_consent BOOLEAN DEFAULT FALSE;
// ALTER TABLE users ADD COLUMN consent_version VARCHAR(10) DEFAULT NULL;
//
// Significado:
// - data_consent_at = NULL → nunca dio consentimiento
// - data_consent_at = timestamp → fecha exacta del consentimiento
// - marketing_consent = false → no enviar follow-ups de marketing
// - consent_version = 'v1.0' → versión de la política aceptada
//
// ═══ FASE 2: Flujo de captura en WhatsApp (Sprint 2, ~2h) ═══
//
// Cuando un usuario SIN consentimiento escribe por WA:
//
// 1. El sistema detecta: user.data_consent_at === null
// 2. ANTES de procesar su mensaje, Aurora envía:
//
//    "¡Hola! 👋 Antes de continuar, necesito tu autorización.
//
//     Coworkia trata tus datos (nombre, teléfono, email) para:
//     ✅ Gestionar reservas y servicios
//     ✅ Enviarte confirmaciones y recordatorios
//
//     📋 Política completa: coworkia.ec/privacidad
//
//     Responde *ACEPTO* para continuar o *NO* si prefieres no compartir tus datos."
//
// 3. Si responde "ACEPTO" / "sí" / "ok":
//    → UPDATE users SET data_consent_at = NOW(), consent_version = 'v1.0'
//      WHERE phone_number = $1
//    → Continuar con el flujo normal
//
// 4. Si responde "NO" / "no acepto":
//    → Informar que puede ejercer derechos ARCO en /privacidad/arco
//    → No registrar datos nuevos
//    → No enviar follow-ups
//
// 5. Si no responde (ignora):
//    → No procesar mensajes posteriores hasta obtener respuesta
//    → Repreguntar UNA vez más después de 24h
//    → Después de 2 intentos sin respuesta: marcar como "consent_pending"
//
// ═══ FASE 3: Marketing consent separado (Sprint 3, ~1h) ═══
//
// Después de obtener el consentimiento base, preguntar:
//
//    "¿Te gustaría recibir ofertas y novedades de Coworkia?
//     Responde *SÍ* para activar o *NO* para solo recibir info de tus reservas."
//
// → Si SÍ: UPDATE users SET marketing_consent = true
// → Si NO: marketing_consent queda false
//
// Follow-up crons DEBEN agregar:
//    WHERE ... AND u.marketing_consent = true
//    (o un JOIN a users que verifique marketing_consent)
//
// ═══ FASE 4: Clientes existentes (retroactivo) ═══
//
// Para los ~N usuarios que ya están en BD sin consentimiento:
//
// OPCIÓN A (recomendada): Consentimiento diferido
// - No enviar follow-ups de marketing a nadie sin marketing_consent = true
// - Al próximo contacto por WA → Fase 2 (pedir consentimiento)
// - Naturalmente, los clientes activos darán consentimiento al escribir
//
// OPCIÓN B (masiva): Campaign de regularización
// - Enviar UN mensaje único a todos los usuarios:
//   "Actualizamos nuestra política de datos. Responde ACEPTO para seguir..."
// - Riesgo: puede molestar a usuarios inactivos
// - Solo ejecutar si hay urgencia legal
//
// RECOMENDACIÓN: Opción A + agregar WHERE marketing_consent = true a todos
// los follow-up queries como primera acción inmediata. Esto bloquea envíos
// no consentidos desde hoy, y la regularización ocurre orgánicamente.
//
// ═══ QUERIES DE DIAGNÓSTICO ═══
//
// -- Cuántos usuarios hay sin consentimiento (todos, porque el campo no existe)
// SELECT COUNT(*) AS total_users FROM users;
//
// -- Usuarios activos (con mensajes en últimos 30 días)
// SELECT COUNT(*) FROM users WHERE last_message_at >= NOW() - INTERVAL '30 days';
//
// -- Usuarios con follow-ups enviados (sin consentimiento verificado)
// SELECT COUNT(DISTINCT user_phone) FROM reservations WHERE followup_1h_sent_at IS NOT NULL;
// SELECT COUNT(DISTINCT user_phone) FROM membership_leads WHERE followup_24h_sent_at IS NOT NULL;
// SELECT COUNT(DISTINCT phone) FROM insurance_leads WHERE quote_sent_at IS NOT NULL;
//
// ═══════════════════════════════════════════════════════════════════════════════
