import { describe, expect, jest, test } from '@jest/globals';

let pending;
const createReservation = jest.fn();
const clearPendingConfirmation = jest.fn(async () => { pending = null; });
const getPendingConfirmation = jest.fn(async () => pending);
const updateUser = jest.fn().mockResolvedValue();
const databaseService = {
  run: jest.fn().mockResolvedValue({ rowCount: 1 }),
  initialize: jest.fn().mockResolvedValue(),
};
const reservationRepository = {
  findByDate: jest.fn().mockResolvedValue([]),
  updateStatus: jest.fn(),
  update: jest.fn().mockResolvedValue(),
};

jest.unstable_mockModule('../../src/perfiles-interacciones/memoria-sqlite.js', () => ({
  loadProfile: jest.fn(),
  saveProfile: jest.fn(),
  updateUser,
  clearPendingConfirmation,
  getPendingConfirmation,
  savePendingConfirmation: jest.fn(),
}));
jest.unstable_mockModule('../../src/servicios/payment-calculator.js', () => ({
  getPaymentInfo: jest.fn(),
  calculateReservationCost: jest.fn(() => ({
    subtotalWithIVA: 11.5, totalPrice: 11.5, payphoneFee: 0,
  })),
}));
jest.unstable_mockModule('../../src/servicios/calendario.js', () => ({
  createReservation,
  checkHotDeskAvailability: jest.fn().mockResolvedValue({ available: true, availableCount: 4, maxCapacity: 4 }),
  assignHotDeskNumbers: jest.fn().mockResolvedValue([1]),
}));
jest.unstable_mockModule('../../src/servicios/email.js', () => ({ sendReservationConfirmation: jest.fn() }));
jest.unstable_mockModule('../../src/servicios/google-calendar.js', () => ({ createCalendarEvent: jest.fn() }));
jest.unstable_mockModule('../../src/database/database.js', () => ({ default: databaseService }));
jest.unstable_mockModule('../../src/servicios/task-queue.js', () => ({
  enqueueBackgroundTask: jest.fn().mockResolvedValue({ success: true }),
}));
jest.unstable_mockModule('../../src/servicios/reservation-state.js', () => ({
  markJustConfirmed: jest.fn().mockResolvedValue(),
  clearPendingConfirmation,
  getPendingConfirmation,
  setPendingConfirmation: jest.fn().mockResolvedValue(),
}));
jest.unstable_mockModule('../../src/database/reservationRepository.js', () => ({ default: reservationRepository }));
jest.unstable_mockModule('../../src/servicios/notification-helper.js', () => ({
  sendReservationNotifications: jest.fn().mockResolvedValue({ email: { success: true } }),
  sendConfirmationEmail: jest.fn().mockResolvedValue({ success: true }),
  createConfirmationCalendarEvent: jest.fn().mockResolvedValue({ success: true }),
}));
jest.unstable_mockModule('../../src/servicios/wifi-codes-service.js', () => ({
  generateWifiCode: jest.fn(), getWifiCodeForReservation: jest.fn(),
}));
jest.unstable_mockModule('../../src/servicios/payment-receipt-email.js', () => ({
  sendReservationReceiptByGabi: jest.fn(),
}));

const { processConfirmationResponse } = await import('../../src/servicios/confirmation-flow.js');

describe('A — confirmación idempotente de reserva para tercero', () => {
  test('dos mensajes SI sobre el mismo pendiente crean una sola reserva para el beneficiario', async () => {
    pending = {
      userId: '+593991234567',
      userName: 'María Fernanda Pérez',
      email: 'maria@example.com',
      bookedByPhone: '+593994000001',
      reservationFor: 'other',
      date: '2026-10-05',
      startTime: '10:00',
      endTime: '12:00',
      durationHours: 2,
      serviceType: 'hotDesk',
      totalPrice: 11.5,
      paymentMethod: 'transferencia',
      wasFree: false,
    };
    const created = {
      id: 'RES-1', user_phone: pending.userId, date: pending.date,
      start_time: pending.startTime, end_time: pending.endTime,
      service_type: pending.serviceType, total_price: pending.totalPrice,
    };
    createReservation.mockResolvedValue({ success: true, reservation: created });
    reservationRepository.updateStatus.mockResolvedValue({ ...created, status: 'pending_payment' });
    const adminProfile = {
      userId: '+593994000001', name: 'Diego Mauricio Villota Sánchez',
      email: 'diego@example.com', freeTrialUsed: false,
    };

    const first = await processConfirmationResponse('SI', adminProfile);
    const second = await processConfirmationResponse('SI', adminProfile);

    expect(first.success).toBe(true);
    expect(second).toMatchObject({ success: false, needsAction: false });
    expect(createReservation).toHaveBeenCalledTimes(1);
    expect(createReservation).toHaveBeenCalledWith(expect.objectContaining({
      userId: '+593991234567', userName: 'María Fernanda Pérez', email: 'maria@example.com', wasFree: false,
    }));
    expect(databaseService.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'), [
      '+593991234567', 'María Fernanda Pérez', 'maria@example.com',
    ]);
    expect(updateUser).toHaveBeenCalledWith('+593991234567', expect.objectContaining({ lastReservation: expect.any(Object) }));
    expect(clearPendingConfirmation).toHaveBeenCalledWith(adminProfile.userId);
    expect(reservationRepository.updateStatus).toHaveBeenCalledWith('RES-1', 'pending_payment');
    expect(reservationRepository.update).not.toHaveBeenCalledWith('RES-1', expect.objectContaining({ payment_status: 'paid' }));
  });
});
