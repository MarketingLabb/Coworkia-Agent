/**
 * Sesión WhatsApp (Wassenger) — incidente 10-nov-2026.
 * checkWassenger() decía OK aunque la sesión estaba desconectada.
 * Verifica: alerta una sola vez por corte, por WA + email, y aviso al recuperarse.
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

const notifyCriticalError = jest.fn().mockResolvedValue(undefined);
const sendEmail = jest.fn().mockResolvedValue({ success: true });

jest.unstable_mockModule('../../src/servicios/notification-service.js', () => ({ notifyCriticalError }));
jest.unstable_mockModule('../../src/database/database.js', () => ({ query: jest.fn().mockResolvedValue([]) }));
jest.unstable_mockModule('../../src/servicios/email.js', () => ({
  sendEmail,
  getAdminCC: () => 'admin@example.com',
}));

const { _checkWhatsAppSession, _resetCountersForTest } = await import('../../src/servicios/health-monitor.js');

const ORIGINAL_FETCH = global.fetch;
const deviceResponse = status => ({ ok: true, json: async () => ({ session: { status } }) });

describe('health-monitor — sesión WhatsApp', () => {
  beforeEach(() => {
    process.env.WASSENGER_TOKEN = 'test-token';
    process.env.WASSENGER_DEVICE_ID = 'device-1';
    jest.clearAllMocks();
    _resetCountersForTest();
  });
  afterEach(() => { global.fetch = ORIGINAL_FETCH; });

  test('online no genera alertas', async () => {
    global.fetch = jest.fn().mockResolvedValue(deviceResponse('online'));
    expect(await _checkWhatsAppSession()).toBe('online');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.wassenger.com/v1/devices/device-1',
      expect.objectContaining({ headers: { Token: 'test-token' } })
    );
    expect(notifyCriticalError).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('desconectada alerta una sola vez por WA y email, y avisa al recuperarse', async () => {
    global.fetch = jest.fn().mockResolvedValue(deviceResponse('offline'));
    expect(await _checkWhatsAppSession()).toBe('offline');
    await _checkWhatsAppSession(); // segundo ciclo, mismo corte → sin spam

    expect(notifyCriticalError).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'admin@example.com',
      subject: expect.stringContaining('WhatsApp desconectado'),
    }));

    global.fetch = jest.fn().mockResolvedValue(deviceResponse('online'));
    expect(await _checkWhatsAppSession()).toBe('online');
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[1][0].subject).toContain('WhatsApp reconectado');
  });

  test('error de red o API no se confunde con sesión caída', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    expect(await _checkWhatsAppSession()).toBe('unknown');
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    expect(await _checkWhatsAppSession()).toBe('unknown');
    expect(notifyCriticalError).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
