import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

const userRepository = { findByPhone: jest.fn().mockResolvedValue(null) };
const reservationRepository = {
  findByUser: jest.fn().mockResolvedValue([]),
  findByDate: jest.fn().mockResolvedValue([]),
};

jest.unstable_mockModule('../../src/servicios/reservation-state.js', () => ({
  getPendingConfirmation: jest.fn().mockResolvedValue(null),
  setPendingConfirmation: jest.fn().mockResolvedValue(),
  clearPendingConfirmation: jest.fn().mockResolvedValue(),
}));
jest.unstable_mockModule('../../src/database/userRepository.js', () => ({ default: userRepository }));
jest.unstable_mockModule('../../src/database/reservationRepository.js', () => ({ default: reservationRepository }));

const {
  PartialReservationForm,
  extractAdminBeneficiaryData,
  processMessageWithForm,
} = await import('../../src/servicios/partial-reservation-form.js');
const { validateBusinessHours, suggestAlternativeSlots } = await import('../../src/servicios/reservation-validation.js');
const { getConsentDecision, handleConsentDecision } = await import('../../src/servicios/contact-consent-flow.js');
const { sanitizeAutomaticCopies } = await import('../../src/servicios/email.js');
const { buildAuroraD3HTML } = await import('../../src/servicios/email-template-system.js');
const { HOURS, LOCATION, CONTACT, WIFI } = await import('../../src/utils/coworkia-facts.js');

const ADMIN = '+593994000001';

beforeEach(() => {
  process.env.ADMIN_PHONE = ADMIN;
  jest.clearAllMocks();
  userRepository.findByPhone.mockResolvedValue(null);
  reservationRepository.findByUser.mockResolvedValue([]);
  reservationRepository.findByDate.mockResolvedValue([]);
});

describe('A — reserva de Aurora iniciada por ADMIN_PHONE', () => {
  test('pregunta obligatoriamente para quién es y conserva los datos de reserva ya escritos', async () => {
    const result = await processMessageWithForm(
      ADMIN,
      'Quiero reservar un Hot Desk el 2026-10-05 a las 10am',
      { userId: ADMIN, name: 'Diego Mauricio Villota Sánchez', email: 'diego@example.com', freeTrialUsed: true }
    );

    expect(result.nextQuestion).toBe('¿La reserva es para ti o para otra persona?');
    expect(result.form).toMatchObject({ spaceType: 'hotDesk', date: '2026-10-05', time: '10:00' });
    expect(result.form.email).toBeNull();
  });

  test('reconoce ADMIN_PHONE con formato local y no intercepta usuarios normales', async () => {
    const admin = await processMessageWithForm(
      '0994000001', 'Quiero reservar el 2026-10-05 a las 10am',
      { userId: '0994000001', freeTrialUsed: true }
    );
    expect(admin.nextQuestion).toBe('¿La reserva es para ti o para otra persona?');

    const normal = await processMessageWithForm(
      '+593992222222', 'Quiero reservar el 2026-10-05 a las 10am',
      { userId: '+593992222222', email: 'cliente@example.com', freeTrialUsed: true }
    );
    expect(normal.nextQuestion).toContain('¿Qué espacio necesitas');
    expect(normal.form.isAdminBooking).toBe(false);
  });

  test('para sí mismo reutiliza únicamente el perfil válido y pregunta lo faltante', async () => {
    const initial = new PartialReservationForm(ADMIN, {
      spaceType: 'hotDesk', date: '2026-10-05', time: '10:00', paymentMethod: 'efectivo'
    }, true);
    const result = await processMessageWithForm(
      ADMIN,
      'Es para mí',
      { userId: ADMIN, name: 'Diego Mauricio Villota Sánchez', email: 'diego@example.com', freeTrialUsed: true },
      initial.toJSON()
    );

    expect(result.form).toMatchObject({
      reservationFor: 'self',
      beneficiaryName: 'Diego Mauricio Villota Sánchez',
      beneficiaryPhone: ADMIN,
      beneficiaryEmail: 'diego@example.com',
    });
    expect(result.isComplete).toBe(true);
  });

  test('para otra persona exige identidad completa, no hereda el perfil y la muestra en el resumen', () => {
    const form = new PartialReservationForm(ADMIN, {}, false);
    form.updateFields(extractAdminBeneficiaryData(
      'Para otra persona, nombre completo es María Fernanda Pérez, celular 099 123 4567, correo maria@example.com',
      form
    ));
    form.updateFields({
      email: form.beneficiaryEmail,
      spaceType: 'meetingRoom', date: '2026-10-05', time: '10:00', paymentMethod: 'transferencia'
    });
    form.freeTrialUsed = true;

    expect(form.getMissingFields()).toEqual([]);
    expect(form.getSummary()).toContain('Reserva para: María Fernanda Pérez');
    expect(form.getSummary()).toContain('+593991234567');
    expect(form.toJSON()).toMatchObject({ reservationFor: 'other', freeTrialUsed: true });

    const incomplete = new PartialReservationForm(ADMIN, { reservationFor: 'other', beneficiaryName: 'María Pérez' }, true);
    expect(incomplete.getNextQuestion()).toContain('celular');
  });
});

describe('B — horario se valida antes del tipo de espacio', () => {
  test('22:00 es inválido para cualquier espacio y las alternativas respetan facts', async () => {
    expect(validateBusinessHours('2026-10-05', '22:00', '24:00')).toMatchObject({ valid: false });
    const slots = suggestAlternativeSlots('2026-10-05', '22:00', 2, []);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every(slot => slot.startTime >= HOURS.open24 && slot.endTime <= HOURS.close24)).toBe(true);

    const result = await processMessageWithForm(
      '+593991111111',
      '¿Tienen servicio el 2026-10-05 a las 10pm?',
      { userId: '+593991111111', freeTrialUsed: true }
    );
    expect(result.nextQuestion).toContain('22:00 está fuera');
    expect(result.nextQuestion).toContain(HOURS.display);
    expect(result.nextQuestion).not.toContain('¿Qué espacio necesitas');
    expect(result.form.date).toBe('2026-10-05');
    expect(result.form.pendingAlternatives).toHaveLength(3);

    const restored = PartialReservationForm.fromJSON(result.form.toJSON(), true);
    expect(restored.date).toBe('2026-10-05');
    expect(restored.time).toBeNull();
    expect(restored.pendingAlternatives).toEqual(result.form.pendingAlternatives);
  });

  test('hora válida con espacio desconocido pregunta el tipo; mensaje incompleto pregunta fecha', async () => {
    const valid = await processMessageWithForm(
      '+593991111112', 'Quiero reservar el 2026-10-05 a las 10am',
      { userId: '+593991111112', freeTrialUsed: true }
    );
    expect(valid.nextQuestion).toContain('¿Qué espacio necesitas');

    const incomplete = new PartialReservationForm('+593991111113');
    incomplete.updateField('spaceType', 'hotDesk');
    expect(incomplete.getNextQuestion()).toContain('¿Para qué día');
  });
});

describe('C — consentimiento progresivo', () => {
  test('saludo natural no dispara consentimiento y la primera necesidad lo solicita una sola vez', () => {
    const greeting = getConsentDecision({ message: 'Hola', consentAt: null, consentRequestedAt: null });
    expect(greeting.action).toBe('greet');
    expect(greeting.message).not.toMatch(/política|consentimiento/i);

    const need = getConsentDecision({ message: 'Necesito una sala mañana', consentAt: null, consentRequestedAt: null });
    expect(need.action).toBe('request');
    expect(need.message).toMatch(/^Claro, te ayudo con eso/);
    expect(need.message).toContain('privacidad.html');

    const repeated = getConsentDecision({ message: 'Necesito una sala mañana', consentAt: null, consentRequestedAt: '2026-10-01' });
    expect(repeated.action).toBe('await-consent');
    expect(repeated.message).not.toContain('privacidad.html');
  });

  test('el saludo se entrega sin crear perfil ni registrar datos adicionales', async () => {
    const run = jest.fn();
    const send = jest.fn().mockResolvedValue({ ok: true });
    const result = await handleConsentDecision({
      decision: getConsentDecision({ message: 'Hola' }),
      userId: '+593991111117', run, send,
    });
    expect(result).toMatchObject({ handled: true, delivered: true });
    expect(run).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('contactos consentidos e internos no se interceptan', () => {
    expect(getConsentDecision({ message: 'Hola', consentAt: '2026-01-01' }).action).toBe('continue');
    expect(getConsentDecision({ message: 'Reserva', isInternal: true }).action).toBe('continue');
  });

  test('acepta y rechaza la respuesta posterior sin duplicar respuestas', async () => {
    const run = jest.fn().mockResolvedValue({ changes: 1 });
    const send = jest.fn().mockResolvedValue({ ok: true });
    const invalidate = jest.fn();

    const accepted = await handleConsentDecision({
      decision: getConsentDecision({ message: 'Sí' }),
      userId: '+593991111114', name: 'Ana', run, send, invalidate,
    });
    expect(accepted).toMatchObject({ handled: true, delivered: true, accepted: true });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toContain('data_consent_at = NOW()');
    expect(send).toHaveBeenCalledTimes(1);

    run.mockClear();
    send.mockClear();
    const declined = await handleConsentDecision({
      decision: getConsentDecision({ message: 'NO', consentRequestedAt: '2026-10-01' }),
      userId: '+593991111115', run, send,
    });
    expect(declined).toMatchObject({ handled: true, delivered: true, declined: true });
    expect(run).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('solo registra requested_at si el aviso se entregó y permite reanudar tras fallo', async () => {
    const run = jest.fn().mockResolvedValue({ changes: 1 });
    const failedSend = jest.fn().mockResolvedValue({ ok: false });
    const decision = getConsentDecision({ message: 'Necesito una sala' });

    const failed = await handleConsentDecision({
      decision, userId: '+593991111116', run, send: failedSend,
    });
    expect(failed).toMatchObject({ handled: true, delivered: false, requested: false });
    expect(run).not.toHaveBeenCalled();
    expect(getConsentDecision({ message: 'Necesito una sala', consentRequestedAt: null }).action).toBe('request');

    const delivered = await handleConsentDecision({
      decision, userId: '+593991111116', run,
      send: jest.fn().mockResolvedValue({ ok: true }),
    });
    expect(delivered).toMatchObject({ delivered: true, requested: true });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toContain('data_consent_requested_at');
    expect(run.mock.calls[0][0]).not.toContain('data_consent_at = NOW()');
  });
});

describe('E/F — correo y contenido canónico', () => {
  test('elimina @diegovillota.com solo de CC/BCC automáticos', () => {
    expect(sanitizeAutomaticCopies('cliente@example.com, Copia <Boss@DiegoVillota.com>')).toBe('cliente@example.com');
    expect(sanitizeAutomaticCopies(['ok@example.com', 'audit@diegovillota.com'])).toEqual(['ok@example.com']);
    expect(sanitizeAutomaticCopies('audit@diegovillota.com')).toBeUndefined();
    expect(sanitizeAutomaticCopies({ name: 'Auditoría', address: 'AUDIT@DIEGOVILLOTA.COM' })).toBeUndefined();
    expect(sanitizeAutomaticCopies({ address: ' audit@diegovillota.com ' })).toBeUndefined();
    const allowedObject = { name: 'Cliente', address: 'cliente@example.com' };
    expect(sanitizeAutomaticCopies(allowedObject)).toBe(allowedObject);
    expect(sanitizeAutomaticCopies('cliente@diegovillota.com.ec')).toBe('cliente@diegovillota.com.ec');
  });

  test('D+3 conserva marca y facts sin promociones inventadas ni sitio web', () => {
    const html = buildAuroraD3HTML({ nombre: 'María Pérez', servicio: 'Hot Desk', wasFree: true });
    expect(html).toContain('Coworkia');
    expect(html).toContain(WIFI.display);
    expect(html).toContain(HOURS.display);
    expect(html).toContain(LOCATION.addressFull);
    expect(html).toContain(CONTACT.phoneDisplay);
    expect(html).not.toMatch(/15% OFF|40%|WiFi premium|sitio web|diegovillota\.com/i);
  });

  test('los cron de Aurora usan horas locales de Ecuador y no UTC desplazado', () => {
    const source = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../src/servicios/aurora-enzo-followup-cron.js'),
      'utf8'
    );
    expect(source).toMatch(/auroraRebookJob = new CronJob\(\s*'0 10 \* \* \*'/);
    expect(source).toMatch(/auroraD1Job = new CronJob\(\s*'5 10 \* \* \*'/);
    expect(source).toMatch(/auroraD3Job = new CronJob\(\s*'0 14 \* \* \*'/);
    expect(source).toMatch(/auroraReminder24hJob = new CronJob\(\s*'0 18 \* \* \*'/);
    expect(source).toMatch(/auroraPaymentJob = new CronJob\(\s*'0 8 \* \* \*'/);
    expect(source).toMatch(/auroraDeliveryRetryJob = new CronJob\(\s*'\*\/5 \* \* \* \*'/);
  });
});
