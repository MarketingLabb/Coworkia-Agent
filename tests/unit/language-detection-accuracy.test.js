import { describe, test, expect } from '@jest/globals';
import { detectLanguage, getUserLanguage } from '../../src/utils/language-detector.js';

// Mensajes reales de clientes en Ecuador que antes se detectaban mal
const SPANISH = [
  'Me interesa la oficina virtual, como pago?',
  'quisiera comprar una casa en cumbaya',
  'que horario tienen',
  'te envio la foto de la matricula',
  'cuanto vale la pintura de un guardachoque',
  'no hablo inglés',
  'Hola Aurora, una pregunta: tienen parqueadero?',
];

describe('detección por palabras completas', () => {
  test.each(SPANISH)('español: %s', (msg) => {
    expect(detectLanguage(msg, 'es').language).toBe('es');
    // Un cliente en español nunca debe pasar a otro idioma por estos mensajes
    expect(getUserLanguage(msg, 'es').language).toBe('es');
  });

  test.each([
    ['en', 'I need car insurance'],
    ['en', 'How much is the monthly plan?'],
    ['fr', 'Combien coûte le plan mensuel ?'],
    ['it', 'Quanto costa il piano mensile?'],
    ['pt', 'Quanto custa o plano mensal?'],
    ['qu', 'Allinllachu, imaynalla kachkanki'],
  ])('%s: %s', (lang, msg) => {
    expect(detectLanguage(msg).language).toBe(lang);
    expect(getUserLanguage(msg, 'es').language).toBe(lang);
  });

  test('una palabra suelta en otro idioma no cambia la conversación', () => {
    expect(getUserLanguage('thanks!', 'es').language).toBe('es');
    expect(getUserLanguage('ok gracias', 'en').language).toBe('en');
  });

  test('subcadenas ya no cuentan ("pi" en "pizarra", "ma" en "mañana")', () => {
    expect(detectLanguage('necesito la pizarra mañana', 'es').language).toBe('es');
  });
});
