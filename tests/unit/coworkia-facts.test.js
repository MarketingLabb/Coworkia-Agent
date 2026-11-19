import { describe, expect, test } from '@jest/globals';

import {
  CONTACT,
  COWORKIA_FACTS,
  FREE_TRIALS,
  HOURS,
  LOCATION,
  MEMBERSHIP_PLANS,
  WIFI,
  getPlan,
  normalizePlanKey,
} from '../../src/utils/coworkia-facts.js';
import { COWORKIA_HOURS } from '../../src/utils/constants.js';

describe('coworkia-facts.js', () => {
  test('expone datos canónicos confirmados de Coworkia', () => {
    expect(LOCATION.addressFull).toBe('Whymper 403, Edificio Finistere, Planta Baja, Quito');
    expect(LOCATION.mapsUrl).toContain('maps.app.goo.gl');
    expect(CONTACT.phoneDisplay).toBe('+593 99 483 7117');
    expect(CONTACT.phoneWhatsApp).toBe('593994837117');
    expect(CONTACT).not.toHaveProperty('website');

    expect(HOURS.display).toBe('Lunes a Viernes 8:30 AM – 6:00 PM');
    expect(HOURS.open).toBe('8:30 AM');
    expect(HOURS.close).toBe('6:00 PM');
    expect(COWORKIA_HOURS).toBe(HOURS.display);

    expect(WIFI.display).toBe('WiFi de alta velocidad incluido');
    expect(WIFI.display).not.toMatch(/Mbps/i);
  });

  test('mantiene planes y pruebas gratuitas alineados con los criterios vigentes', () => {
    expect(MEMBERSHIP_PLANS.plan10.price).toBe(67);
    expect(MEMBERSHIP_PLANS.plan20.price).toBe(99);
    expect(MEMBERSHIP_PLANS.salareuniones.price).toBe(30);
    expect(MEMBERSHIP_PLANS.salareuniones.priceDisplay).toBe('$30 USD / sesión');
    expect(MEMBERSHIP_PLANS.salareuniones.hours).toContain('2 horas');
    expect(MEMBERSHIP_PLANS.salareuniones.hours).toContain('máximo 4 personas');

    expect(FREE_TRIALS.aurora.scope).toContain('Primera visita');
    expect(FREE_TRIALS.aurora.note).toContain(HOURS.display);
    expect(FREE_TRIALS.aurora.note).not.toContain('08:00 a 12:00');
  });

  test('normaliza claves, alias, mayúsculas, espacios, tildes y valores vacíos', () => {
    expect(normalizePlanKey('PLAN 20')).toBe('plan20');
    expect(normalizePlanKey(' oficina virtual ')).toBe('oficinavirtual');
    expect(normalizePlanKey('sala de reunión')).toBe('salareuniones');
    expect(normalizePlanKey('membresía mensual')).toBe('plan10');
    expect(normalizePlanKey(null)).toBe('plan10');
    expect(normalizePlanKey(undefined)).toBe('plan10');
    expect(normalizePlanKey('desconocido')).toBe('plan10');
  });

  test('getPlan retorna objetos canónicos congelados y fallback seguro', () => {
    expect(getPlan('Plan 20')).toBe(MEMBERSHIP_PLANS.plan20);
    expect(getPlan('sala')).toBe(MEMBERSHIP_PLANS.salareuniones);
    expect(getPlan('no existe')).toBe(MEMBERSHIP_PLANS.plan10);
    expect(Object.isFrozen(COWORKIA_FACTS)).toBe(true);
    expect(Object.isFrozen(MEMBERSHIP_PLANS.plan10)).toBe(true);
  });
});
