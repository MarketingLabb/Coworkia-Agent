/**
 * 🧪 E2E Tests - Sistema Completo Multi-Agente
 * 
 * Suite de tests end-to-end que cubren:
 * 1. Detección de intenciones (detectar-intencion.js)
 * 2. Orquestación de agentes (orquestador.js)
 * 3. Handoffs entre agentes
 * 4. Flujos completos por agente
 * 5. Edge cases y escenarios reales
 * 
 * Versión: v422 - Post T5 Fixes
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('🎯 E2E: Sistema Multi-Agente Completo', () => {
  
  describe('🧠 1. Detección de Intenciones', () => {
    
    describe('Aurora - Reservas y Coordinación', () => {
      test('debe detectar reserva de Hot Desk', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('Necesito reservar un hot desk para mañana');
        
        expect(result.agent).toBe('AURORA');
        expect(result.reason).toContain('keyword');
        expect(result.flags.isKeywordMatch).toBe(true);
      });
      
      test('debe detectar solicitud de pago', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('Dame el link de pago por favor');
        
        expect(result.agent).toBe('AURORA');
        expect(result.flags.paymentLinkRequest).toBe(true);
      });
      
      test('debe detectar modificación de reserva', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('Necesito cambiar la hora de mi reserva');
        
        expect(result.agent).toBe('AURORA');
        expect(result.flags.requiresAurora).toBe(true);
        expect(result.reason).toContain('modification');
      });
      
      test('debe detectar cancelación', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('Quiero cancelar mi reserva');
        
        expect(result.flags.cancelacion).toBe(true);
        expect(result.agent).toBe('AURORA');
      });
    });
    
    describe('Aluna - Membresías', () => {
      test('debe detectar interés en membresía', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('Quiero información sobre el plan 10');
        
        expect(result.agent).toBe('ALUNA');
      });
      
      test('debe detectar plan mensual', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('Me interesa un plan mensual');
        
        expect(result.agent).toBe('ALUNA');
        expect(result.flags.isKeywordMatch).toBe(true);
      });
      
      test('debe detectar oficina virtual', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('Necesito una oficina virtual para mi empresa');
        
        expect(result.agent).toBe('ALUNA');
      });
    });
    
    describe('Paula - Bienes Raíces (Keywords Corregidos)', () => {
      test('Keywords de propiedad NO activan Paula (solo @paula lo activa)', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        // "Busco casa" NO debe activar Paula, Aurora responde y sugiere @paula
        const result = detectarIntencion('Busco casa en Quito');
        
        expect(result.agent).toBe('AURORA');
        expect(result.agent).not.toBe('PAULA');
      });
      
      test('Paula SOLO se activa con @paula (handoff explícito)', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('@paula necesito vender mi casa');
        
        expect(result.agent).toBe('PAULA');
        expect(result.flags.agentHandoff).toBe(true);
      });
      
      test('NO debe activar Paula solo con ciudad (FIX P0)', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('Necesito espacio de coworking en Quito');
        
        // Debe ser Aurora, NO Paula
        expect(result.agent).not.toBe('PAULA');
        expect(result.agent).toBe('AURORA');
      });
      
      test('NO debe activar Paula con "quito" sin contexto propiedad', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('¿Están en Quito?');
        
        expect(result.agent).not.toBe('PAULA');
      });
    });
    
    describe('Handoffs Explícitos', () => {
      test('debe detectar @enzo', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('@enzo necesito ayuda con marketing');
        
        expect(result.agent).toBe('ENZO');
        expect(result.flags.agentHandoff).toBe(true);
      });
      
      test('debe detectar @adriana', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('@adriana quiero cotizar seguro');
        
        expect(result.agent).toBe('ADRIANA');
        expect(result.flags.agentHandoff).toBe(true);
      });
      
      test('debe detectar @aluna', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('@aluna hola');
        
        expect(result.agent).toBe('ALUNA');
        expect(result.flags.agentHandoff).toBe(true);
      });
      
      test('debe volver a Aurora con @aurora', async () => {
        const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
        
        const result = detectarIntencion('@aurora necesito reservar');
        
        expect(result.agent).toBe('AURORA');
        expect(result.flags.returningToAurora).toBe(true);
      });
    });
  });
  
  describe('🎭 2. Configuración de Agentes', () => {
    
    test('Aurora debe tener lastUpdated y disclaimers', async () => {
      const { AURORA } = await import('../../src/deteccion-intenciones/aurora.js');
      
      expect(AURORA.lastUpdated).toBe('2026-01-12');
      expect(AURORA.modeloNegocio).toBeDefined();
      expect(AURORA.disclaimers).toBeDefined();
      expect(AURORA.disclaimers.disponibilidad).toContain('Disponibilidad');
      expect(AURORA.disclaimers.cancelacion).toContain('cancelación');
      expect(AURORA.personalidad.idiomas).toHaveLength(6);
    });
    
    test('Aluna debe tener disclaimers y modelo de negocio', async () => {
      const { ALUNA } = await import('../../src/deteccion-intenciones/aluna.js');
      
      expect(ALUNA.lastUpdated).toBe('2026-01-12');
      expect(ALUNA.modeloNegocio).toBeDefined();
      expect(ALUNA.modeloNegocio.cancelacion).toContain('Sin compromiso');
      expect(ALUNA.disclaimers).toBeDefined();
      expect(ALUNA.disclaimers.garantia).toContain('15 días');
      expect(ALUNA.disclaimers.programaReferidos).toContain('3+ meses');
    });
    
    test('Adriana debe aclarar que es BROKER', async () => {
      const { ADRIANA } = await import('../../src/deteccion-intenciones/adriana.js');
      
      expect(ADRIANA.modeloNegocio).toBeDefined();
      expect(ADRIANA.modeloNegocio.importante).toContain('intermediarios');
      expect(ADRIANA.disclaimers.broker).toContain('BROKER');
      // Verificar que aclara que NO es aseguradora (contiene "no aseguradora")
      expect(ADRIANA.disclaimers.broker.toLowerCase()).toContain('no');
      expect(ADRIANA.disclaimers.broker.toLowerCase()).toContain('aseguradora');
    });
    
    test('Ángela debe tener disclaimer médico crítico', async () => {
      const { ANGELA } = await import('../../src/deteccion-intenciones/angela.js');
      
      expect(ANGELA.disclaimers.noSoyMedico).toContain('NO soy médico');
      expect(ANGELA.disclaimers.emergencias).toContain('911');
      expect(ANGELA.disclaimers.noEsSeguro).toContain('NO es seguro');
    });
    
    test('Axel debe tener disclaimers ejemplares', async () => {
      const { AXEL } = await import('../../src/deteccion-intenciones/axel.js');
      
      expect(AXEL.disclaimers.cotizacion).toContain('NO incluye daños ocultos');
      expect(AXEL.disclaimers.dañosOcultos).toContain('NO confirmables');
      expect(AXEL.modeloNegocio.cotizacion).toContain('GRATUITA');
    });
    
    test('Todos los agentes deben tener 6 idiomas', async () => {
      const { AURORA } = await import('../../src/deteccion-intenciones/aurora.js');
      const { ALUNA } = await import('../../src/deteccion-intenciones/aluna.js');
      const { ADRIANA } = await import('../../src/deteccion-intenciones/adriana.js');
      const { ENZO } = await import('../../src/deteccion-intenciones/enzo.js');
      const { ANGELA } = await import('../../src/deteccion-intenciones/angela.js');
      const { AXEL } = await import('../../src/deteccion-intenciones/axel.js');
      const { GABI } = await import('../../src/deteccion-intenciones/gabi.js');
      const { PAULA } = await import('../../src/deteccion-intenciones/paula.js');
      
      expect(AURORA.personalidad.idiomas).toHaveLength(6);
      expect(ALUNA.personalidad.idiomas).toHaveLength(6);
      expect(ADRIANA.personalidad.idiomas).toHaveLength(6);
      expect(ENZO.personalidad.idiomas).toHaveLength(6);
      expect(ANGELA.personalidad.idiomas).toHaveLength(6);
      expect(AXEL.personalidad.idiomas).toHaveLength(6);
      expect(GABI.personalidad.idiomas).toHaveLength(6);
      expect(PAULA.personalidad.idiomas).toHaveLength(6); // todos los idiomas tras ML-5/6
    });
  });
  
  describe('🔄 3. Flujos End-to-End Completos', () => {
    
    test('Flujo: Usuario pregunta precio → Aurora responde → Solicita reserva', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      
      // Paso 1: Pregunta precio
      let result = detectarIntencion('¿Cuánto cuesta el hot desk?');
      expect(result.agent).toBe('AURORA');
      
      // Paso 2: Usuario solicita reserva
      result = detectarIntencion('Ok, quiero reservar para mañana');
      expect(result.agent).toBe('AURORA');
      expect(result.flags.isKeywordMatch).toBe(true);
    });
    
    test('Flujo: Usuario consulta membresía → Aluna → Cierre', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      const { ALUNA } = await import('../../src/deteccion-intenciones/aluna.js');
      
      // Paso 1: Consulta membresía
      let result = detectarIntencion('Me interesa un plan mensual');
      expect(result.agent).toBe('ALUNA');
      
      // Verificar que Aluna tiene metodología de cierre
      expect(ALUNA.getSystemPrompt('es')).toContain('DESCUBRIR');
      expect(ALUNA.getSystemPrompt('es')).toContain('PRESENTAR');
      expect(ALUNA.getSystemPrompt('es')).toContain('CERRAR');
    });
    
    test('Flujo: Usuario menciona @enzo → Enzo responde → Vuelve con @aurora', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      
      // Paso 1: Handoff a Enzo
      let result = detectarIntencion('@enzo necesito marketing');
      expect(result.agent).toBe('ENZO');
      expect(result.flags.agentHandoff).toBe(true);
      
      // Paso 2: Conversación con Enzo...
      
      // Paso 3: Retorno a Aurora
      result = detectarIntencion('@aurora quiero reservar ahora');
      expect(result.agent).toBe('AURORA');
      expect(result.flags.returningToAurora).toBe(true);
    });
    
    test('Flujo: Usuario pregunta por casa → Aurora sugiere @paula → Paula conectada', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      const { PAULA } = await import('../../src/deteccion-intenciones/paula.js');
      
      // Paso 1: Usuario pregunta por casa → Aurora responde (NO activa Paula)
      let result = detectarIntencion('Busco casa en Cumbayá');
      expect(result.agent).toBe('AURORA');
      
      // Paso 2: Usuario usa @paula explícitamente → Ahora SÍ activa Paula
      result = detectarIntencion('@paula quiero ver opciones de casas');
      expect(result.agent).toBe('PAULA');
      
      // Verificar que Paula tiene proceso de compra
      expect(PAULA.conocimiento.procesoCompra).toBeDefined();
      expect(PAULA.conocimiento.procesoCompra.pasos).toBeDefined();
      expect(PAULA.conocimiento.procesoCompra.pasos).toHaveLength(10);
    });
    
    test('Flujo: Post-email support → requiresAurora flag', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      
      const result = detectarIntencion('Recibí tu correo de confirmación y tengo dudas');
      
      expect(result.flags.postEmailSupport).toBe(true);
      expect(result.flags.requiresAurora).toBe(true);
      expect(result.agent).toBe('AURORA');
    });
  });
  
  describe('🚨 4. Edge Cases y Escenarios Complejos', () => {
    
    test('Mensaje ambiguo: "Quiero reservar un plan" → ¿Aluna o Aurora?', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      
      const result = detectarIntencion('Quiero reservar un plan mensual');
      
      // Debe priorizar Aluna por "plan mensual"
      expect(result.agent).toBe('ALUNA');
    });
    
    test('Usuario confundido: "Ya no sé qué hacer"', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      
      const result = detectarIntencion('Ya no sé qué hacer, estoy confundido');
      
      // Debe mantener Aurora o agente actual
      expect(result.agent).toBe('AURORA');
    });
    
    test('Saludo casual: "Hola" → No debe cambiar agente', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      
      const result = detectarIntencion('Hola');
      
      expect(result.flags.casualGreeting).toBe(true);
    });
    
    test('Pregunta identidad: "¿Quién eres?" → No debe cambiar agente', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      
      const result = detectarIntencion('¿Quién eres?');
      
      expect(result.flags.identityQuestion).toBe(true);
    });
    
    test('Keywords múltiples conflictivas: "plan" + "reserva"', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      
      // "plan mensual" es más específico que "reservar"
      const result = detectarIntencion('Necesito reservar el plan 10');
      
      expect(result.agent).toBe('ALUNA');
    });
    
    test('Handoff después de cancelación debe mantener Aurora', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      
      const result = detectarIntencion('Cancelar mi reserva');
      
      expect(result.flags.cancelacion).toBe(true);
      expect(result.agent).toBe('AURORA');
    });
  });
  
  describe('📊 5. Prioridades del Orquestador', () => {
    
    test('Handoff explícito debe tener máxima prioridad', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      
      // Aunque menciona "plan", @enzo debe ganar
      const result = detectarIntencion('@enzo necesito un plan de marketing');
      
      expect(result.agent).toBe('ENZO');
    });
    
    test('requiresAurora debe forzar Aurora incluso con keywords', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      
      const result = detectarIntencion('Necesito cambiar la hora de mi plan');
      
      // "cambiar hora" es modificación → requiresAurora
      expect(result.flags.requiresAurora).toBe(true);
      expect(result.agent).toBe('AURORA');
    });
    
    test('Keywords deben sugerir pero no forzar', async () => {
      const { detectarIntencion } = await import('../../src/deteccion-intenciones/detectar-intencion.js');
      
      const result = detectarIntencion('Cuéntame sobre las membresías');
      
      expect(result.agent).toBe('ALUNA');
      expect(result.flags.isKeywordMatch).toBe(true);
      // Confidence < 1.0 (no es handoff explícito)
    });
  });
  
  describe('🌍 6. Multi-idioma', () => {
    
    test('Todos los agentes deben tener getSystemPrompt con idioma', async () => {
      const { AURORA } = await import('../../src/deteccion-intenciones/aurora.js');
      const { ALUNA } = await import('../../src/deteccion-intenciones/aluna.js');
      const { ENZO } = await import('../../src/deteccion-intenciones/enzo.js');
      
      expect(typeof AURORA.getSystemPrompt).toBe('function');
      expect(typeof ALUNA.getSystemPrompt).toBe('function');
      expect(typeof ENZO.getSystemPrompt).toBe('function');
      
      // Debe aceptar userLanguage
      const promptEs = AURORA.getSystemPrompt(false, 'es');
      const promptEn = AURORA.getSystemPrompt(false, 'en');
      
      // Verificar que menciona el idioma configurado
      expect(promptEs.toLowerCase()).toMatch(/español|idioma actual.*es/i);
      expect(promptEn.toLowerCase()).toMatch(/english|idioma actual.*en/i);
      expect(promptEs).not.toBe(promptEn);
    });
    
    test('System prompts deben adaptarse culturalmente por idioma', async () => {
      const { ENZO } = await import('../../src/deteccion-intenciones/enzo.js');
      
      const promptEs = ENZO.getSystemPrompt('es');
      const promptEn = ENZO.getSystemPrompt('en');
      
      // Español debe contener indicadores de español
      expect(promptEs.toLowerCase()).toMatch(/español|tú|idioma actual.*es/i);
      
      // Inglés debe contener indicadores de inglés  
      expect(promptEn.toLowerCase()).toMatch(/english|idioma actual.*en/i);
    });
  });
  
  describe('✅ 7. Validaciones de Integridad', () => {
    
    test('Todos los agentes deben tener estructura mínima', async () => {
      const agentes = [
        'AURORA', 'ALUNA', 'ADRIANA', 'ENZO', 'angela', 'axel', 'gabi', 'PAULA'
      ];
      
      for (const agentName of agentes) {
        const module = await import(`../../src/deteccion-intenciones/${agentName}.js`);
        const agent = Object.values(module)[0]; // Primer export
        
        expect(agent.nombre).toBeDefined();
        expect(agent.rol).toBeDefined();
        expect(agent.personalidad).toBeDefined();
        expect(agent.personalidad.idiomas).toBeDefined();
        expect(agent.getSystemPrompt).toBeDefined();
        expect(agent.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/); // fecha de última actualización del agente
      }
    });
    
    test('Ningún agente debe tener referencias hardcodeadas obsoletas', async () => {
      const { AURORA } = await import('../../src/deteccion-intenciones/aurora.js');
      const { ALUNA } = await import('../../src/deteccion-intenciones/aluna.js');
      
      const auroraPrompt = AURORA.getSystemPrompt('es', false);
      const alunaPrompt = ALUNA.getSystemPrompt('es');
      
      // No debe tener fechas hardcodeadas viejas
      expect(auroraPrompt).not.toContain('2025');
      expect(alunaPrompt).not.toContain('noviembre');
      expect(alunaPrompt).not.toContain('v241');
    });
  });
});

