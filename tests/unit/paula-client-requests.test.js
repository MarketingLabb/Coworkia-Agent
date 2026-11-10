/**
 * Paula — incidente 10-nov-2026: prometía enviar la cotización por correo sin
 * enviarla, y no actualizaba el email ("contacta a soporte").
 */
import { describe, test, expect } from '@jest/globals';
import {
  detectEmailChange, isPaulaEmailRequest, findPropertyNumber, buildQuoteCommand,
} from '../../src/servicios/paula-client-requests.js';

describe('Paula — peticiones de cliente', () => {
  test.each([
    ['I have new email now, can you change it to info@iapawer.com ?', 'info@iapawer.com'],
    ['cambia mi correo a a@b.com', 'a@b.com'],
    ['mi nuevo correo es a@b.com', 'a@b.com'],
  ])('detecta cambio de email: %s', (text, email) => {
    expect(detectEmailChange(text)).toBe(email);
  });

  test.each([
    'email me the quotation to a@b.com',
    'send the brochure to a@b.com',
    'change my email please',
  ])('no confunde con cambio de email: %s', (text) => {
    expect(detectEmailChange(text)).toBeNull();
  });

  test.each(['email me the quotation', 'send me the brochure', 'mándame la cotización por correo', 'envíamelo al correo'])(
    'detecta pedido de envío por correo: %s', (text) => expect(isPaulaEmailRequest(text)).toBe(true));

  test.each(['May i have a quotation of house #6?', 'is there something wrong?', 'thank you for the information'])(
    'no dispara envío con: %s', (text) => expect(isPaulaEmailRequest(text)).toBe(false));

  test('toma la casa del historial reciente', () => {
    expect(findPropertyNumber([
      'email me the quotation',
      'Here are the details for *House #6 - La Equilibrada*',
    ])).toBe('6');
    expect(findPropertyNumber(['casa jardín 3 por favor'])).toBe('3');
    expect(findPropertyNumber(['tengo 2 hijos', '$353,091.50 USD'])).toBeNull();
  });

  test('arma el comando que entiende sendPaulaCotizacion', () => {
    expect(buildQuoteCommand({ propertyNumber: '6', name: 'Diego Villota', email: 'a@b.com' }))
      .toBe('Envía cotización casa #6 para Diego Villota a@b.com');
    expect(buildQuoteCommand({ propertyNumber: null, name: 'Ana', email: 'a@b.com' }))
      .toContain('overview');
  });
});
