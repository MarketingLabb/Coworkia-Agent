import { jest } from '@jest/globals';

const enviarWhatsApp = jest.fn().mockResolvedValue({ ok: true });
const sendEmail = jest.fn().mockResolvedValue({ success: true, messageId: 'test-message' });
const buildEmailTemplate = jest.fn(() => '<html>template</html>');
const query = jest.fn();
const processAutomationBatch = jest.fn(async ({ deliveries, dispatch }) => {
  for (const delivery of deliveries || []) {
    const result = await dispatch({ ...delivery, payload: delivery.payload });
    const success = delivery.channel === 'whatsapp' ? result?.ok === true : result?.success === true;
    if (!success) return { complete: false, failed: true, attempted: true };
  }
  return { complete: true, failed: false, attempted: true };
});
const databaseService = {
  initialize: jest.fn().mockResolvedValue(),
  all: jest.fn(),
  run: jest.fn().mockResolvedValue({ rowCount: 1 }),
};
const getUserPreferredLanguage = jest.fn();
const auroraLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};
const alunaLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

let auroraD1Rows = [];
let auroraD3Rows = [];
let paula24hRows = [];
let paula3dRows = [];
let paulaVisitRows = [];
let alunaD1Rows = [];
let alunaD3Rows = [];
let languageByPhone = new Map();

jest.unstable_mockModule('../../src/express-servidor/endpoints-api/wassenger.js', () => ({
  enviarWhatsApp,
}));

jest.unstable_mockModule('../../src/servicios/email.js', () => ({
  sendEmail,
}));

jest.unstable_mockModule('../../src/servicios/email-template-system.js', () => ({
  buildEmailTemplate,
}));

jest.unstable_mockModule('../../src/database/database.js', () => ({
  default: databaseService,
  query,
}));

jest.unstable_mockModule('../../src/database/auroraRepository.js', () => ({
  findReservationsForOneHourFollowup: jest.fn().mockResolvedValue([]),
  markFollowup1hSent: jest.fn().mockResolvedValue(),
  findReservationsForRebookingReminder: jest.fn().mockResolvedValue([]),
  markRebookReminderSent: jest.fn().mockResolvedValue(),
}));

jest.unstable_mockModule('../../src/perfiles-interacciones/memoria-sqlite.js', () => ({
  getUserPreferredLanguage,
}));

jest.unstable_mockModule('../../src/servicios/automation-delivery-service.js', () => ({
  processAutomationBatch,
  findDueAutomationBatches: jest.fn().mockResolvedValue([]),
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  loggers: {
    aurora: auroraLogger,
    aluna: alunaLogger,
  },
}));

jest.unstable_mockModule('../../src/servicios/follow-up-service.js', () => ({
  isWithinAllowedHours: jest.fn(() => true),
}));

const {
  sendAuroraD1Followups,
  sendAuroraD3Followups,
} = await import('../../src/servicios/aurora-followup-service.js');
const {
  sendD1Followups,
  sendD3Followups,
} = await import('../../src/servicios/aluna-followup-service.js');
const { processPaulaFollowUps } = await import('../../src/servicios/paula-followup-service.js');
const {
  sendPaymentReceipt,
  sendReservationReceiptByGabi,
} = await import('../../src/servicios/payment-receipt-email.js');

const originalAdminPhone = process.env.ADMIN_PHONE;
const originalDiegoPhone = process.env.DIEGO_PERSONAL_PHONE;
const originalAdminEmail = process.env.COWORKIA_ADMIN_EMAIL;

const internalPhone = '+593990000001';
const clientPhone = '+593990000002';

function auroraReservation(overrides = {}) {
  return {
    id: 901,
    user_phone: clientPhone,
    service_type: 'hot_desk',
    date: '2026-08-10',
    start_time: '09:00',
    total_price: 12,
    user_name: 'Cliente Demo',
    user_email: '',
    ...overrides,
  };
}

function alunaLead(overrides = {}) {
  return {
    id: 301,
    user_phone: clientPhone,
    phone: clientPhone,
    name: 'Cliente Demo',
    email: '',
    interest_type: 'private_office',
    mensualidad: '300',
    ...overrides,
  };
}

function paulaLead(overrides = {}) {
  return {
    id: 401,
    client_name: 'Cliente Demo',
    phone: clientPhone,
    email: '',
    operation_type: 'buy',
    property_type: 'departamento',
    preferred_zone: 'Quito Norte',
    budget_range: '$100k',
    requirements: {},
    ...overrides,
  };
}

function setupDatabaseMocks() {
  databaseService.all.mockImplementation(async (sql) => {
    const text = String(sql);
    if (text.includes('FROM reservations') && text.includes('followup_d3_sent_at')) return auroraD3Rows;
    if (text.includes('FROM reservations') && text.includes('followup_d1_sent_at')) return auroraD1Rows;
    if (text.includes('FROM real_estate_leads') && text.includes("NOT LIKE '%followup24hSent%'")) return paula24hRows;
    if (text.includes('FROM real_estate_leads') && text.includes("LIKE '%followup24hSent%'")) return paula3dRows;
    if (text.includes('FROM property_visits')) return paulaVisitRows;
    return [];
  });

  query.mockImplementation(async (sql) => {
    const text = String(sql);
    if (text.includes('FROM membership_leads') && text.includes("INTERVAL '25 hours'")) {
      return { rows: alunaD1Rows };
    }
    if (text.includes('FROM membership_leads') && text.includes("INTERVAL '73 hours'")) {
      return { rows: alunaD3Rows };
    }
    return { rowCount: 1, rows: [] };
  });
}

function resetScenario() {
  auroraD1Rows = [];
  auroraD3Rows = [];
  paula24hRows = [];
  paula3dRows = [];
  paulaVisitRows = [];
  alunaD1Rows = [];
  alunaD3Rows = [];
  languageByPhone = new Map();
}

function lastWhatsAppMessage() {
  return enviarWhatsApp.mock.calls.at(-1)[1];
}

function numberedPhone(index) {
  return `+5939901${String(index).padStart(5, '0')}`;
}

function expectNoBrokenVariables(value) {
  expect(value).not.toMatch(/\bundefined\b|\bnull\b|\[object Object\]/);
}

function expectNoAlunaForbiddenText(value) {
  expect(value).not.toMatch(/recepci[oó]n|anfitri[oó]n|visita guiada|show-around|show around|show you around|mostr[aá]rtelo|visitar|visita|recorrido/i);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetScenario();
  setupDatabaseMocks();
  jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
    callback();
    return 0;
  });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env.ADMIN_PHONE = internalPhone;
  process.env.DIEGO_PERSONAL_PHONE = '+593990000099';
  delete process.env.COWORKIA_ADMIN_EMAIL;

  getUserPreferredLanguage.mockImplementation(async (phone) => {
    const value = languageByPhone.get(phone);
    if (value instanceof Error) throw value;
    return value;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  if (originalAdminPhone === undefined) delete process.env.ADMIN_PHONE;
  else process.env.ADMIN_PHONE = originalAdminPhone;

  if (originalDiegoPhone === undefined) delete process.env.DIEGO_PERSONAL_PHONE;
  else process.env.DIEGO_PERSONAL_PHONE = originalDiegoPhone;

  if (originalAdminEmail === undefined) delete process.env.COWORKIA_ADMIN_EMAIL;
  else process.env.COWORKIA_ADMIN_EMAIL = originalAdminEmail;
});

describe('Lote 4 — i18n automatizaciones y subjects', () => {
  test('Aurora D+1 usa el idioma preferido en cada idioma admitido por el template', async () => {
    const cases = [
      ['es', '¿Qué calificación nos das'],
      ['en', 'How would you rate us'],
      ['fr', 'Quelle note nous donneriez-vous'],
      ['it', 'Che voto ci dai'],
      ['pt', 'Que nota nos dá'],
      ['qu', 'Napaykullayki'],
    ];

    for (const [lang, expected] of cases) {
      jest.clearAllMocks();
      auroraD1Rows = [auroraReservation({ id: `d1-${lang}`, user_phone: `${clientPhone}${lang}` })];
      languageByPhone.set(`${clientPhone}${lang}`, lang);

      const result = await sendAuroraD1Followups();

      expect(result).toMatchObject({ success: true, sent: 1, errors: 0 });
      expect(lastWhatsAppMessage()).toContain(expected);
      expectNoBrokenVariables(lastWhatsAppMessage());
    }
  });

  test('Aurora aplica fallback español si el idioma falta, es no soportado o falla la lectura', async () => {
    const cases = [
      ['missing', undefined],
      ['unsupported', 'de'],
      ['error', new Error('language read failed')],
    ];

    for (const [suffix, lang] of cases) {
      jest.clearAllMocks();
      const phone = `${clientPhone}${suffix}`;
      auroraD1Rows = [auroraReservation({ id: `fallback-${suffix}`, user_phone: phone })];
      if (lang !== undefined) languageByPhone.set(phone, lang);

      const result = await sendAuroraD1Followups();

      expect(result).toMatchObject({ success: true, sent: 1, errors: 0 });
      expect(lastWhatsAppMessage()).toContain('¿Qué calificación nos das');
      expectNoBrokenVariables(lastWhatsAppMessage());
    }
  });

  test('Aurora D+3 localiza fomoLine y evita mezcla de español en idiomas no españoles', async () => {
    const cases = [
      ['es', '¿Cuándo vuelves?', auroraReservation({ total_price: 0 })],
      ['en', 'We hope you enjoyed your first visit', auroraReservation({ total_price: 0 })],
      ['fr', 'Des salles sont disponibles', auroraReservation({ service_type: 'meeting_room', total_price: 50 })],
      ['it', 'abbonamento Coworkia', auroraReservation({ service_type: 'hot_desk', total_price: 12 })],
      ['pt', 'assinatura Coworkia', auroraReservation({ service_type: 'hot_desk', total_price: 12 })],
      ['qu', 'Napaykullayki', auroraReservation({ service_type: 'hot_desk', total_price: 12 })],
    ];

    for (const [lang, expected, baseReservation] of cases) {
      jest.clearAllMocks();
      const phone = `${clientPhone}d3${lang}`;
      auroraD3Rows = [{ ...baseReservation, id: `d3-${lang}`, user_phone: phone }];
      languageByPhone.set(phone, lang);

      const result = await sendAuroraD3Followups();

      expect(result).toMatchObject({ success: true, sent: 1, errors: 0 });
      const message = lastWhatsAppMessage();
      expect(message).toContain(expected);
      expectNoBrokenVariables(message);
      if (['en', 'fr', 'it', 'pt'].includes(lang)) {
        expect(message).not.toMatch(/Tu primera|¿Tienes otra reunión|¿Sabías|Pregúntame|Salas disponibles/i);
      }
    }
  });

  test('Aurora conserva elegibilidad y entrega D+1 mediante outbox', async () => {
    auroraD1Rows = [auroraReservation({ id: 'claim-d1', user_email: 'cliente@example.com' })];

    const result = await sendAuroraD1Followups();

    expect(result).toMatchObject({ success: true, sent: 1, errors: 0 });
    const selectionSql = databaseService.all.mock.calls.find(([sql]) => String(sql).includes('followup_d1_sent_at'))[0];
    expect(selectionSql).toContain("r.status IN ('confirmed', 'completed')");
    expect(selectionSql).toContain('r.followup_d1_sent_at IS NULL');
    expect(processAutomationBatch).toHaveBeenCalledWith(expect.objectContaining({
      entityId: 'claim-d1', automationKey: 'aurora_d1', legacyColumn: 'followup_d1_sent_at',
    }));
  });

  test('Aurora usa email cliente válido sin CC/BCC y omite email inválido', async () => {
    auroraD1Rows = [auroraReservation({ id: 'valid-email', user_email: 'cliente@example.com' })];
    await sendAuroraD1Followups();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'cliente@example.com', agent: 'aurora' }));
    expect(sendEmail.mock.calls[0][0]).not.toHaveProperty('cc');
    expect(sendEmail.mock.calls[0][0]).not.toHaveProperty('bcc');

    jest.clearAllMocks();
    setupDatabaseMocks();
    databaseService.run.mockResolvedValue({ rowCount: 1 });
    auroraD1Rows = [auroraReservation({ id: 'invalid-email', user_email: 'correo-invalido' })];
    await sendAuroraD1Followups();
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('Aurora D+3 comunica facts canónicos sin descuentos ni afirmaciones inventadas', async () => {
    auroraD3Rows = [auroraReservation({ id: 'canonical-d3', total_price: 0 })];
    languageByPhone.set(clientPhone, 'es');
    await sendAuroraD3Followups();
    const message = lastWhatsAppMessage();
    expect(message).toContain('Lunes a Viernes 8:30 AM – 6:00 PM');
    expect(message).toContain('+593 99 483 7117');
    expect(message).not.toMatch(/15% OFF|40%|WiFi premium|sitio web/i);
  });

  test('Aluna D+1 y D+3 usan idiomas admitidos sin recepción, anfitrión, visita guiada ni show-around', async () => {
    const d1Cases = [
      ['es', '¿Qué día te gustaría probar el espacio?'],
      ['en', 'What day would you like to try the space?'],
      ['fr', "Quel jour souhaitez-vous essayer l'espace?"],
      ['it', 'Che giorno vorresti provare lo spazio?'],
      ['pt', 'Que dia você gostaria de experimentar o espaço?'],
    ];

    for (const [lang, expected] of d1Cases) {
      jest.clearAllMocks();
      const phone = numberedPhone(d1Cases.findIndex(([code]) => code === lang) + 1);
      alunaD1Rows = [alunaLead({ id: `aluna-d1-${lang}`, phone, user_phone: phone })];
      languageByPhone.set(phone, lang);

      const result = await sendD1Followups();

      expect(result).toMatchObject({ success: true, sent: 1, errors: 0 });
      const message = lastWhatsAppMessage();
      expect(message).toContain(expected);
      expectNoAlunaForbiddenText(message);
      expectNoBrokenVariables(message);
    }

    const d3Cases = [
      ['es', 'coordinamos tu día de prueba'],
      ['en', 'coordinate your trial workday'],
      ['fr', "votre journée d'essai"],
      ['it', 'giornata di prova'],
      ['pt', 'dia de teste'],
    ];

    for (const [lang, expected] of d3Cases) {
      jest.clearAllMocks();
      const phone = numberedPhone(d3Cases.findIndex(([code]) => code === lang) + 101);
      alunaD3Rows = [alunaLead({ id: `aluna-d3-${lang}`, phone, user_phone: phone })];
      languageByPhone.set(phone, lang);

      const result = await sendD3Followups();

      expect(result).toMatchObject({ success: true, sent: 1, errors: 0 });
      const message = lastWhatsAppMessage();
      expect(message).toContain(expected);
      expectNoAlunaForbiddenText(message);
      expectNoBrokenVariables(message);
    }
  });

  test('Aluna excluye contacto interno sin enviar WhatsApp ni email y marca idempotencia', async () => {
    alunaD1Rows = [alunaLead({ id: 555, phone: internalPhone, user_phone: internalPhone, email: 'interno@example.test' })];

    const result = await sendD1Followups();

    expect(result).toMatchObject({ success: true, sent: 0, errors: 0 });
    expect(enviarWhatsApp).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(expect.stringContaining('followup_24h_sent_at'), [555]);
    const logText = alunaLogger.info.mock.calls.flat().join('\n');
    expect(logText).toContain('contacto interno');
    expect(logText).not.toContain(internalPhone);
    expect(logText).not.toContain('interno@example.test');
  });

  test('Aluna no excluye un cliente legítimo', async () => {
    alunaD1Rows = [alunaLead({ id: 556, phone: clientPhone, user_phone: clientPhone })];
    languageByPhone.set(clientPhone, 'en');

    const result = await sendD1Followups();

    expect(result).toMatchObject({ success: true, sent: 1, errors: 0 });
    expect(enviarWhatsApp).toHaveBeenCalledWith(clientPhone, expect.stringContaining('try the space'));
  });

  test('Paula excluye contactos internos antes de WhatsApp/email y conserva marca idempotente', async () => {
    paula24hRows = [paulaLead({ id: 601, phone: internalPhone, email: 'interno@example.test' })];

    const result = await processPaulaFollowUps();

    expect(result).toMatchObject({ sent24h: 0, sent3d: 0, visitReminders: 0, skipped: 1 });
    expect(enviarWhatsApp).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(databaseService.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE real_estate_leads'),
      [expect.stringContaining('followup24hSent'), 601]
    );
  });

  test('subjects de recibo se localizan y aplican fallback sin romper variables', async () => {
    languageByPhone.set(clientPhone, 'en');
    await sendPaymentReceipt({
      memberName: 'Cliente Demo',
      memberEmail: 'cliente@example.test',
      memberPhone: clientPhone,
      receiptNumber: 'REC-TEST-001',
      paymentDate: '2026-08-09',
      paymentMethod: 'transferencia',
      totalAmount: 120,
      membershipType: 'Plan 10',
    });

    expect(sendEmail).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: '🧾 Payment Receipt - REC-TEST-001 - Coworkia',
    }));
    expectNoBrokenVariables(sendEmail.mock.calls.at(-1)[0].subject);

    languageByPhone.set(`${clientPhone}-fallback`, 'de');
    await sendReservationReceiptByGabi({
      clientName: 'Cliente Demo',
      clientEmail: 'cliente@example.test',
      clientPhone: `${clientPhone}-fallback`,
      reservationId: 'RSV-TEST-001',
      serviceType: 'Hot Desk',
      reservationDate: '2026-08-10',
      startTime: '09:00',
      endTime: '17:00',
      totalAmount: 15,
      paymentMethod: 'transferencia',
    });

    expect(sendEmail).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: expect.stringMatching(/^🧾 Tu recibo de reserva RSV-/),
    }));
    expectNoBrokenVariables(sendEmail.mock.calls.at(-1)[0].subject);
  });
});
