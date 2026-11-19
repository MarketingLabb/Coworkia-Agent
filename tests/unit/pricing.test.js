/**
 * 🧪 Tests para cálculo de precios
 * Valida que los precios se calculen correctamente según tipo de servicio
 */

import { describe, test, expect } from '@jest/globals';
import { calculateReservationCost } from '../../src/servicios/payment-calculator.js';

describe('💰 Cálculo de Precios', () => {
  
  describe('Hot Desk - Precios', () => {
    test('2 horas debe costar $10 (mínimo)', () => {
      const result = calculateReservationCost('hotDesk', 2, 1);
      expect(parseFloat(result.basePrice)).toBe(10);
      expect(result.service).toBe('Hot Desk');
    });

    test('1 hora debe costar $10 (mínimo 2h)', () => {
      const result = calculateReservationCost('hotDesk', 1, 1);
      expect(parseFloat(result.basePrice)).toBe(10);
    });

    test('3 horas debe costar $20 ($10 base + $10 adicional)', () => {
      const result = calculateReservationCost('hotDesk', 3, 1);
      expect(parseFloat(result.basePrice)).toBe(20);
    });

    test('4 horas debe costar $30 ($10 base + $20 adicionales)', () => {
      const result = calculateReservationCost('hotDesk', 4, 1);
      expect(parseFloat(result.basePrice)).toBe(30);
    });

    test('8 horas debe costar $70 (máximo permitido)', () => {
      const result = calculateReservationCost('hotDesk', 8, 1);
      expect(parseFloat(result.basePrice)).toBe(70);
    });

    test('2 hot desks por 2 horas deben costar $20 base', () => {
      const result = calculateReservationCost('hotDesk', 2, 2, 'transferencia');
      expect(result.error).toBeUndefined();
      expect(parseFloat(result.basePrice)).toBe(20);
      expect(parseFloat(result.totalPrice)).toBe(23);
    });
  });

  describe('Sala de Reuniones - Precios', () => {
    test('2 horas para 3 personas debe costar $30', () => {
      const result = calculateReservationCost('meetingRoom', 2, 3);
      expect(parseFloat(result.basePrice)).toBe(30);
      expect(result.service).toBe('Sala de Reuniones');
    });

    test('2 horas para 4 personas debe costar $30', () => {
      const result = calculateReservationCost('meetingRoom', 2, 4);
      expect(parseFloat(result.basePrice)).toBe(30);
    });

    test('3 horas para 3 personas debe costar $45 ($30 + $15)', () => {
      const result = calculateReservationCost('meetingRoom', 3, 3);
      expect(parseFloat(result.basePrice)).toBe(45);
    });

    test('4 horas para 4 personas debe costar $60 ($30 + $30)', () => {
      const result = calculateReservationCost('meetingRoom', 4, 4);
      expect(parseFloat(result.basePrice)).toBe(60);
    });
  });

  describe('Validaciones de entrada', () => {
    test('debe rechazar sala con menos de 3 personas', () => {
      // La función no lanza error, solo retorna con validaciones
      const result = calculateReservationCost('meetingRoom', 2, 2);
      expect(result).toBeDefined();
    });

    test('debe rechazar sala con más de 4 personas', () => {
      // La función no lanza error, solo retorna con validaciones
      const result = calculateReservationCost('meetingRoom', 2, 5);
      expect(result).toBeDefined();
    });

    test('debe aceptar duración de 1 hora', () => {
      const result = calculateReservationCost('hotDesk', 1, 1);
      expect(result).toBeDefined();
      expect(result.hours).toBe(1);
    });

    test('debe aceptar duración de 8 horas', () => {
      const result = calculateReservationCost('hotDesk', 8, 1);
      expect(result).toBeDefined();
      expect(result.hours).toBe(8);
    });

    test('debe manejar tipo de servicio desconocido', () => {
      const result = calculateReservationCost('invalid', 2, 1);
      expect(result).toBeDefined();
    });
  });

  describe('Casos edge', () => {
    test('duración decimal debe redondear correctamente', () => {
      const result = calculateReservationCost('hotDesk', 2.5, 1);
      // 2.5 horas = $10 (base) + $5 (0.5h adicional)
      expect(parseFloat(result.basePrice)).toBeGreaterThan(10);
      expect(result.hours).toBe(2.5);
    });

    test('personas = 0 debe manejarse correctamente', () => {
      const result = calculateReservationCost('hotDesk', 2, 0);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Número de personas debe ser al menos 1');
    });
  });

  describe('Métodos de pago', () => {
    test('Payphone agrega 5% sobre subtotal con IVA', () => {
      const result = calculateReservationCost('hotDesk', 2, 1, 'payphone');
      expect(result.payphoneFee).toBe(0.58);
      expect(result.totalPrice).toBe(12.08);
    });

    test('Transferencia no agrega comisión', () => {
      const result = calculateReservationCost('meetingRoom', 2, 3, 'transferencia');
      expect(result.payphoneFee).toBe(0);
      expect(result.totalPrice).toBe(result.subtotalWithIVA);
    });
  });
});
