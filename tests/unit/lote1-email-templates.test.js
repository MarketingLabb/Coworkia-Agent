import { beforeAll, describe, expect, jest, test } from '@jest/globals';

import {
  CONTACT,
  HOURS,
  LOCATION,
  MEMBERSHIP_PLANS,
  WIFI,
} from '../../src/utils/coworkia-facts.js';
import {
  buildAlunaD1HTML,
  buildAlunaD3HTML,
  buildAlunaRenewalHTML,
} from '../../src/servicios/email-template-system.js';
import {
  generateEmailForAgent,
  generateAlunaProformaHTML,
} from '../../src/servicios/generic-email-templates.js';

const stalePatterns = /300 Mbps|200 Mbps|0788|República del Salvador|Membresía Flex|\$39 USD \/ sesión|Primera semana de prueba/i;
const invalidRenderPatterns = /undefined|null|\[object Object\]/;

let PLAN_DATA;
let normalizePlanKey;

beforeAll(async () => {
  jest.unstable_mockModule('../../src/servicios/email.js', () => ({
    AGENT_FROM_NAMES: { aluna: 'Aluna' },
    DEFAULT_FROM_EMAIL: 'test@example.com',
    sendEmail: jest.fn(),
  }));
  jest.unstable_mockModule('../../src/database/alunaRepository.js', () => ({
    saveMembershipLead: jest.fn(),
    trackAlunaProspect: jest.fn(),
  }));
  jest.unstable_mockModule('../../src/database/database.js', () => ({
    default: {},
  }));
  jest.unstable_mockModule('../../src/utils/code-generator.js', () => ({
    generateSequentialCode: jest.fn(async () => 'ALU-0001'),
  }));

  ({ PLAN_DATA, normalizePlanKey } = await import('../../src/servicios/aluna-proforma-email.js'));
});

describe('Lote 1 email templates y datos canónicos', () => {
  test('PLAN_DATA de proformas se deriva de MEMBERSHIP_PLANS', () => {
    expect(PLAN_DATA.plan20.price).toBe(MEMBERSHIP_PLANS.plan20.priceDisplay);
    expect(PLAN_DATA.plan20.benefits).toBe(MEMBERSHIP_PLANS.plan20.benefits);
    expect(PLAN_DATA.salareuniones.price).toBe('$30 USD / sesión');
    expect(normalizePlanKey('SALA DE REUNIÓN')).toBe('salareuniones');
    expect(normalizePlanKey(undefined)).toBe('plan10');
  });

  test('render Aluna D1/D3/Renewal usa contacto y ubicación canónicos sin datos antiguos', () => {
    const d1 = buildAlunaD1HTML({
      name: 'Ana Torres',
      message: 'Quiero conocer el espacio',
      plan: 'Plan 10',
    });
    const d3 = buildAlunaD3HTML({
      name: 'Ana Torres',
      message: 'Sigo interesada',
    });
    const renewal = buildAlunaRenewalHTML({
      name: 'Ana Torres',
      plan: 'Plan 20',
      expirationDate: '2026-08-31',
      monthlyFee: 250,
    });

    for (const html of [d1, d3, renewal]) {
      expect(html).toContain(LOCATION.addressFull);
      expect(html).toContain(CONTACT.phoneDisplay);
      expect(html).toContain(CONTACT.whatsappUrl);
      expect(html).not.toMatch(stalePatterns);
      expect(html).not.toMatch(invalidRenderPatterns);
    }

    expect(d1).toContain(WIFI.display);
    expect(d1).toContain('Primera visita de prueba GRATIS');
    expect(renewal).toContain(WIFI.display);
  });

  test('render de proforma Aluna usa facts, Maps como ubicación y no website ficticio', () => {
    const html = generateAlunaProformaHTML({
      clientName: 'Ana Torres',
      planName: PLAN_DATA.salareuniones.name,
      planPrice: PLAN_DATA.salareuniones.price,
      planDays: PLAN_DATA.salareuniones.days,
      planHours: PLAN_DATA.salareuniones.hours,
      planBenefits: PLAN_DATA.salareuniones.benefits,
      planIdeal: PLAN_DATA.salareuniones.ideal,
      proformaCode: 'ALU-0001',
      coworkiaWhatsApp: CONTACT.phoneWhatsApp,
    });

    expect(html).toContain('$30 USD / sesión');
    expect(html).toContain(LOCATION.addressFull);
    expect(html).toContain(LOCATION.mapsUrl);
    expect(html).toContain(CONTACT.email);
    expect(html).toContain(CONTACT.phoneDisplay);
    expect(html).not.toMatch(/website oficial|sitio web oficial|diegovillota\.com/i);
    expect(html).not.toMatch(stalePatterns);
    expect(html).not.toMatch(invalidRenderPatterns);
  });

  test('dispatcher de proforma preserva firma y subject existente', () => {
    const email = generateEmailForAgent('ALUNA', 'proforma', {
      clientName: 'Ana Torres',
      planName: PLAN_DATA.plan20.name,
      planPrice: PLAN_DATA.plan20.price,
      planDays: PLAN_DATA.plan20.days,
      planHours: PLAN_DATA.plan20.hours,
      planBenefits: PLAN_DATA.plan20.benefits,
      planIdeal: PLAN_DATA.plan20.ideal,
      proformaCode: 'ALU-0002',
    });

    expect(email.subject).toBe('Tu propuesta de Plan 20 — Coworkia');
    expect(email.html).toContain(MEMBERSHIP_PLANS.plan20.priceDisplay);
    expect(email.html).toContain(CONTACT.phoneDisplay);
    expect(email.html).not.toMatch(stalePatterns);
    expect(email.html).not.toMatch(invalidRenderPatterns);
  });

  test('escapa HTML visible en D1 y proforma Aluna', () => {
    const d1 = buildAlunaD1HTML({
      name: '<script>alert(1)</script>',
      message: '<img src=x onerror=alert(1)>',
      plan: '<b>Plan 10</b>',
    });
    const proforma = generateAlunaProformaHTML({
      clientName: '<script>alert(1)</script>',
      planName: '<b>Sala</b>',
      planPrice: '$30 USD / sesión',
      planDays: 'Reserva',
      planHours: '2 horas',
      planBenefits: ['<img src=x onerror=alert(1)>'],
      planIdeal: '<b>Equipo</b>',
      nota: '<script>alert(2)</script>',
      coworkiaWhatsApp: CONTACT.phoneWhatsApp,
    });

    for (const html of [d1, proforma]) {
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;');
    }
  });
});
