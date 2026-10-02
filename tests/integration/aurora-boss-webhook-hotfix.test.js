import { afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

const ADMIN = '+593994000001';
const QUESTION = '¿Cuál es el nombre completo de la persona que usará la reserva?';

process.env.ADMIN_PHONE = ADMIN;
process.env.WASSENGER_TOKEN = 'test-token';
process.env.WASSENGER_DEVICE = 'test-device';
process.env.WEBHOOK_SECURITY_BYPASS = 'true';

let profile;
let activeForm;
let legacyPartialForm;
let pendingConfirmation;

const sentMessages = [];
const createdReservations = [];

const databaseService = {
  ensureInitialized: jest.fn().mockResolvedValue(),
  initialize: jest.fn().mockResolvedValue(),
  run: jest.fn().mockResolvedValue({ rowCount: 1, changes: 1 }),
  get: jest.fn().mockResolvedValue(null),
  all: jest.fn().mockResolvedValue([]),
};

const getAgentForm = jest.fn(async () => activeForm);
const saveAgentForm = jest.fn(async (_userId, _agent, formData) => {
  activeForm = structuredClone(formData);
  return true;
});
const clearAgentForm = jest.fn(async () => {
  activeForm = null;
  return true;
});
const clearPartialForm = jest.fn(async () => {
  legacyPartialForm = null;
  return true;
});
const cancelAgentForm = jest.fn(async () => {
  activeForm = null;
  return true;
});

jest.unstable_mockModule('../../src/database/database.js', () => ({
  default: databaseService,
  query: jest.fn().mockResolvedValue({ rows: [] }),
  getClient: jest.fn().mockResolvedValue({ query: jest.fn(), release: jest.fn() }),
  DatabaseService: class DatabaseService {},
}));

jest.unstable_mockModule('../../src/database/userRepository.js', () => ({
  default: { findByPhone: jest.fn().mockResolvedValue(null) },
}));

jest.unstable_mockModule('../../src/database/reservationRepository.js', () => ({
  default: {
    findByUser: jest.fn().mockResolvedValue([]),
    findByDate: jest.fn().mockResolvedValue([]),
    create: jest.fn(async (data) => {
      createdReservations.push(data);
      return { id: 'unexpected-reservation', ...data };
    }),
    updateStatus: jest.fn(),
  },
}));

jest.unstable_mockModule('../../src/servicios/agent-form-manager.js', () => ({
  getAgentForm,
  saveAgentForm,
  clearAgentForm,
  cancelAgentForm,
  getAllUserForms: jest.fn().mockResolvedValue({}),
}));

jest.unstable_mockModule('../../src/servicios/reservation-state.js', () => ({
  getPendingConfirmation: jest.fn(async () => pendingConfirmation),
  setPendingConfirmation: jest.fn(async (_userId, data) => { pendingConfirmation = data; }),
  clearPendingConfirmation: jest.fn(async () => { pendingConfirmation = null; }),
  clearJustConfirmed: jest.fn().mockResolvedValue(),
  markJustConfirmed: jest.fn().mockResolvedValue(),
}));

jest.unstable_mockModule('../../src/perfiles-interacciones/memoria-sqlite.js', () => ({
  loadAllProfiles: jest.fn().mockResolvedValue([]),
  loadProfile: jest.fn(async () => structuredClone(profile)),
  saveProfile: jest.fn(async (_userId, nextProfile) => {
    profile = { ...profile, ...structuredClone(nextProfile) };
    return profile;
  }),
  updateProfile: jest.fn(async (_userId, nextProfile) => {
    profile = { ...profile, ...structuredClone(nextProfile) };
    return profile;
  }),
  saveInteraction: jest.fn().mockResolvedValue(),
  loadConversationHistory: jest.fn().mockResolvedValue([]),
  saveConversationMessage: jest.fn().mockResolvedValue(),
  invalidateCachedProfile: jest.fn(),
  updateUser: jest.fn().mockResolvedValue(),
  updateReservationHistory: jest.fn().mockResolvedValue(),
  savePartialForm: jest.fn().mockResolvedValue(),
  getPartialForm: jest.fn(async () => legacyPartialForm),
  clearPartialForm,
  getUserPreferredLanguage: jest.fn().mockResolvedValue('es'),
  setUserPreferredLanguage: jest.fn().mockResolvedValue(),
  calculateReservationCost: jest.fn(() => ({ totalPrice: 0 })),
  getPaymentInfo: jest.fn(() => ({})),
  databaseService,
  clearPendingConfirmation: jest.fn(async () => { pendingConfirmation = null; }),
  getPendingConfirmation: jest.fn(async () => pendingConfirmation),
  savePendingConfirmation: jest.fn(async (_userId, data) => { pendingConfirmation = data; }),
}));

jest.unstable_mockModule('../../src/servicios/external-dispatcher.js', () => ({
  dispatchHttpRequest: jest.fn(async ({ body }) => {
    sentMessages.push(JSON.parse(body));
    return { ok: true, status: 200, json: async () => ({ id: `sent-${sentMessages.length}` }) };
  }),
  runWithRetry: jest.fn(async (_name, task) => task()),
  getCircuitState: jest.fn(() => null),
  getAllCircuits: jest.fn(() => ({})),
}));

const router = (await import('../../src/express-servidor/endpoints-api/wassenger.js')).default;

function formWaitingFor(field = 'beneficiaryName') {
  const base = {
    userId: ADMIN,
    isAdminBooking: true,
    reservationFor: 'other',
    beneficiaryName: null,
    beneficiaryPhone: null,
    beneficiaryEmail: null,
    email: null,
    spaceType: 'meetingRoom',
    date: '2026-10-05',
    time: '16:00',
    numPeople: 1,
    durationHours: 2,
    paymentMethod: null,
    freeTrialUsed: true,
  };

  if (field !== 'beneficiaryName') base.beneficiaryName = 'Francisco Zapata';
  if (!['beneficiaryName', 'beneficiaryPhone'].includes(field)) base.beneficiaryPhone = '+593991234567';
  if (!['beneficiaryName', 'beneficiaryPhone', 'beneficiaryEmail'].includes(field)) {
    base.beneficiaryEmail = 'francisco@example.com';
    base.email = 'francisco@example.com';
  }
  if (field === 'spaceType') base.spaceType = null;

  return base;
}

function webhookHandler() {
  const layer = router.stack.find(entry => entry.route?.path === '/webhooks/wassenger' && entry.route.methods.post);
  return layer.route.stack.at(-1).handle;
}

async function postIncoming(body, { quotedText = null, flushTimers = true } = {}) {
  const data = {
    id: `msg-${Date.now()}-${Math.random()}`,
    fromNumber: ADMIN,
    body,
    type: 'text',
    timestamp: Math.floor(Date.now() / 1000),
    fromMe: false,
  };
  if (quotedText) data.quotedMsg = { id: 'quoted-question', body: quotedText };

  const req = { body: { event: 'message:in:new', data }, headers: {}, connection: {} };
  const res = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
  await webhookHandler()(req, res);
  if (flushTimers) await jest.runAllTimersAsync();
  return res;
}

beforeEach(() => {
  jest.useFakeTimers();
  profile = {
    userId: ADMIN,
    name: 'Diego Villota',
    email: 'diego@example.com',
    freeTrialUsed: true,
    activeAgent: 'AURORA',
    preferredLanguage: 'es',
    dataConsentAt: '2026-01-01T00:00:00.000Z',
  };
  activeForm = formWaitingFor('beneficiaryName');
  legacyPartialForm = null;
  pendingConfirmation = null;
  sentMessages.length = 0;
  createdReservations.length = 0;
  jest.clearAllMocks();
});

afterAll(() => {
  jest.useRealTimers();
});

describe('Aurora BOSS — recorrido real del webhook', () => {
  test.each(['Francisco Zapata', 'francisco zapata'])(
    'consume el nombre activo “%s” citado por WhatsApp y envía una sola pregunta siguiente',
    async (name) => {
      await postIncoming(name, { quotedText: QUESTION });

      expect(activeForm).toMatchObject({
        userId: ADMIN,
        beneficiaryName: name,
        spaceType: 'meetingRoom',
        date: '2026-10-05',
        time: '16:00',
      });
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].message).toContain('número de celular');
      expect(sentMessages[0].message).not.toContain('nombre completo');
      expect(createdReservations).toHaveLength(0);
      expect(pendingConfirmation).toBeNull();
    }
  );

  test.each([
    ['beneficiaryName', 'cancelar'],
    ['beneficiaryPhone', 'cancelar reserva'],
    ['beneficiaryEmail', 'salir'],
    ['spaceType', 'olvida la reserva'],
  ])('cancela desde %s con “%s” antes de procesar el campo', async (field, command) => {
    activeForm = formWaitingFor(field);
    const permanentIdentity = { name: profile.name, email: profile.email };

    await postIncoming(command, { quotedText: QUESTION });

    expect(activeForm).toBeNull();
    expect(legacyPartialForm).toBeNull();
    expect(pendingConfirmation).toBeNull();
    expect(profile).toMatchObject({
      ...permanentIdentity,
      transactionStartedAt: null,
      transactionAgent: null,
      followUpSentAt: null,
    });
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].message).toMatch(/cancel[eé].*borrador/i);
    expect(sentMessages[0].message).not.toContain(QUESTION);
    expect(createdReservations).toHaveLength(0);
  });

  test('recupera y cancela un estado antiguo incoherente sin mezclar identidades', async () => {
    activeForm = {
      ...formWaitingFor('beneficiaryPhone'),
      reservationFor: 'self',
      beneficiaryName: 'Francisco Zapata',
      beneficiaryEmail: 'diego@example.com',
      email: 'francisco@example.com',
    };
    legacyPartialForm = { formType: 'reservation', beneficiaryName: 'Francisco Zapata' };
    pendingConfirmation = { _type: 'partial_form', beneficiaryName: 'Francisco Zapata' };

    await postIncoming('cancelar');

    expect(activeForm).toBeNull();
    expect(legacyPartialForm).toBeNull();
    expect(pendingConfirmation).toBeNull();
    expect(profile).toMatchObject({ name: 'Diego Villota', email: 'diego@example.com' });
    expect(sentMessages).toHaveLength(1);
    expect(createdReservations).toHaveLength(0);
  });

  test('cancela una confirmación Aurora pendiente sin crear ni borrar reservas', async () => {
    activeForm = null;
    pendingConfirmation = {
      userId: '+593991234567',
      reservationFor: 'other',
      userName: 'Francisco Zapata',
      date: '2026-10-05',
      startTime: '16:00',
    };

    await postIncoming('salir');

    expect(activeForm).toBeNull();
    expect(pendingConfirmation).toBeNull();
    expect(createdReservations).toHaveLength(0);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].message).toMatch(/cancel[eé].*borrador/i);
  });

  test('una solicitud posterior a cancelar comienza desde cero', async () => {
    activeForm = {
      ...formWaitingFor('beneficiaryPhone'),
      beneficiaryName: 'Francisco Zapata',
    };

    await postIncoming('cancelar');
    expect(activeForm).toBeNull();

    sentMessages.length = 0;
    await postIncoming('Reserva para mí una sala el 2026-10-05 a las 4pm');

    expect(activeForm).toMatchObject({
      userId: ADMIN,
      reservationFor: 'self',
      beneficiaryName: 'Diego Villota',
      beneficiaryPhone: ADMIN,
      beneficiaryEmail: 'diego@example.com',
      spaceType: 'meetingRoom',
      date: '2026-10-05',
      time: '16:00',
    });
    expect(JSON.stringify(activeForm)).not.toContain('Francisco');
    expect(sentMessages).toHaveLength(1);
  });

  test('cancelar descarta mensajes del mismo usuario que seguían en debounce', async () => {
    await postIncoming('Francisco Zapata', { quotedText: QUESTION, flushTimers: false });
    await jest.advanceTimersByTimeAsync(0);

    await postIncoming('cancelar', { flushTimers: false });
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(5000);

    expect(activeForm).toBeNull();
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].message).toMatch(/cancel[eé].*borrador/i);
    expect(sentMessages[0].message).not.toContain('número de celular');
    expect(createdReservations).toHaveLength(0);
  });

  test('un cliente normal conserva el flujo de reserva sin campos BOSS', async () => {
    const clientPhone = '+593992222222';
    activeForm = null;
    profile = {
      userId: clientPhone,
      name: 'Cliente Normal',
      email: 'cliente@example.com',
      freeTrialUsed: true,
      activeAgent: 'AURORA',
      preferredLanguage: 'es',
      dataConsentAt: '2026-01-01T00:00:00.000Z',
    };

    const data = {
      id: 'normal-client-message',
      fromNumber: clientPhone,
      body: 'Reserva una sala el 2026-10-05 a las 4pm',
      type: 'text',
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: false,
    };
    const req = { body: { event: 'message:in:new', data }, headers: {}, connection: {} };
    const res = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
    await webhookHandler()(req, res);
    await jest.runAllTimersAsync();

    expect(activeForm).toMatchObject({
      userId: clientPhone,
      isAdminBooking: false,
      reservationFor: null,
      beneficiaryName: null,
      spaceType: 'meetingRoom',
      date: '2026-10-05',
      time: '16:00',
    });
    expect(sentMessages).toHaveLength(1);
  });
});
