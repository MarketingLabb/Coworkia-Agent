import { describe, expect, test } from '@jest/globals';

import { AURORA } from '../../src/deteccion-intenciones/aurora.js';
import { ALUNA } from '../../src/deteccion-intenciones/aluna.js';
import { ADRIANA } from '../../src/deteccion-intenciones/adriana.js';

const AGENTS = [
  ['Aurora', AURORA, 'Necesito reservar un Hot Desk'],
  ['Aluna', ALUNA, 'Quiero conocer el Plan 20'],
];

describe.each(AGENTS)('%s — aperturas sin "entonces"', (_name, agent, directNeed) => {
  test('primer mensaje: saluda naturalmente y no usa "Entonces" como saludo', () => {
    const prompt = agent.getSystemPrompt(false, 'es', 1);

    expect(prompt).toContain('NO empieces una respuesta con "Entonces"');
    expect(prompt).toContain('❌ "Entonces, ¿en qué puedo ayudarte?"');
    expect(prompt).toContain('✅ Usuario: "Hola"');
    expect(prompt).toMatch(/Respuesta: "¡Hola[^\n]*¿En qué puedo ayudarte/);
  });

  test('necesidad directa: responde a la necesidad sin saludo ni muletilla', () => {
    const prompt = agent.getSystemPrompt(false, 'es', 1);

    expect(prompt).toContain(`✅ Usuario: "${directNeed}"`);
    expect(prompt).toContain('responde directamente');
    expect(prompt).toContain('sin saludo introductorio');
    expect(prompt).toMatch(/conversationCount === 1[^\n]*usuario ya expres[oó] una necesidad/i);
  });

  test('conversación en curso: no vuelve a saludar ni abre con "Entonces"', () => {
    const prompt = agent.getSystemPrompt(false, 'es', 5);

    expect(prompt).toContain('NO vuelvas a saludar');
    expect(prompt).toContain('NO uses "Entonces" como apertura repetida');
  });

  test('dato solicitado: lo acepta y avanza sin añadir la muletilla', () => {
    const prompt = agent.getSystemPrompt(false, 'es', 5);

    expect(prompt).toContain('Si el usuario responde con un dato solicitado, acéptalo y avanza');
    expect(prompt).toContain('sin anteponer "Entonces"');
  });

  test('uso legítimo: conserva "entonces" como conector interno', () => {
    const prompt = agent.getSystemPrompt(false, 'es', 5);

    expect(prompt).toContain('Puede usarse como conector dentro de una explicación');
    expect(prompt).toContain('Si prefieres venir mañana, entonces reviso la disponibilidad');
  });
});

test('la regla queda limitada a Aurora y Aluna', () => {
  const adrianaPrompt = ADRIANA.getSystemPrompt(false, 'es', 5);

  expect(adrianaPrompt).not.toContain('NO empieces una respuesta con "Entonces"');
  expect(adrianaPrompt).not.toContain('NO uses "Entonces" como apertura repetida');
});
