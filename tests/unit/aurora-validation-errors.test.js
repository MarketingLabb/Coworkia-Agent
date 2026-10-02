/**
 * 🧪 Tests para validación de errores en Aurora
 * Previene regresión del bug de .includes() sobre objetos
 */

import { describe, test, expect } from '@jest/globals';
import { validateReservation } from '../../src/servicios/reservation-validation.js';

describe('Aurora Validation Errors Structure', () => {
  test('validation.errors debe contener objetos con reason, no strings', () => {
    // Caso que causa el bug: horario fuera de rango
    const result = validateReservation(
      '2025-11-12', 
      '06:00',  // Antes de las 7am
      '08:00', 
      2
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(Array.isArray(result.errors)).toBe(true);
    
    // Verificar que errors contiene objetos, no strings
    result.errors.forEach(error => {
      expect(typeof error).toBe('object');
      expect(error).toHaveProperty('valid');
      expect(error).toHaveProperty('reason');
      expect(error.valid).toBe(false);
      expect(typeof error.reason).toBe('string');
    });
  });

  test('errores de horario deben tener reason con "horario"', () => {
    const result = validateReservation(
      '2025-11-12',
      '21:00',  // Después de las 20:00
      '23:00',
      2
    );

    expect(result.valid).toBe(false);
    const hasHorarioError = result.errors.some(
      err => err.reason?.includes('horario') || err.reason?.includes('Fuera del horario')
    );
    expect(hasHorarioError).toBe(true);
  });

  test('errores de duración deben tener reason con "duración"', () => {
    // Usar fecha futura para evitar error de "horario pasado"
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const futureDate = future.toISOString().split('T')[0];

    const result = validateReservation(
      futureDate,
      '07:00',
      '20:00',
      13  // Más de 12 horas (maxDurationHours = 12)
    );

    expect(result.valid).toBe(false);
    const hasDurationError = result.errors.some(
      err => err.reason?.includes('duración') || err.reason?.includes('Duración')
    );
    expect(hasDurationError).toBe(true);
  });

  test('validación correcta no debe tener errores', () => {
    // Usar fecha futura para evitar error de ventana
      const future = new Date();
      do {
      future.setUTCDate(future.getUTCDate() + 1);
      } while ([0, 6].includes(future.getUTCDay()));
      const futureDate = future.toISOString().split('T')[0];
    
    const result = validateReservation(
      futureDate,
      '10:00',
      '12:00',
      2
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('errores múltiples deben ser todos objetos', () => {
    const result = validateReservation(
      '2025-11-12',
      '22:00',  // Fuera de horario
      '06:00',  // Y duración inválida (-16h)
      -16
    );

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    
    // Todos deben ser objetos, no strings
    result.errors.forEach(error => {
      expect(typeof error).toBe('object');
      expect(error).toHaveProperty('reason');
      // NO debe ser un string directamente
      expect(typeof error.includes).toBe('undefined');
    });
  });
});
