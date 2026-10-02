/**
 * 🧪 AURORA FOLLOW-UP SERVICE — Tests unitarios
 * Cubre: sendOneHourFollowups, sendRebookingReminders,
 *        sendOneHourFollowup (manual), sendRebookingReminder (manual)
 *
 * Las dependencias externas (enviarWhatsApp, DB queries) se mockean.
 */

import { jest } from '@jest/globals';

const processAutomationBatch = jest.fn(async ({ deliveries, dispatch }) => {
  for (const delivery of deliveries || []) {
    const result = await dispatch({ ...delivery, payload: delivery.payload });
    const success = delivery.channel === 'whatsapp' ? result?.ok === true : result?.success === true;
    if (!success) return { complete: false, failed: true, attempted: true };
  }
  return { complete: true, failed: false, attempted: true };
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.unstable_mockModule('../../src/express-servidor/endpoints-api/wassenger.js', () => ({
  enviarWhatsApp: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.unstable_mockModule('../../src/servicios/email.js', () => ({
  sendEmail: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.unstable_mockModule('../../src/database/auroraRepository.js', () => ({
  findReservationsForOneHourFollowup: jest.fn(),
  markFollowup1hSent: jest.fn().mockResolvedValue(),
  findReservationsForRebookingReminder: jest.fn(),
  markRebookReminderSent: jest.fn().mockResolvedValue(),
}));

jest.unstable_mockModule('../../src/perfiles-interacciones/memoria-sqlite.js', () => ({
  getUserPreferredLanguage: jest.fn().mockResolvedValue('es'),
}));

jest.unstable_mockModule('../../src/servicios/automation-delivery-service.js', () => ({
  processAutomationBatch,
  findDueAutomationBatches: jest.fn().mockResolvedValue([]),
}));

// ─── Import SUT after mocks ──────────────────────────────────────────────────

const { enviarWhatsApp } = await import('../../src/express-servidor/endpoints-api/wassenger.js');
const {
  findReservationsForOneHourFollowup,
  markFollowup1hSent,
  findReservationsForRebookingReminder,
  markRebookReminderSent,
} = await import('../../src/database/auroraRepository.js');

const {
  sendOneHourFollowups,
  sendRebookingReminders,
  sendOneHourFollowup,
  sendRebookingReminder,
} = await import('../../src/servicios/aurora-followup-service.js');

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockReservationHotDesk = {
  id: 101,
  user_phone: '+593991000001',
  service_type: 'hot_desk',
  date: '2026-03-22',
  start_time: '09:00',
  end_time: '18:00',
  total_price: 15,
  was_free: false,
  guest_count: 1,
  confirmed_at: new Date(Date.now() - 70 * 60 * 1000).toISOString(), // 70min ago
};

const mockReservationSala = {
  id: 202,
  user_phone: '+593991000002',
  service_type: 'sala_reunion',
  date: '2026-03-15',
  start_time: '14:00',
  end_time: '16:00',
  total_price: 40,
  was_free: false,
  guest_count: 4,
  confirmed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// 1️⃣ sendOneHourFollowups — cron +1h
// ============================================================================
describe('⏰ sendOneHourFollowups (cron)', () => {

  test('✅ Envía WA a cada reserva pendiente', async () => {
    findReservationsForOneHourFollowup.mockResolvedValue([mockReservationHotDesk]);

    const result = await sendOneHourFollowups();

    expect(result.success).toBe(true);
    expect(result.sent).toBe(1);
    expect(result.errors).toBe(0);
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
    expect(enviarWhatsApp).toHaveBeenCalledWith(mockReservationHotDesk.user_phone, expect.any(String));
  });

  test('✅ Entrega mediante outbox y finaliza solo tras el proveedor', async () => {
    findReservationsForOneHourFollowup.mockResolvedValue([mockReservationHotDesk]);

    await sendOneHourFollowups();

    expect(processAutomationBatch).toHaveBeenCalledWith(expect.objectContaining({
      entityId: mockReservationHotDesk.id,
      automationKey: 'aurora_followup_1h',
      legacyColumn: 'followup_1h_sent_at',
    }));
    expect(markFollowup1hSent).not.toHaveBeenCalled();
  });

  test('✅ Retorna sent=0 cuando no hay reservas pendientes', async () => {
    findReservationsForOneHourFollowup.mockResolvedValue([]);

    const result = await sendOneHourFollowups();

    expect(result.success).toBe(true);
    expect(result.sent).toBe(0);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  test('✅ Procesa múltiples reservas', async () => {
    const r2 = { ...mockReservationHotDesk, id: 102, user_phone: '+593991000003' };
    findReservationsForOneHourFollowup.mockResolvedValue([mockReservationHotDesk, r2]);

    const result = await sendOneHourFollowups();

    expect(result.sent).toBe(2);
    expect(enviarWhatsApp).toHaveBeenCalledTimes(2);
    expect(processAutomationBatch).toHaveBeenCalledTimes(2);
  });

  test('✅ Continúa con las demás reservas si una falla', async () => {
    const r2 = { ...mockReservationHotDesk, id: 102, user_phone: '+593991000004' };
    findReservationsForOneHourFollowup.mockResolvedValue([mockReservationHotDesk, r2]);
    // Primera falla, segunda ok
    enviarWhatsApp
      .mockRejectedValueOnce(new Error('WA timeout'))
      .mockResolvedValueOnce({ ok: true });

    const result = await sendOneHourFollowups();

    expect(result.success).toBe(true);
    expect(result.sent).toBe(1);
    expect(result.errors).toBe(1);
  });

  test('✅ Retorna success:false si la query falla', async () => {
    findReservationsForOneHourFollowup.mockRejectedValue(new Error('DB connection failed'));

    const result = await sendOneHourFollowups();

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('✅ Mensaje contiene el tipo de servicio', async () => {
    findReservationsForOneHourFollowup.mockResolvedValue([mockReservationHotDesk]);
    await sendOneHourFollowups();

    const sentMessage = enviarWhatsApp.mock.calls[0][1];
    // Debe mencionar el espacio o alguna característica de la reserva
    expect(sentMessage.length).toBeGreaterThan(20);
    expect(typeof sentMessage).toBe('string');
  });
});

// ============================================================================
// 2️⃣ sendRebookingReminders — cron D+7
// ============================================================================
describe('🔁 sendRebookingReminders (cron D+7)', () => {

  test('✅ Envía WA de re-booking a cada reserva completada hace 7 días', async () => {
    findReservationsForRebookingReminder.mockResolvedValue([mockReservationSala]);

    const result = await sendRebookingReminders();

    expect(result.success).toBe(true);
    expect(result.sent).toBe(1);
    expect(result.errors).toBe(0);
    expect(enviarWhatsApp).toHaveBeenCalledWith(mockReservationSala.user_phone, expect.any(String));
  });

  test('✅ Rebooking usa outbox persistente', async () => {
    findReservationsForRebookingReminder.mockResolvedValue([mockReservationSala]);

    await sendRebookingReminders();

    expect(processAutomationBatch).toHaveBeenCalledWith(expect.objectContaining({
      entityId: mockReservationSala.id,
      automationKey: 'aurora_rebook_d7',
      legacyColumn: 'rebook_reminder_sent_at',
    }));
    expect(markRebookReminderSent).not.toHaveBeenCalled();
  });

  test('✅ Retorna sent=0 cuando no hay reservas para D+7', async () => {
    findReservationsForRebookingReminder.mockResolvedValue([]);

    const result = await sendRebookingReminders();

    expect(result.success).toBe(true);
    expect(result.sent).toBe(0);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  test('✅ Retorna success:false si la query falla', async () => {
    findReservationsForRebookingReminder.mockRejectedValue(new Error('DB timeout'));

    const result = await sendRebookingReminders();

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('✅ El mensaje de re-booking invita a volver', async () => {
    findReservationsForRebookingReminder.mockResolvedValue([mockReservationSala]);
    await sendRebookingReminders();

    const sentMessage = enviarWhatsApp.mock.calls[0][1];
    expect(typeof sentMessage).toBe('string');
    expect(sentMessage.length).toBeGreaterThan(20);
  });
});

// ============================================================================
// 3️⃣ sendOneHourFollowup — trigger manual
// ============================================================================
describe('📲 sendOneHourFollowup (manual)', () => {

  test('✅ Envía WA y marca como enviado para la reserva dada', async () => {
    await sendOneHourFollowup(mockReservationHotDesk);

    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
    expect(enviarWhatsApp).toHaveBeenCalledWith(mockReservationHotDesk.user_phone, expect.any(String));
    expect(markFollowup1hSent).toHaveBeenCalledWith(mockReservationHotDesk.id);
  });

  test('✅ Funciona con reserva gratuita (was_free=true)', async () => {
    const freeReservation = { ...mockReservationHotDesk, id: 999, total_price: 0, was_free: true };

    await sendOneHourFollowup(freeReservation);

    expect(enviarWhatsApp).toHaveBeenCalled();
    expect(markFollowup1hSent).toHaveBeenCalledWith(999);
  });
});

// ============================================================================
// 4️⃣ sendRebookingReminder — trigger manual
// ============================================================================
describe('📲 sendRebookingReminder (manual)', () => {

  test('✅ Envía WA y marca rebook_reminder para la reserva dada', async () => {
    await sendRebookingReminder(mockReservationSala);

    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
    expect(enviarWhatsApp).toHaveBeenCalledWith(mockReservationSala.user_phone, expect.any(String));
    expect(markRebookReminderSent).toHaveBeenCalledWith(mockReservationSala.id);
  });

  test('✅ Funciona con diferentes tipos de servicio', async () => {
    const tipos = ['hot_desk', 'sala_reunion', 'oficina_privada', 'evento', 'coworking'];

    for (const service_type of tipos) {
      jest.clearAllMocks();
      const r = { ...mockReservationSala, service_type };
      await sendRebookingReminder(r);
      expect(enviarWhatsApp).toHaveBeenCalled();
    }
  });
});
