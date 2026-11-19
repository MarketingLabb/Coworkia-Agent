// deteccion-intenciones/orquestador.js
// Aurora Core — Orquestador central del ecosistema Coworkia

import { receiptCopy } from '../utils/receipt-messages.js';
import { AURORA } from './aurora.js';
import { ALUNA } from './aluna.js';
import { ADRIANA } from './adriana.js';
import { ENZO } from './enzo.js';
import { ANGELA } from './angela.js';
import { AXEL } from './axel.js';
import { GABI } from './gabi.js';
import { PAULA } from './paula.js';
import { detectarIntencion, detectarSolicitudRecibo } from './detectar-intencion.js';
import { detectKeywordIA } from './intent-detection-helpers.js';
import { loggers } from '../utils/logger.js';
import { detectLanguage, detectLanguageCommand, detectLanguageListQuery, getLanguageListResponse } from '../utils/language-detector.js';
import { setUserPreferredLanguage } from '../perfiles-interacciones/memoria-sqlite.js';
import { clearAgentForm } from '../servicios/agent-form-manager.js';
import { clearJustConfirmed, clearPendingConfirmation, getPendingConfirmation } from '../servicios/reservation-state.js';
import { getUserReceipts, resendReceipt, formatReceiptsList } from '../servicios/receipt-lookup.js';
import { getRelevantExamples, formatRAGExamples } from '../servicios/rag-retriever.js';
import { formatHotDeskNumbers, getHotDeskNumbers } from '../utils/hot-desk-assignments.js';

// ⚠️ NOTA V2: detectPaulaOutOfScope() ELIMINADA
// Ahora SOLO @menciones explícitas cambian de agente
// Cada agente responde en su especialidad y sugiere @menciones si es necesario

export const AGENTES = {
  AURORA,
  ALUNA,
  ADRIANA,
  ENZO,
  ANGELA,
  AXEL,
  GABI,
  PAULA
};

// ✅ ELIMINADO: getHandoffMessages() DUPLICADA
// Ahora existe UNA SOLA versión en:
// src/deteccion-intenciones/handoff-messages.js
// Que es importada por handoff-manager.js

/**
 * Aurora Core decide TODO.
 */
export async function procesarMensaje(mensaje, perfil = {}, historial = [], formData = {}) {
  const startTime = Date.now();
  const activeAgent = perfil.activeAgent || 'AURORA';
  const userId = perfil.userId || 'unknown';

  loggers.orquestador.userMessage(userId, activeAgent, mensaje);

  // � KEYWORD CAMPAÑA: respuesta fija cuando usuario envía solo "IA"
  if (detectKeywordIA(mensaje)) {
    const nombre = perfil.nombre || '';
    console.log(`[KEYWORD-IA] 🎯 Keyword "IA" detectada para ${userId} — respondiendo CAMPAÑA #2`);
    return {
      respuesta: AURORA.getKeywordIAResponse(nombre),
      shouldReply: true,
      agente: 'AURORA',
      activeAgent: activeAgent
    };
  }
  // 🗣️ IDIOMAS: respuesta fija cuando preguntan qué idiomas habla el agente
  if (detectLanguageListQuery(mensaje)) {
    const userLang = perfil.preferredLanguage || 'es';
    console.log(`[IDIOMAS] 🌍 Consulta de idiomas detectada para ${userId} (agente: ${activeAgent}, lang: ${userLang})`);
    return {
      respuesta: getLanguageListResponse(userLang, activeAgent),
      shouldReply: true,
      agente: activeAgent,
      activeAgent: activeAgent
    };
  }
  // �🌍 Detectar idioma automáticamente en cada mensaje
  const languageCommand = detectLanguageCommand(mensaje);
  const languageDetection = detectLanguage(mensaje, perfil.preferredLanguage);
  
  // Si hay comando explícito de cambio de idioma (/english, /español, etc.)
  if (languageCommand && languageCommand !== perfil.preferredLanguage) {
    loggers.orquestador.debug('Comando de idioma detectado', { 
      userId, 
      from: perfil.preferredLanguage, 
      to: languageCommand 
    });
    await setUserPreferredLanguage(userId, languageCommand);
    perfil.preferredLanguage = languageCommand;
    console.log(`[LANGUAGE] 🌍 Idioma cambiado explícitamente: ${languageCommand}`);
  }
  // Si detecta cambio de idioma con evidencia clara, actualizar automáticamente
  // (strong = varias palabras del otro idioma y clara ventaja sobre el actual)
  else if (languageDetection.language !== perfil.preferredLanguage && 
           languageDetection.strong) {
    loggers.orquestador.debug('Cambio de idioma detectado automáticamente', { 
      userId, 
      from: perfil.preferredLanguage, 
      to: languageDetection.language,
      confidence: languageDetection.confidence,
      reason: languageDetection.reason
    });
    await setUserPreferredLanguage(userId, languageDetection.language);
    perfil.preferredLanguage = languageDetection.language;
    console.log(`[LANGUAGE] 🌍 Idioma actualizado automáticamente: ${languageDetection.language} (confianza: ${languageDetection.confidence})`);
  }
  // Logging del idioma detectado para debug
  else if (languageDetection.confidence > 0.5) {
    loggers.orquestador.debug('Idioma detectado (no cambia)', { 
      userId, 
      detected: languageDetection.language,
      current: perfil.preferredLanguage,
      confidence: languageDetection.confidence
    });
  }

  // 1. Detectar intención (🎯 FIX A7: pasar context con perfil y formData)
  const intent = detectarIntencion(mensaje, activeAgent, { perfil, formData });
  loggers.orquestador.debug('Intención detectada', { 
    userId, 
    activeAgent, 
    detectedAgent: intent.agent,
    reason: intent.reason,
    flags: Object.keys(intent.flags || {}) 
  });

  // NOTA V2: Out-of-scope detection ELIMINADA
  // Solo @menciones explicitas cambian de agente
  // Cada agente mantiene su especialidad y sugiere otros agentes si es necesario

  // MANEJO DE CANCELACION: Solo limpiar si HAY flujo activo
  if (intent.flags?.cancelacion) {
    console.log('[ORQUESTADOR] Cancelacion detectada');
    
    // Verificar si realmente hay algo que cancelar
    const pendingNew = await getPendingConfirmation(userId);
    const hasPending = !!pendingNew;
    const hasPartialForm = !!(formData?.resumed || formData?.partial);
    
    if (hasPending || hasPartialForm) {
      console.log('[ORQUESTADOR] 🧹 Limpiando flujo activo:', { 
        pendingConfirmation: hasPending, 
        partialForm: hasPartialForm 
      });
      
      try {
        // Limpiar confirmaciones pendientes (nuevo sistema reservation-state)
        if (pendingNew) {
          await clearPendingConfirmation(userId);
          console.log('[ORQUESTADOR] ✅ Confirmación pendiente (reservation-state) limpiada');
        }
        
        // Limpiar formulario parcial
        if (hasPartialForm) {
          await clearAgentForm(userId, 'AURORA');
          console.log('[ORQUESTADOR] ✅ Formulario parcial limpiado');
        }
        
        // Limpiar estado just-confirmed
        await clearJustConfirmed(userId);
        
        // Limpiar reservas pendientes del calendario
        const { cancelUserPendingReservations } = await import('../servicios/calendario.js');
        const cancelResult = await cancelUserPendingReservations(userId);
        
        // 🎯 CRÍTICO: Marcar en metadata para que webhook vea el flag
        intent.flags.cancelacionEjecutada = true;
        intent.flags.hadActiveFlow = true;
        intent.cancelacionResult = cancelResult;
        
        console.log('[ORQUESTADOR] ✅ Flujo cancelado exitosamente:', cancelResult);
      } catch (error) {
        console.error('[ORQUESTADOR] ❌ Error cancelando flujo:', error);
        intent.flags.cancelacionError = true;
        intent.cancelacionError = error.message;
      }
    } else {
      console.log('[ORQUESTADOR] ℹ️  Cancelación solicitada pero NO hay flujo activo - ignorando');
      intent.flags.noActiveFlow = true;
      intent.flags.cancelacionIgnorada = true;
    }
  }

  // 🧾 MANEJO DE SOLICITUD DE RECIBOS: Aurora busca y reenvía recibos
  const solicitudRecibo = detectarSolicitudRecibo(mensaje);
  if (solicitudRecibo && (activeAgent === 'AURORA' || activeAgent === 'ALUNA')) {
    console.log('[ORQUESTADOR] 🧾 Solicitud de recibo detectada');
    
    try {
      // Buscar recibos del usuario
      const receipts = await getUserReceipts(userId, 5);
      
      if (receipts.length === 0) {
        // No hay recibos
        const userLanguage = perfil.preferredLanguage || 'es';
        const noReceiptsMessage = receiptCopy(userLanguage).noReceipts;
        
        return {
          respuesta: noReceiptsMessage,
          shouldReply: true,
          metadata: {
            agent: activeAgent,
            receiptRequest: true,
            receiptsFound: 0
          }
        };
      }
      
      // Detectar si solicita reenvío de un recibo específico
      const receiptNumberMatch = mensaje.match(/REC-\d+-[A-Z0-9]+/i);
      
      if (receiptNumberMatch) {
        // Usuario proporcionó número de recibo específico - reenviar
        const receiptNumber = receiptNumberMatch[0].toUpperCase();
        console.log('[ORQUESTADOR] 📧 Reenviando recibo específico:', receiptNumber);
        
        const resendResult = await resendReceipt(receiptNumber, userId);
        
        if (resendResult.success) {
          const userLanguage = perfil.preferredLanguage || 'es';
          const successMessage = receiptCopy(userLanguage).resent(receiptNumber);
          
          return {
            respuesta: successMessage,
            shouldReply: true,
            metadata: {
              agent: activeAgent,
              receiptRequest: true,
              receiptResent: true,
              receiptNumber
            }
          };
        } else if (resendResult.notFound) {
          const userLanguage = perfil.preferredLanguage || 'es';
          const notFoundMessage = receiptCopy(userLanguage).notFound(receiptNumber);
          
          return {
            respuesta: notFoundMessage,
            shouldReply: true,
            metadata: {
              agent: activeAgent,
              receiptRequest: true,
              receiptNotFound: true,
              receiptNumber
            }
          };
        } else {
          throw new Error(resendResult.error);
        }
      }
      
      // Mostrar lista de recibos disponibles
      const userLanguage = perfil.preferredLanguage || 'es';
      const receiptsList = formatReceiptsList(receipts, userLanguage);
      
      const responseMessage = receiptCopy(userLanguage).listIntro(receiptsList);
      
      return {
        respuesta: responseMessage,
        shouldReply: true,
        metadata: {
          agent: activeAgent,
          receiptRequest: true,
          receiptsFound: receipts.length,
          receiptNumbers: receipts.map(r => r.receipt_number)
        }
      };
      
    } catch (error) {
      console.error('[ORQUESTADOR] ❌ Error manejando solicitud de recibo:', error);
      const userLanguage = perfil.preferredLanguage || 'es';
      const errorMessage = receiptCopy(userLanguage).error;
      
      return {
        respuesta: errorMessage,
        shouldReply: true,
        metadata: {
          agent: activeAgent,
          receiptRequest: true,
          error: error.message
        }
      };
    }
  }

  // 2. Aurora Core decide a qué agente ir
  const targetAgent = decidirAgente(intent, activeAgent);
  
  // 🔧 Verificar si el agente está en mantenimiento
  const targetAgentObj = AGENTES[targetAgent];
  if (targetAgentObj?.maintenance === true && targetAgent !== 'AURORA') {
    console.log(`[ORQUESTADOR] 🔧 ${targetAgent} en mantenimiento, redirigiendo a AURORA`);
    
    // Crear mensaje de mantenimiento según idioma del usuario
    const userLanguage = perfil.preferredLanguage || 'es';
    const maintenanceMessages = {
      es: `Disculpa, ${targetAgentObj.nombre} está temporalmente fuera de servicio por mantenimiento.\n\n¿En qué más puedo ayudarte? 😊`,
      en: `Sorry, ${targetAgentObj.nombre} is temporarily out of service for maintenance.\n\nHow else can I help you? 😊`,
      fr: `Désolé, ${targetAgentObj.nombre} est temporairement hors service pour maintenance.\n\nComment puis-je vous aider autrement? 😊`,
      it: `Scusa, ${targetAgentObj.nombre} è temporaneamente fuori servizio per manutenzione.\n\nCome posso aiutarti? 😊`,
      pt: `Desculpe, ${targetAgentObj.nombre} está temporariamente fora de serviço por manutenção.\n\nComo posso ajudá-lo? 😊`
    };
    
    return {
      respuesta: maintenanceMessages[userLanguage] || maintenanceMessages.es,
      shouldReply: true,
      shouldUpdateAgent: false,
      metadata: {
        agent: 'AURORA',
        previousAgent: activeAgent,
        intendedAgent: targetAgent,
        maintenance: true,
        maintenanceAgent: targetAgent
      }
    };
  }
  
  // 3. Detectar handoff y capturar contexto
  const isHandoff = targetAgent !== activeAgent;
  let handoffContext = isHandoff ? {
    fromAgent: activeAgent,
    toAgent: targetAgent,
    reason: intent.reason,
    userMessage: mensaje,
    timestamp: new Date().toISOString()
  } : null;

  if (isHandoff) {
    // Guardar en perfil para que persista en mensajes siguientes
    perfil.lastHandoffContext = handoffContext;
    loggers.orquestador.handoff(activeAgent, targetAgent, userId, intent.reason);
  } else if (!handoffContext && perfil.lastHandoffContext) {
    // No hay handoff nuevo: recuperar el contexto del handoff anterior
    // Solo si el agente activo sigue siendo el mismo al que se hizo el handoff
    const saved = perfil.lastHandoffContext;
    if (saved.toAgent === targetAgent) {
      handoffContext = { ...saved, recovered: true };
    } else {
      // El agente cambió a uno diferente — contexto anterior ya no aplica
      perfil.lastHandoffContext = null;
    }
  }

  // 4. Construir contexto reducido (Aurora filtra según agente)
  const contexto = construirContexto(perfil, historial, formData, handoffContext, targetAgent, intent);

  // 5. Determinar si hay modo especial
  let specialMode = null;
  if (intent.flags?.virtualAgentSalesPromo) {
    specialMode = 'VIRTUAL_AGENT_SALES';
  }

  // 6. Consultar reservas si el usuario pregunta por ellas
  let reservasContexto = '';
  const preguntaReservas = /\b(reserva|reservación|reservacion|cita|hora)\b/i.test(mensaje) && 
                           /\b(tengo|confirmada|pendiente|pendienes|activa|qué|cuál|cuáles|mi|mis|alguna)\b/i.test(mensaje);
  
  if (preguntaReservas && targetAgent === 'AURORA') {
    try {
      const reservasHoy = await AGENTES.AURORA.getConfirmedReservationsToday(userId);
      
      if (reservasHoy.length > 0) {
        reservasContexto = `\n\n📋 RESERVAS CONFIRMADAS HOY:\n`;
        reservasHoy.forEach((res, idx) => {
          const spaceName = res.service_type === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones';
          reservasContexto += `${idx + 1}. ${spaceName}\n`;
          reservasContexto += `   ⏰ ${res.start_time} - ${res.end_time}\n`;
          reservasContexto += `   💰 ${res.was_free ? 'GRATIS (primera visita)' : `$${res.total_price}`}\n`;
          const hotDeskNumbers = getHotDeskNumbers(res);
          if (hotDeskNumbers.length) {
            reservasContexto += `   🪑 ${hotDeskNumbers.length > 1 ? 'Puestos' : 'Puesto'} ${formatHotDeskNumbers(hotDeskNumbers)}\n`;
          }
        });
        reservasContexto += `\nMuestra esta información al usuario de forma clara y amigable.`;
      } else {
        reservasContexto = `\n\n📋 El usuario NO tiene reservas confirmadas para hoy.`;
      }
    } catch (error) {
      console.error('[ORQUESTADOR] Error consultando reservas:', error);
    }
  }

  // 7. Construir prompt para el agente
  const agente = AGENTES[targetAgent];
  if (!agente) throw new Error(`Agente no encontrado: ${targetAgent}`);

  const prompt = `
${contexto}${reservasContexto}

MENSAJE DEL USUARIO:
"${mensaje}"

INSTRUCCIONES:
- Responde como ${agente.nombre}
${specialMode ? '- ⚠️ MODO ESPECIAL ACTIVO: Sigue el formato exacto del system prompt' : '- Mantén tu rol: ' + agente.rol}
- No inventes datos que Aurora no te haya dado
- Si el tema no es de tu especialidad, indícalo
`.trim();

  // 🔥 AXEL necesita await porque recupera fotos de BD
  let systemPrompt;
  if (typeof agente.getSystemPrompt === 'function') {
    const promptResult = agente.getSystemPrompt(
      perfil.freeTrialUsed || false, 
      perfil.preferredLanguage || 'es', 
      perfil.conversationCount || 0,
      specialMode === undefined ? userId : specialMode // AXEL necesita userId como 4to parámetro
    );
    
    // Si es Promise (AXEL), await
    systemPrompt = promptResult instanceof Promise ? await promptResult : promptResult;
  } else {
    systemPrompt = agente.systemPrompt;
  }

  // � Language lock: reinforce language at top+bottom for non-Spanish to prevent AI reverting to Spanish
  const activeLang = perfil.preferredLanguage || 'es';
  if (activeLang !== 'es') {
    const langNames = { en: 'ENGLISH', fr: 'FRANÇAIS', it: 'ITALIANO', pt: 'PORTUGUÊS', qu: 'RUNASIMI (QUECHUA)' };
    const langName = langNames[activeLang] || activeLang.toUpperCase();
    const topLock = `🔒 IDIOMA ACTIVO: ${langName}\n⚠️ RESPONDE EXCLUSIVAMENTE EN ESTE IDIOMA. IGNORA el idioma del historial anterior.\n${'\u2501'.repeat(40)}\n\n`;
    const bottomLock = `\n\n${'\u2501'.repeat(40)}\n🔒 RECORDATORIO FINAL: El idioma activo es ${langName}. TODA respuesta en este idioma. Sin excepción.`;
    systemPrompt = topLock + systemPrompt + bottomLock;
  }

  // �🔧 Reemplazar placeholders con datos reales del usuario
  const userName = perfil.name || perfil.whatsappDisplayName || '';
  let systemPromptWithData = systemPrompt.replace(/ \{nombre\}|\{nombre\}/g, userName ? ` ${userName}` : '');
  const promptWithData = prompt.replace(/ \{nombre\}|\{nombre\}/g, userName ? ` ${userName}` : '');

  // 🧠 RAG: inyectar ejemplos de conversaciones exitosas similares (fire-and-forget safe)
  try {
    const ragExamples = await getRelevantExamples(targetAgent, mensaje, 2);
    const ragBlock = formatRAGExamples(ragExamples);
    if (ragBlock) {
      systemPromptWithData += ragBlock;
    }
  } catch (err) {
    // RAG es best-effort — no bloquear respuesta
  }

  const duration = Date.now() - startTime;
  loggers.orquestador.timing('procesarMensaje', duration, { userId, agent: targetAgent, isHandoff });

  return {
    agente: agente.nombre,
    agenteKey: targetAgent,
    razonSeleccion: intent.reason,
    systemPrompt: systemPromptWithData,
    prompt: promptWithData,
    metadata: {
      agentHandoff: isHandoff,
      targetAgent,
      intent,
      handoffContext,
      specialMode,
      ...(intent.flags?.cancelacionEjecutada && {
        cancelacion: true,
        cancelacionDetails: {
          hadActiveFlow: intent.flags?.hadActiveFlow,
          timestamp: new Date().toISOString()
        }
      })
    }
  };
}

/**
 * Decide qué agente debe responder según intent y contexto
 * 
 * PRIORIDAD:
 * 1. Handoff explícito (flags.agentHandoff) → CAMBIAR
 * 2. RequiresAurora (contexto crítico) → AURORA
 * 3. ReturningToAurora (desde agente) → AURORA
 * 4. Agente activo != AURORA → MANTENER (salvo forceChange)
 * 5. SuggestedAgent → SOLO cambiar si activeAgent === AURORA
 * 6. Fallback → intent.agent o AURORA
 */
function decidirAgente(intent, activeAgent) {
  const currentAgent = activeAgent || 'AURORA';
  
  // 1. Handoff explícito (mayor prioridad - @menciones, implicit keywords)
  if (intent.flags?.agentHandoff) {
    console.log('[DECIDIR-AGENTE] 🔀 Handoff explícito:', currentAgent, '→', intent.agent);
    return intent.agent;
  }
  
  // 2. Contexto requiere Aurora (reservas, pagos, post-email)
  if (intent.flags?.requiresAurora) {
    console.log('[DECIDIR-AGENTE] 🎯 Contexto requiere Aurora');
    return 'AURORA';
  }
  
  // 3. Retorno a Aurora desde agente especializado
  if (intent.flags?.returningToAurora) {
    console.log('[DECIDIR-AGENTE] ↩️  Retorno explícito a Aurora');
    return 'AURORA';
  }
  
  // 4. Agente especializado activo → MANTENER (salvo forceChange)
  if (currentAgent !== 'AURORA' && !intent.flags?.forceChange) {
    console.log('[DECIDIR-AGENTE] 🔒 Manteniendo agente especializado:', currentAgent);
    return currentAgent;
  }
  
  // 5. SuggestedAgent → Solo cambiar si estamos en Aurora
  if (intent.flags?.suggestedAgent) {
    if (currentAgent === 'AURORA') {
      console.log('[DECIDIR-AGENTE] 💡 Suggested agent desde Aurora:', intent.agent);
      return intent.agent; // Aurora puede cambiar a sugeridos
    } else {
      console.log('[DECIDIR-AGENTE] 🚫 Suggested agent ignorado (agente activo):', currentAgent);
      return currentAgent; // Agente especializado ignora sugerencias
    }
  }
  
  // 6. Fallback
  const finalAgent = intent.agent || 'AURORA';
  console.log('[DECIDIR-AGENTE] 🔄 Fallback:', finalAgent);
  return finalAgent;
}

/**
 * Aurora resume lo que el agente necesita saber.
 * 🎯 ARQUITECTURA: Solo AURORA y ALUNA reciben contexto de reservas.
 * Otros agentes (Enzo, Angela, etc) operan sin contaminar con datos de coworking.
 */
function construirContexto(perfil = {}, historial = [], formData = {}, handoffContext = null, targetAgent = 'AURORA', intent = null) {
  const lineas = [];

  lineas.push(`USUARIO: ${perfil.name || 'Cliente'}`);
  if (perfil.email) lineas.push(`Email: ${perfil.email}`);

  // 📸 Instrucciones clave para AXEL (fotos agrupadas)
  if (targetAgent === 'AXEL' || intent?.flags?.axelPhotoInstructions) {
    lineas.push('\n📸 FLUJO AXEL (fotos)');
    lineas.push('• Acepta hasta 4 fotos. Usuario escribe "listo" al terminar.');
    lineas.push('• Agrupa 20s y responde un solo mensaje (no foto por foto).');
    lineas.push('• Resume daños y pregunta si falta algo. Sugiere: "no tengo" | "me falta cotizar <pieza>".');
    lineas.push('• Pide marca, modelo, año y email para enviar cotización HTML con fotos comprimidas.');
  }

  // 🤖 PROMPTS ESPECIALES: Contexto mínimo (system prompt tiene todas las instrucciones)
  const isVirtualAgentSales = intent?.flags?.virtualAgentSalesPromo === true;
  if (isVirtualAgentSales) {
    lineas.push('\n🔴 MODO: DEMO_SISTEMA_ONEMIND');
    // NO agregar más instrucciones - el system prompt especializado ya las tiene
    return lineas.join('\n');
  }

  // 🗑️ CANCELACIÓN: Si el usuario pidió cancelar, informar el resultado
  if (intent?.flags?.cancelacion && intent?.cancelacionResult) {
    const result = intent.cancelacionResult;
    lineas.push('\n🗑️ CANCELACIÓN SOLICITADA:');
    if (result.success) {
      lineas.push(`✅ Se cancelaron ${result.cancelledCount} reserva(s) pendiente(s)`);
      if (result.cancelledCount > 0) {
        lineas.push('📋 El sistema está limpio y disponible para nuevas reservas');
      } else {
        lineas.push('ℹ️ No había reservas pendientes por cancelar');
      }
    } else {
      lineas.push(`❌ Error: ${result.error}`);
    }
    lineas.push('\n💬 INSTRUCCIÓN: Confirma al usuario que su solicitud fue procesada y pregunta si desea hacer algo más.');
  }

  if (perfil.upcomingReservations?.length) {
    lineas.push(`Reservas futuras: ${perfil.upcomingReservations.length}`);
  }

  // 🔒 AISLAMIENTO: Solo agentes de coworking reciben contexto de reservas
  // GABI es agente externo (GR Consulting) — no debe recibir formularios ni datos de reservas
  const isCoworkingAgent = ['AURORA', 'ALUNA'].includes(targetAgent);
  const isExternalAgent = ['GABI', 'ENZO', 'ANGELA', 'AXEL', 'PAULA'].includes(targetAgent);
  
  // 🛡️ PROTECCIÓN: NO agregar contexto de reservas si es venta de agentes virtuales
  const skipReservationContext = isVirtualAgentSales;

  // 📅 FASE 4: Sesión nueva tras ausencia — contexto de última sesión para Aurora
  // Se activa cuando: agente es AURORA, no hay handoff activo, y han pasado más de 4h
  if (targetAgent === 'AURORA' && !handoffContext && !skipReservationContext && historial.length > 0) {
    const lastMsg = perfil.lastMessageAt ? new Date(perfil.lastMessageAt) : null;
    const gapHours = lastMsg ? (Date.now() - lastMsg.getTime()) / 3600000 : 0;
    const isReturningSession = gapHours > 4 && (perfil.conversationCount || 0) > 2;

    if (isReturningSession) {
      // Extraer último tema relevante: último mensaje de usuario que no sea @mention ni saludo
      const lastMeaningful = historial
        .filter(m => m.role === 'user')
        .map(m => (m.content || '').trim())
        .filter(c => c.length > 8 && !/^@\w+\s*$/i.test(c) && !/^(hola|hi|hello|buenas|hey)\s*[.!]?$/i.test(c))
        .slice(-1)[0];

      // Último agente especialista con el que habló (si no fue Aurora)
      const lastSpecialist = historial
        .filter(m => m.role === 'assistant' && m.agent && m.agent !== 'AURORA')
        .slice(-1)[0]?.agent;

      if (lastMeaningful || lastSpecialist) {
        const horasRedondeadas = Math.round(gapHours);
        const tiempoStr = horasRedondeadas < 24
          ? `${horasRedondeadas}h`
          : `${Math.round(horasRedondeadas / 24)} día${Math.round(horasRedondeadas / 24) > 1 ? 's' : ''}`;

        lineas.push(`\n🕐 USUARIO REGRESA (ausente ${tiempoStr}):`);
        if (lastMeaningful) lineas.push(`Último tema: "${lastMeaningful.substring(0, 100)}"`);
        if (lastSpecialist) lineas.push(`Último agente especialista: ${lastSpecialist}`);
        lineas.push('⚠️ ACCIÓN: Salúdalo mencionando el contexto anterior de forma natural. No uses frases genéricas.');
      }
    }
  }

  // 🔄 FASE 6: RETORNO A AURORA — reserva pendiente desde antes del handoff
  const isReturningToAurora = targetAgent === 'AURORA' && 
                              handoffContext && 
                              handoffContext.fromAgent !== 'AURORA';
  
  if (isReturningToAurora && !skipReservationContext) {
    // Caso A: formulario activo en memoria
    const pendingForm = formData?.form && !formData.form.isComplete() ? formData.form : null;
    // Caso B: formulario guardado (savedPartial) aunque no esté activo
    const savedForm = !pendingForm && formData?.savedPartial?.formData ? formData.savedPartial.formData : null;
    const anyForm = pendingForm || savedForm;

    if (anyForm) {
      const data = pendingForm ? pendingForm : anyForm;
      const captured = [];
      if (data.spaceType) captured.push(data.spaceType === 'hotDesk' ? 'Hot Desk' : 'Sala Reuniones');
      if (data.date) captured.push(`fecha: ${data.date}`);
      if (data.time) captured.push(`hora: ${data.time}`);
      if (data.email) captured.push(`email: ${data.email}`);
      if (data.durationHours && data.durationHours > 2) captured.push(`duración: ${data.durationHours}h`);

      lineas.push('\n🔄 RESERVA PENDIENTE (antes del handoff):');
      if (captured.length > 0) lineas.push(`✅ Datos guardados: ${captured.join(', ')}`);

      const missing = pendingForm?.getMissingFields
        ? pendingForm.getMissingFields()
        : [];
      if (missing.length > 0) lineas.push(`❌ Falta: ${missing.join(', ')}`);

      lineas.push('⚠️ ACCIÓN OBLIGATORIA: Saluda al usuario y RETOMA ACTIVAMENTE la reserva —');
      lineas.push('dile que tienes sus datos guardados y pregunta directamente por lo que falta.');
      lineas.push('Ejemplo: "Oye, tengo guardada tu reserva para [fecha/espacio]. ¿Terminamos con el [campo faltante]?"');
    }
  }
  
  if (isCoworkingAgent && formData?.summary && !skipReservationContext) {
    lineas.push(`Reserva en proceso: ${formData.summary}`);
  }
  
  // 📋 FORMULARIO PARCIAL GUARDADO: Si hay formulario guardado pero no activo, informar
  if (isCoworkingAgent && formData?.savedPartial && !formData?.form && !skipReservationContext) {
    const saved = formData.savedPartial;
    if (saved.formData && !saved.cancelledAt) {
      const data = saved.formData;
      const captured = [];
      
      if (data.spaceType) {
        const spaceLabel = data.spaceType === 'hotDesk' ? 'Hot Desk' : 'Sala Reuniones';
        captured.push(`tipo (${spaceLabel})`);
      }
      if (data.date) captured.push(`fecha (${data.date})`);
      if (data.time) captured.push(`hora (${data.time})`);
      if (data.email) captured.push(`email (${data.email})`);
      if (data.numPeople && data.numPeople > 1) captured.push(`personas (${data.numPeople})`);
      
      if (captured.length > 0) {
        lineas.push('\n📋 RESERVA PENDIENTE (continuación):');
        lineas.push(`✅ Datos guardados: ${captured.join(', ')}`);
        lineas.push('\n⚠️ ACCIÓN: El usuario está continuando una reserva. Retoma el flujo y pregunta solo lo que falta.');
      }
    }
  }
  
  // 📋 FORMULARIO DE RESERVA: Solo para Aurora/Aluna
  if (isCoworkingAgent && formData?.form && !skipReservationContext) {
    const form = formData.form;
    const completed = [];
    const missing = [];
    
    // Analizar qué campos están completos y cuáles faltan
    if (form.spaceType) {
      const spaceLabel = form.spaceType === 'hotDesk' ? 'Hot Desk' : 'Sala Reuniones';
      completed.push(`tipo (${spaceLabel})`);
    } else {
      missing.push('tipo de espacio');
    }
    
    if (form.date) {
      completed.push(`fecha (${form.date})`);
    } else {
      missing.push('fecha');
    }
    
    if (form.time) {
      completed.push(`hora (${form.time})`);
    } else {
      missing.push('hora');
    }
    
    if (form.email) {
      completed.push(`email (${form.email})`);
    } else {
      missing.push('email');
    }
    
    if (form.numPeople && form.numPeople > 1) {
      completed.push(`personas (${form.numPeople})`);
    }
    
    // Construir mensaje informativo
    lineas.push('\n📋 FORMULARIO DE RESERVA EN PROCESO:');
    
    if (completed.length > 0) {
      lineas.push(`✅ Ya capturado: ${completed.join(', ')}`);
    }
    
    if (missing.length > 0) {
      lineas.push(`❌ Falta: ${missing.join(', ')}`);
      
      // Instrucción explícita para evitar preguntas redundantes
      const completedFields = completed.map(c => c.split('(')[0].trim());
      lineas.push(`\n⚠️ CRÍTICO: NO preguntes por ${completedFields.join(', ')}. Solo pregunta lo faltante: ${missing.join(', ')}`);
    } else {
      lineas.push('✅ Formulario completo - listo para confirmación');
    }
  }
  
  // 🤝 CONTEXTO DE HANDOFF: Info crucial para continuidad conversacional
  if (handoffContext) {
    // Extraer consulta real tras el @mention (ej: "@aluna quiero plan 10" → "quiero plan 10")
    const queryAfterMention = (handoffContext.userMessage || '').replace(/^@\w+\s*/i, '').trim();
    const hasDirectQuery = queryAfterMention.length > 3;

    if (handoffContext.recovered) {
      // Contexto recuperado de mensajes anteriores — inyectar como memoria de sesión, no como transferencia
      lineas.push('\n🧠 MEMORIA DE SESIÓN:');
      if (hasDirectQuery) {
        lineas.push(`El usuario inició esta conversación pidiendo: "${queryAfterMention}"`);
        lineas.push('Mantén ese hilo. Responde con continuidad, como si recordaras toda la conversación.');
      } else {
        lineas.push(`El usuario llegó desde ${handoffContext.fromAgent}. Continúa la conversación con naturalidad.`);
      }
    } else {
      // Handoff fresco — contexto completo de transferencia
      lineas.push('\n🤝 CONTEXTO DE TRANSFERENCIA:');
      lineas.push(`De: ${handoffContext.fromAgent}`);
      lineas.push(`Motivo: ${handoffContext.reason}`);
      lineas.push(`Mensaje que disparó handoff: "${handoffContext.userMessage}"`);

      if (hasDirectQuery) {
        lineas.push(`Consulta directa del usuario: "${queryAfterMention}"`);
        lineas.push('\n⚠️ CRÍTICO: El usuario ya hizo su pregunta. Responde DIRECTAMENTE a esa consulta.');
        lineas.push('Puedes hacer una introducción breve de UNA línea (ej: "¡Hola, soy Aluna!") y luego responder la consulta en el mismo mensaje. NO hagas más preguntas antes de responder.');
      } else {
        lineas.push('\n⚠️ IMPORTANTE: El usuario ya mencionó su necesidad. NO preguntes nuevamente lo que ya dijo.');
      }

      // 🔒 NOTA: No pasamos datos de reserva a agentes externos
      // Aurora mantiene el formulario pendiente para retomar después
      if (!isCoworkingAgent && handoffContext.fromAgent === 'AURORA') {
        lineas.push('\n📝 NOTA: Aurora mantendrá cualquier reserva pendiente para cuando el usuario regrese.');
      }
    }
  }

  // 💬 MEMORIA CONVERSACIONAL: Últimos 7-8 intercambios (hasta 15 mensajes)
  // Ampliado para mejor contexto en ecosistema multi-agente con handoffs
  if (historial.length > 0) {
    const historyLimit = 15;
    const recentHistory = historial.slice(-historyLimit);
    const filteredHistory = isExternalAgent
      ? recentHistory.filter((m) => {
          const content = (m.content || '').toLowerCase();
          // Solo eliminar menciones puras (@nombre sin contenido adicional)
          // Preservar mensajes con texto real tras la mención (son el trigger del handoff)
          const isPureMention = /^@\w+\s*$/.test((m.content || '').trim());
          return !(
            isPureMention ||
            /paymentmethod|pago|payphone|transferencia|precio|total/i.test(content) ||
            /fecha/.test(content) ||
            /reserva/.test(content)
          );
        })
      : recentHistory;
    
    if (filteredHistory.length > 0) {
      lineas.push('\n💬 CONVERSACIÓN RECIENTE:');

      filteredHistory.forEach((m) => {
        const isUser = m.role === 'user';
        const speaker = isUser ? '👤 Usuario' : `🤖 ${m.agent || 'Asistente'}`;
        const prefix = isUser ? '' : '   ';

        let content = m.content || '';
        if (content.length > 150) {
          content = content.substring(0, 147) + '...';
        }

        lineas.push(`${prefix}${speaker}: ${content}`);
      });
      
      lineas.push('\n📌 Usa esta conversación para contexto, pero NO repitas información que el usuario ya dio.');
    } else {
      lineas.push('\n💬 CONVERSACIÓN RECIENTE: (contenido filtrado por privacidad)');
    }
  }

  return lineas.join('\n');
}

export default {
  procesarMensaje,
  AGENTES
};
