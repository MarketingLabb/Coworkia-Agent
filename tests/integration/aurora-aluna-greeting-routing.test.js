import { describe, expect, jest, test } from '@jest/globals';

const getRelevantExamples = jest.fn().mockResolvedValue([]);
const formatRAGExamples = jest.fn(() => '');

jest.unstable_mockModule('../../src/servicios/rag-retriever.js', () => ({
  getRelevantExamples,
  formatRAGExamples,
}));

jest.unstable_mockModule('../../src/perfiles-interacciones/memoria-sqlite.js', () => ({
  loadAllProfiles: jest.fn().mockResolvedValue([]),
  loadProfile: jest.fn().mockResolvedValue(null),
  saveProfile: jest.fn().mockResolvedValue(),
  updateUser: jest.fn().mockResolvedValue(),
  saveInteraction: jest.fn().mockResolvedValue(),
  getPendingConfirmation: jest.fn().mockResolvedValue(null),
  savePendingConfirmation: jest.fn().mockResolvedValue(),
  clearPendingConfirmation: jest.fn().mockResolvedValue(),
  updateReservationHistory: jest.fn().mockResolvedValue(),
  savePartialForm: jest.fn().mockResolvedValue(),
  getPartialForm: jest.fn().mockResolvedValue(null),
  clearPartialForm: jest.fn().mockResolvedValue(),
  loadConversationHistory: jest.fn().mockResolvedValue([]),
  saveConversationMessage: jest.fn().mockResolvedValue(),
  getUserPreferredLanguage: jest.fn().mockResolvedValue('es'),
  setUserPreferredLanguage: jest.fn().mockResolvedValue(),
}));

jest.unstable_mockModule('../../src/servicios/reservation-state.js', () => ({
  clearJustConfirmed: jest.fn().mockResolvedValue(),
  clearPendingConfirmation: jest.fn().mockResolvedValue(),
  getPendingConfirmation: jest.fn().mockResolvedValue(null),
}));

const { procesarMensaje } = await import('../../src/deteccion-intenciones/orquestador.js');

function profile(activeAgent, conversationCount) {
  return {
    userId: `test-${activeAgent.toLowerCase()}`,
    name: 'Cliente Test',
    activeAgent,
    preferredLanguage: 'es',
    conversationCount,
    freeTrialUsed: false,
  };
}

describe('routing real — estilo conversacional Aurora y Aluna', () => {
  test('Aurora recibe el primer saludo con la regla de apertura natural', async () => {
    const result = await procesarMensaje('Hola', profile('AURORA', 1), []);

    expect(result.agenteKey).toBe('AURORA');
    expect(result.prompt).toContain('MENSAJE DEL USUARIO:\n"Hola"');
    expect(result.systemPrompt).toContain('NO empieces una respuesta con "Entonces"');
    expect(result.systemPrompt).toContain('✅ Usuario: "Hola"');
  });

  test('Aurora recibe una necesidad directa sin convertirla en un saludo', async () => {
    const message = 'Necesito reservar un Hot Desk';
    const result = await procesarMensaje(message, profile('AURORA', 1), []);

    expect(result.agenteKey).toBe('AURORA');
    expect(result.prompt).toContain(`"${message}"`);
    expect(result.systemPrompt).toContain(`✅ Usuario: "${message}"`);
    expect(result.systemPrompt).toContain('sin saludo introductorio');
  });

  test('Aluna recibe su necesidad directa y mantiene su personalidad', async () => {
    const message = 'Quiero conocer el Plan 20';
    const result = await procesarMensaje(message, profile('ALUNA', 1), []);

    expect(result.agenteKey).toBe('ALUNA');
    expect(result.agente).toBe('Aluna');
    expect(result.prompt).toContain(`"${message}"`);
    expect(result.systemPrompt).toContain(`✅ Usuario: "${message}"`);
    expect(result.systemPrompt).toContain('Closer de ventas consultiva');
  });

  test.each(['AURORA', 'ALUNA'])('%s no vuelve a saludar en conversación en curso', async (agent) => {
    const history = [
      { role: 'user', content: 'Quiero revisar opciones', agent },
      { role: 'assistant', content: 'Claro, revisemos lo que necesitas.', agent },
    ];
    const result = await procesarMensaje('Continúa por favor', profile(agent, 5), history);

    expect(result.agenteKey).toBe(agent);
    expect(result.prompt).toContain('CONVERSACIÓN RECIENTE');
    expect(result.systemPrompt).toContain('NO vuelvas a saludar');
    expect(result.systemPrompt).toContain('NO uses "Entonces" como apertura repetida');
  });

  test.each(['AURORA', 'ALUNA'])('%s acepta un dato solicitado y avanza sin muletilla', async (agent) => {
    const history = [
      { role: 'assistant', content: '¿Cuál es tu correo?', agent },
    ];
    const result = await procesarMensaje('cliente@example.com', profile(agent, 5), history);

    expect(result.agenteKey).toBe(agent);
    expect(result.prompt).toContain('cliente@example.com');
    expect(result.systemPrompt).toContain('acéptalo y avanza al siguiente dato');
    expect(result.systemPrompt).toContain('sin anteponer "Entonces"');
  });

  test.each(['AURORA', 'ALUNA'])('%s conserva un uso legítimo interno en la memoria', async (agent) => {
    const legitimateSentence = 'Si prefieres venir mañana, entonces reviso la disponibilidad.';
    const history = [
      { role: 'assistant', content: legitimateSentence, agent },
    ];
    const result = await procesarMensaje('Mañana está bien', profile(agent, 5), history);

    expect(result.prompt).toContain(legitimateSentence);
    expect(result.systemPrompt).toContain(legitimateSentence);
  });
});
