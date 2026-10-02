import { beforeEach, describe, expect, jest, test } from '@jest/globals';

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
  processMessageWithForm,
} = await import('../../src/servicios/partial-reservation-form.js');

const ADMIN = '+593994000001';
const ADMIN_PROFILE = {
  userId: ADMIN,
  name: 'Diego Villota',
  email: 'diego@example.com',
  freeTrialUsed: true,
};

beforeEach(() => {
  process.env.ADMIN_PHONE = ADMIN;
  jest.clearAllMocks();
  userRepository.findByPhone.mockResolvedValue(null);
  reservationRepository.findByUser.mockResolvedValue([]);
  reservationRepository.findByDate.mockResolvedValue([]);
});

describe('Aurora — máquina de beneficiario para reservas BOSS', () => {
  test('captura al tercero nombrado en el primer mensaje y conserva fecha y hora', async () => {
    const result = await processMessageWithForm(
      ADMIN,
      'Reserva para mi amigo Francisco Zapata hoy a las 4pm',
      ADMIN_PROFILE
    );

    expect(result.form).toMatchObject({
      userId: ADMIN,
      isAdminBooking: true,
      reservationFor: 'other',
      beneficiaryName: 'Francisco Zapata',
      time: '16:00',
    });
    expect(result.form.date).toBeTruthy();
    expect(result.nextQuestion).not.toContain('nombre completo');
  });

  test.each([
    'Reserva para Francisco Zapata el 2026-10-05 a las 4pm',
    'La reserva es para mi amigo Francisco Zapata el 2026-10-05 a las 4pm',
    'Reserva para mi colega Francisco Zapata el 2026-10-05 a las 4pm',
  ])('reconoce la variante natural “%s” como reserva para tercero', async (message) => {
    const result = await processMessageWithForm(ADMIN, message, ADMIN_PROFILE);

    expect(result.form.reservationFor).toBe('other');
    expect(result.form.beneficiaryName).toBe('Francisco Zapata');
    expect(result.nextQuestion).not.toContain('nombre completo');
  });

  test.each([
    ['francisco zapata', 'francisco zapata'],
    ['josé maría pérez', 'josé maría pérez'],
  ])('consume la respuesta activa “%s” una sola vez y avanza al celular', async (message, expectedName) => {
    const waiting = new PartialReservationForm(ADMIN, {
      isAdminBooking: true,
      reservationFor: 'other',
      spaceType: 'meetingRoom',
      date: '2026-10-02',
      time: '16:00',
    }, true);

    expect(waiting.getNextQuestion()).toContain('nombre completo');

    const result = await processMessageWithForm(
      ADMIN,
      message,
      ADMIN_PROFILE,
      waiting.toJSON()
    );

    expect(result.form).toMatchObject({
      beneficiaryName: expectedName,
      spaceType: 'meetingRoom',
      date: '2026-10-02',
      time: '16:00',
    });
    expect(result.updates).toMatchObject({ beneficiaryName: expectedName });
    expect(result.nextQuestion).toContain('número de celular');
    expect(result.nextQuestion).not.toContain('nombre completo');
  });

  test('captura “reserva para mi amigo francisco zapata” sin repetir el nombre', async () => {
    const result = await processMessageWithForm(
      ADMIN,
      'reserva para mi amigo francisco zapata el 2026-10-05 a las 4pm en una sala',
      ADMIN_PROFILE
    );

    expect(result.form).toMatchObject({
      reservationFor: 'other',
      beneficiaryName: 'francisco zapata',
      spaceType: 'meetingRoom',
      date: '2026-10-05',
      time: '16:00',
    });
    expect(result.nextQuestion).toContain('número de celular');
    expect(result.nextQuestion).not.toContain('nombre completo');
  });

  test('no interpreta “para hoy una sala” como nombre de beneficiario', async () => {
    const result = await processMessageWithForm(
      ADMIN,
      'Quiero reservar para hoy una sala a las 4pm',
      ADMIN_PROFILE
    );

    expect(result.form.reservationFor).toBeNull();
    expect(result.form.beneficiaryName).toBeNull();
    expect(result.nextQuestion).toBe('¿La reserva es para ti o para otra persona?');
  });

  test.each([
    'la reserva es para mí',
    'quiero hacer una reserva yo',
    'yo voy a usarla',
    'para mí',
    'yo mismo',
    'la usaré yo',
  ])('cambia de tercero a reserva propia con “%s” sin mezclar beneficiarios', async (message) => {
    const thirdParty = new PartialReservationForm(ADMIN, {
      isAdminBooking: true,
      reservationFor: 'other',
      beneficiaryName: 'Francisco Zapata',
      beneficiaryPhone: '+593991234567',
      beneficiaryEmail: 'francisco@example.com',
      email: 'francisco@example.com',
      spaceType: 'hotDesk',
      date: '2026-10-05',
      time: '16:00',
    }, true);

    const result = await processMessageWithForm(
      ADMIN,
      message,
      ADMIN_PROFILE,
      thirdParty.toJSON()
    );

    expect(result.form).toMatchObject({
      userId: ADMIN,
      reservationFor: 'self',
      beneficiaryName: 'Diego Villota',
      beneficiaryPhone: ADMIN,
      beneficiaryEmail: 'diego@example.com',
      email: 'diego@example.com',
      spaceType: 'hotDesk',
      date: '2026-10-05',
      time: '16:00',
    });
    expect(result.form.beneficiaryName).not.toContain('Francisco');
  });

  test('reserva propia directa usa el perfil administrativo válido', async () => {
    const result = await processMessageWithForm(
      ADMIN,
      'Aurora, reserva para mí una sala el 2026-10-05 a las 4pm',
      ADMIN_PROFILE
    );

    expect(result.form).toMatchObject({
      reservationFor: 'self',
      beneficiaryName: 'Diego Villota',
      beneficiaryPhone: ADMIN,
      beneficiaryEmail: 'diego@example.com',
      date: '2026-10-05',
      time: '16:00',
      spaceType: 'meetingRoom',
    });
  });

  test('al pasar de reserva propia a tercero limpia solo la identidad anterior', async () => {
    const ownReservation = new PartialReservationForm(ADMIN, {
      isAdminBooking: true,
      reservationFor: 'self',
      beneficiaryName: 'Diego Villota',
      beneficiaryPhone: ADMIN,
      beneficiaryEmail: 'diego@example.com',
      email: 'diego@example.com',
      spaceType: 'meetingRoom',
      date: '2026-10-05',
      time: '16:00',
    }, true);

    const result = await processMessageWithForm(
      ADMIN,
      'La reserva es para mi amigo Francisco Zapata',
      ADMIN_PROFILE,
      ownReservation.toJSON()
    );

    expect(result.form).toMatchObject({
      reservationFor: 'other',
      beneficiaryName: 'Francisco Zapata',
      beneficiaryPhone: null,
      beneficiaryEmail: null,
      email: null,
      spaceType: 'meetingRoom',
      date: '2026-10-05',
      time: '16:00',
    });
    expect(result.nextQuestion).toContain('número de celular');
  });

  test('mantiene sin cambios el flujo de un cliente no administrativo', async () => {
    const result = await processMessageWithForm(
      '+593992222222',
      'Reserva para mi amigo Francisco Zapata el 2026-10-05 a las 4pm',
      { userId: '+593992222222', email: 'cliente@example.com', freeTrialUsed: true }
    );

    expect(result.form.isAdminBooking).toBe(false);
    expect(result.form.reservationFor).toBeNull();
    expect(result.form.beneficiaryName).toBeNull();
  });
});
