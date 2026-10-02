// src/express-servidor/endpoints-api/wassenger.js
import { Router } from 'express';

import { procesarMensaje } from '../../deteccion-intenciones/orquestador.js';
import { complete, transcribeAudio, generateSpeech } from '../../servicios-ia/openai.js';
import { loggers } from '../../utils/logger.js';
import { checkRateLimit, recordMessage } from '../../utils/rate-limiter.js';
import { validateAudio, getLocalizedAudioError } from '../../utils/audio-validator.js';
import { sanitizeUrl, sanitizeForLog } from '../../utils/log-sanitizer.js';

import { processPaymentReceipt, isReceiptImage } from '../../servicios/payment-receipts.js';
import { processMembershipPayment, findPendingMembershipLead } from '../../servicios/membership-payment-verification.js';
import { analyzeMedicalImage } from '../../servicios/angela-vision-analysis.js';
import { processConfirmationResponse, isPositiveResponse, isNegativeResponse } from '../../servicios/confirmation-flow.js';
import { enhanceAuroraResponse } from '../../servicios/aurora-confirmation-helper.js';
import { addPhoto, getSession, completeSession, canProcessQuote, startTimeout, queueTask, clearQueue, markFirstAckSent, markMaxPhotosAckSent } from '../../servicios/axel-photo-collector.js';
import { processAxelFormMessage, generateFormSummary, generateFormPrompt } from '../../servicios/axel-quote-form.js';
import { saveQuote } from '../../servicios/axel-quote-db.js';
import { generateQuoteCode } from '../../servicios/axel-quote-code.js';
import { analyzeCollisionPhotos } from '../../servicios/axel-vision-analysis.js';
import { generateQuote } from '../../servicios/axel-quote-generator.js';
import { sendQuoteEmail } from '../../servicios/axel-quote-email.js';
import { detectSchedulingIntent, processWorkshopScheduling } from '../../servicios/axel-appointment.js';
import { query } from '../../database/database.js';
import databaseService from '../../database/database.js';
import { processMembershipForm } from '../../servicios/membership-form.js';
import { processAlunaMembershipFlow } from '../../servicios/aluna-membership-flow.js';

import { detectCampaignMessage, personalizeCampaignResponse, CAMPAIGN_PROMPTS } from '../../servicios/campaign-prompts.js';
import { validateWebhookSignature, rateLimitByPhone } from '../middleware/webhook-security.js';

import { processMessageWithForm } from '../../servicios/partial-reservation-form.js';
import { buildReplyContext, getReplyContextMetadata } from '../../servicios/reply-context-handler.js';
import { getUserLanguage, detectLanguageCommand, getLanguageChangeConfirmation } from '../../utils/language-detector.js';
import { processMessage as splitLongMessage, cleanPromptMarkers } from '../../utils/message-splitter.js';
import { getAgentForm, saveAgentForm, clearAgentForm, getAllUserForms, cancelAgentForm } from '../../servicios/agent-form-manager.js';
import { normalizeAgentName } from '../../utils/agent-normalizer.js';
import { trackAlunaProspect, captureAlunaLeadFromKeywords, markAlunaMembershipLeadClientResponse } from '../../database/alunaRepository.js';
import { trackAlunaFollowupReply } from '../../servicios/aluna-response-tracking.js';

// 🆕 NUEVO SISTEMA V2 - Handoffs unificados
import { resolveIntent, decideResponder, logIntent, INTENT_TYPES } from '../../deteccion-intenciones/intent-resolver-v2.js';
import { executeHandoff } from '../../servicios/handoff-manager.js';
import { isUpdateInProgress } from '../../servicios/agent-state-manager.js';
import { updateAgent as updateAgentState } from '../../servicios/agent-state-manager.js';

// 🤖 SISTEMA AUTÓNOMO - Comandos autopilot desde WhatsApp
import { detectSystemCommand, isWaitingForApproval } from '../../servicios/autopilot-state.js';
import { executeSystemCommand } from '../../servicios/autopilot-command-executor.js';

import {
  loadProfile,
  saveProfile,
  saveInteraction,
  loadConversationHistory,
  saveConversationMessage,
  invalidateCachedProfile
} from '../../perfiles-interacciones/memoria-sqlite.js';

import { loadProfileWithTimeout } from '../../utils/timeout-helpers.js';
import { dispatchHttpRequest } from '../../servicios/external-dispatcher.js';
import { detectKnowledgeGap } from '../../servicios/knowledge-gap-detector.js';
import { clearJustConfirmed, clearPendingConfirmation, getPendingConfirmation } from '../../servicios/reservation-state.js';
import { isBossQuoteCommand, parseGabiQuoteData, sendGabiConsultoriaEmail } from '../../servicios/gabi-cotizacion-email.js';
import { isAxelBossQuoteCommand, parseAxelDemoQuoteData, sendAxelDemoCotizacion } from '../../servicios/axel-demo-cotizacion.js';
import { isEnzoBossQuoteCommand, sendEnzoCotizacion } from '../../servicios/enzo-cotizacion-email.js';
// enzo-consulting-flow: imported dynamically when needed (#PROCESS_FORM or active state)
import { isPaulaBossQuoteCommand, parsePaulaQuoteData, sendPaulaCotizacion } from '../../servicios/paula-cotizacion-email.js';
import { saveBossQuote, generateBossQuoteCode } from '../../database/bossQuotesRepository.js';
import { isAdrianaBossQuoteCommand, sendAdrianaCotizacion } from '../../servicios/adriana-cotizacion-email.js';
import { analyzeInsuranceDocument, detectDocumentType, extractVehicleData, DOCUMENT_TYPES } from '../../servicios/insurance-document-analysis.js';
import { calculateAllCoverages, formatPremiumForWhatsApp, inferVehicleCategory, VEHICLE_CATEGORIES, COVERAGE_TYPES, calculateVehiclePremium } from '../../servicios/adriana-quote-calculator.js';
import { generateMultiQuotes, saveLeadQuotes, formatQuotesForTemplate } from '../../servicios/adriana-multi-quote-engine.js';
import { processFormMessage, getOrCreateConversation, resetForm } from '../../servicios/adriana-conversational-form.js';
import { processRealEstateForm } from '../../servicios/real-estate-form.js';
import enzoRepository from '../../database/enzoRepository.js';
import { saveLegalLead } from '../../database/gabiRepository.js';
import { saveRealEstateLead } from '../../database/paulaRepository.js';
import { saveCollisionQuote } from '../../database/axelRepository.js';
import { saveInsuranceLead, getQuoteLead, upsertQuoteLead, updateQuoteLeadData, deleteQuoteLead, findLeadByPhone, createOrUpdateInsuranceLead, updateLeadStatus, saveCompetitorQuotes } from '../../database/adrianaRepository.js';
import { buildEmailTemplate } from '../../servicios/email-template-system.js';
import { sendEmail } from '../../servicios/email.js';
import { shouldActivateVisitConfirmation, activateVisitConfirmation } from '../../servicios/paula-confirmation-helper.js';
import { scoreConversation } from '../../servicios/conversation-scorer.js';
import { normalizePhoneEC } from '../../utils/validators.js';
import { getServiceLabel } from '../../utils/service-labels.js';
import { pauseBot, isBotPaused, resumeBot, resumeAll, getActiveTakeovers } from '../../servicios/human-takeover.js';
import { getConsentDecision, handleConsentDecision } from '../../servicios/contact-consent-flow.js';

const router = Router();

// 👔 Número del jefe — activa comandos directos de cotización desde WhatsApp
const ADMIN_PHONE = process.env.ADMIN_PHONE || null;

// Normaliza número de teléfono para comparación: solo dígitos
const normalizePhone = (p) => p ? String(p).replace(/\D/g, '') : '';
const isAdminPhone = (userId) => ADMIN_PHONE && normalizePhone(userId) === normalizePhone(ADMIN_PHONE);

/* ─────────────────────────────────────────────────────────────
   🎮 BLOQUE 1B: Comandos siempre activos de Diego
   Intercepta ANTES del debounce con respuesta inmediata.
   Seguridad: solo DIEGO_PERSONAL_PHONE. Todo otro número ignorado.
───────────────────────────────────────────────────────────── */

/**
 * Maneja comandos siempre activos de Diego (no requieren pregunta pendiente).
 * @returns {boolean} true si el mensaje fue un comando y ya fue procesado
 */
async function handleDiegoAlwaysOnCommands(userId, text) {
  const DIEGO_PERSONAL = process.env.DIEGO_PERSONAL_PHONE;
  if (!DIEGO_PERSONAL) return false;
  if (normalizePhone(userId) !== normalizePhone(DIEGO_PERSONAL)) return false;

  const cmd = (text || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // /STATUS o STATUS: estado del sistema (health + stats)
  if (cmd === '/STATUS' || cmd === 'STATUS' || cmd === 'ESTADO') {
    console.log('[DIEGO-CMD] 📊 STATUS solicitado');
    try {
      const { getLastStatus } = await import('../../servicios/health-monitor.js');
      const health = getLastStatus();

      const [resHoy, leadsAluna, leadsAxel] = await Promise.all([
        query(`SELECT COUNT(*) AS n FROM reservations WHERE created_at >= CURRENT_DATE`).catch(() => ({ rows: [{ n: '?' }] })),
        query(`SELECT COUNT(*) AS n FROM aluna_leads WHERE status NOT IN ('lost','archived') AND created_at >= NOW() - INTERVAL '30 days'`).catch(() => ({ rows: [{ n: '?' }] })),
        query(`SELECT COUNT(*) AS n FROM axel_quotes WHERE created_at >= NOW() - INTERVAL '30 days'`).catch(() => ({ rows: [{ n: '?' }] }))
      ]);

      const icon = s => s === 'ok' ? '✅' : s === 'unknown' ? '⏳' : '❌';
      const ramLabel = health.ramMB > 0 ? `${health.ramMB}MB` : '⏳';
      const uptime = Math.floor(process.uptime());
      const uptimeFmt = uptime < 3600 ? `${Math.floor(uptime/60)}m` : `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`;

      const msg = [
        '🖥️ *Status del Sistema*',
        '',
        `${icon(health.openai)} OpenAI: ${health.openai}`,
        `${icon(health.db)} DB: ${health.db}`,
        `${icon(health.wassenger)} Wassenger: ${health.wassenger}`,
        `💾 RAM: ${ramLabel} / uptime: ${uptimeFmt}`,
        health.checkedAt ? `🕐 Último check: ${new Date(health.checkedAt).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil' })}` : '🕐 Check pendiente',
        '',
        '📊 *Stats*',
        `🏢 Reservas hoy: *${resHoy.rows[0].n}*`,
        `👥 Leads Aluna (30d): *${leadsAluna.rows[0].n}*`,
        `🎨 Cotizaciones Axel (30d): *${leadsAxel.rows[0].n}*`,
        '',
        'Comandos: /status · /migrate status · /perf'
      ].join('\n');
      await enviarWhatsApp(userId, msg);
    } catch (err) {
      await enviarWhatsApp(userId, `📊 Sistema en línea ✅\nError detallando stats: ${err.message}`);
    }
    return true;
  }

  // /MIGRATE STATUS: estado de migraciones de BD
  if (cmd === '/MIGRATE STATUS' || cmd === '/MIGRATE') {
    console.log('[DIEGO-CMD] 🗄️ /migrate status solicitado');
    try {
      const { getMigrationStatus } = await import('../../database/migrations/migration-runner.js');
      const status = await getMigrationStatus();
      const lines = [
        '🗄️ *Migraciones BD*',
        '',
        `✅ Aplicadas: ${status.applied.length}`,
        ...status.applied.map(m => `  · ${m}`),
        status.pending.length > 0 ? `\n⏳ Pendientes: ${status.pending.length}` : '\n✨ Todo al día',
        ...status.pending.map(m => `  · ${m}`),
        `\nDB: ${status.dbOk ? '✅ online' : '❌ error'}`,
      ];
      await enviarWhatsApp(userId, lines.join('\n'));
    } catch (err) {
      await enviarWhatsApp(userId, `🗄️ Migraciones: error al leer estado\n${err.message}`);
    }
    return true;
  }

  // /PERF: snapshot de métricas de performance
  if (cmd === '/PERF') {
    console.log('[DIEGO-CMD] 📈 /perf solicitado');
    try {
      const { metricsCollector } = await import('../../utils/observability.js');
      const snap = metricsCollector.getMetrics ? metricsCollector.getMetrics() : null;
      if (!snap) {
        await enviarWhatsApp(userId, '📈 Métricas no disponibles aún (reinicia el servidor para activarlas)');
        return true;
      }
      const msg = [
        '📈 *Performance Snapshot*',
        '',
        `📥 Requests: ${snap.requests?.total ?? 0} total | ${snap.requests?.failed ?? 0} fallidos`,
        `⏱️ Avg response: ${snap.requests?.avgResponseTime ?? 0}ms`,
        `🗄️ Queries: ${snap.database?.queriesTotal ?? 0} | Lentas: ${snap.database?.slowQueries ?? 0}`,
        `💾 RAM heap: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        `🕐 Ahora: ${new Date().toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil' })}`,
      ].join('\n');
      await enviarWhatsApp(userId, msg);
    } catch (err) {
      await enviarWhatsApp(userId, `📈 Performance: error al leer métricas\n${err.message}`);
    }
    return true;
  }

  // PARA: pausa el autopilot
  if (cmd === 'PARA' || cmd === 'STOP') {
    console.log('[DIEGO-CMD] 🛑 PARA recibido');
    const { setAutopilotState } = await import('../../servicios/autopilot-state.js');
    setAutopilotState({ active: false, waitingForApproval: false });
    // Escribir respuesta en tabla de checkpoints para que Copilot lo lea
    try {
      const { query } = await import('../../database/database.js');
      await query(
        `UPDATE _autopilot_checkpoints SET command = 'PARA', answered_at = NOW()
         WHERE command IS NULL ORDER BY asked_at DESC LIMIT 1`
      );
    } catch (_) { /* tabla puede no existir todavía, no bloquear */ }
    await enviarWhatsApp(userId, '🛑 *Autopilot pausado.*\nEl agente detendrá la ejecución al final del bloque actual.');
    return true;
  }

  // SIGUIENTE: reanuda / indica al autopilot que puede avanzar
  if (cmd === 'SIGUIENTE') {
    console.log('[DIEGO-CMD] ▶️ SIGUIENTE recibido');
    const { setAutopilotState } = await import('../../servicios/autopilot-state.js');
    setAutopilotState({ active: true });
    // Escribir respuesta en tabla de checkpoints para que Copilot lo lea
    try {
      const { query } = await import('../../database/database.js');
      await query(
        `UPDATE _autopilot_checkpoints SET command = 'SIGUIENTE', answered_at = NOW()
         WHERE command IS NULL ORDER BY asked_at DESC LIMIT 1`
      );
    } catch (_) { /* tabla puede no existir todavía, no bloquear */ }
    await enviarWhatsApp(userId, '▶️ *Siguiente bloque activado.*\nEl agente continuará con el próximo bloque.');
    return true;
  }

  // DEPLOY: deployar a Heroku y continuar
  if (cmd === 'DEPLOY') {
    console.log('[DIEGO-CMD] 🚀 DEPLOY recibido');
    try {
      const { query } = await import('../../database/database.js');
      await query(
        `UPDATE _autopilot_checkpoints SET command = 'DEPLOY', answered_at = NOW()
         WHERE command IS NULL ORDER BY asked_at DESC LIMIT 1`
      );
    } catch (_) { /* tabla puede no existir todavía, no bloquear */ }
    await enviarWhatsApp(userId, '🚀 *Deploy activado.*\nEl agente hará git push heroku main antes de continuar.');
    return true;
  }

  // SKIP: saltar el bloque actual
  if (cmd === 'SKIP') {
    console.log('[DIEGO-CMD] ⏭️ SKIP recibido');
    try {
      const { query } = await import('../../database/database.js');
      await query(
        `UPDATE _autopilot_checkpoints SET command = 'SKIP', answered_at = NOW()
         WHERE command IS NULL ORDER BY asked_at DESC LIMIT 1`
      );
    } catch (_) { /* tabla puede no existir todavía, no bloquear */ }
    await enviarWhatsApp(userId, '⏭️ *Bloque saltado.*\nEl agente pasará al siguiente bloque.');
    return true;
  }

  // SI/NO/OK: Palabras ambiguas — solo interceptar si hay autopilot question pendiente
  // Si Diego está en una conversación activa (form, pending_confirmation), dejar pasar al flujo normal
  const AMBIGUOUS_CMDS = ['SI', 'SÍ', 'YES', 'OK', 'NO', 'NOPE', 'CANCELAR'];
  if (AMBIGUOUS_CMDS.includes(cmd)) {
    // Verificar si hay una pregunta autopilot pendiente ANTES de interceptar
    let hasAutopilotQuestion = false;
    try {
      const pending = await query(
        `SELECT id FROM _autopilot_checkpoints WHERE command IS NULL AND answered_at IS NULL ORDER BY asked_at DESC LIMIT 1`
      );
      hasAutopilotQuestion = pending?.rows?.length > 0;
    } catch (_) { /* tabla puede no existir → no hay pregunta pendiente */ }

    if (!hasAutopilotQuestion) {
      console.log(`[DIEGO-CMD] ⏭️ "${cmd}" ignorado como boss command — no hay autopilot question pendiente, pasa al flujo de conversación`);
      return false; // Dejar que el flujo normal (Aurora, Aluna, etc.) lo procese
    }

    // Hay autopilot question pendiente → procesar como boss command
    if (cmd === 'NO' || cmd === 'NOPE' || cmd === 'CANCELAR') {
      console.log('[DIEGO-CMD] ❌ NO recibido (rechazo autopilot)');
      const { setAutopilotState } = await import('../../servicios/autopilot-state.js');
      setAutopilotState({ active: false, waitingForApproval: false });
      try {
        await query(
          `UPDATE _autopilot_checkpoints SET command = 'NO', answered_at = NOW()
           WHERE command IS NULL ORDER BY asked_at DESC LIMIT 1`
        );
      } catch (_) { /* no bloquear */ }
      await enviarWhatsApp(userId, '❌ *Acción rechazada.*\nEl agente saltará esta tarea y continuará con la siguiente.');
      return true;
    } else {
      console.log('[DIEGO-CMD] ✅ SI recibido (aprobación autopilot)');
      const { setAutopilotState } = await import('../../servicios/autopilot-state.js');
      setAutopilotState({ active: true, waitingForApproval: false });
      try {
        await query(
          `UPDATE _autopilot_checkpoints SET command = 'SI', answered_at = NOW()
           WHERE command IS NULL ORDER BY asked_at DESC LIMIT 1`
        );
      } catch (_) { /* no bloquear */ }
      await enviarWhatsApp(userId, '✅ *Acción aprobada.*\nEl agente continuará con la tarea.');
      return true;
    }
  }

  // REVIEW: solicitar revisión detallada antes de continuar
  if (cmd === 'REVIEW' || cmd === 'REVISAR' || cmd === 'VER') {
    console.log('[DIEGO-CMD] 🔍 REVIEW recibido');
    try {
      const { query } = await import('../../database/database.js');
      await query(
        `UPDATE _autopilot_checkpoints SET command = 'REVIEW', answered_at = NOW()
         WHERE command IS NULL ORDER BY asked_at DESC LIMIT 1`
      );
    } catch (_) { /* tabla puede no existir todavía, no bloquear */ }
    await enviarWhatsApp(userId, '🔍 *Revisión solicitada.*\nEl agente mostrará detalles del cambio antes de aplicarlo.\nResponde SI para aprobar o NO para rechazar.');
    return true;
  }

  // CANCELA: detener completamente el autopilot (más fuerte que PARA)
  if (cmd === 'CANCELA' || cmd === 'CANCEL' || cmd === 'ABORTAR' || cmd === 'ABORT') {
    console.log('[DIEGO-CMD] 🚫 CANCELA recibido');
    const { setAutopilotState } = await import('../../servicios/autopilot-state.js');
    setAutopilotState({ active: false, waitingForApproval: false, cancelled: true });
    try {
      const { query } = await import('../../database/database.js');
      await query(
        `UPDATE _autopilot_checkpoints SET command = 'CANCELA', answered_at = NOW()
         WHERE command IS NULL ORDER BY asked_at DESC LIMIT 1`
      );
    } catch (_) { /* tabla puede no existir todavía, no bloquear */ }
    await enviarWhatsApp(userId, '🚫 *Autopilot cancelado.*\nTodas las tareas pendientes se detendrán inmediatamente.');
    return true;
  }

  // REPAIR: ver último reporte de self-healing y plan de reparación
  if (cmd === 'REPAIR' || cmd === 'REPARAR') {
    console.log('[DIEGO-CMD] 🔧 REPAIR solicitado');
    try {
      const latestReport = await databaseService.get(
        `SELECT report_date, errors_found, conversations_failed, plan_file, summary, status
         FROM self_healing_reports
         ORDER BY report_date DESC
         LIMIT 1`
      );

      if (!latestReport) {
        await enviarWhatsApp(userId, '✨ *Sistema saludable*\n\nNo hay reportes de self-healing. El sistema no ha detectado problemas en las últimas 24h.');
        return true;
      }

      const { errors_found, conversations_failed, plan_file, summary, status, report_date } = latestReport;
      const totalIssues = (errors_found || 0) + (conversations_failed || 0);

      if (totalIssues === 0) {
        await enviarWhatsApp(userId, `✨ *Sistema saludable*\n\nÚltimo análisis: ${report_date}\nNo se detectaron problemas.`);
        return true;
      }

      const statusEmoji = status === 'pending' ? '⚠️' : status === 'reviewed' ? '👀' : '✅';
      const msg = [
        '🔧 *Self-Healing Report*',
        '',
        `${statusEmoji} Estado: ${status}`,
        `📅 Fecha: ${report_date}`,
        '',
        `🔴 Errores detectados: ${errors_found}`,
        `💬 Conversaciones fallidas: ${conversations_failed}`,
        '',
        plan_file ? `📋 Plan: \`${plan_file}\`` : '📋 Plan no generado',
        '',
        `📝 Resumen:\n${summary}`,
        '',
        '💡 Para aplicar reparaciones, abre VS Code y activa autopilot sobre el plan de repair.'
      ].join('\n');

      await enviarWhatsApp(userId, msg);
    } catch (err) {
      console.error('[DIEGO-CMD] ❌ Error obteniendo repair report:', err);
      await enviarWhatsApp(userId, `🔧 Error al consultar self-healing reports:\n${err.message}`);
    }
    return true;
  }

  // RETOMA / RESUME: reactivar bot para un número (o todos) tras human takeover
  if (cmd.startsWith('RETOMA') || cmd.startsWith('RESUME')) {
    console.log('[DIEGO-CMD] 🤝 RETOMA recibido');
    const rawText = (text || '').trim();
    const parts = rawText.split(/\s+/);
    const target = parts[1] || '';

    if (target.toUpperCase() === 'ALL' || target.toUpperCase() === 'TODOS') {
      const count = resumeAll();
      await enviarWhatsApp(userId, `✅ Bot reactivado para *todas* las conversaciones (${count} pausas eliminadas).`);
      return true;
    }

    if (target) {
      const targetNumber = target.replace(/\D/g, '');
      if (targetNumber.length >= 8) {
        resumeBot(targetNumber);
        await enviarWhatsApp(userId, `✅ Bot reactivado para *${targetNumber}*.`);
        return true;
      }
    }

    // Sin target → mostrar estado actual
    const active = getActiveTakeovers();
    if (active.length === 0) {
      await enviarWhatsApp(userId, '✅ No hay conversaciones pausadas actualmente.');
    } else {
      const lines = active.map(t => `• ${t.userId} — ${t.remainingMin}min restantes`);
      await enviarWhatsApp(userId, `🤝 *Takeovers activos (${active.length}):*\n\n${lines.join('\n')}\n\n💡 Usa: RETOMA +593... o RETOMA ALL`);
    }
    return true;
  }

  return false; // No era un comando conocido, continuar flujo normal
}

/* ─────────────────────────────────────────────────────────────
   ✅ HANDOFF: Todos los handoffs usan executeHandoff() de 
   handoff-manager.js - sistema centralizado con locks
───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
   🔒 Seguridad & estabilidad global (NO dentro del webhook)
───────────────────────────────────────────────────────────── */
if (!globalThis.__AURORA_CORE_UNHANDLED__) {
  globalThis.__AURORA_CORE_UNHANDLED__ = true;
  process.on('unhandledRejection', (reason) => {
    loggers.webhook.error('Unhandled promise rejection', {}, reason);
  });
  process.on('uncaughtException', (err) => {
    loggers.webhook.error('Uncaught exception', {}, err);
  });
}

/* ─────────────────────────────────────────────────────────────
   ⏱️ DEBOUNCE: Agrupar webhooks del mismo usuario en ráfaga
   Previene race conditions y mejora UX cuando el usuario envía
   su pensamiento en varios mensajes cortos seguidos (patrón
   común en WhatsApp). Siempre espera la ventana completa antes
   de procesar, extendiendo el timer con cada mensaje nuevo.
   
   🎯 FIX A4: Consolidar textos antes de procesar para reducir 
   llamadas a OpenAI (de N llamadas → 1 llamada consolidada).
───────────────────────────────────────────────────────────── */
const pendingWebhooks = new Map(); // userId → { timer, payloads: [], count }
const DEBOUNCE_WINDOW_MS = 4000; // 🔧 FIX A4: Reducido de 8s a 4s (más responsive)

/**
 * Agrupa webhooks del mismo usuario que lleguen en ráfaga.
 * Todos los mensajes esperan la ventana completa antes de procesarse.
 * Cada mensaje adicional reinicia el timer (ventana deslizante).
 * 
 * 🎯 FIX A4: Los mensajes de TEXTO se consolidan en uno solo antes
 * de procesar. Mensajes con media (imagen/audio) se procesan por separado.
 * 
 * @param {string} userId - ID del usuario
 * @param {object} webhookData - Datos completos del webhook (data, text, mediaUrl, type, etc)
 * @param {function} handler - Función que procesa el webhook
 */
function debounceUserWebhook(userId, webhookData, handler) {
  if (pendingWebhooks.has(userId)) {
    const existing = pendingWebhooks.get(userId);
    clearTimeout(existing.timer);
    existing.items.push({ webhookData, handler });
    existing.count++;
    console.log(`[DEBOUNCE] 📦 Mensaje ${existing.count} de ${userId}, reagrupando`);
  } else {
    pendingWebhooks.set(userId, { timer: null, items: [{ webhookData, handler }], count: 1 });
    console.log(`[DEBOUNCE] ⏱️ Iniciando ventana ${DEBOUNCE_WINDOW_MS}ms para ${userId}`);
  }

  // Siempre (re)programar el timer — ventana se extiende con cada mensaje nuevo
  const state = pendingWebhooks.get(userId);
  state.timer = setTimeout(async () => {
    const allItems = state.items;
    pendingWebhooks.delete(userId);
    console.log(`[DEBOUNCE] ✅ Procesando ${allItems.length} mensaje(s) de ${userId}`);
    
    // 🎯 FIX A4: CONSOLIDAR mensajes de texto, procesar media por separado
    const textOnly = allItems.filter(item => !item.webhookData.mediaUrl && item.webhookData.text);
    const withMedia = allItems.filter(item => item.webhookData.mediaUrl || !item.webhookData.text);
    
    // Consolidar textos en un solo mensaje
    if (textOnly.length > 1) {
      const consolidatedText = textOnly.map(item => item.webhookData.text).join(' ');
      console.log(`[DEBOUNCE] 🔀 Consolidando ${textOnly.length} textos:`, consolidatedText.substring(0, 100));
      // Modificar el webhookData del primero con texto consolidado
      textOnly[0].webhookData.text = consolidatedText;
      textOnly[0].webhookData._consolidated = true;
      textOnly[0].webhookData._originalCount = textOnly.length;
      await textOnly[0].handler();
    } else if (textOnly.length === 1) {
      // Un solo texto, procesar normal
      await textOnly[0].handler();
    }
    
    // Procesar media por separado (no consolidable)
    for (const item of withMedia) {
      await item.handler();
    }
  }, DEBOUNCE_WINDOW_MS);
}

/* ─────────────────────────────────────────────────────────────
   🛡️ DEDUPLICACIÓN: Prevenir procesamiento de webhooks duplicados
   Wassenger puede enviar el mismo webhook múltiples veces si:
   - Timeout en su lado (no recibe 200 a tiempo)
   - Retry automático por errores transitorios
   - Race conditions en su infraestructura
   - Webhooks de mensajes que EL SISTEMA envió (fromMe debería ser true pero a veces no llega)
───────────────────────────────────────────────────────────── */
const processedMessages = new Map(); // messageId → timestamp
const sentMessages = new Map(); // Hash de (userId + texto) → timestamp para detectar eco
const MESSAGE_DEDUP_TTL_MS = 60000; // 1 minuto

/**
 * Verifica si un mensaje ya fue procesado recientemente
 * @param {string} messageId - ID único del mensaje de Wassenger
 * @returns {boolean} - true si ya fue procesado
 */
function isDuplicateMessage(messageId) {
  if (!messageId) return false; // Sin ID, no se puede deduplicar
  
  // Limpiar mensajes antiguos (> 1 minuto)
  const now = Date.now();
  for (const [id, timestamp] of processedMessages.entries()) {
    if (now - timestamp > MESSAGE_DEDUP_TTL_MS) {
      processedMessages.delete(id);
    }
  }
  
  // Verificar si ya fue procesado
  if (processedMessages.has(messageId)) {
    console.log(`[DEDUP] 🚫 Mensaje duplicado ignorado: ${messageId}`);
    return true;
  }
  
  // Marcar como procesado
  processedMessages.set(messageId, now);
  return false;
}

/**
 * Verifica si un webhook es de un mensaje que el sistema acaba de enviar (eco)
 * Wassenger envía webhooks incluso de mensajes enviados por el bot,
 * aunque fromMe debería ser true, a veces no viene o llega incorrectamente.
 * @param {string} userId - Número de teléfono del usuario
 * @param {string} text - Texto del mensaje
 * @returns {boolean} - true si es eco de un mensaje propio
 */
function isEchoMessage(userId, text) {
  if (!userId || !text) return false;
  
  // Limpiar cache antiguo (> 1 minuto)
  const now = Date.now();
  for (const [key, timestamp] of sentMessages.entries()) {
    if (now - timestamp > MESSAGE_DEDUP_TTL_MS) {
      sentMessages.delete(key);
    }
  }
  
  // Hash único: userId + primeros 50 caracteres del texto (para comparación rápida)
  const textHash = text.trim().substring(0, 50).toLowerCase();
  const key = `${userId}:${textHash}`;
  
  if (sentMessages.has(key)) {
    console.log(`[DEDUP] 🔁 Eco detectado - ignorando mensaje propio de ${userId}`);
    return true;
  }
  
  return false;
}

/**
 * Registra un mensaje enviado por el sistema para detectar ecos en webhooks
 * @param {string} userId - Número de teléfono
 * @param {string} text - Texto enviado
 */
function trackSentMessage(userId, text) {
  if (!userId || !text) return;
  const textHash = text.trim().substring(0, 50).toLowerCase();
  const key = `${userId}:${textHash}`;
  sentMessages.set(key, Date.now());
  console.log(`[DEDUP] 📝 Registrado mensaje propio: ${textHash.substring(0, 30)}...`);
}

/* ─────────────────────────────────────────────────────────────
   🧼 Helpers
───────────────────────────────────────────────────────────── */
function safeStr(v) {
  return (typeof v === 'string' ? v : '').trim();
}

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function isIncomingEvent(evt) {
  return evt && evt.includes('message:in') && !evt.includes('message:out');
}

function isGroupOrBroadcast(userId) {
  return userId.includes('@g.us') || userId.includes('@broadcast');
}

function normalizeUserId(data) {
  return safeStr(data.fromNumber || data.from || '');
}

function normalizeName(data) {
  return safeStr(data.chat?.name || data.contact?.name || data.fromName || data.name || '');
}

function normalizeText(data) {
  return safeStr(data.body || data.message || '');
}

// Tipos de webhook que Wassenger envía sin texto descifrado (Click-to-WhatsApp, IG ads)
const UNDECRYPTED_TYPES = ['ciphertext', 'notification_template'];

/**
 * Fetch mensaje desde Wassenger API cuando el webhook llega sin texto
 * (ej: ciphertext de Click-to-WhatsApp / Instagram ads)
 */
async function fetchMessageText(messageId) {
  const token = process.env.WASSENGER_TOKEN;
  if (!token || !messageId) return '';
  try {
    // Esperar 2s para que Wassenger descifre
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`https://api.wassenger.com/v1/messages/${messageId}`, {
      headers: { Token: token }
    });
    if (!res.ok) return '';
    const msg = await res.json();
    const text = safeStr(msg.body || msg.message || '');
    if (text) console.log(`[CTWA-FETCH] ✅ Texto recuperado para ${messageId}: "${text.substring(0, 60)}"`);
    return text;
  } catch (e) {
    console.warn(`[CTWA-FETCH] ❌ Error fetching message ${messageId}:`, e.message);
    return '';
  }
}

function normalizeType(data) {
  return safeStr(data.type || 'text') || 'text';
}

function buildMediaUrl(data) {
  let mediaUrl = data.mediaUrl || data.media?.url || null;

  // Wassenger a veces entrega links.download relativo
  if (!mediaUrl && data.media?.links?.download) {
    const token = process.env.WASSENGER_TOKEN;
    mediaUrl = `https://api.wassenger.com${data.media.links.download}?token=${token}`;
  }

  return mediaUrl;
}

/**
 * 🧹 Limpia nombres de WhatsApp Business para extraer nombre real
 * Remueve emojis, keywords empresariales, números de teléfono
 * 🎯 FIX A1: Blacklist de nombres genéricos post-limpieza
 */
function cleanWhatsAppName(whatsappName) {
  if (!whatsappName || typeof whatsappName !== 'string') return null;
  
  let cleaned = whatsappName.trim();
  
  // Remover emojis comunes
  cleaned = cleaned.replace(/[🏠🏢💼🔥⭐🎯💪👑🚀💯😊😎🤝🌟❤️🎉💻📱🏆☎️]/g, '');
  
  // Remover texto común de WhatsApp Business
  const businessKeywords = [
    'whatsapp business', 'business', 'empresa', 'company', 
    'servicio', 'service', 'oficial', 'official', '\\+593', '\\+1',
    'contacto', 'contact', 'ventas', 'sales', 'info', 'atención'
  ];
  
  for (const keyword of businessKeywords) {
    const regex = new RegExp(keyword, 'gi');
    cleaned = cleaned.replace(regex, '');
  }
  
  // Remover números de teléfono
  cleaned = cleaned.replace(/\+?\d{1,4}[\s-]?\d{6,}/g, '');
  
  // Limpiar espacios y caracteres especiales (mantener acentos españoles)
  cleaned = cleaned.replace(/[^\w\sñáéíóúüÑÁÉÍÓÚÜ]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Solo tomar el primer nombre si es muy largo
  if (cleaned.length > 20) {
    cleaned = cleaned.split(' ')[0];
  }
  
  // Capitalizar cada palabra (Title Case)
  if (cleaned.length > 0) {
    cleaned = cleaned
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  // 🎯 FIX A1: BLACKLIST de nombres genéricos post-limpieza
  // Estos nombres no son útiles como identificación real
  const GENERIC_NAME_BLACKLIST = [
    // Nombres de 1 letra (aliases comunes)
    /^[A-Z]$/i,
    // Nombres genéricos sin valor
    /^(Usuario|User|Cliente|Client|Test|Testing|Prueba)$/i,
    // Nombres que son solo el nombre del negocio
    /^(Coworkia|Oficina|Office|Admin|Administrator|Info|Contacto)$/i,
    // Números o códigos
    /^\d+$/
  ];
  
  if (cleaned.length > 1) {
    const isGeneric = GENERIC_NAME_BLACKLIST.some(pattern => pattern.test(cleaned));
    if (isGeneric) {
      console.log('[NAME-BLACKLIST] 🚫 Nombre genérico detectado y rechazado:', cleaned);
      return null; // Forzar a que el sistema pregunte el nombre real
    }
  }
  
  return cleaned.length > 1 ? cleaned : null;
}

/**
 * 🔍 Detecta nombre desde mensaje de presentación
 */
function extractNameFromMessage(message) {
  if (!message) return null;
  
  // Patrones comunes de presentación
  const patterns = [
    /(?:soy|me llamo|mi nombre es|soy de)\s+([A-Za-záéíóúüñÁÉÍÓÚÜÑ]+)/i,
    /(?:hola|buenos días|buenas tardes|buenas noches),?\s*(?:soy)?\s+([A-Za-záéíóúüñÁÉÍÓÚÜÑ]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1].length > 1) {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    }
  }
  
  return null;
}

function buildMessageEnvelope({ userId, name, text, type, mediaUrl, data, evt }) {
  // Esto es lo que “ve” Aurora Core. No hay agentes aquí.
  return {
    channel: 'whatsapp',
    provider: 'wassenger',
    event: evt,
    userId,
    name,
    type,
    text,
    mediaUrl,
    timestamp: data.timestamp || nowUnix(),
    raw: {
      // guardamos lo mínimo útil (sin reventar logs)
      fromMe: data.fromMe,
      isBot: data.isBot,
      mime: data.media?.mime
    }
  };
}

async function enviarWhatsApp(numero, mensaje) {
  const WASSENGER_TOKEN = process.env.WASSENGER_TOKEN;
  const WASSENGER_DEVICE = process.env.WASSENGER_DEVICE || process.env.WASSENGER_DEVICE_ID;
  const BOT_NUMBER = process.env.WHATSAPP_BOT_NUMBER || process.env.WASSENGER_DEVICE_ID || process.env.WASSENGER_DEVICE;

  if (!WASSENGER_TOKEN || !WASSENGER_DEVICE) {
    console.warn('[WASSENGER] Token o Device no configurado');
    return { ok: false, error: 'NO_WASSENGER_CONFIG' };
  }

  // No auto-mensajearse
  if (BOT_NUMBER && numero.includes(String(BOT_NUMBER).replace(/\D/g, ''))) {
    console.warn('[WASSENGER] Intento de enviar mensaje al propio bot bloqueado');
    return { ok: false, error: 'SELF_MESSAGE_BLOCKED' };
  }

  try {
    // ✅ Registrar mensaje ANTES de enviar (prevenir race condition)
    // Si el webhook llega antes de que trackSentMessage se ejecute, ya lo tendremos en cache
    trackSentMessage(numero, mensaje);
    
    const response = await dispatchHttpRequest({
      url: 'https://api.wassenger.com/v1/messages',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Token: WASSENGER_TOKEN },
      body: JSON.stringify({ phone: numero, message: mensaje, device: WASSENGER_DEVICE }),
      circuitId: 'wassenger:messages',
      timeoutMs: 8000,
      maxRetries: 2
    });

    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      loggers.wassenger.warn('Failed to send message', { userId: numero, status: response.status });
      // Si falló el envío, remover del cache (no se envió realmente)
      const textHash = mensaje.trim().substring(0, 50).toLowerCase();
      const key = `${numero}:${textHash}`;
      sentMessages.delete(key);
    }
    
    return { ok: response.ok, data };
  } catch (error) {
    loggers.wassenger.error('Error sending message', { userId: numero }, error);
    // Si hubo excepción, remover del cache
    const textHash = mensaje.trim().substring(0, 50).toLowerCase();
    const key = `${numero}:${textHash}`;
    sentMessages.delete(key);
    return { ok: false, error: error.message };
  }
}

/**
 * 🔊 Envía audio/voz por WhatsApp usando Wassenger API
 * @param {string} numero - Número de teléfono
 * @param {Buffer} audioBuffer - Buffer del archivo de audio
 * @param {object} opts - Opciones { filename, mimetype }
 * @returns {Promise<{ok: boolean, data?: any, error?: string}>}
 */
async function enviarWhatsAppVoz(numero, audioBuffer, opts = {}) {
  const WASSENGER_TOKEN = process.env.WASSENGER_TOKEN;
  const WASSENGER_DEVICE = process.env.WASSENGER_DEVICE || process.env.WASSENGER_DEVICE_ID;
  const BOT_NUMBER = process.env.WHATSAPP_BOT_NUMBER || process.env.WASSENGER_DEVICE_ID || process.env.WASSENGER_DEVICE;

  if (!WASSENGER_TOKEN || !WASSENGER_DEVICE) {
    console.warn('[WASSENGER] Token o Device no configurado');
    return { ok: false, error: 'NO_WASSENGER_CONFIG' };
  }

  // No auto-mensajearse
  if (BOT_NUMBER && numero.includes(String(BOT_NUMBER).replace(/\D/g, ''))) {
    console.warn('[WASSENGER] Intento de enviar audio al propio bot bloqueado');
    return { ok: false, error: 'SELF_MESSAGE_BLOCKED' };
  }

  try {
    const { filename = 'audio.mp3', mimetype = 'audio/mpeg' } = opts;

    console.log(`[WASSENGER] 🔊 Paso 1/2: Subiendo audio (${audioBuffer.length} bytes)`);

    // Paso 1: Subir archivo a Wassenger usando fetch directo (FormData)
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('file', audioBuffer, { filename, contentType: mimetype });
    formData.append('device', WASSENGER_DEVICE);

    const uploadResponse = await fetch('https://api.wassenger.com/v1/files', {
      method: 'POST',
      headers: {
        'Token': WASSENGER_TOKEN,
        ...formData.getHeaders()
      },
      body: formData
    });

    const uploadData = await uploadResponse.json().catch(() => ({}));
    
    if (!uploadResponse.ok || !uploadData.id) {
      console.error(`[WASSENGER] ❌ Error subiendo archivo:`, {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        body: JSON.stringify(uploadData),
        audioSize: audioBuffer.length
      });
      return { ok: false, error: `Upload failed: HTTP ${uploadResponse.status}`, data: uploadData };
    }

    const fileId = uploadData.id;
    console.log(`[WASSENGER] ✅ Archivo subido, ID: ${fileId}`);

    // Paso 2: Enviar mensaje con el file ID
    console.log(`[WASSENGER] 🔊 Paso 2/2: Enviando mensaje con audio a ${numero}`);

    const messageResponse = await dispatchHttpRequest({
      url: 'https://api.wassenger.com/v1/messages',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Token: WASSENGER_TOKEN },
      body: JSON.stringify({
        phone: numero,
        media: {
          file: fileId,  // ID del archivo subido (24 chars hex)
          filename
        },
        device: WASSENGER_DEVICE
      }),
      circuitId: 'wassenger:messages',
      timeoutMs: 15000,
      maxRetries: 2
    });

    const messageData = await messageResponse.json().catch(() => ({}));
    
    if (!messageResponse.ok) {
      console.error(`[WASSENGER] ❌ Error enviando mensaje:`, {
        status: messageResponse.status,
        statusText: messageResponse.statusText,
        body: JSON.stringify(messageData),
        fileId,
        userId: numero
      });
      loggers.wassenger.warn('Failed to send audio message', { 
        userId: numero, 
        status: messageResponse.status,
        statusText: messageResponse.statusText,
        errorBody: messageData,
        fileId,
        audioSize: audioBuffer.length 
      });
      return { ok: false, error: `Message failed: HTTP ${messageResponse.status}`, data: messageData };
    }

    console.log(`[WASSENGER] ✅ Audio enviado exitosamente a ${numero}`);
    loggers.wassenger.info('Audio sent successfully', { 
      userId: numero, 
      audioSize: audioBuffer.length,
      fileId,
      filename 
    });
    
    return { ok: true, data: messageData };

  } catch (error) {
    console.error(`[WASSENGER] ❌ Error enviando audio a ${numero}:`, error.message);
    loggers.wassenger.error('Error sending audio', { 
      userId: numero, 
      audioSize: audioBuffer?.length 
    }, error);
    return { ok: false, error: error.message };
  }
}

function detectBotLight(data, userId) {
  // Mantenerlo mínimo (sin “matar” humanos por error)
  if (data.isBot === true || data.type === 'bot' || data.fromBot === true) return { detected: true, reason: 'explicit_isBot' };
  if (isGroupOrBroadcast(userId)) return { detected: true, reason: 'group_or_broadcast' };
  return { detected: false, reason: null };
}

/**
 * 🔄 Helper consistente para actualizar profile
 * SIEMPRE actualiza: activeAgent (si cambia), agent_history, lastMessageAt
 * 
 * @param {string} userId - ID del usuario
 * @param {Object} updates - Campos a actualizar en el profile
 * @param {Object} metadata - Metadata adicional para agent_history (opcional)
 * @returns {Object} - Profile actualizado
 */
async function updateProfile(userId, updates, metadata = {}) {
  const current = await loadProfile(userId) || {};
  
  const newProfile = {
    ...current,
    ...updates,
    lastMessageAt: new Date().toISOString() // SIEMPRE actualizar
  };
  
  // Si cambió activeAgent, actualizar agent_history
  if (updates.activeAgent && updates.activeAgent !== current.activeAgent) {
    newProfile.agent_history = newProfile.agent_history || {};
    newProfile.agent_history[updates.activeAgent] = newProfile.agent_history[updates.activeAgent] || [];
    newProfile.agent_history[updates.activeAgent].push({
      timestamp: new Date().toISOString(),
      fromAgent: current.activeAgent || 'NONE',
      ...metadata
    });
    
    console.log(`[PROFILE] ✅ Agent actualizado: ${current.activeAgent || 'NONE'} → ${updates.activeAgent}`);
  }
  
  return await saveProfile(userId, newProfile);
}

/**
 * 🎯 Maneja resultado de formulario de forma consistente para TODOS los agentes
 * Función compartida - DRY principle
 * Evita duplicación de lógica entre Aurora, Aluna, etc.
 * 
 * @param {Object} formResult - Resultado del procesamiento del formulario
 * @param {string} userId - ID del usuario
 * @param {string} agentName - Nombre del agente (AURORA, ALUNA, etc.)
 * @param {Object} profile - Perfil del usuario
 * @returns {boolean} - true si manejó el resultado y debe hacer return, false si debe continuar
 */
async function handleFormResult(formResult, userId, agentName, profile) {
  if (!formResult) return false;

  // � FIX A6.3: INFORMAR CONFLICTOS AL USUARIO (cambios detectados en fecha/hora/tipo)
  if (formResult.updates && formResult.updates._conflicts && formResult.updates._conflicts.length > 0) {
    const conflictMessages = formResult.updates._conflicts.map(c => c.message);
    const conflictAlert = conflictMessages.join('\n');
    console.log('[FORM-CONFLICT] 📢 Informando cambios al usuario:', conflictAlert);
    // Enviar mensaje de alerta antes de continuar
    await enviarWhatsApp(userId, `⚠️ *Nota:*\n${conflictAlert}`);
    await saveConversationMessage(userId, { role: 'assistant', content: conflictAlert, agent: agentName });
  }

  // �🚨 Validaciones del formulario (ej: domingo/feriado) → respuesta inmediata
  if (formResult.validationError) {
    const errorMessage = formResult.validationError.message;
    await enviarWhatsApp(userId, errorMessage);
    await saveConversationMessage(userId, { role: 'assistant', content: errorMessage, agent: agentName });
    await saveInteraction({
      userId,
      agent: normalizeAgentName(agentName),
      agentName: agentName === 'AURORA' ? 'Aurora Core' : agentName,
      intentReason: 'validation_error',
      input: formResult.userMessage || '',
      output: errorMessage,
      meta: { errorType: formResult.validationError.type }
    });
    if (agentName === 'AURORA') {
      await clearAgentForm(userId, 'AURORA');
    }
    return true; // Manejado - hacer return
  }

  // ✅ Formulario completo → mensaje de confirmación + activar sistema confirmación
  if (formResult.isComplete) {
    // 🔥 HOTFIX v636: Guardar confirmación pendiente si es Aurora
    if (agentName === 'AURORA' && formResult.form) {
      const { processAuroraConfirmationRequest } = await import('../../servicios/aurora-confirmation-helper.js');
      // 🎯 FIX A6: Construir mensaje de confirmación desde datos del formulario directamente
      // En lugar de pasar string 'FORM_COMPLETE', construir descripción completa
      const form = formResult.form;
      const spaceLabel = form.spaceType === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones';
      const confirmMsg = `Perfecto, confirmo tu reserva: ${spaceLabel} para el ${form.date} a las ${form.time} (${form.durationHours}h). Email: ${form.email}. ¿Confirmamos?`;
      const confirmationResult = await processAuroraConfirmationRequest(confirmMsg, profile, { form: formResult.form });
      
      if (confirmationResult.success) {
        await enviarWhatsApp(userId, confirmationResult.confirmationMessage);
        await saveConversationMessage(userId, { role: 'assistant', content: confirmationResult.confirmationMessage, agent: agentName });
        // 🔧 FIX: Limpiar agent_form para que el "SI" del usuario NO vuelva a activar el
        // formulario. Sin este clear, hasActiveForm = true en el siguiente mensaje, lo que
        // hace que handleFormResult intercepte el "SI" antes de que llegue al check de
        // pending_confirmation, causando un loop de resumen de confirmación infinito.
        await clearAgentForm(userId, agentName);
        return true; // Manejado - hacer return
      } else {
        // 🎯 FIX: Manejar errores de validación SIN borrar el formulario
        // Mantener date, spaceType, email para que el usuario solo corrija hora
        console.log('[AURORA-FORM] ❌ Validación fallida:', confirmationResult.error);
        await enviarWhatsApp(userId, confirmationResult.userMessage || '❌ No pude procesar tu reserva. Por favor, intenta con otros datos.');
        await saveConversationMessage(userId, { role: 'assistant', content: confirmationResult.userMessage, agent: agentName });
        // 🛡️ NO limpiar form completo — solo resetear time/duration para que pueda elegir otra hora
        if (formResult.form) {
          formResult.form.time = null;
          formResult.form.durationHours = 2;
          formResult.form.paymentMethod = null;
          await saveAgentForm(userId, agentName, formResult.form.toJSON(), 120);
          console.log('[AURORA-FORM] 🔄 Form preservado sin time/payment — usuario puede elegir otra hora');
        }
        return true; // Manejado - hacer return
      }
    }
    
    // 🏡 PAULA / ALUNA: Guardar confirmación pendiente para que el "SI" active el handler correcto
    if (formResult.form && ['ALUNA', 'PAULA'].includes(agentName)) {
      const { savePendingConfirmation } = await import('../../perfiles-interacciones/memoria-sqlite.js');
      await savePendingConfirmation(userId, {
        agentName: agentName,
        formData: formResult.form.data,
        summary: formResult.summary
      });
      // Limpiar agent_form para que el "SI" no vuelva a entrar al form handler
      await clearAgentForm(userId, agentName);
      console.log(`[${agentName}-FORM] ✅ Pending confirmation guardada con agentName=${agentName}`);
    }

    // Fallback: mensaje genérico si no es Aurora o falla
    const confirmationMessage = `Perfecto! Déjame confirmar todos los datos:

📋 RESUMEN:
${formResult.summary}

${formResult.benefits ? `✨ BENEFICIOS INCLUIDOS:\n${formResult.benefits}\n\n` : ''}¿Todo correcto? Responde SI para confirmar 🏢`;

    await enviarWhatsApp(userId, confirmationMessage);
    await saveConversationMessage(userId, { role: 'assistant', content: confirmationMessage, agent: agentName });
    return true; // Manejado - hacer return
  }

  // 📝 Formulario incompleto → siguiente pregunta
  if (formResult.needsMoreInfo && formResult.nextQuestion) {
    await enviarWhatsApp(userId, formResult.nextQuestion);
    await saveConversationMessage(userId, { role: 'assistant', content: formResult.nextQuestion, agent: agentName });
    return true; // Manejado - hacer return
  }

  return false; // No manejado - continuar flujo normal
}

/**
 * 🔍 Detecta si el mensaje es continuación de un formulario de reserva
 * Reconoce patrones como: email, "ya te dije", horarios, fechas, personas
 */
function detectFormContinuation(text) {
  if (!text) return false;
  
  const continuationPatterns = [
    /^\d+$/,  // Números simples (3, 4, 10, etc) - para cantidad de personas
    /mi\s+(email|correo|mail|e-mail)/i,
    /ya\s+te\s+(dije|dij[eé]|mencion[eé]|coment[eé]|dí|di)/i,
    /te\s+(dije|mencion[eé]|coment[eé])/i,
    /somos\s+\d+/i,
    /\d+\s+personas?/i,
    /(voy|vamos|iremos)\s+(con|a ser)/i,
    /mi\s+nombre\s+es/i,
    /\w+@\w+\.\w+/i, // Email pattern
    /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/i, // Fecha completa
    /(mañana|ma\u00f1ana|hoy|pasado\s+ma\u00f1ana|tarde|noche)/i,
    /(\d{1,2})(:|\.)?(\d{2})?\s*(am|pm|AM|PM)/i, // Horarios
    /a\s+las\s+\d+/i, // "a las 9"
    /para\s+(hoy|mañana|ma\u00f1ana)/i,
    /el\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i,
    /\b(efectivo|tarjeta|transferencia|cash|credito|crédit|débito|debito|transfer)\b/i // Métodos de pago
  ];
  
  return continuationPatterns.some(pattern => pattern.test(text));
}/* ─────────────────────────────────────────────────────────────
   💰 AXEL QUOTE PROCESSOR
───────────────────────────────────────────────────────────── */
const axelQuoteLocks = new Set();
const axelMissingPromptAt = new Map();
const axelEmailConsent = new Map();
const axelSchedulingPending = new Map(); // userId → { quoteCode, clientName } — agendamiento post-cotización
const axelFirstAckTimers = new Map(); // userId → timerId — para evitar doble mensaje al recibir batch de fotos
const AXEL_MISSING_PROMPT_COOLDOWN_MS = 45000;

async function upsertCollisionQuote({
  quoteCode,
  userPhone,
  vehicleData,
  visionAnalysis,
  quoteResult,
  photoUrls,
  customerName,
  customerEmail,
  sessionFingerprint
}) {
  const damageType = visionAnalysis?.severity || 'collision';
  const priceMin = quoteResult?.priceRange?.min || null;
  const priceMax = quoteResult?.priceRange?.max || null;
  const currency = quoteResult?.priceRange?.currency || 'USD';
  const damageDescription = visionAnalysis?.analysis?.summary || visionAnalysis?.analysis?.description || null;

  const sql = `
    INSERT INTO collision_quotes (
      id,
      quote_code,
      user_phone,
      damage_type,
      client_name,
      vehicle_brand,
      vehicle_model,
      vehicle_year,
      email,
      phone,
      damage_description,
      photo_urls,
      damage_analysis,
      quote_details,
      price_min,
      price_max,
      currency,
      session_fingerprint,
      status,
      quote_sent_at,
      created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'quoted', NOW(), NOW()
    )
    ON CONFLICT (quote_code) DO UPDATE SET
      client_name = EXCLUDED.client_name,
      vehicle_brand = EXCLUDED.vehicle_brand,
      vehicle_model = EXCLUDED.vehicle_model,
      vehicle_year = EXCLUDED.vehicle_year,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      damage_description = EXCLUDED.damage_description,
      photo_urls = EXCLUDED.photo_urls,
      damage_analysis = EXCLUDED.damage_analysis,
      quote_details = EXCLUDED.quote_details,
      price_min = EXCLUDED.price_min,
      price_max = EXCLUDED.price_max,
      currency = EXCLUDED.currency,
      session_fingerprint = EXCLUDED.session_fingerprint,
      status = EXCLUDED.status,
      quote_sent_at = EXCLUDED.quote_sent_at,
      updated_at = NOW();
  `;

  const values = [
    `col-${quoteCode}`,
    quoteCode,
    userPhone,
    damageType,
    customerName || null,
    (vehicleData?.marca && !['Pendiente','pendiente','S/D',''].includes(vehicleData.marca)) ? vehicleData.marca : null,
    (vehicleData?.modelo && !['Pendiente','pendiente','S/D',''].includes(vehicleData.modelo)) ? vehicleData.modelo : null,
    parseInt(vehicleData?.año) || null,
    customerEmail || null,
    userPhone,
    damageDescription,
    JSON.stringify(photoUrls || []),
    JSON.stringify(visionAnalysis || {}),
    quoteResult?.quote || null,
    priceMin,
    priceMax,
    currency,
    sessionFingerprint || null
  ];

  try {
    await query(sql, values);
    console.log('[AXEL-QUOTE] 🗄️ collision_quotes upserted', { quoteCode });
  } catch (error) {
    console.error('[AXEL-QUOTE] ❌ Error upserting collision_quotes:', error);
  }
}
async function processAxelQuote(userId, photoUrls, profile, latestUserText = '', sessionFingerprint = null) {
  const startTime = Date.now();
  if (axelQuoteLocks.has(userId)) {
    loggers.axel.warn('Quote already in progress, skipping duplicate trigger', { userId, photoCount: photoUrls.length });
    return { success: false, error: 'quote_in_progress' };
  }
  axelQuoteLocks.add(userId);
  
  try {
    loggers.axel.info('Starting quote processing', { userId, photoCount: photoUrls.length });
    
    // 1. Cargar datos del formulario guardado (si los hay) para enriquecer vehicleData
    const formResult = await processAxelFormMessage(userId, latestUserText || '').catch(() => null);
    const vehicleData = {
      marca: formResult?.data?.marca || 'Pendiente',
      modelo: formResult?.data?.modelo || 'Pendiente',
      año: formResult?.data?.año || 'Pendiente',
      nombre: formResult?.data?.nombre || profile?.whatsappDisplayName || null,
      email: formResult?.data?.email || null
    };
    // El análisis procede siempre — si falta email se pide después al confirmar envío.

    // 2. Analizar fotos con Vision AI (agrupado)
    loggers.axel.info('Analyzing collision photos', { userId, photoCount: photoUrls.length });
    const visionAnalysis = await analyzeCollisionPhotos(photoUrls);
    
    if (!visionAnalysis.success) {
      await enviarWhatsApp(userId, `Disculpa, tuve un problema analizando las fotos. ¿Podrías enviarlas nuevamente?`);
      return { success: false, error: visionAnalysis.error };
    }
    
    // 3. Generar cotización con IA (aunque falten datos, usando placeholders)
    const quoteResult = await generateQuote({
      vehicleData,
      damageAnalysis: visionAnalysis,
      photoUrls
    });
    
    if (!quoteResult.success) {
      await enviarWhatsApp(userId, `Hubo un problema generando la cotización. Déjame contactarte en un momento.`);
      return { success: false, error: quoteResult.error };
    }
    
    // 4. Generar código único
    const { code: quoteCode } = await generateQuoteCode();

    // 4.5 Guardar cotización en BD (trazabilidad)
    await saveQuote({
      quoteCode,
      userPhone: userId,
      vehicleData,
      damageAnalysis: visionAnalysis,
      quoteDetails: quoteResult.quote,
      priceRange: quoteResult.priceRange,
      customerName: vehicleData.nombre || profile.whatsappDisplayName || 'Cliente',
      customerEmail: vehicleData.email || null,
      photoUrls
    }).catch(err => console.error('[AXEL-QUOTE] ⚠️ Error guardando cotización:', err));

    // 4.6 Guardar también en collision_quotes para reporting unificado
    await upsertCollisionQuote({
      quoteCode,
      userPhone: userId,
      vehicleData,
      visionAnalysis,
      quoteResult,
      photoUrls,
      customerName: vehicleData.nombre || profile.whatsappDisplayName || 'Cliente',
      customerEmail: vehicleData.email || null,
      sessionFingerprint
    });

    // 5. Mensaje único al usuario (resumen corto) + pregunta cerrada para email
    const affectedParts = (visionAnalysis.affectedParts || []).slice(0, 4).join(', ') || 'No detectado';
    const hiddenRisk = visionAnalysis.hiddenDamageRisk || 'MEDIO';
    const estimatedDays = visionAnalysis.estimatedRepairDays || '2-5 días';

    const priceLine = quoteResult.priceRange
      ? `💰 Estimación: $${quoteResult.priceRange.min} - $${quoteResult.priceRange.max} USD`
      : '💰 Estimación: rango pendiente';

    const smsSummary = [
      `✅ ¡Listo! Tu cotización *${quoteCode}* está lista.`,
      `🚗 Severidad: *${visionAnalysis.severity}* | Riesgo ocultos: ${hiddenRisk}`,
      `🔧 Partes: ${affectedParts}`,
      priceLine,
      `⏱️ Tiempo estimado: ${estimatedDays}`,
      ``,
      `✨ *Tu auto habla por ti.* Sin abolladuras = autoestima, confianza y presencia.`,
      ``,
      `📧 ¿Te envío la cotización detallada al correo? Responde *SI* o *NO*.`
    ].join('\n');

    await enviarWhatsApp(userId, smsSummary);

    // Guardar pendiente de confirmación de email (texto largo para email)
    axelEmailConsent.set(userId, {
      quoteCode,
      email: vehicleData.email,
      customerName: vehicleData.nombre || profile.whatsappDisplayName || 'Cliente',
      vehicleData,
      damageAnalysis: visionAnalysis,
      quote: quoteResult.quote,
      priceRange: quoteResult.priceRange,
      photoUrls,
      sessionFingerprint: sessionFingerprint || quoteCode
    });

    // Observabilidad: registrar evento de cotización generada
    await saveInteraction({
      userId,
      agent: 'AXEL',
      agentName: 'Axel - PaintBull',
      intentReason: 'axel_quote_generated',
      input: latestUserText || `[${photoUrls.length} fotos]`,
      output: smsSummary,
      meta: {
        quoteCode,
        photoCount: photoUrls.length,
        correlationId: sessionFingerprint || quoteCode,
        emailPending: true
      }
    });
    
    // 7. Marcar sesión de fotos como completada en BD
    const { completePhotoSession } = await import('../../database/axelPhotoRepository.js');
    await completePhotoSession(userId, quoteCode).catch(err => {
      console.error('[AXEL-QUOTE] ⚠️ Error marcando sesión completada:', err);
    });
    
    // ⏱️ T14: Limpiar transacción (cotización enviada exitosamente)
    profile.transactionStartedAt = null;
    profile.transactionAgent = null;
    profile.followUpSentAt = null;
    await updateProfile(userId, profile, { reason: 'quote_sent', quoteCode });
    console.log('[T14] ✅ Transacción completada (cotización enviada):', { userId, quoteCode });
    
    const duration = Date.now() - startTime;
    loggers.axel.timing('Quote processing complete', duration, { userId, quoteCode });
    
    return { success: true, quoteCode };
    
  } catch (error) {
    loggers.axel.error('Quote processing failed', { userId }, error);
    await enviarWhatsApp(userId, `Hubo un problema técnico. Déjame contactarte manualmente para ayudarte.`);
    return { success: false, error: error.message };
  } finally {
    axelQuoteLocks.delete(userId);
  }
}
function isOldMessage(data) {
  const ts = Number(data.timestamp || 0);
  if (!ts) return false;
  const diff = nowUnix() - ts;
  const type = safeStr(data.type || '');
  // Click-to-WhatsApp (IG ads) pueden llegar horas después — tolerar hasta 8h
  if (UNDECRYPTED_TYPES.includes(type)) return diff > 28800;
  return diff > 3600; // 1h para mensajes normales
}

function isCasualGreetingOnly(text) {
  const t = (text || '').toLowerCase().trim();
  return [
    /^hola[!.?\s]*$/,
    /^hi[!.?\s]*$/,
    /^hey[!.?\s]*$/,
    /^buenas[!.?\s]*$/,
    /^buenos días[!.?\s]*$/,
    /^buenas tardes[!.?\s]*$/,
    /^buenas noches[!.?\s]*$/,
    /^qué tal[!.?\s]*$/,
    /^como estas[!.?\s]*$/,
    /^hola aurora[!.?\s]*$/,
    /^hola como estas[!.?\s]*$/
  ].some(r => r.test(t));
}

function isReservationIntent(text) {
  const t = (text || '').toLowerCase();
  const reservationKeywords = ['reserva', 'reservar', 'hot desk', 'sala de reuniones', 'quiero venir', 'quiero reservar'];
  if (isCasualGreetingOnly(text)) return false;
  return reservationKeywords.some(k => t.includes(k));
}

/* ─────────────────────────────────────────────────────────────
   ✅ Webhook POST (tonto + rápido)
───────────────────────────────────────────────────────────── */
router.post('/webhooks/wassenger', validateWebhookSignature, rateLimitByPhone, async (req, res) => {
  const wassengerEnabled = process.env.WASSENGER_ENABLED !== 'false';
  if (!wassengerEnabled) {
    return res.json({ ok: true, ignored: true, reason: 'wassenger_disabled' });
  }

  const body = req.body || {};
  const evt = safeStr(body.event || '');
  const data = body.data || {};
  const debug = process.env.DEBUG_MODE === 'true';
  const isProd = process.env.NODE_ENV === 'production';

  if (!evt || !data) {
    return res.status(400).json({ ok: false, error: 'INVALID_PAYLOAD' });
  }

  // 🤝 HUMAN TAKEOVER: Detectar mensajes salientes manuales de Diego
  if (evt.includes('message:out')) {
    const outText = safeStr(data.body || data.text || data.message || '');
    const toNumber = safeStr(data.toNumber || data.to || data.chatId || '').replace(/\D/g, '');
    // Solo actuar si hay destinatario y el mensaje NO es un echo del bot
    if (toNumber && !isEchoMessage(toNumber, outText)) {
      pauseBot(toNumber, 30);
      console.log(`[TAKEOVER] Diego intervino manualmente en conversación con ${toNumber}, bot pausado 30min`);
    }
    return res.json({ ok: true, ignored: true, reason: 'outgoing_message_takeover_check' });
  }

  // Sólo entrantes
  if (!isIncomingEvent(evt)) {
    return res.json({ ok: true, ignored: true, reason: 'not_incoming_message' });
  }

  // Responder inmediato para evitar timeouts
  res.json({ ok: true, processing: 'async' });

  // Background con try/catch global
  setImmediate(async () => {
    let userId = null;
    try {
      userId = normalizeUserId(data);
      const name = normalizeName(data);
      const type = normalizeType(data);
      const mediaUrl = buildMediaUrl(data);
      const messageId = data.id || data.messageId || `${userId}_${Date.now()}`;
      
      // 🎯 FIX A4: Usar objeto mutable para permitir consolidación de texto
      const webhookData = {
        text: normalizeText(data),
        mediaUrl,
        type,
        data,
        name,
        messageId
      };

      // 📱 CTWA: Click-to-WhatsApp (Instagram/Facebook ads) llegan como
      // ciphertext o notification_template sin texto — recuperar de API
      if (!webhookData.text && UNDECRYPTED_TYPES.includes(type)) {
        console.log(`[CTWA] ⏳ Mensaje tipo '${type}' sin texto de ${userId}, consultando API...`);
        const fetchedText = await fetchMessageText(messageId);
        if (fetchedText) {
          webhookData.text = fetchedText;
          console.log(`[CTWA] ✅ Texto recuperado para ${userId}: "${fetchedText.substring(0, 80)}"`);
        } else {
          console.log(`[CTWA] ⚠️ No se pudo recuperar texto para ${userId} (type=${type}), ignorando`);
          return;
        }
      }

      if (debug) {
        console.log('[WASSENGER] Incoming:', {
          event: evt,
          userId: userId || 'NULL',
          messageId,
          type,
          hasText: !!webhookData.text,
          hasMedia: !!mediaUrl,
          prod: isProd
        });
      }

      if (!userId) return;

      // 🛡️ DEDUPLICACIÓN: Ignorar webhooks duplicados o ecos
      if (isDuplicateMessage(messageId)) {
        console.log(`[DEDUP] ⏭️ Ignorando webhook duplicado de ${userId}`);
        return; // No res.json aquí - headers ya enviados
      }
      
      // 🔁 ECO: Ignorar webhooks de mensajes que el sistema acaba de enviar
      if (isEchoMessage(userId, webhookData.text)) {
        console.log(`[DEDUP] 🔁 Ignorando eco - mensaje enviado por el sistema`);
        return;
      }

    loggers.webhook.info('Processing incoming message', { userId, type, hasMedia: !!mediaUrl });

    // Filtros básicos (no destructivos)
    const BOT_NUMBER = process.env.WHATSAPP_BOT_NUMBER || process.env.WASSENGER_DEVICE_ID || process.env.WASSENGER_DEVICE;
    if (BOT_NUMBER && userId.includes(String(BOT_NUMBER).replace(/\D/g, ''))) return;
    if (data.fromMe === true || data.fromMe === 'true') return;
    if (isOldMessage(data)) return;

    const botCheck = detectBotLight(data, userId);
    if (botCheck.detected) {
      if (debug) console.log('[WASSENGER] Ignorado (bot):', botCheck.reason);
      return;
    }

    // 🎮 DIEGO COMMANDS: Interceptar antes del debounce — respuesta inmediata
    // Comandos siempre activos: STATUS, PARA, SIGUIENTE, CANCELA
    // Solo responde si el mensaje viene de DIEGO_PERSONAL_PHONE
    {
      const diegoHandled = await handleDiegoAlwaysOnCommands(userId, webhookData.text || '');
      if (diegoHandled) return;
    }

    // 🤝 HUMAN TAKEOVER: No procesar si Diego está atendiendo manualmente
    if (isBotPaused(userId)) {
      console.log(`[TAKEOVER] Bot pausado para ${userId}, ignorando mensaje entrante`);
      return;
    }

    // ⏱️ DEBOUNCE: Agrupar mensajes rápidos del mismo usuario
    // TODOS los webhooks que pasen los filtros básicos entran al debounce
    // 🎯 FIX A4: Pasar webhookData para consolidar textos
    debounceUserWebhook(userId, webhookData, async () => {
      try {
      // 🎯 FIX A4: Extraer variables del webhookData (puede estar consolidado)
      let text = webhookData.text;
      const { mediaUrl, type, name, messageId } = webhookData;
      
      if (webhookData._consolidated) {
        console.log(`[DEBOUNCE] ✨ Procesando texto consolidado de ${webhookData._originalCount} mensajes`);
      }
      
      // 🚦 Rate limiting - Prevenir spam/abuso
      const rateLimitCheck = checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      const message = rateLimitCheck.reason === 'minute_limit'
        ? `⏱️ Por favor, espera ${rateLimitCheck.retryAfter} segundos antes de enviar más mensajes.\n\nLímite: ${rateLimitCheck.limit} mensajes por minuto.`
        : `⏱️ Has alcanzado el límite de mensajes por hora.\n\nIntenta nuevamente en ${Math.ceil(rateLimitCheck.retryAfter / 60)} minutos.`;
      
      await enviarWhatsApp(userId, message);
      return;
    }

    // 🚫 BLOQUEO: Tipos de archivo NO permitidos (stickers, documentos, ubicaciones, contactos)
    // Solo permitimos: text, image, audio, voice, ptt, video (en casos específicos)
    const BLOCKED_TYPES = ['sticker', 'document', 'location', 'contact', 'vcard', 'poll', 'live_location'];
    
    if (BLOCKED_TYPES.includes(type)) {
      console.log(`[WEBHOOK] 🚫 Tipo bloqueado: ${type} de usuario ${userId}`);
      
      // Obtener idioma del usuario para mensaje personalizado
      const current = await loadProfileWithTimeout(loadProfile, userId, 15000).catch(() => ({})) || {};
      const userLanguage = current.preferredLanguage || 'es';
      
      const blockedMessages = {
        es: '📝 Por favor envía tu mensaje por texto, imagen o audio.\n\nNo puedo procesar este tipo de archivo.',
        en: '📝 Please send your message as text, image or audio.\n\nI cannot process this type of file.',
        fr: '📝 Envoyez votre message par texte, image ou audio.\n\nJe ne peux pas traiter ce type de fichier.',
        it: '📝 Invia il tuo messaggio come testo, immagine o audio.\n\nNon posso elaborare questo tipo di file.',
        pt: '📝 Envie sua mensagem como texto, imagem ou áudio.\n\nNão posso processar este tipo de arquivo.',
        qu: '📝 Ama hina willayta qillqasqapi, imaynapi utaq uyarinapaq apachimuy.\n\nMana atinichu kay laya willakuna ruwayta.'
      };
      
      await enviarWhatsApp(userId, blockedMessages[userLanguage] || blockedMessages.es);
      return; // 🛑 No procesar
    }

    // 🎤 Detectar si usuario envió audio (para transcribir con Whisper)
    const userSentAudio = (type === 'audio' || type === 'voice' || type === 'ptt');
    
    // ✅ Obtener perfil una sola vez (se usará en múltiples flujos)
    const current = await loadProfileWithTimeout(loadProfile, userId, 15000).catch(() => ({})) || {};
    let userLanguage = current.preferredLanguage || 'es';

    // 🔐 LOPDP: saludar primero; solicitar consentimiento una sola vez cuando
    // el contacto expresa una necesidad, antes de procesar datos personales.
    const DIEGO_PHONE = process.env.DIEGO_PERSONAL_PHONE;
    const isDiego = DIEGO_PHONE && normalizePhone(userId) === normalizePhone(DIEGO_PHONE);
    const consentDecision = getConsentDecision({
      message: text,
      consentAt: current.dataConsentAt,
      consentRequestedAt: current.dataConsentRequestedAt,
      isInternal: Boolean(isDiego || isAdminPhone(userId))
    });

    const consentResult = await handleConsentDecision({
      decision: consentDecision,
      userId,
      name,
      run: databaseService.run.bind(databaseService),
      send: enviarWhatsApp,
      invalidate: invalidateCachedProfile,
    });
    if (consentResult.handled) {
      if (consentResult.accepted) console.log(`[LOPDP] ✅ Consentimiento recibido de ${userId}`);
      if (consentResult.declined) console.log(`[LOPDP] ❌ Consentimiento rechazado por ${userId}`);
      if (consentResult.requested) console.log(`[LOPDP] 📋 Consentimiento entregado a ${userId}`);
      if (!consentResult.delivered) console.warn(`[LOPDP] ⚠️ Mensaje de consentimiento no entregado a ${userId}; se reintentará en el siguiente mensaje`);
      return;
    }

    // 🎤 Voz → transcribir (MULTIIDIOMA + VALIDACIÓN + FALLBACKS)
    if (userSentAudio) {
      if (!mediaUrl) {
        console.error('[Whisper] ❌ No se encontró URL de audio en el mensaje');
        console.error('[Whisper] Debug - data.media:', JSON.stringify(data.media, null, 2));
        
        // ✅ FALLBACK: Enviar mensaje directamente y terminar (NO procesar con Aurora)
        console.log('[Whisper] 🔄 Fallback activado - sin URL de audio');
        // 📊 Registrar en error_events para self-healing
        databaseService.run(
          `INSERT INTO error_events (source, agent, error_type, message, user_phone, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
          ['whisper', 'orquestador', 'AUDIO_NO_URL', 'No se encontró URL de audio en el mensaje', userId, JSON.stringify({ type, hasMedia: !!data.media })]
        ).catch(() => {});
        const fallbackMsg = userLanguage === 'en' 
          ? '🎤 I could not access your audio. Can you write it as text? 😊'
          : userLanguage === 'fr'
          ? '🎤 Je n\'ai pas pu accéder à votre audio. Pouvez-vous l\'écrire en texte? 😊'
          : userLanguage === 'it'
          ? '🎤 Non ho potuto accedere al tuo audio. Puoi scriverlo come testo? 😊'
          : userLanguage === 'pt'
          ? '🎤 Não pude acessar seu áudio. Pode escrevê-lo como texto? 😊'
          : userLanguage === 'qu'
          ? '🎤 Mana atisqachu audio kaqman yaykuy. Qillqasqa qillqayta atiwaqchu? 😊'
          : '🎤 No pude procesar tu audio. ¿Puedes escribirlo por texto? 😊';
        
        console.log('[Whisper] 📤 Enviando mensaje fallback y deteniendo flujo');
        await enviarWhatsApp(userId, fallbackMsg);
        return; // ← Detener flujo, NO procesar con Aurora
      } else {
        // URL de audio disponible - procesar normalmente
        console.log(`[Whisper] 🎤 Procesando audio para usuario ${userId} en idioma: ${userLanguage}`);
        console.log('[Whisper] 📋 Debug - Media data:', {
          url: mediaUrl?.substring(0, 100),
          mime: data.media?.mime,
          size: data.media?.size,
          hasLinks: !!data.media?.links
        });
        
        // ✅ Validar audio antes de transcribir (con mime type de Wassenger)
        const audioMetadata = {
          mimeType: data.media?.mime || data.media?.mimetype,
          size: data.media?.size || data.media?.fileSize
        };
        
        const validation = validateAudio(mediaUrl, audioMetadata);
        
        if (!validation.valid) {
          console.error('[Whisper] ❌ Audio inválido:', validation.errors);
          console.error('[Whisper] Debug - URL:', mediaUrl);
          console.error('[Whisper] Debug - Metadata:', audioMetadata);
          
          // ✅ FALLBACK: Enviar mensaje de error y terminar (NO procesar con Aurora)
          console.log('[Whisper] 🔄 Fallback activado - validación fallida');
          // 📊 Registrar en error_events para self-healing
          databaseService.run(
            `INSERT INTO error_events (source, agent, error_type, message, user_phone, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
            ['whisper', 'orquestador', 'AUDIO_VALIDATION_FAILED', validation.errors.join('; '), userId, JSON.stringify({ url: mediaUrl?.substring(0, 100), mime: audioMetadata.mimeType, size: audioMetadata.size })]
          ).catch(() => {});
          const errorMsg = getLocalizedAudioError(validation.errors[0], userLanguage);
          console.log('[Whisper] 📤 Enviando mensaje de error y deteniendo flujo');
          await enviarWhatsApp(userId, errorMsg);
          return; // ← Detener flujo, NO procesar con Aurora
        } else {
          // Validación exitosa - continuar con transcripción
          
          // ⚠️ Warnings (tamaño grande, etc.)
          if (validation.warnings.length > 0) {
            console.warn('[Whisper] ⚠️ Advertencias:', validation.warnings);
          }
          
          // 🎤 Transcribir
          let tr;
          try {
            tr = await transcribeAudio(mediaUrl, {
              language: userLanguage,
              agentName: 'orquestador',
              userName: name || userId
            });
          } catch (error) {
            // Capturar errores de descarga/transcripción
            tr = { success: false, error: error.message || 'Error desconocido' };
          }
          
          if (!tr?.success || !tr?.text) {
            console.error('[Whisper] ❌ Error en transcripción:', tr?.error);
            
            // ✅ FALLBACK: Enviar mensaje de error y terminar (NO procesar con Aurora)
            console.log('[Whisper] 🔄 Fallback activado - transcripción fallida');
            // 📊 Registrar en error_events para self-healing
            databaseService.run(
              `INSERT INTO error_events (source, agent, error_type, message, user_phone, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
              ['whisper', 'orquestador', 'AUDIO_TRANSCRIPTION_FAILED', tr?.error || 'Error desconocido', userId, JSON.stringify({ url: mediaUrl?.substring(0, 100), language: userLanguage })]
            ).catch(() => {});
            const errorMsg = getLocalizedAudioError(tr?.error || 'Error desconocido', userLanguage);
            console.log('[Whisper] 📤 Enviando mensaje de error y deteniendo flujo');
            await enviarWhatsApp(userId, errorMsg);
            return; // ← Detener flujo, NO procesar con Aurora
          } else {
            // Transcripción exitosa
            text = tr.text;
            console.log(`[Whisper] ✅ Audio transcrito (${tr.language}):`, text.substring(0, 100));
          }
        }
      }
    }

    // Construir “evento” para Aurora Core
    const envelope = buildMessageEnvelope({ userId, name, text, type, mediaUrl, data, evt });

    // ✅ Perfil ya cargado antes del bloque if (userSentAudio) - línea 967
    // Cargar historial de conversación
    let conversationHistory = await loadConversationHistory(userId, 10).catch(() => []);

    // ✅ Registrar mensaje procesado para rate limiting
    recordMessage(userId);

    // � DETECCIÓN DE CAMBIO DE IDIOMA MANUAL
    // Si usuario escribe "english", "español", "français", etc.
    const languageCommand = detectLanguageCommand(text);
    
    if (languageCommand) {
      console.log(`[LANGUAGE] 🔄 Usuario solicitó cambio a: ${languageCommand}`);
      
      // Actualizar idioma en perfil
      current.preferredLanguage = languageCommand;
      await updateProfile(userId, { preferredLanguage: languageCommand }, { reason: 'language_command_change', language: languageCommand });
      console.log(`[LANGUAGE] ✅ Idioma actualizado en BD: ${languageCommand}`);
      
      // Obtener último mensaje del agente (ya tenemos conversationHistory arriba)
      const lastAssistantMessage = conversationHistory
        .filter(msg => msg.role === 'assistant')
        .pop();
      
      if (lastAssistantMessage && lastAssistantMessage.content) {
        console.log('[LANGUAGE] 📤 Reenviando último mensaje traducido...');
        
        // Traducir último mensaje al nuevo idioma
        const { translateMessage } = await import('../../utils/language-detector.js');
        const translatedMessage = await translateMessage(lastAssistantMessage.content, languageCommand);
        
        // Enviar traducción sin mensaje de confirmación (silencioso)
        await enviarWhatsApp(userId, translatedMessage);
        
        console.log('[LANGUAGE] ✅ Mensaje traducido enviado');
        
        // Terminar procesamiento - no res.json (headers ya enviados)
        return;
      } else {
        // Si no hay mensaje anterior, solo confirmar cambio
        const confirmation = getLanguageChangeConfirmation(languageCommand);
        await enviarWhatsApp(userId, confirmation);
        console.log('[LANGUAGE] ✅ Cambio confirmado (sin mensaje anterior)');
        return; // No res.json (headers ya enviados)
      }
    }

    // 🌍 DETECCIÓN DE IDIOMA AUTOMÁTICA - Solo si no tiene idioma guardado
    // Idiomas soportados: español (default), inglés, francés, quechua
    const isFirstMessage = !current.preferredLanguage;
    // Reasignar userLanguage si es necesario (ya declarado en línea 966)
    userLanguage = current.preferredLanguage || 'es';
    
    if (isFirstMessage && text) {
      // MODO: Default español - el usuario debe pedir explícitamente otro idioma
      userLanguage = 'es';
      console.log('[LANGUAGE] 🌍 Primera interacción - idioma español por defecto');
      
      // ✅ Guardar idioma default
      current.preferredLanguage = userLanguage;
      await updateProfile(userId, { preferredLanguage: userLanguage }, { reason: 'first_message_language_detected' });
      console.log(`[LANGUAGE] ✅ Idioma guardado en BD: ${userLanguage}`);
    }

    // Actualizar perfil mínimo
    const ahoraISO = new Date().toISOString();
    const lastMessageAt = current.lastMessageAt ? new Date(current.lastMessageAt).getTime() : 0;
    const minutos = lastMessageAt ? (Date.now() - lastMessageAt) / (1000 * 60) : 999;
    const conversacionEnCurso = minutos < 10;

    // 🆕 DETECCIÓN INTELIGENTE DEL NOMBRE (rescatado del backup v230)
    // PRIORIDAD: 1) Nombre de WhatsApp actual, 2) Nombre en BD, 3) Extraer del mensaje
    let detectedName = null;
    const firstVisit = current?.firstVisit === undefined ? true : current.firstVisit;
    
    // Detectar nombre: WhatsApp > BD > mensaje (si first visit)
    if (name) {
      detectedName = cleanWhatsAppName(name);
    } else if (current.name) {
      detectedName = current.name;
    } else if (firstVisit && text) {
      const nameFromMessage = extractNameFromMessage(text);
      if (nameFromMessage) {
        detectedName = nameFromMessage;
      }
    }

    // 🎯 Siempre detectar si el usuario se presenta explícitamente (cualquier mensaje)
    // Ej: "soy Diego", "me llamo Diego Villota" → sobrescribe alias de WA como "dievil"
    if (text) {
      const strictPattern = /(?:soy|me llamo|mi nombre es)\s+([A-Za-záéíóúüñÁÉÍÓÚÜÑ]+)/i;
      const nameMatch = strictPattern.exec(text);
      if (nameMatch && nameMatch[1].length > 1) {
        detectedName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1).toLowerCase();
      }
    }

    const profile = {
      ...current,
      userId,
      name: detectedName, // 🎯 Usar nombre limpio e inteligente
      whatsappDisplayName: name || current.whatsappDisplayName || null, // ✅ ACTUALIZAR SIEMPRE si viene de WhatsApp
      preferredLanguage: userLanguage, // 🌍 Idioma detectado/guardado
      channel: 'whatsapp',
      lastMessageAt: ahoraISO,
      conversationCount: (current.conversationCount || 0) + 1,
      conversacionEnCurso
    };

    await updateProfile(userId, profile, { reason: 'message_received' });

    // Guardar mensaje usuario con contexto reply si existe
    const replyContext = buildReplyContext(text || '', body, conversationHistory);
    const processedText = replyContext.hasReplyContext ? replyContext.enrichedMessage : (text || '');

    // 📸 Si hay imagen pero no texto, usar placeholder descriptivo
    const messageContent = processedText || (mediaUrl && type === 'image' ? '[Usuario envió imagen]' : '');
    
    // 🔒 FIX A7: Incrementar contador de mensajes desde último handoff (para cooldown)
    if (profile.lastHandoffCount !== undefined) {
      profile.lastHandoffCount = Math.min((profile.lastHandoffCount || 0) + 1, 10); // Max 10 para no crecer indefinidamente
      await saveProfile(userId, profile);
      console.log('[HANDOFF-TRACKING] 📈 Mensaje post-handoff:', profile.lastHandoffCount);
    } else {
      // Primera vez - inicializar
      profile.lastHandoffCount = 10; // Valor alto = sin cooldown
      await saveProfile(userId, profile);
    }

    await saveConversationMessage(userId, {
      role: 'user',
      content: messageContent,
      agent: profile.activeAgent || 'AURORA'
    });

    // ══════════════════════════════════════════════════════════════════════
    // � PRE-HANDOFF: Si el mensaje empieza con @agente, actualizar activeAgent
    // ANTES de entrar a los boss commands — así "@gabi cotización..." dispara
    // el boss de GABI aunque el agente activo fuera AXEL o cualquier otro.
    // ══════════════════════════════════════════════════════════════════════
    const agentMentionMap = {
      '@gabi': 'GABI', '@axel': 'AXEL', '@enzo': 'ENZO',
      '@paula': 'PAULA', '@adriana': 'ADRIANA', '@aluna': 'ALUNA',
      '@aurora': 'AURORA', '@angela': 'ANGELA',
    };
    if (processedText) {
      const firstToken = processedText.trim().split(/\s/)[0].toLowerCase();
      const mentionedAgent = agentMentionMap[firstToken];
      if (mentionedAgent && mentionedAgent !== profile.activeAgent) {
        console.log(`[BOSS-CMD] 🔀 Pre-handoff: ${profile.activeAgent} → ${mentionedAgent} (mención en mensaje)`);
        profile.activeAgent = mentionedAgent;
        await updateProfile(userId, { activeAgent: mentionedAgent }, { reason: 'pre_handoff_boss' });
      }
    }
    // ══════════════════════════════════════════════════════════════════════

    // ══════════════════════════════════════════════════════════════════════
    // �👔 BOSS COMMANDS: Gabi — cotización por orden directa del jefe
    // Solo activo cuando: userId === ADMIN_PHONE + agente GABI + email presente
    // ══════════════════════════════════════════════════════════════════════
    if (ADMIN_PHONE && isAdminPhone(userId) && processedText && profile.activeAgent === 'GABI') {
      if (isBossQuoteCommand(processedText)) {
        const quoteData = await parseGabiQuoteData(processedText);
        if (quoteData?.email) {
          console.log('[BOSS-CMD] 👔 Cotización GABI solicitada por jefe:', quoteData);
          const quoteCode = await generateBossQuoteCode('GABI');
          await enviarWhatsApp(userId, `⚙️ Preparando propuesta para *${quoteData.nombre}*...\n📧 ${quoteData.email}\n💼 ${quoteData.area}\n🔑 ${quoteCode}`);
          await new Promise(r => setTimeout(r, 600));
          const result = await sendGabiConsultoriaEmail({ ...quoteData, mensajeJefe: processedText, quoteCode });
          await saveBossQuote({
            agent: 'GABI',
            clientName:  quoteData.nombre,
            clientEmail: quoteData.email,
            clientPhone: normalizePhoneEC(quoteData.telefono) || null,
            serviceInfo: result.areaLabel || quoteData.area,
            quoteCode,
            emailSent:   result.success,
          });
          // 🆕 Guardar en legal_leads (para dashboard Gabi)
          if (result.success) {
            try {
              // Mapear areaLabel/area a los valores válidos del CHECK constraint
              const areaToConsultationType = {
                'finanzas': 'Contabilidad', 'Finanzas y Contabilidad': 'Contabilidad',
                'recursosHumanos': 'RRHH',  'Recursos Humanos y Nómina': 'RRHH',
                'uafe': 'Fiscal',            'Compliance y UAFE': 'Fiscal',
                'legal': 'Legal',            'Asesoría Legal Empresarial': 'Legal',
              };
              const rawArea = quoteData.area || result.areaLabel;
              const consultationType = areaToConsultationType[rawArea] || 'Otro';
              await saveLegalLead({
                consultationCode: quoteCode,
                userId:           userId, // admin phone — FK válido en users
                consultationType,
                company:          quoteData.empresa || null,
                ruc:              null,
                clientName:       quoteData.nombre,
                email:            quoteData.email,
                phone:            normalizePhoneEC(quoteData.telefono) || null,
                description:      quoteData.descripcionServicio || `Cotización generada por Big Boss — ${result.areaLabel || quoteData.area}`,
                urgency:          'Normal',
              });
              console.log(`[BOSS-CMD] ✅ Lead GABI guardado en legal_leads: ${quoteCode} (${consultationType})`);
            } catch (err) { console.error('[BOSS-CMD] ⚠️ Error guardando legal_lead:', err.message); }
          }
          const reply = result.success
            ? `✅ *Propuesta enviada*\n👤 ${quoteData.nombre}\n📧 ${quoteData.email}\n💼 ${result.areaLabel}\n\nCopia a secretaría ✓`
            : `❌ Error enviando propuesta: ${result.error}`;
          await enviarWhatsApp(userId, reply);
          return;
        }
      }
    }
    // ══════════════════════════════════════════════════════════════════════

    // ══════════════════════════════════════════════════════════════════════
    // 👔 BOSS COMMANDS: Axel — cotización demo con caso real de la memoria
    // Solo activo cuando: userId === ADMIN_PHONE + agente AXEL + email presente
    // ══════════════════════════════════════════════════════════════════════
    if (ADMIN_PHONE && isAdminPhone(userId) && processedText && profile.activeAgent === 'AXEL') {
      if (isAxelBossQuoteCommand(processedText)) {
        const quoteData = await parseAxelDemoQuoteData(processedText);
        if (quoteData?.email) {
          console.log('[BOSS-CMD] 👔 Cotización AXEL demo solicitada por jefe:', quoteData);
          await enviarWhatsApp(userId, `⚙️ Buscando caso real en memoria para *${quoteData.nombre}*...\n📧 ${quoteData.email}\n🚗 Tomando fotos y análisis de siniestro guardado`);
          await new Promise(r => setTimeout(r, 600));
          const result = await sendAxelDemoCotizacion(quoteData);
          const axelQuoteCode = result.quoteCode || `AXEL-BOSS-${Date.now()}`;
          await saveBossQuote({
            agent:       'AXEL',
            clientName:  quoteData.nombre,
            clientEmail: quoteData.email,
            clientPhone: normalizePhoneEC(quoteData.telefono) || null,
            serviceInfo: result.vehicleData ? `${result.vehicleData.marca} ${result.vehicleData.modelo} ${result.vehicleData.año}`.trim() : null,
            amountMin:   result.priceRange?.min  ?? null,
            amountMax:   result.priceRange?.max  ?? null,
            quoteCode:   axelQuoteCode,
            emailSent:   result.success,
          });
          // 🆕 Guardar en collision_quotes (para dashboard Axel)
          if (result.success) {
            try {
              const { v4: uuidv4Axel } = await import('uuid');
              await saveCollisionQuote({
                id:               uuidv4Axel(),
                quoteCode:        axelQuoteCode,
                userId:           userId, // admin phone — FK válido en users
                damageType:       'Colisión',
                clientName:       quoteData.nombre,
                vehicleBrand:     result.vehicleData?.marca || null,
                vehicleModel:     result.vehicleData?.modelo || null,
                vehicleYear:      parseInt(result.vehicleData?.año) || null,
                email:            quoteData.email,
                phone:            normalizePhoneEC(quoteData.telefono) || null,
                damageDescription: `Cotización generada por Big Boss`,
                photoUrls:        [],
                damageAnalysis:   {},
                quoteDetails:     null,
                priceMin:         result.priceRange?.min ?? null,
                priceMax:         result.priceRange?.max ?? null,
                sessionFingerprint: `boss-${Date.now()}`,
              });
              console.log(`[BOSS-CMD] ✅ Lead AXEL guardado en collision_quotes: ${axelQuoteCode}`);
            } catch (err) { console.error('[BOSS-CMD] ⚠️ Error guardando collision_quote:', err.message); }
          }
          const reply = result.success
            ? `✅ *Cotización enviada*\n👤 ${quoteData.nombre}\n📧 ${quoteData.email}\n🚗 ${result.vehicleData?.marca} ${result.vehicleData?.modelo} ${result.vehicleData?.año}\n📸 ${result.hasRealPhotos ? 'Con fotos reales del siniestro' : 'Demo estático (sin fotos aún)'}\n🔑 ${result.quoteCode}`
            : `❌ Error enviando cotización: ${result.error}`;
          await enviarWhatsApp(userId, reply);
          return;
        }
      }
    }
    // ══════════════════════════════════════════════════════════════════════

    // ══════════════════════════════════════════════════════════════════════
    // 👔 BOSS COMMANDS: Enzo — cotización IA personalizada para MarketingLab
    // El jefe dicta TODO: empresa, contacto, necesidad. OpenAI estructura y genera propuesta
    // Solo activo cuando: userId === ADMIN_PHONE + agente ENZO + email presente
    // ══════════════════════════════════════════════════════════════════════
    if (ADMIN_PHONE && isAdminPhone(userId) && processedText && profile.activeAgent === 'ENZO') {
      if (isEnzoBossQuoteCommand(processedText)) {
        console.log('[BOSS-CMD] 👔 Cotización ENZO solicitada por jefe — procesando con OpenAI...');
        const quoteCode = await generateBossQuoteCode('ENZO');
        await enviarWhatsApp(userId, `🧠 *Enzo procesando propuesta con IA...*\nAnalizando datos del cliente y elaborando oferta personalizada. Esto toma ~20 segundos ⚡\n🔑 ${quoteCode}`);
        await new Promise(r => setTimeout(r, 600));
        const result = await sendEnzoCotizacion(processedText, { quoteCode });
        
        // Guardar en boss_quotes (histórico)
        await saveBossQuote({
          agent:       'ENZO',
          clientName:  result.contacto || null,
          clientEmail: result.email    || null,
          companyName: result.empresa  || null,
          serviceInfo: result.nivel    || null,
          amountMin:   result.precio   ?? null,
          amountMax:   result.precio   ?? null,
          quoteCode,
          emailSent:   result.success,
        });
        
        // 🆕 Guardar en marketing_leads (para dashboard)
        if (result.success) {
          try {
            await enzoRepository.saveMarketingLead({
              projectCode: quoteCode,
              userId: userId, // admin phone — tiene FK válido en users
              projectType: result.nivel || 'Automatización IA',
              company: result.empresa || null,
              clientName: result.contacto || 'Cliente',
              email: result.email,
              phone: normalizePhoneEC(result.telefono) || null, // número del cliente extraído por OpenAI
              budgetRange: result.precio ? `$${result.precio}` : 'Por definir',
              urgency: 'Normal',
              description: `Cotización generada por Big Boss - ${result.nivel || 'Agente IA'}`
            });
            console.log(`[BOSS-CMD] ✅ Proyecto guardado en marketing_leads: ${quoteCode}`);
          } catch (err) {
            console.error('[BOSS-CMD] ⚠️ Error guardando en marketing_leads:', err.message);
          }
        }
        
        const reply = result.success
          ? `✅ *Propuesta enviada por Enzo*\n🏢 ${result.empresa}\n👤 ${result.contacto}\n📧 ${result.email}\n🤖 Nivel: ${result.nivel}\n💰 $${result.precio?.toLocaleString()} USD`
          : `❌ Error al generar propuesta Enzo: ${result.error}`;
        await enviarWhatsApp(userId, reply);
        return;
      }
    }
    // ══════════════════════════════════════════════════════════════════════

    // ══════════════════════════════════════════════════════════════════════
    // 👔 BOSS COMMANDS: Paula — brochure de lujo con propiedades El Morenal
    // Boss especifica propiedad (#1/#3/#6/#7) o envía overview de las 4 casas
    // Solo activo cuando: userId === ADMIN_PHONE + agente PAULA + email presente
    // ══════════════════════════════════════════════════════════════════════
    if (ADMIN_PHONE && isAdminPhone(userId) && processedText && profile.activeAgent === 'PAULA') {
      if (isPaulaBossQuoteCommand(processedText)) {
        const quoteData = await parsePaulaQuoteData(processedText);
        if (quoteData?.email) {
          const propLabel = quoteData.esOverview ? 'El Morenal (las 4 casas)' : quoteData.propiedad?.nombre;
          console.log('[BOSS-CMD] 👔 Brochure PAULA solicitado:', propLabel, '→', quoteData.nombre);
          const quoteCode = await generateBossQuoteCode('PAULA');
          await enviarWhatsApp(userId, `🏡 *Paula preparando brochure de lujo...*\n📐 ${propLabel}\n👤 ${quoteData.nombre}\n📧 ${quoteData.email}\n🔑 ${quoteCode}`);
          await new Promise(r => setTimeout(r, 600));
          const result = await sendPaulaCotizacion(processedText, { quoteCode });
          await saveBossQuote({
            agent:       'PAULA',
            clientName:  result.nombre    || quoteData.nombre,
            clientEmail: result.email     || quoteData.email,
            clientPhone: normalizePhoneEC(quoteData.telefono) || null,
            serviceInfo: result.propiedad  || null,
            amountMin:   quoteData.esOverview ? null : (quoteData.propiedad?.precio ?? null),
            amountMax:   quoteData.esOverview ? null : (quoteData.propiedad?.precio ?? null),
            quoteCode,
            emailSent:   result.success,
          });
          // 🆕 Guardar en real_estate_leads (para dashboard Paula)
          if (result.success) {
            try {
              const { v4: uuidv4 } = await import('uuid');
              const leadId = uuidv4();
              await saveRealEstateLead({
                id:            leadId,
                userId:        userId, // admin phone — FK válido en users
                operationType: 'Compra',
                propertyType:  result.propiedad || 'Propiedad',
                preferredZone: 'El Morenal',
                budgetRange:   quoteData.propiedad?.precio ? `$${quoteData.propiedad.precio}` : 'Por definir',
                clientName:    result.nombre || quoteData.nombre,
                email:         result.email  || quoteData.email,
                phone:         normalizePhoneEC(quoteData.telefono) || null,
                requirements:  { quoteCode, brochureEnviado: true, fuente: 'boss_command', brochureSentAt: new Date().toISOString(), leadId },
              });
              console.log(`[BOSS-CMD] ✅ Lead PAULA guardado en real_estate_leads: ${quoteCode}`);

              // 🤖 AUTO WA: Paula se presenta al cliente tras enviar brochure
              if (normalizePhoneEC(quoteData.telefono)) {
                const clientFirstName = (result.nombre || quoteData.nombre || 'Hola').split(' ')[0];
                const propName = quoteData.esOverview ? 'las Casas Jardín El Morenal' : quoteData.propiedad?.nombre;
                const autoMsg = `@paula\n¡Hola ${clientFirstName}! 🏡\n\nSoy *Paula* de PropElite Bienes Raíces. Te acabo de enviar un brochure exclusivo de *${propName}* a tu correo 📧\n\nRevísalo con calma y si te interesa, con gusto te agendo una *visita presencial* para que conozcas la propiedad en persona.\n\n¿Tienes alguna pregunta? Estoy aquí para ayudarte 🤝`;
                await new Promise(r => setTimeout(r, 2000));
                await enviarWhatsApp(normalizePhoneEC(quoteData.telefono), autoMsg);
                console.log(`[BOSS-CMD] 🤖 Auto-WA enviado a cliente: ${normalizePhoneEC(quoteData.telefono)}`);
              }
            } catch (err) { console.error('[BOSS-CMD] ⚠️ Error guardando real_estate_lead:', err.message); }
          }
          const reply = result.success
            ? `✅ *Brochure enviado por Paula*\n🏡 ${result.propiedad}\n👤 ${result.nombre}\n📧 ${result.email}\n💰 ${result.precio} USD`
            : `❌ Error enviando brochure Paula: ${result.error}`;
          await enviarWhatsApp(userId, reply);
          return;
        }
      }
    }
    // ══════════════════════════════════════════════════════════════════════

    // ══════════════════════════════════════════════════════════════════════
    // 👔 BOSS COMMANDS: Aluna — proforma de membresía para cliente presencial
    // Detección flexible: email + palabra de plan/membresía en cualquier orden
    // ══════════════════════════════════════════════════════════════════════
    if (ADMIN_PHONE && isAdminPhone(userId) && processedText) {
      const hasEmail       = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/.test(processedText);
      const hasAlunaTrigger = /plan\s*(?:10|20|diez|veinte|mensual)|oficina\s*virtual|membres[ií]a|cowork(?:ing)?|proforma|cotizar|coti\b|manda|env[ií]a/i.test(processedText);

      if (hasEmail && hasAlunaTrigger) {
        const emailMatch = processedText.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
        let trimmedName = 'Cliente', trimmedEmail = emailMatch?.[0] || '', trimmedPhone = null, rawPlan = null, trimmedNota = null;
        // Extracción rápida de nota como fallback (por si falla OpenAI)
        const notaFallbackM = processedText.match(/\bN(?:ota)?:\s*(.+)/i);
        if (notaFallbackM) trimmedNota = notaFallbackM[1].trim();
        try {
          const { complete: _c } = await import('../../servicios-ia/openai.js');
          const raw = await _c(processedText, {
            system: `La directora de Coworkia quiere enviar una proforma de membresía a un cliente. Extrae ÚNICAMENTE este JSON (sin markdown):
{"nombre":"nombre del cliente","email":"email","telefono":"tel o null","plan":"plan10|plan20|oficina-virtual|sala-reuniones o null","nota":"texto de la nota del admin o null"}
REGLAS: nombre=solo nombre de persona. plan=detecta de contexto, si no hay plan explícito usa null. nota=texto que viene después de 'Nota:' o 'nota:' o 'N:'; si no hay nota usa null.`,
            temperature: 0.1, max_tokens: 200, model: 'gpt-4o'
          });
          const d = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
          trimmedName  = d.nombre || 'Cliente';
          trimmedEmail = d.email  || trimmedEmail;
          trimmedPhone = d.telefono || null;
          rawPlan      = d.plan || null;
          trimmedNota  = d.nota || null;
        } catch {
          const paraM = processedText.match(/para\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i);
          trimmedName = paraM ? paraM[1].trim() : 'Cliente';
          const planM = processedText.match(/plan\s*(10|20)/i);
          rawPlan = planM ? `plan${planM[1]}` : null;
        }

        if (trimmedEmail) {
          const { sendAlunaProforma, saveAlunaLeadFromProforma, normalizePlanKey } = await import('../../servicios/aluna-proforma-email.js');
          const planKey = normalizePlanKey(rawPlan); // defaultea a plan10 si rawPlan es null
          console.log('[BOSS-CMD] 👔 Proforma ALUNA solicitada por admin:', { rawPlan, planKey, trimmedName, trimmedEmail, nota: trimmedNota });
          const quoteCode = await generateBossQuoteCode('ALUNA');
          await enviarWhatsApp(userId, `💜 *Aluna preparando proforma...*\n🎫 ${planKey}\n👤 ${trimmedName}\n📧 ${trimmedEmail}${trimmedPhone ? `\n📱 ${trimmedPhone}` : ''}${trimmedNota ? `\n📝 ${trimmedNota}` : ''}\n🔑 ${quoteCode}`);
          await new Promise(r => setTimeout(r, 600));
          const proResult = await sendAlunaProforma({ clientName: trimmedName, clientEmail: trimmedEmail, planKey, proformaCode: quoteCode, nota: trimmedNota, fromAdmin: true });

          if (proResult.success) {
            await saveAlunaLeadFromProforma({ userId, clientName: trimmedName, clientEmail: trimmedEmail, planKey, phone: normalizePhoneEC(trimmedPhone), proformaCode: proResult.proformaCode, nota: trimmedNota, fromAdmin: true });
          }
          await saveBossQuote({
            agent:       'ALUNA',
            clientName:  trimmedName,
            clientEmail: trimmedEmail,
            clientPhone: normalizePhoneEC(trimmedPhone) || null,
            serviceInfo: proResult.planName || rawPlan,
            quoteCode,
            emailSent:   proResult.success,
          });

          const reply = proResult.success
            ? `✅ *Proforma enviada por Aluna*\n🎫 ${proResult.planName}\n👤 ${trimmedName}\n📧 ${trimmedEmail}${trimmedPhone ? `\n📱 ${trimmedPhone}` : ''}${trimmedNota ? `\n📝 ${trimmedNota}` : ''}\n🔑 ${proResult.proformaCode}`
            : `❌ Error enviando proforma: ${proResult.error}`;
          await enviarWhatsApp(userId, reply);
          return;
        }
      }
    }
    // ══════════════════════════════════════════════════════════════════════

    // � BOSS COMMANDS: Adriana — cotización de seguro vehicular para cliente presencial
    // El jefe dicta: "cotización seguro Toyota RAV4 2023 $45000 para Ana Martínez ana@email.com 0987..."
    // ══════════════════════════════════════════════════════════════════════
    if (ADMIN_PHONE && isAdminPhone(userId) && processedText && profile.activeAgent === 'ADRIANA') {
      if (isAdrianaBossQuoteCommand(processedText)) {
        console.log('[BOSS-CMD] 🛡️ Cotización ADRIANA solicitada por admin');
        const quoteCode = await generateBossQuoteCode('ADRIANA');
        await enviarWhatsApp(userId, `⚙️ *Adriana preparando cotización de seguro...*\n🔑 ${quoteCode}`);
        await new Promise(r => setTimeout(r, 600));

        const result = await sendAdrianaCotizacion(processedText, { quoteCode });

        await saveBossQuote({
          agent:       'ADRIANA',
          clientName:  result.nombre  || null,
          clientEmail: result.email   || null,
          clientPhone: normalizePhoneEC(result.telefono) || null,
          serviceInfo: result.vehiculo || null,
          amountMin:   result.primaAnual || null,
          amountMax:   result.primaAnual || null,
          quoteCode,
          emailSent:   result.success,
        });
        // 🆕 Guardar en insurance_leads (para dashboard Adriana)
        if (result.success) {
          try {
            await saveInsuranceLead({
              quoteCode:     quoteCode,
              userId:        userId, // admin phone — FK válido en users
              insuranceType: 'Vehicular',
              city:          null,
              commercialValue: null,
              plate:         null,
              vehicleBrand:  null,
              vehicleModel:  result.vehiculo || null,
              vehicleYear:   null,
              motor:         null,
              chasis:        null,
              originCountry: null,
              licenseType:   null,
              licenseExpiry: null,
              clientName:    result.nombre   || null,
              cedula:        null,
              email:         result.email    || null,
              phone:         normalizePhoneEC(result.telefono) || null,
              quotedPremium: result.primaAnual || null,
              premiumBreakdown: { fuente: 'boss_command' },
            });
            console.log(`[BOSS-CMD] ✅ Lead ADRIANA guardado en insurance_leads: ${quoteCode}`);
          } catch (err) { console.error('[BOSS-CMD] ⚠️ Error guardando insurance_lead:', err.message); }
        }

        const reply = result.success
          ? `✅ *Cotización enviada por Adriana*\n🚗 ${result.vehiculo}\n👤 ${result.nombre}\n📧 ${result.email}${result.telefono ? `\n📱 ${result.telefono}` : ''}\n💰 $${result.primaAnual}/año\n🔑 ${result.quoteCode}`
          : `❌ Error enviando cotización: ${result.error}`;
        await enviarWhatsApp(userId, reply);
        return;
      }
    }
    // ══════════════════════════════════════════════════════════════════════

    // 📋 Inicializar variables de formulario para todo el scope
    let formResult = { form: null, needsMoreInfo: false, updates: {} };
    const currentAgentForm = await getAgentForm(userId, profile.activeAgent || 'AURORA').catch(() => null);

    // ═══════════════════════════════════════════════════════════════════════
    // 🔒 AURORA FLOW: Confirmaciones SI/NO y formulario de reservas
    // CRÍTICO: debe ejecutarse ANTES del orquestador/LLM para que "Si"/"No"
    // llegue a processConfirmationResponse en lugar de al modelo de lenguaje.
    // ═══════════════════════════════════════════════════════════════════════
    // 🛡️ AURORA GUARDRAIL: imágenes recibidas con Aurora activo → manejar como comprobante
    // Debe ejecutarse ANTES del bloque general para que Aurora nunca ceda al handler de Axel/Adriana
    if (profile.activeAgent === 'AURORA' && mediaUrl && type === 'image') {
      const _receiptMsgData = { type, media: { url: mediaUrl } };
      if (isReceiptImage(_receiptMsgData)) {
        console.log('[AURORA-GUARDRAIL] 📸 Imagen recibida con Aurora activo → procesando como comprobante de pago');
        const _paymentResult = await processPaymentReceipt(_receiptMsgData, profile);
        await enviarWhatsApp(userId, _paymentResult.message);
        await saveConversationMessage(userId, { role: 'assistant', content: _paymentResult.message, agent: 'AURORA' });
        await saveInteraction({
          userId,
          agent: normalizeAgentName('AURORA'),
          agentName: 'Aurora Core',
          intentReason: 'payment_receipt_guardrail',
          input: `[RECEIPT:${type}]`,
          output: _paymentResult.message,
          meta: { envelope, paymentVerified: _paymentResult.success }
        });
        return;
      }
    }

    if (profile.activeAgent === 'AURORA' && processedText) {
      const { detectVirtualAgentSalesPromo: _dvVAP, detectarSaludoConInteresServicio: _dSCIS } = await import('../../deteccion-intenciones/detectar-intencion.js');
      const _hasVAP = _dvVAP(processedText).detected;
      const _hasSI  = _dSCIS(processedText);
      const _hasAF  = !!currentAgentForm;
      const _hasFCont = detectFormContinuation(processedText);
      // 🔥 FIX: No interceptar mensajes con keywords de Aluna si no hay form Aurora activo.
      // Evita que isReservationIntent (que matchea 'tienen', 'ofrecen', etc.) tape el handoff a Aluna.
      const _alunaKeywords = ['membresía','membresias','membresías','membresia','plan mensual','planes mensuales','plan 10','plan 20','plan10','plan20'];
      const _isAlunaIntent = !_hasAF && _alunaKeywords.some(k => (processedText || '').toLowerCase().includes(k));
      const _shouldForm = !_hasVAP && !_isAlunaIntent && (_hasSI || isReservationIntent(processedText) || _hasAF || _hasFCont);

      // ① Interceptar pedidos de supervisores / escalación humana
      const _supervisorKeywords = ['supervisor', 'gerente', 'jefe', 'encargado', 'responsable', 'hablar con alguien', 'hablar con una persona', 'persona real', 'humano real', 'quiero hablar con', 'comunícame con', 'comunicate con', 'pásame con', 'pasame con', 'llamar a', 'queja', 'reclamo', 'denuncia'];
      if (_supervisorKeywords.some(kw => processedText.toLowerCase().includes(kw))) {
        console.log('[AURORA-FLOW] 🚨 Detección de solicitud de supervisión/escalación');
        const _escalMsg = `Entiendo que quieres hablar directamente con alguien de nuestro equipo. 😊\n\nPuedes contactarnos por:\n📧 *Email:* info@coworkia.com\n📍 *En persona:* Whymper 403, Edificio Finistere\n\nAlguien del equipo te atenderá en seguida. ¿Hay algo más en que pueda ayudarte mientras tanto?`;
        await enviarWhatsApp(userId, _escalMsg);
        await saveConversationMessage(userId, { role: 'assistant', content: _escalMsg, agent: 'AURORA' });
        await saveInteraction({ userId, agent: normalizeAgentName('AURORA'), agentName: 'Aurora Core', intentReason: 'supervisor_escalation', input: processedText, output: _escalMsg, meta: { envelope } });
        return;
      }

      // ② Interceptar SI/NO pendiente ANTES de ir al LLM
      const _auroraEarlyPending = await getPendingConfirmation(userId).catch(() => null);
      if (_auroraEarlyPending) {
        const _isPos = isPositiveResponse(processedText);
        const _isNeg = isNegativeResponse(processedText);
        if (_isPos || _isNeg) {
          console.log('[AURORA-FLOW] ✅ Interceptando SI/NO (pendingConfirmation) antes del LLM');
          const _confResult = await processConfirmationResponse(processedText, profile);
          if (_confResult.success && _isPos) {
            profile.transactionStartedAt = null;
            profile.transactionAgent     = null;
            profile.followUpSentAt       = null;
            await saveProfile(userId, profile);
            console.log('[T14] ✅ Transacción Aurora completada:', { userId });
          }
          if (_confResult.cancelledReservation) {
            await cancelAgentForm(userId, 'AURORA', 'user_cancelled').catch(e => console.error('[WASSENGER] ⚠️ cancelAgentForm:', e));
          }
          await enviarWhatsApp(userId, _confResult.message);
          await saveConversationMessage(userId, { role: 'assistant', content: _confResult.message, agent: 'AURORA' });
          await saveInteraction({
            userId,
            agent: normalizeAgentName('AURORA'),
            agentName: 'Aurora Core',
            intentReason: 'aurora_confirmation_response',
            input: processedText,
            output: _confResult.message,
            meta: { envelope, confirmationSuccess: _confResult.success }
          });
          return;
        }
      }

      // ② bis: Interceptar solicitud de link de pago — responder siempre con el link directamente
      // No bloquear por falta de form/reserva: lo importante es capturar el pago, el registro se ajusta después
      const _PAYMENT_LINK_PATTERNS = [/link.*pago/i, /enlace.*pago/i, /dame.*link/i, /envia.*link/i, /me.*das.*link/i, /como.*pago/i, /donde.*pago/i, /quiero.*pagar/i, /necesito.*pagar/i, /pagar.*tarjeta/i, /tarjeta.*pagar/i];
      const _isPayLinkReq = _PAYMENT_LINK_PATTERNS.some(p => p.test(processedText));
      if (_isPayLinkReq) {
        console.log('[AURORA-FLOW] 💳 Solicitud de link de pago — enviando link directo sin condiciones');
        // Limpiar form vacío si existe para evitar loops futuros
        if (_hasAF && currentAgentForm) {
          const _fd = currentAgentForm.form_data || currentAgentForm;
          if (!_fd.spaceType && !_fd.date && !_fd.time) {
            await cancelAgentForm(userId, 'AURORA', 'payment_link_requested').catch(() => {});
          }
        }
        const _payMsg = `Aquí tienes el link de pago con tarjeta 💳\n\n🔗 *https://ppls.me/hnMI9yMRxbQ6rgIVi6L2DA*\n\n💵 Ingresa el monto de tu reserva y paga con tarjeta crédito/débito (Visa, Mastercard).\n\nCuando termines, envíame el comprobante por aquí y te confirmo ✅`;
        await enviarWhatsApp(userId, _payMsg);
        await saveConversationMessage(userId, { role: 'assistant', content: _payMsg, agent: 'AURORA' });
        await saveInteraction({ userId, agent: normalizeAgentName('AURORA'), agentName: 'Aurora Core', intentReason: 'payment_link_direct', input: processedText, output: _payMsg, meta: { envelope } });
        return;
      }

      // ② Formulario de reservas (progresivo, sin LLM)
      if (_shouldForm) {
        console.log('[AURORA-FLOW] 📋 Activando formulario de reserva:', {
          isReservationIntent: isReservationIntent(processedText),
          hasActiveForm: _hasAF,
          isFormContinuation: _hasFCont
        });
        formResult = await processMessageWithForm(userId, processedText, profile, currentAgentForm);
        formResult.userMessage = text;

        // Guardar form si hay actualizaciones
        if (formResult.form && formResult.updates && Object.keys(formResult.updates).length > 0) {
          await saveAgentForm(userId, 'AURORA', formResult.form.toJSON(), 120);
        }

        // ⏱️ T14: Iniciar tracking de transacción al comenzar captura de datos
        if (formResult.needsMoreInfo && !profile.transactionStartedAt) {
          profile.transactionStartedAt = new Date().toISOString();
          profile.transactionAgent = 'AURORA';
          profile.followUpSentAt = null;
          await saveProfile(userId, profile);
          console.log('[T14] ⏱️ Transacción AURORA iniciada:', { userId, timestamp: profile.transactionStartedAt });
        }

        const _handled = await handleFormResult(formResult, userId, 'AURORA', profile);
        if (_handled) return;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // �🎨 AXEL FLOW: Cotizaciones de pintura con fotos
    // ═══════════════════════════════════════════════════════════════════════
    if (profile.activeAgent === 'AXEL') {
      // ────────────────────────────────────────────────────────────────────
      // PASO 1: Consentimiento email (SI/NO post-cotización)
      // ────────────────────────────────────────────────────────────────────
      if (axelEmailConsent.has(userId) && processedText) {
        const consentData = axelEmailConsent.get(userId);

        // Sub-estado: esperando que el usuario escriba su email
        if (consentData.awaitingEmail) {
          const emailMatch = processedText.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) {
            consentData.email = emailMatch[0];
            consentData.awaitingEmail = false;
            axelEmailConsent.set(userId, consentData);
            const emailResult = await sendQuoteEmail({
              customerName: consentData.customerName,
              customerEmail: consentData.email,
              vehicleData: consentData.vehicleData,
              damageAnalysis: consentData.damageAnalysis,
              quote: consentData.quote,
              priceRange: consentData.priceRange,
              photoUrls: consentData.photoUrls,
              quoteCode: consentData.quoteCode
            });
            const message = emailResult.success
              ? `✉️ Listo, envié la cotización detallada a ${consentData.email}. ¿Necesitas algo más?`
              : `⚠️ No pude enviar el email (${emailResult.error}). Te contacto manualmente.`;
            await enviarWhatsApp(userId, message);
            if (emailResult.success) {
              await saveInteraction({
                userId, agent: 'AXEL', agentName: 'Axel - PaintBull',
                intentReason: 'email_sent', input: consentData.email, output: 'quote_email_sent',
                meta: { quoteCode: consentData.quoteCode, correlationId: consentData.sessionFingerprint || consentData.quoteCode, email: consentData.email }
              });
            }
            axelEmailConsent.delete(userId);
            axelSchedulingPending.set(userId, { quoteCode: consentData.quoteCode, clientName: consentData.customerName });
            await enviarWhatsApp(userId, `¿Cuándo tienes 20 minutos esta semana para revisarla juntos? 📅\n\nDime el día y hora y te confirmo disponibilidad.\n📍 Lun–Vie 8am–6pm · Sáb 8am–1pm`);
          } else {
            await enviarWhatsApp(userId, '✉️ No detecté un email válido. Por favor escribe solo tu dirección de correo (ej: tu@mail.com)');
          }
          return;
        }

        const normalized = processedText.trim().toLowerCase();
        const isYes = ['si', 'sí', 'yes', 'y', 'claro', 'ok'].includes(normalized);
        const isNo = ['no', 'nop', 'nope'].includes(normalized);

        if (isYes || isNo) {
          if (isYes) {
            if (consentData.email) {
              const emailResult = await sendQuoteEmail({
                customerName: consentData.customerName,
                customerEmail: consentData.email,
                vehicleData: consentData.vehicleData,
                damageAnalysis: consentData.damageAnalysis,
                quote: consentData.quote,
                priceRange: consentData.priceRange,
                photoUrls: consentData.photoUrls,
                quoteCode: consentData.quoteCode
              });
              const message = emailResult.success
                ? `✉️ Listo, envié la cotización detallada a ${consentData.email}. ¿Necesitas algo más?`
                : `⚠️ No pude enviar el email (${emailResult.error}). Te contacto manualmente.`;
              await enviarWhatsApp(userId, message);
              if (emailResult.success) {
                await saveInteraction({
                  userId, agent: 'AXEL', agentName: 'Axel - PaintBull',
                  intentReason: 'email_sent', input: consentData.email, output: 'quote_email_sent',
                  meta: { quoteCode: consentData.quoteCode, correlationId: consentData.sessionFingerprint || consentData.quoteCode, email: consentData.email }
                });
              }
              axelEmailConsent.delete(userId);
              axelSchedulingPending.set(userId, { quoteCode: consentData.quoteCode, clientName: consentData.customerName });
              await enviarWhatsApp(userId, `¿Cuándo tienes 20 minutos esta semana para revisarla juntos? 📅\n\nDime el día y hora y te confirmo disponibilidad.\n📍 Lun–Vie 8am–6pm · Sáb 8am–1pm`);
            } else {
              // No tenemos email — pedirlo ahora
              consentData.awaitingEmail = true;
              axelEmailConsent.set(userId, consentData);
              await enviarWhatsApp(userId, '✉️ ¿A qué correo te envío la cotización? Escribe tu email.');
            }
          } else {
            axelEmailConsent.delete(userId);
            axelSchedulingPending.set(userId, { quoteCode: consentData.quoteCode, clientName: consentData.customerName });
            await enviarWhatsApp(userId, `👍 Sin problema — ¿cuándo tienes 20 minutos esta semana para revisar los detalles juntos? 📅\n\nDime el día y hora y te confirmo.\n📍 Lun–Vie 8am–6pm · Sáb 8am–1pm`);
          }
          return;
        } else {
          await enviarWhatsApp(userId, 'Por favor responde solo SI o NO para confirmar el envío de la cotización por email.');
          return;
        }
      }

    // ── 🗓️ PASO 2: Agendamiento de inspección en taller post-cotización ─────
    if (axelSchedulingPending.has(userId) && processedText) {
      const { detected } = detectSchedulingIntent(processedText);
      if (detected) {
        const pending = axelSchedulingPending.get(userId);
        const result = await processWorkshopScheduling(pending.quoteCode, processedText, pending.clientName);
        await enviarWhatsApp(userId, result.message);
        axelSchedulingPending.delete(userId);
        return;
      }
      // No date detected → falls through to normal LLM flow for open questions
    }

    // 📋 Formulario inteligente: activar si hay intención, formulario activo, o continuación detectada
    const hasActiveForm = !!currentAgentForm;
    const isFormContinuation = detectFormContinuation(processedText);
    
    // 🔍 DETECCIÓN TEMPRANA: Verificar si hay intención especial que debe ir directo al orquestador
    const { detectVirtualAgentSalesPromo, detectarSaludoConInteresServicio } = await import('../../deteccion-intenciones/detectar-intencion.js');
    // 🛡️ FIX: No activar OneMind promo si el agente activo ya es ENZO — el cliente ya está en contexto
    const hasVirtualAgentPromo = profile.activeAgent !== 'ENZO' && detectVirtualAgentSalesPromo(processedText).detected;
    const hasServiceInterest = detectarSaludoConInteresServicio(processedText);
    
    // 🎯 LÓGICA CORRECTA:
    // - Promo de agente virtual (Enzo): NO activar formulario → orquestador
    // - Saludo "quiero probar servicio": SÍ activar formulario → capturar datos
    // - Cualquier otro mensaje con intención de reserva: SÍ activar formulario
    const shouldActivateForm = !hasVirtualAgentPromo && (hasServiceInterest || isReservationIntent(processedText) || hasActiveForm || isFormContinuation);
    
    // 🎯 ENZO - Flujo consultivo estructurado SOLO para #PROCESS_FORM o states activos
    // Conversaciones normales → orquestador con system prompt + conversation history (más natural)
    if (profile.activeAgent === 'ENZO' && !isEnzoBossQuoteCommand(processedText)) {
      try {
        // Importar módulos del consulting flow
        const { processEnzoConsultingFlowFull } = await import('../../servicios/enzo-consulting-flow.js');
        const { getPendingConfirmation } = await import('../../servicios/reservation-state.js');

        // Solo activar consulting flow si:
        // 1. Hay un state activo (QUALIFYING/CONFIRMING/WAITING_EMAIL) — respetar flujo en progreso
        // 2. El mensaje tiene #PROCESS_FORM — el cliente quiere formalizar
        const existingState = await getPendingConfirmation(userId).catch(() => null);
        const hasActiveState = existingState?.type === 'enzo_consulting';
        const hasProcessForm = /\#PROCESS_FORM/i.test(processedText);

        if (hasActiveState || hasProcessForm) {
          const enzoResult = await processEnzoConsultingFlowFull(userId, processedText, profile);
          if (enzoResult.handled) {
            console.log(`[ENZO-FLOW] ✅ Manejado por ${hasActiveState ? 'state activo' : '#PROCESS_FORM'}`);
            await enviarWhatsApp(userId, enzoResult.reply);
            await saveConversationMessage(userId, { role: 'assistant', content: enzoResult.reply, agent: 'ENZO' });
            await saveInteraction({
              userId, agent: 'ENZO', agentName: 'Enzo - MarketingLab',
              intentReason: hasActiveState ? 'enzo_consulting_state' : 'enzo_process_form',
              input: processedText, output: enzoResult.reply,
              meta: { envelope }
            });
            return;
          }
        }
      } catch (enzoErr) {
        console.error('[ENZO-FLOW] ❌ Error en flujo consultivo, fallback al LLM:', enzoErr.message);
      }
      // 🆕 Auto-captura de lead: registra al prospecto en marketing_leads aunque
      //    no llegue a #PROCESS_FORM (excluye Diego/admin internamente).
      try {
        const enzoLeadName = profile?.nombre || envelope?.from?.name || 'Sin nombre';
        await enzoRepository.captureEnzoLeadFromKeywords(userId, enzoLeadName, processedText);
      } catch (captureErr) {
        console.warn('[ENZO-CAPTURE] ⚠️ Error en auto-captura (no crítico):', captureErr.message);
      }
      // → Conversaciones normales fluyen al orquestador con Enzo system prompt + history
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 💜 ALUNA FLOW: Membresías (PRE-LLM)
    // CRÍTICO: Debe ejecutarse ANTES del orquestador/LLM para que la detección
    // de keywords active el formulario en lugar de que el modelo responda
    // conversacionalmente sin recolectar datos.
    // ═══════════════════════════════════════════════════════════════════════
    console.log(`[ALUNA-FLOW-DEBUG] Verificando condiciones: activeAgent=${profile.activeAgent}, hasProcessedText=${!!processedText}`);
    
    if (profile.activeAgent === 'ALUNA' && processedText) {
      console.log('[ALUNA-FLOW-DEBUG] ✅ Condiciones satisfechas - ejecutando processAlunaMembershipFlow');
      
      const alunaResult = await processAlunaMembershipFlow(
        userId,
        processedText,
        text,
        profile,
        envelope
      );

      if (alunaResult.handled) {
        console.log('[ALUNA-FLOW] ✅ Mensaje manejado por flujo de membresías');
        
        // Si el flow retorna un mensaje, enviarlo
        if (alunaResult.reply) {
          await enviarWhatsApp(userId, alunaResult.reply);
          console.log('[ALUNA-FLOW] 📤 Mensaje enviado al usuario');
        }
        
        return;
      }
      // Si no maneja el mensaje → auto-captura lead por keywords antes de pasar al LLM
      try {
        const userName = profile?.nombre || envelope?.from?.name || 'Sin nombre';
        await captureAlunaLeadFromKeywords(userId, userName, processedText);
      } catch (captureErr) {
        console.warn('[ALUNA-CAPTURE] ⚠️ Error en auto-captura (no crítico):', captureErr.message);
      }
    } else {
      console.log('[ALUNA-FLOW-DEBUG] ❌ Condiciones NO satisfechas - saltando flujo');
    }

    // 🏡 PAULA - Formulario de búsqueda inmobiliaria
    // PRE-LLM: Si ya hay un form activo para PAULA, continuar recopilando datos sin llamar al LLM
    if (profile.activeAgent === 'PAULA') {
      const paulaForm = await getAgentForm(userId, 'PAULA').catch(() => null);
      if (paulaForm) {
        console.log('[PAULA-FORM] 🏡 Continuando formulario inmobiliario');
        try {
          formResult = await processRealEstateForm(userId, processedText, profile);
          formResult.userMessage = text;
          const handled = await handleFormResult(formResult, userId, 'PAULA', profile);
          if (handled) return;
        } catch (error) {
          console.error('[PAULA-FORM] ❌ Error procesando formulario:', error);
          // Continuar con flujo normal en caso de error
        }
      }
    }
    
    // 🔧 FIX: Verificar pending_confirmation ANTES del form handler para Aurora.
    // Si el usuario responde SI/NO a un resumen de confirmación pendiente, procesarlo
    // de inmediato sin pasar por el formulario (evita el loop infinito de confirmación).
    if (profile.activeAgent === 'AURORA') {
      const earlyPending = await getPendingConfirmation(userId).catch(() => null);
      if (earlyPending) {
        const isPos = isPositiveResponse(processedText);
        const isNeg = isNegativeResponse(processedText);
        if (isPos || isNeg) {
          console.log('[WASSENGER] 🔧 FIX: Interceptando SI/NO antes del form handler - confirmación pendiente');
          const confirmationResult = await processConfirmationResponse(processedText, profile);

          if (confirmationResult.success && isPos) {
            profile.transactionStartedAt = null;
            profile.transactionAgent = null;
            profile.followUpSentAt = null;
            await saveProfile(userId, profile);
          }
          if (confirmationResult.cancelledReservation) {
            await cancelAgentForm(userId, 'AURORA', 'user_cancelled').catch(e => console.error('[WASSENGER] ⚠️ cancelAgentForm:', e));
          }

          const interactionAgent = earlyPending.agentName || profile.activeAgent || 'AURORA';
          await enviarWhatsApp(userId, confirmationResult.message);
          await saveConversationMessage(userId, { role: 'assistant', content: confirmationResult.message, agent: interactionAgent });
          await saveInteraction({
            userId,
            agent: normalizeAgentName(interactionAgent),
            agentName: interactionAgent,
            intentReason: 'confirmation_response_early',
            input: processedText,
            output: confirmationResult.message,
            meta: { envelope, confirmationSuccess: confirmationResult.success }
          });
          return;
        }
      }
    }

    // 🏢 AURORA - Formulario de reservas
    if (shouldActivateForm && profile.activeAgent === 'AURORA') {
      console.log('[FORM] 🎯 Activando formulario:', { 
        isReservationIntent: isReservationIntent(processedText),
        hasActiveForm,
        isFormContinuation 
      });
      
      formResult = await processMessageWithForm(userId, processedText, profile, currentAgentForm);
      formResult.userMessage = text;
      
      // 💾 Guardar form en sistema unificado si hay cambios
      if (formResult.form && formResult.updates && Object.keys(formResult.updates).length > 0) {
        await saveAgentForm(userId, 'AURORA', formResult.form.toJSON(), 120);
      }
      
      // ⏱️ T14: Iniciar tracking de transacción si necesita más info (inicio de reserva)
      if (formResult.needsMoreInfo && !profile.transactionStartedAt) {
        profile.transactionStartedAt = new Date().toISOString();
        profile.transactionAgent = 'AURORA';
        profile.followUpSentAt = null;
        await saveProfile(userId, profile);
        console.log('[T14] ⏱️ Transacción AURORA iniciada:', { userId, timestamp: profile.transactionStartedAt });
      }

      // 🎯 Usar función compartida para manejar resultado
      const handled = await handleFormResult(formResult, userId, 'AURORA', profile);
      if (handled) return;
    }

    // Si hay confirmación pendiente en sistema unificado, SOLO procesar SI/NO explícito
    const pendingConfirmation = await getPendingConfirmation(userId).catch(() => null);
    if (pendingConfirmation) {
      const isPos = isPositiveResponse(processedText);
      const isNeg = isNegativeResponse(processedText);

      if (isPos || isNeg) {
        console.log(`[WASSENGER] ✅ Confirmación pendiente (${pendingConfirmation.agentName || 'AURORA'}) y respuesta SI/NO`);

        const confirmationResult = await processConfirmationResponse(processedText, profile);

        // ⏱️ T14: Limpiar transacción si confirmación exitosa (transacción completada)
        if (confirmationResult.success && isPos) {
          profile.transactionStartedAt = null;
          profile.transactionAgent = null;
          profile.followUpSentAt = null;
          await saveProfile(userId, profile);
          console.log('[T14] ✅ Transacción completada (confirmación exitosa):', { userId });
        }
        if (confirmationResult.cancelledReservation) {
          await cancelAgentForm(userId, 'AURORA', 'user_cancelled').catch(e => console.error('[WASSENGER] ⚠️ cancelAgentForm:', e));
        }

        const interactionAgent = pendingConfirmation.agentName || profile.activeAgent || 'AURORA';
        const intentReason = pendingConfirmation.agentName ? 'specialized_confirmation' : 'confirmation_response';

        await enviarWhatsApp(userId, confirmationResult.message);
        await saveConversationMessage(userId, {
          role: 'assistant',
          content: confirmationResult.message,
          agent: interactionAgent
        });
        await saveInteraction({
          userId,
          agent: normalizeAgentName(interactionAgent),
          agentName: interactionAgent,
          intentReason,
          input: processedText,
          output: confirmationResult.message,
          meta: {
            envelope,
            confirmationSuccess: confirmationResult.success,
            actionType: confirmationResult.actionType,
            needsAction: confirmationResult.needsAction
          }
        });

        console.log('[WASSENGER] 🛑 Confirmación procesada - NO continuar con orquestador');
        return;
      }

      // Si no es SI/NO explícito, continuar con orquestador normal
      console.log('[WASSENGER] ⚠️ Confirmación pendiente pero respuesta NO es SI/NO - continuar con agente');
    }

    // Si el usuario reanuda reserva (mensaje de continuación si aplica)
    if (currentAgentForm && formResult?.form?.getResumeMessage) {
      const resumeMessage = formResult.form.getResumeMessage();
      if (resumeMessage) formResult.resumeMessage = resumeMessage;
    }

      // ────────────────────────────────────────────────────────────────────
      // PASO 2: Manejo de fotos (agregar a sesión)
      // ────────────────────────────────────────────────────────────────────
      if (mediaUrl && type === 'image') {
        await queueTask(userId, async () => {
          const photoStatus = await addPhoto(userId, mediaUrl, type);
          
          // Tracking de transacción en primera foto
          if (photoStatus.currentCount === 1 && !profile.transactionStartedAt) {
            profile.transactionStartedAt = new Date().toISOString();
            profile.transactionAgent = 'AXEL';
            profile.followUpSentAt = null;
            await saveProfile(userId, profile);
          }
          
          // ─── Primera foto: programar ack con retraso de 2s ───────────────
          // Si llegan más fotos y se alcanza el máximo antes de los 2s,
          // el timer se cancela y solo se envía el mensaje de máximo (1 mensaje).
          if (photoStatus.currentCount === 1 && !photoStatus.firstAckSent) {
            markFirstAckSent(userId);

            const firstAckTimer = setTimeout(async () => {
              axelFirstAckTimers.delete(userId);
              // Solo enviar si el máximo aún NO fue alcanzado
              const currentSession = await getSession(userId).catch(() => null);
              if (!currentSession?.maxPhotosAckSent) {
                await enviarWhatsApp(userId,
                  `📸 Foto recibida (1/${photoStatus.maxPhotos}).\n\n🚗 Mientras envías las demás, ¿qué vehículo es? Escríbeme *marca, modelo y año*.\nEj: _Toyota Corolla 2021_\n\nCuando las tengas todas escribe *listo* para cotizar.`);
              }
            }, 2000);
            axelFirstAckTimers.set(userId, firstAckTimer);

            await saveInteraction({
              userId,
              agent: 'AXEL',
              agentName: 'Axel - PaintBull',
              intentReason: 'photo_received',
              input: '[PHOTO]',
              output: 'ack_first_photo',
              meta: {
                correlationId: photoStatus.sessionFingerprint,
                photoCount: photoStatus.currentCount
              }
            });
            
            // Timeout reminder (20s sin actividad)
            startTimeout(userId, async () => {
              await enviarWhatsApp(userId,
                `⏳ Pasaron 20s sin nuevas fotos.\n\n🚗 ¿Qué vehículo es? Escribe *marca, modelo y año* y luego *listo* para cotizar.`);
              await saveInteraction({
                userId,
                agent: 'AXEL',
                agentName: 'Axel - PaintBull',
                intentReason: 'photo_timeout_reminder',
                input: '[PHOTO_TIMEOUT]',
                output: 'reminder_sent',
                meta: { photoCount: photoStatus.currentCount }
              });
            });
          }
          
          // ─── Máximo de fotos: cancelar primer ack pendiente y enviar único mensaje ─
          if (photoStatus.currentCount >= photoStatus.maxPhotos && !photoStatus.maxPhotosAckSent) {
            // Cancelar el ack de primera foto si aún está pendiente
            const pendingTimer = axelFirstAckTimers.get(userId);
            if (pendingTimer) {
              clearTimeout(pendingTimer);
              axelFirstAckTimers.delete(userId);
            }
            await enviarWhatsApp(userId,
              `✅ Ya tengo las ${photoStatus.maxPhotos} fotos.\n\n🚗 ¿Qué vehículo es? Escribe *marca, modelo y año*.\nEj: _Toyota RAV4 2023_\n\nLuego escribe *listo* para analizar y cotizar.`);
            markMaxPhotosAckSent(userId);
          }
        });
        
        return;
      }

      // ────────────────────────────────────────────────────────────────────
      // PASO 3: Comando "listo" (procesar cotización)
      // ────────────────────────────────────────────────────────────────────
      if (!mediaUrl && processedText) {
        const session = await getSession(userId);
        
        if (session && session.photoCount > 0) {
          const normalized = processedText.toLowerCase().trim().replace(/[!.]/g, '');
          const finalizationPatterns = [
            /^listo$/,
            /^ya$/,
            /^ya\s+esta$/,
            /^ya\s+está$/,
            /^procesar$/,
            /^ok$/,
            /^dale$/
          ];
          
          const isFinalizationCommand = finalizationPatterns.some(rx => rx.test(normalized));
          
          if (isFinalizationCommand) {
            await queueTask(userId, async () => {
              const result = await completeSession(userId);
              
              if (result) {
                await processAxelQuote(userId, result.photos, profile, processedText, result.sessionFingerprint);
                clearQueue(userId);
              }
            });
            
            return;
          }
        }
        
        // ────────────────────────────────────────────────────────────────────
        // PASO 4: Texto normal — actualizar formulario silenciosamente
        // Si hay sesión de fotos activa, responder con contexto directo
        // (NO caer al orquestador LLM: no tiene contexto de las fotos y
        //  regenera el mensaje de bienvenida pidiendo fotos de nuevo)
        // ────────────────────────────────────────────────────────────────────
        await processAxelFormMessage(userId, processedText).catch(() => {});

        const activeSession = await getSession(userId).catch(() => null);
        if (activeSession && activeSession.photoCount > 0) {
          const photoEmoji = activeSession.photoCount >= 4 ? '✅' : '📸';
          const ackMsg = `${photoEmoji} Tengo ${activeSession.photoCount} foto(s) listas y anoté tu vehículo.\n\nEscribe *listo* cuando quieras que analice y cotice. 🚗💥`;
          await enviarWhatsApp(userId, ackMsg);
          await saveInteraction({
            userId,
            agent: 'AXEL',
            agentName: 'Axel - PaintBull',
            intentReason: 'vehicle_data_received',
            input: processedText,
            output: ackMsg,
            meta: { photoCount: activeSession.photoCount }
          });
          return; // No caer al orquestador
        }

        // Sin sesión activa → continuar con orquestador para respuestas conversacionales
      }
    }
    
    // 💼 ALUNA PAYMENT RECEIPTS: Verificar comprobantes de membresías
    if (mediaUrl && type === 'image' && profile.activeAgent === 'ALUNA') {
      const messageData = { type, media: { url: mediaUrl } };
      
      if (isReceiptImage(messageData)) {
        console.log('[ALUNA] 💳 Comprobante de membresía detectado');
        
        const pendingLead = await findPendingMembershipLead(userId);
        
        if (pendingLead && pendingLead.status === 'pending_payment') {
          console.log('[ALUNA] 📋 Lead pendiente encontrado:', pendingLead.id);
          
          // Pasar el mensaje del usuario para detectar pagos compuestos
          const userMessage = messageData.text || '';
          const paymentResult = await processMembershipPayment(messageData, profile, userMessage);
          
          await enviarWhatsApp(userId, paymentResult.message);
          await saveConversationMessage(userId, { 
            role: 'assistant', 
            content: paymentResult.message, 
            agent: 'ALUNA' 
          });
          
          await saveInteraction({
            userId,
            agent: 'ALUNA',
            agentName: 'Aluna - Closer Membresías',
            intentReason: 'membership_payment_verification',
            input: `[RECEIPT:${type}]`,
            output: paymentResult.message,
            meta: { 
              envelope, 
              paymentVerified: paymentResult.autoApproved || false,
              manualReview: paymentResult.manualReview || false,
              rejected: paymentResult.rejected || false
            }
          });
          
          return; // No continuar con flujo normal
        }
        
        // Si no hay lead pendiente, informar al usuario
        console.log('[ALUNA] ⚠️ No hay lead pendiente para este comprobante');
        await enviarWhatsApp(userId, 
          `📸 Recibí tu comprobante, pero no encuentro solicitudes de membresía pendientes de pago.\n\n` +
          `¿Necesitas información sobre nuestros planes? Escribe "planes" 😊`
        );
        
        return;
      }
    }

    // 🏥 ANGELA MEDICAL IMAGES: Analizar imágenes médicas (heridas, ojos, piel)
    if (mediaUrl && type === 'image' && profile.activeAgent === 'ANGELA') {
      console.log('[ANGELA] 🏥 Imagen médica detectada');
      
      try {
        const medicalAnalysis = await analyzeMedicalImage(mediaUrl, processedText || '');
        
        if (medicalAnalysis.success) {
          await enviarWhatsApp(userId, medicalAnalysis.analysis);
          await saveConversationMessage(userId, {
            role: 'assistant',
            content: medicalAnalysis.analysis,
            agent: 'ANGELA'
          });
          
          await saveInteraction({
            userId,
            agent: normalizeAgentName('ANGELA'),
            agentName: 'Angela - MedBeneficios',
            intentReason: 'medical_image_analysis',
            input: `[MEDICAL_IMAGE:${medicalAnalysis.imageType}] ${processedText || 'Imagen médica'}`,
            output: medicalAnalysis.analysis,
            meta: {
              envelope,
              imageType: medicalAnalysis.imageType,
              confidence: medicalAnalysis.confidence,
              imageUrl: mediaUrl
            }
          });
          
          return; // No continuar con flujo normal
        } else {
          console.error('[ANGELA] ❌ Error analizando imagen médica:', medicalAnalysis.error);
          await enviarWhatsApp(userId, 
            `⚠️ No pude analizar la imagen automáticamente.\n\n` +
            `Por favor, descríbeme lo que ves en la imagen y con gusto te ayudo 😊`
          );
          return;
        }
      } catch (error) {
        console.error('[ANGELA] 🚨 Error procesando imagen médica:', error);
        await enviarWhatsApp(userId, 
          `⚠️ Hubo un problema procesando tu imagen.\n\n` +
          `Por favor, intenta enviarla nuevamente o descríbeme tu consulta por texto 💚`
        );
        return;
      }
    }

    // 🛡️ ADRIANA AUTO-TRIGGER: Detectar foto de matrícula aunque el agente activo no sea ADRIANA
    // Solo aplica cuando el agente activo NO tiene su propio handler de imágenes
    // 🚨 GUARDRAIL: AURORA excluida — tiene su propio handler de comprobantes (línea ~3301)
    //    Si Aurora recibe una imagen → siempre procesarla como posible recibo de pago,
    //    NUNCA re-rutear a Adriana aunque Vision AI detecte algo parecido a una matrícula.
    if (mediaUrl && type === 'image' && !['AXEL', 'ALUNA', 'ANGELA', 'AURORA'].includes(profile.activeAgent)) {
      const existingInsuranceLead = await findLeadByPhone(userId).catch(() => null);
      const ADRIANA_ACTIVE_STATES = ['waiting_matricula', 'waiting_cedula', 'waiting_competitor', 'waiting_coverage', 'quoted', 'waiting_kyc', 'accepted'];
      const hasActiveAdrianaLead = existingInsuranceLead && ADRIANA_ACTIVE_STATES.includes(existingInsuranceLead.status);

      if (!hasActiveAdrianaLead) {
        // 1. Detección barata: keywords en el texto del usuario
        const docType = detectDocumentType(processedText || '', '');
        const isMatriculaByText = docType === DOCUMENT_TYPES.VEHICLE_REGISTRATION;

        // 2. Detección por Vision AI: solo si el agente es AURORA (punto de entrada natural)
        //    y el texto no ayudó a identificarlo
        let isMatriculaByVision = false;
        if (!isMatriculaByText && (profile.activeAgent === 'AURORA' || !profile.activeAgent)) {
          try {
            console.log('[ADRIANA-AUTO] 🔍 Analizando imagen sin contexto de texto — verificando si es matrícula');
            const quickAnalysis = await analyzeInsuranceDocument(mediaUrl, processedText || '', {
              documentType: DOCUMENT_TYPES.VEHICLE_REGISTRATION,
            });
            isMatriculaByVision = quickAnalysis.success && quickAnalysis.analysis;
            if (isMatriculaByVision) {
              console.log('[ADRIANA-AUTO] ✅ Matrícula detectada por Vision AI');
            }
          } catch (_err) {
            console.warn('[ADRIANA-AUTO] ⚠️ Error en detección rápida de matrícula:', _err.message);
          }
        }

        if (isMatriculaByText || isMatriculaByVision) {
          console.log('[ADRIANA-AUTO] 🚗 Matrícula detectada — activando flujo Adriana');
          profile.activeAgent = 'ADRIANA';
          await updateProfile(userId, { activeAgent: 'ADRIANA' }, { reason: 'auto_matricula_detection' }).catch(() => {});
          const handled = await handleAdrianaFlow({ userId, profile, processedText, mediaUrl, type, envelope });
          if (handled) return;
        }
      }
    }

    // 🛡️ ADRIANA FLUJO COMPLETO (V2): Estados insurance_leads — waiting_matricula…accepted
    if (profile.activeAgent === 'ADRIANA') {
      const handled = await handleAdrianaFlow({ userId, profile, processedText, mediaUrl, type, envelope });
      if (handled) return;
    }

    // 🛡️ ADRIANA FORMULARIO CONVERSACIONAL: Máquina de estados multi-paso
    // gathering_vehicle → gathering_id → selecting_coverage → quote_sent
    if (profile.activeAgent === 'ADRIANA') {
      const quoteLead = await getQuoteLead(userId).catch(() => null);

      // ── Estado: gathering_id — espera foto de cédula ───────────────────────
      if (quoteLead?.status === 'gathering_id' && mediaUrl && type === 'image') {
        console.log('[ADRIANA-FORM] 🪪 Cédula recibida — analizando...');
        try {
          await enviarWhatsApp(userId, '📸 Recibí tu cédula. Analizando con IA... un momento 🔍');
          const analysis = await analyzeInsuranceDocument(mediaUrl, processedText || '', { documentType: DOCUMENT_TYPES.ID_CARD });
          const idData = analysis.success && analysis.analysis
            ? { raw: analysis.analysis.slice(0, 500), cedula: analysis.analysis.match(/\b\d{10}\b/)?.[0] || null }
            : {};
          const vd = quoteLead.vehicle_data || {};
          const brandModel = [vd.brand, vd.model].filter(Boolean).join(' ') || 'Vehículo';
          const year   = vd.year   || vd.vehicleYear   || '?';
          const value  = vd.value  || vd.commercialValue || null;
          const category = inferVehicleCategory(`${vd.brand || ''} ${vd.model || ''}`);

          if (!value) {
            await updateQuoteLeadData(userId, { status: 'gathering_vehicle', idCardData: idData });
            await enviarWhatsApp(userId, '⚠️ Necesito el *valor comercial del vehículo* para cotizar.\n\n¿Cuánto vale tu *' + brandModel + ' ' + year + '*? (ej: $25,000)');
            return;
          }

          const quotes = calculateAllCoverages({ commercialValue: parseFloat(value), vehicleYear: parseInt(year) || 2020, vehicleCategory: category });
          const msgParts = [
            `✅ *Cédula registrada* 🪪`,
            ``,
            `🚗 *${brandModel} ${year}* — $${parseFloat(value).toLocaleString()}`,
            ``,
            `🛡️ *Opciones de cobertura SegPopular:*`,
          ];
          let optIdx = 1;
          const coverageOrder = [COVERAGE_TYPES.BASIC, COVERAGE_TYPES.STANDARD, COVERAGE_TYPES.PREMIUM];
          for (const cov of coverageOrder) {
            const r = quotes.options[cov];
            if (r?.success) {
              msgParts.push('');
              msgParts.push(`*${optIdx}.* ${formatPremiumForWhatsApp(r, `${brandModel} ${year}`)}`);
              optIdx++;
            }
          }
          msgParts.push('');
          msgParts.push('Responde *1* (Básica), *2* (Todo Riesgo) o *3* (Premium) y te envío la propuesta por email 📧');

          await updateQuoteLeadData(userId, { status: 'selecting_coverage', idCardData: idData });
          const msg = msgParts.join('\n');
          await enviarWhatsApp(userId, msg);
          await saveConversationMessage(userId, { role: 'assistant', content: msg, agent: 'ADRIANA' });
          return;
        } catch (err) {
          console.error('[ADRIANA-FORM] ❌ Error analizando cédula:', err);
          await enviarWhatsApp(userId, '⚠️ Tuve un problema analizando la cédula.\n\nEnvíame los datos en texto: *Nombre completo y cédula* 🪪');
          return;
        }
      }

      // ── Estado: selecting_coverage — espera "1", "2" o "3" ────────────────
      if (quoteLead?.status === 'selecting_coverage' && processedText && /^[123]$/.test(processedText.trim())) {
        const coverageMap = { '1': COVERAGE_TYPES.BASIC, '2': COVERAGE_TYPES.STANDARD, '3': COVERAGE_TYPES.PREMIUM };
        const selectedCoverage = coverageMap[processedText.trim()];
        console.log(`[ADRIANA-FORM] 🛡️ Cobertura seleccionada: ${selectedCoverage}`);
        try {
          const vd = quoteLead.vehicle_data || {};
          const brandModel = [vd.brand, vd.model].filter(Boolean).join(' ') || 'Vehículo';
          const year   = vd.year   || vd.vehicleYear   || 2020;
          const value  = vd.value  || vd.commercialValue || 20000;
          const category = inferVehicleCategory(`${vd.brand || ''} ${vd.model || ''}`);

          const premiumResult = calculateVehiclePremium({
            commercialValue: parseFloat(value),
            vehicleYear: parseInt(year),
            vehicleCategory: category,
            coverage: selectedCoverage,
          });

          const quoteCode = quoteLead.quote_code || `ADR-${Date.now().toString(36).toUpperCase()}`;
          const clientName  = quoteLead.client_name  || profile.name || userId;
          const clientEmail = quoteLead.client_email || '';

          const waMsg = [
            `✅ *¡Cotización lista!* 🛡️`,
            ``,
            `🚗 *${brandModel} ${year}*`,
            `💵 Valor: $${parseFloat(value).toLocaleString()}`,
            `📋 Cobertura: *${selectedCoverage.toUpperCase()}*`,
            premiumResult.success ? `💰 Prima anual: *$${premiumResult.annualPremium?.toFixed(2) || '—'}*` : '',
            premiumResult.success ? `📊 Deducible: ${premiumResult.deductiblePct}%` : '',
            ``,
            `📧 Te envío la propuesta completa por email ahora mismo.`,
            `Ref: *${quoteCode}*`,
          ].filter(l => l !== '').join('\n');

          await enviarWhatsApp(userId, waMsg);

          if (clientEmail) {
            const html = buildEmailTemplate('ADRIANA', 'COMPARISON', {
              name: clientName,
              vehiculo: `${brandModel} ${year}`,
              valorComercial: parseFloat(value),
              primaAnual: premiumResult.success ? premiumResult.annualPremium : 0,
              message: `Aquí está tu cotización personalizada de seguro vehicular, cobertura *${selectedCoverage}*.`,
              quoteCode,
            });
            await sendEmail({
              to: clientEmail,
              subject: `Cotización de seguro vehicular — ${brandModel} ${year} | Ref. ${quoteCode}`,
              html,
            }).catch(err => console.error('[ADRIANA-FORM] ⚠️ Error enviando email:', err));
          }

          await updateQuoteLeadData(userId, {
            status: 'quote_sent',
            selectedCoverage,
            premiumData: premiumResult.success ? { annualPremium: premiumResult.annualPremium, deductiblePct: premiumResult.deductiblePct } : {},
            quoteCode,
          });
          await saveConversationMessage(userId, { role: 'assistant', content: waMsg, agent: 'ADRIANA' });
          await saveInsuranceLead({
            userId,
            quoteCode,
            clientName,
            email: clientEmail,
            commercialValue: parseFloat(value),
            vehicleBrand: vd.brand,
            vehicleModel: vd.model,
            vehicleYear: parseInt(year),
            plate: vd.plate,
            quotedPremium: premiumResult.success ? premiumResult.annualPremium : null,
            status: 'quoted',
          }).catch(() => {});
          return;
        } catch (err) {
          console.error('[ADRIANA-FORM] ❌ Error generando cotización:', err);
          await enviarWhatsApp(userId, '⚠️ Ocurrió un error al generar la cotización. Por favor intenta nuevamente o escríbeme para ayudarte 🛡️');
          return;
        }
      }

      // ── Sin estado activo + imagen → iniciar flujo (gathering_vehicle) ─────
      // Cae al bloque legacy de vehicle documents que maneja el análisis y
      // luego establece el estado gathering_id en el DB.
    }

    // 🛡️ ADRIANA VEHICLE DOCUMENTS: Extraer datos vehiculares y cotizar automáticamente
    if (mediaUrl && type === 'image' && profile.activeAgent === 'ADRIANA') {
      console.log('[ADRIANA] 🚗 Imagen recibida — analizando documento vehicular...');
      try {
        const docType = detectDocumentType(processedText || '');
        const vehicleDocTypes = [
          DOCUMENT_TYPES.VEHICLE_REGISTRATION,
          DOCUMENT_TYPES.ID_CARD,
          DOCUMENT_TYPES.CAR_APPRAISAL
        ];

        if (vehicleDocTypes.includes(docType)) {
          await enviarWhatsApp(userId, '📸 Recibí tu documento. Analizando con IA... un momento 🔍');

          const analysis = await analyzeInsuranceDocument(mediaUrl, processedText || '', { documentType: docType });

          if (!analysis.success) {
            await enviarWhatsApp(userId,
              '⚠️ No pude leer el documento automáticamente.\n\nPor favor envíame los datos en texto:\n📋 *Marca, modelo y año*\n💵 *Precio del vehículo*');
            return;
          }

          const extracted = extractVehicleData(analysis.analysis);

          if (extracted.success && extracted.data) {
            const d = extracted.data;
            const year = d.year || d.vehicleYear || null;
            const value = d.commercial_value || d.recommended_sum || d.commercialValue || null;
            const brandModel = [d.brand, d.model].filter(Boolean).join(' ') || 'Vehículo';
            const category = inferVehicleCategory(`${d.brand || ''} ${d.model || ''}`);

            if (year && value) {
              // 🛡️ Iniciar flujo conversacional: almacenar vehículo → pedir cédula
              const vehicleDataStored = { brand: d.brand, model: d.model, year, value, plate: d.plate, category };
              await upsertQuoteLead(userId, {
                status: 'gathering_id',
                vehicleData: vehicleDataStored,
                clientName: profile.name || null,
              }).catch(err => console.error('[ADRIANA-FORM] ⚠️ upsert vehicle:', err));

              const cotizMsg = [
                `✅ *Matrícula registrada* 🚗`,
                ``,
                `🚗 *${brandModel} ${year}*`,
                `💵 Valor: $${parseFloat(value).toLocaleString()}`,
                ``,
                `Ahora necesito tu *cédula de identidad* para completar la cotización.`,
                `Por favor, envía una foto clara de tu cédula 🪪`,
              ].join('\n');
              await enviarWhatsApp(userId, cotizMsg);
              await saveConversationMessage(userId, { role: 'assistant', content: cotizMsg, agent: 'ADRIANA' });
              await saveInteraction({
                userId, agent: 'ADRIANA', agentName: 'Adriana - SegPopular',
                intentReason: 'vehicle_document_quote',
                input: `[VEHICLE_DOC:${docType}] ${processedText || ''}`,
                output: cotizMsg,
                meta: { envelope, docType, year, value, category }
              });
              return;
            }

            if (!year) {
              await enviarWhatsApp(userId, '📋 Extraje el documento pero necesito el *año del vehículo*.\n\n¿De qué año es? (ej: 2021)');
              return;
            }
            if (!value) {
              await enviarWhatsApp(userId, `📋 Vehículo: *${brandModel} ${year}*\n\n¿Cuál es el *valor comercial*? (ej: $25,000)`);
              return;
            }
          }

          const fallbackMsg = `📋 *Análisis del documento:*\n\n${(analysis.analysis || '').slice(0, 1000)}\n\n¿Quieres cotizar? Envíame *marca, modelo, año y valor* del vehículo.`;
          await enviarWhatsApp(userId, fallbackMsg);
          await saveConversationMessage(userId, { role: 'assistant', content: fallbackMsg, agent: 'ADRIANA' });
          return;

        }
        // Si no es documento vehicular → cae al orquestador
      } catch (err) {
        console.error('[ADRIANA] ❌ Error procesando imagen vehicular:', err);
        await enviarWhatsApp(userId,
          '⚠️ Tuve un problema analizando el documento.\n\nEnvíame los datos en texto:\n📋 *Marca, modelo y año*\n💵 *Valor del vehículo*');
        return;
      }
    }

    // “Media event” para Aurora Core: si no hay texto pero hay media, damos un texto técnico controlado
    let auroraInput = processedText;
    if (!auroraInput && mediaUrl) {
      auroraInput = `[MEDIA:${type}] El usuario envió un archivo. URL: ${mediaUrl}`;
    }

    // 🎯 DETECCIÓN CÓDIGO EXPRESO @agente - ELIMINADO (duplicidad)
    // Ahora detectar-intencion.js detecta @menciones y activa flags.agentHandoff
    // que luego es procesado por executeHandoff() con locks y validaciones

    // 🎯 DETECCIÓN DE CAMPAÑAS (ya no hace handoffs directos)
    // Las campañas con targetAgent deben usar detectar-intencion.js
    // para activar flags.agentHandoff y usar executeHandoff() centralizado

        // Si hay media y es recibo, dejamos que Aurora lo maneje (sin meter agentes aquí)
    // Para que isReceiptImage funcione, armamos messageData estándar
    const messageData = { type, media: { url: mediaUrl } };

    if (mediaUrl && profile.activeAgent === 'AURORA' && isReceiptImage(messageData)) {
      const paymentResult = await processPaymentReceipt(messageData, profile);
      await enviarWhatsApp(userId, paymentResult.message);
      await saveConversationMessage(userId, { role: 'assistant', content: paymentResult.message, agent: 'AURORA' });
      await saveInteraction({
        userId,
        agent: normalizeAgentName('AURORA'),
        agentName: 'Aurora Core',
        intentReason: 'payment_verification',
        input: `[RECEIPT:${type}]`,
        output: paymentResult.message,
        meta: { envelope, paymentVerified: paymentResult.success }
      });
      return;
    }

    // 🎯 Post-VirtualAgentPromo: si Aurora ya presentó OneMind y usuario muestra interés → handoff directo a ENZO
    if (
      profile.lastVirtualAgentPromoAt &&
      (Date.now() - new Date(profile.lastVirtualAgentPromoAt).getTime() < 30 * 60 * 1000) &&
      /^(s[ií]|claro|dale|ok|quiero|me interesa|interesa|me gustar[ií]a|cu[aá]nto|c[oó]mo|arrancamos|empecemos|quiero saber m[aá]s|m[aá]s info|si por favor|genial|suena bien|me convence|perfecto|hagámoslo|hag[aá]moslo)[,!.\s]*$/i.test((processedText || '').trim())
    ) {
      console.log('[CAMPAIGN-2] 🚀 Post-promo interest detectado → handoff automático a ENZO');
      await updateProfile(userId, { lastVirtualAgentPromoAt: null }, { reason: 'post_promo_enzo_handoff' });
      auroraInput = `@enzo ${auroraInput}`;
    }

    // 🤖 AUTOPILOT: Detectar comandos del sistema ANTES del orquestador
    // Si Diego responde "Si"/"No"/"Review" a una pregunta pendiente,
    // ejecutar la acción directamente sin pasar por el LLM
    const systemCommand = detectSystemCommand(userId, processedText || '');
    if (systemCommand) {
      console.log(`[AUTOPILOT] 🎮 Comando del sistema detectado: ${systemCommand.command}`);
      
      const commandResult = await executeSystemCommand(systemCommand, userId, enviarWhatsApp);
      
      if (commandResult.executed) {
        console.log(`[AUTOPILOT] ✅ Comando ejecutado: ${commandResult.action}`);
        
        // Guardar en historial como mensaje del sistema
        await saveConversationMessage(userId, {
          role: 'user',
          content: processedText,
          metadata: { systemCommand: true, command: systemCommand.command }
        });
        
        await saveConversationMessage(userId, {
          role: 'assistant',
          content: commandResult.message || 'Comando ejecutado',
          metadata: { systemResponse: true, action: commandResult.action }
        });
        
        // NO continuar al orquestador - retornar aquí
        return;
      } else {
        console.log(`[AUTOPILOT] ⚠️ Comando falló, continuando con orquestador normal`);
      }
    }

    await trackAlunaFollowupReply({
      userId,
      messageText: processedText || auroraInput || '',
      channel: 'whatsapp',
      markClientResponse: markAlunaMembershipLeadClientResponse,
      logger: { info: console.log, warn: console.warn },
    });


    // 🎯 ALUNA HIGH INTENT DETECTION: Detectar señales de alto interés comercial
    // Keywords: precio exacto, disponibilidad, me interesa, quiero contratar, etc.
    // Acción: Cambiar status a 'negotiating' + notificar Diego
    if (profile.activeAgent === 'ALUNA' && processedText) {
      try {
        const { detectHighIntentKeywords, buildHighIntentNotification } = await import('../../servicios/aluna-high-intent-detector.js');
        const detection = detectHighIntentKeywords(processedText);
        
        if (detection.detected) {
          console.log(`[ALUNA-HIGH-INTENT] 🔥 Detectado: ${detection.category} - "${detection.keyword}"`);
          
          // Obtener info del prospecto para la notificación
          const prospectInfo = await alunaRepository.getAlunaProspectInfo(userId);
          
          // Cambiar status a negotiating
          await alunaRepository.markAlunaLeadAsNegotiating(userId);
          
          // Notificar a Diego via notification-service
          if (prospectInfo) {
            const { notifyHighIntent } = await import('../../servicios/notification-service.js');
            await notifyHighIntent({
              nombre:   prospectInfo.clientName   || prospectInfo.nombre,
              phone:    prospectInfo.userPhone     || prospectInfo.phone,
              plan:     prospectInfo.planKey       || prospectInfo.plan,
              keyword:  detection.keyword,
              category: detection.category,
            });
            console.log(`[ALUNA-HIGH-INTENT] 📢 Notificación enviada a Diego`);
          }
        }
      } catch (highIntentErr) {
        // No crítico - no bloquear flujo principal
        console.warn('[ALUNA-HIGH-INTENT] ⚠️ Error en detección:', highIntentErr.message);
      }
    }
    // �📌 Orquestador = Aurora Core decide TODO (incluye handoffs)
    loggers.webhook.debug('Calling orquestador', { userId, agent: profile.activeAgent, messagePreview: auroraInput.substring(0, 50) });
    
    const resultado = await procesarMensaje(auroraInput, profile, conversationHistory, {
      ...formResult,
      savedPartial: currentAgentForm,
      envelope
    });
    
    // 🔒 GUARDAR fromAgent ANTES de actualizar (fix bug handoff loop)
    const originalFromAgent = profile.activeAgent || 'AURORA';
    
    // 🏎️ MERCEDES BENZ v735: Actualización de agente centralizada
    // Regla: handoff actualiza agente DESPUÉS de completar transición UX.
    const shouldChangeAgent = resultado.agenteKey && resultado.agenteKey !== profile.activeAgent;
    const isHandoffFlow = resultado?.metadata?.agentHandoff === true;

    if (shouldChangeAgent && !isHandoffFlow) {
      console.log(`[WASSENGER-V735] 🔄 Solicitando cambio de agente: ${profile.activeAgent} → ${resultado.agenteKey}`);

      const updateResult = await updateAgentState(
        userId,
        resultado.agenteKey,
        {
          reason: 'orchestrator',
          fromAgent: profile.activeAgent,
          metadata: resultado.metadata,
          intentReason: resultado.razonSeleccion
        },
        saveProfile,
        profile
      );

      if (updateResult.success) {
        profile.activeAgent = resultado.agenteKey;
        console.log(`[WASSENGER-V735] ✅ AgentStateManager actualizó: ${updateResult.fromAgent} → ${updateResult.toAgent}`);
      } else {
        console.error(`[WASSENGER-V735] ❌ AgentStateManager falló:`, updateResult.error);
      }
    } else if (!shouldChangeAgent) {
      if (process.env.DEBUG_MODE === 'true') {
        console.log(`[WASSENGER-DEBUG] ✅ Agente NO cambió, manteniendo: ${profile.activeAgent}`);
      }
    }

    // Cancelación (si orquestador lo marca)
    if (resultado?.metadata?.cancelacion) {
      if (resultado.metadata.shouldSavePartialForm) {
        await saveAgentForm(userId, 'AURORA', formResult.form?.toJSON() || {}, 120);
      }
      await clearPendingConfirmation(userId);
      await clearJustConfirmed(userId);
    }

    // 🤝 Handoff genérico - NUEVO SISTEMA V2
    if (resultado?.metadata?.agentHandoff) {
      const targetAgent = resultado.metadata.targetAgent;
      const fromAgent = originalFromAgent; // ← Usar original, NO el actualizado
      const userLanguage = profile.preferredLanguage || 'es';
      const userName = profile.name || profile.whatsappDisplayName || '';
      
      // 🔒 FIX A7: Tracking de handoff para cooldown (resetear contador)
      profile.lastHandoffCount = 0;
      await saveProfile(userId, profile);
      console.log('[HANDOFF-TRACKING] 🔄 Handoff ejecutado - contador reseteado a 0');

      // 🎯 FIX A7: Enviar mensaje explícito de handoff si existe
      const explicitMessage = resultado.metadata.intent?.flags?.explicitHandoffMessage;
      if (explicitMessage) {
        console.log('[HANDOFF-MESSAGE] 📢 Enviando mensaje explícito:', explicitMessage);
        await enviarWhatsApp(userId, explicitMessage);
        await saveConversationMessage(userId, { role: 'assistant', content: explicitMessage, agent: fromAgent });
      }

      // 🎯 V833/V834 FASE 5: Para cualquier @mention puro (sin query), usar
      // el último mensaje con contenido real como contexto del handoff
      let handoffUserContext = processedText || text || '';
      if (/^@\w+\s*$/i.test(handoffUserContext.trim())) {
        const lastMeaningfulMsg = conversationHistory
          .filter(m => m.role === 'user' && !/^@\w+\s*$/i.test((m.content || '').trim()))
          .slice(-1)[0];
        if (lastMeaningfulMsg?.content) handoffUserContext = lastMeaningfulMsg.content;
      }

      console.log(`[WASSENGER-V2] 🔀 Handoff detectado: ${fromAgent} → ${targetAgent}`);
      loggers.webhook.handoff(fromAgent, targetAgent, userId, resultado.metadata.intent?.reason || 'unknown');
      
      // Prevenir handoffs concurrentes (AgentStateManager gestiona locks)
      if (isUpdateInProgress(userId)) {
        console.warn(`[WASSENGER-V2] ⚠️ Actualización de agente en progreso para ${userId}, esperando...`);
        await new Promise(r => setTimeout(r, 2000));
      }
      
      // ⏱️ T14: Iniciar transacción si viene de AURORA y va a agente especializado
      if (fromAgent === 'AURORA' && targetAgent !== 'AURORA' && !profile.transactionStartedAt) {
        profile.transactionStartedAt = new Date().toISOString();
        profile.transactionAgent = targetAgent;
        profile.followUpSentAt = null;
        await updateProfile(userId, { 
          transactionStartedAt: profile.transactionStartedAt, 
          transactionAgent: targetAgent,
          followUpSentAt: null
        }, { reason: 'handoff_transaction_start', fromAgent, targetAgent });
        console.log('[T14] ⏱️ Transacción iniciada en handoff:', { 
          userId, from: fromAgent, to: targetAgent, timestamp: profile.transactionStartedAt 
        });
      }

      // 🎯 V831: Detectar si hay consulta real tras el @mention
      // Ej: "@aluna quiero el plan 10" → queryAfterMention = "quiero el plan 10"
      // Ej: "@aluna" o "@aluna hola" → sin consulta → saludo estándar
      const queryAfterMention = (processedText || text || '').replace(/^@\w+\s*/i, '').trim();
      const hasQueryWithHandoff = queryAfterMention.length > 3;

      if (hasQueryWithHandoff) {
        // ✅ Handoff silencioso: cambiar agente sin enviar saludo genérico
        // El agente responde DIRECTO a la consulta con contexto de handoff
        console.log(`[WASSENGER-V831] 🎯 Handoff con consulta: ${fromAgent}→${targetAgent} | "${queryAfterMention.substring(0, 60)}"`);
        const updateResult = await updateAgentState(
          userId,
          targetAgent,
          {
            reason: 'handoff_with_query',
            fromAgent,
            metadata: resultado.metadata,
            intentReason: resultado.razonSeleccion
          },
          saveProfile,
          profile
        );

        if (updateResult.success) {
          profile.activeAgent = targetAgent;
          console.log(`[WASSENGER-V831] ✅ Agente cambiado silenciosamente: ${fromAgent} → ${targetAgent}`);
        } else {
          console.error('[WASSENGER-V831] ❌ Commit de agente falló:', updateResult.error);
          await enviarWhatsApp(userId, 'Hice el relevo, pero tuve un problema. Escribe de nuevo @' + targetAgent.toLowerCase() + ' por favor.');
          return;
        }
        // ⬇️ Fall through al bloque de LLM — orquestador ya construyó el prompt del agente destino

      } else {
        // ✅ Solo @mention sin consulta: ejecutar handoff estándar con saludo de bienvenida
        const handoffResult = await executeHandoff(
          userId,
          profile,
          fromAgent,
          targetAgent,
          userName,
          userLanguage,
          saveProfile,
          enviarWhatsApp,
          saveConversationMessage,
          handoffUserContext
        );

        if (handoffResult.success) {
          const updateResult = await updateAgentState(
            userId,
            targetAgent,
            {
              reason: 'handoff',
              fromAgent,
              metadata: resultado.metadata,
              intentReason: resultado.razonSeleccion
            },
            saveProfile,
            profile
          );

          if (updateResult.success) {
            profile.activeAgent = targetAgent;
            console.log(`[WASSENGER-V735] ✅ Commit handoff: ${updateResult.fromAgent} → ${updateResult.toAgent}`);
          } else {
            console.error('[WASSENGER-V735] ❌ Handoff UX completado pero commit de agente falló:', updateResult.error);
            await enviarWhatsApp(userId, 'Hice el relevo, pero tuve un problema guardando el estado. Escribe de nuevo @' + targetAgent.toLowerCase() + ' por favor.');
            return;
          }

          console.log(`[WASSENGER-V2] ✅ Handoff completado exitosamente - mensaje de bienvenida ya enviado`);
          return; // ✅ executeHandoff ya envió el mensaje del nuevo agente
        } else {
          console.error(`[WASSENGER-V2] ❌ Handoff falló:`, handoffResult.error);
          await enviarWhatsApp(userId, 'Disculpa, hubo un problema conectándote. Escribe "ayuda" y lo reintentamos.');
          return;
        }
      }
    }

    // 🧠 Generar respuesta (OpenAI) según sistema de Aurora Core
    
    // 🔍 DEBUG: Verificar specialMode
    if (process.env.DEBUG_MODE === 'true') {
      console.log('[WASSENGER] 🔍 DEBUG - Antes de OpenAI:', {
        userId,
        agenteKey: resultado.agenteKey,
        specialMode: resultado.metadata?.specialMode,
        hasVirtualAgentSalesFlag: resultado.metadata?.intent?.flags?.virtualAgentSalesPromo,
        systemPromptLength: resultado.systemPrompt?.length,
        systemPromptStart: resultado.systemPrompt?.substring(0, 200)
      });
    }
    
    // 🔧 VALIDACIÓN CRÍTICA: Si orquestador ya devolvió respuesta lista, NO llamar OpenAI
    // Casos: mantenimiento de agente, cancelación, error específico
    if (resultado.respuesta && resultado.shouldReply === true) {
      console.log('[WASSENGER] 📤 Respuesta directa del orquestador (no requiere OpenAI)');
      
      const agentDisplayNames = {
        'AURORA': 'Aurora Core',
        'ALUNA': 'Aluna - Closer Membresías',
        'ADRIANA': 'Adriana - SegPopular',
        'ENZO': 'Enzo - MarketingLab',
        'ANGELA': 'Angela - MedBeneficios',
        'AXEL': 'Axel - PaintBull',
        'GABI': 'Gabi - GR Consulting',
        'PAULA': 'Paula - PropElite'
      };
      
      const finalReply = resultado.respuesta;
      const responseAgent = resultado.agenteKey || resultado.metadata?.agent || profile.activeAgent;
      
      await enviarWhatsApp(userId, finalReply);
      await saveConversationMessage(userId, { 
        role: 'assistant', 
        content: finalReply, 
        agent: responseAgent 
      });
      
      await saveInteraction({
        userId,
        agent: normalizeAgentName(responseAgent),
        agentName: agentDisplayNames[responseAgent] || responseAgent,
        intentReason: resultado.metadata?.maintenance ? 'agent_maintenance' : resultado.razonSeleccion || 'direct_response',
        input: processedText.substring(0, 500),
        output: finalReply,
        meta: { 
          ...resultado.metadata,
          envelope,
          maintenance: resultado.metadata?.maintenance || false,
          intendedAgent: resultado.metadata?.intendedAgent || null
        }
      });
      
      return; // ✅ Terminar sin llamar a OpenAI
    }
    
    let reply = await complete(resultado.prompt, {
      temperature: ['ENZO', 'ADRIANA', 'ALUNA'].includes(resultado.agenteKey) ? 0.7 : 0.4,
      max_tokens: ['ENZO', 'ADRIANA', 'ALUNA', 'PAULA'].includes(resultado.agenteKey) ? 1200 : 350, // Paula necesita más tokens para fichas completas
      system: resultado.systemPrompt
    });

    // ✨ Si es Aurora, pasar por el helper de confirmaciones
    let finalReply = reply;
    let confirmationActivated = false;

    if (resultado.agenteKey === 'AURORA') {
      const enhancement = await enhanceAuroraResponse(reply, profile, formResult);
      if (enhancement?.enhanced) {
        finalReply = enhancement.finalMessage;
        confirmationActivated = true;
      }
    }

    // 💼 Si es ALUNA, detectar y crear lead automáticamente
    if (resultado.agenteKey === 'ALUNA' && reply.includes('[LEAD_DATA:')) {
      const leadMatch = reply.match(/\[LEAD_DATA:([^|]+)\|(\d+)\|([^|]+)\|([^|]+)\|([^\]]+)\]/);
      
      if (leadMatch) {
        const [_, planType, price, name, email, phone] = leadMatch;
        
        console.log('[ALUNA-LEAD] 💼 Creando lead automático:', { planType, price, name, email });
        
        try {
          const { databaseService } = await import('../../database/database.js');
          const leadId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          await databaseService.run(
            `INSERT INTO membership_leads (
              id, user_phone, membership_type, client_name, email, phone, 
              monthly_fee, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())`,
            [leadId, userId, planType, name, email, phone, parseFloat(price)]
          );
          
          console.log('[ALUNA-LEAD] ✅ Lead creado:', leadId);
          
          // Limpiar el tag de la respuesta visible al usuario
          finalReply = reply.replace(/\[LEAD_DATA:[^\]]+\]/g, '').trim();
        } catch (error) {
          console.error('[ALUNA-LEAD] ❌ Error creando lead:', error);
          // No bloquear - continuar sin lead
        }
      }
    }

    // 💜 ALUNA: Si el LLM menciona un email en su respuesta (ej: "te reenvío a X@Y.com")
    // y tenemos un plan en el form → enviar proforma automáticamente, sin depender de fullName en form
    if (resultado.agenteKey === 'ALUNA') {
      const emailInReply = finalReply.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/i);
      if (emailInReply) {
        const detectedEmail = emailInReply[1];
        try {
          const alunaFormRaw = await getAgentForm(userId, 'ALUNA').catch(() => null);
          const planInForm = alunaFormRaw?.data?.membershipType;
          const alreadySent = alunaFormRaw?.data?.proformaSent;
          if (planInForm && !alreadySent) {
            const { sendAlunaProforma, saveAlunaLeadFromProforma, normalizePlanKey } = await import('../../servicios/aluna-proforma-email.js');
            const planKey = normalizePlanKey(planInForm);
            const clientName = alunaFormRaw?.data?.fullName || userName || 'Cliente';
            const proResult = await sendAlunaProforma({ clientName, clientEmail: detectedEmail, planKey, fromAdmin: false });
            if (proResult.success) {
              // Marcar como enviada para no duplicar
              const updatedForm = { ...(alunaFormRaw || {}), data: { ...(alunaFormRaw?.data || {}), proformaSent: true, email: detectedEmail } };
              await saveAgentForm(userId, 'ALUNA', updatedForm, 120);
              await saveAlunaLeadFromProforma({ userId, clientName, clientEmail: detectedEmail, planKey, phone: alunaFormRaw?.data?.phone || null, proformaCode: proResult.proformaCode, fromAdmin: false });
              console.log(`[ALUNA-PROFORMA] 💜 Auto-proforma desde respuesta LLM → ${detectedEmail} (${proResult.planName})`);
            }
          }
        } catch (autoProErr) {
          console.error('[ALUNA-PROFORMA] ⚠️ Error en auto-proforma desde LLM:', autoProErr.message);
        }
      }
    }

    // 🏡 PAULA - Detectar [CONFIRMAR_VISITA] y #PROCESS_FORM en respuesta del LLM
    if (resultado.agenteKey === 'PAULA') {
      // ① Activar pending confirmation de visita si LLM incluyó el tag
      if (shouldActivateVisitConfirmation(reply)) {
        const activated = await activateVisitConfirmation(userId, reply, profile);
        console.log('[PAULA-FLOW] 🏡 Confirmación de visita activada:', activated);
      }
      // Strip [CONFIRMAR_VISITA] + cualquier contenido de esa línea del reply visible
      finalReply = finalReply.replace(/\[CONFIRMAR_VISITA\][^\n]*/gi, '').trim();

      // ② Si LLM emitió #PROCESS_FORM, inicializar formulario y enviar primera pregunta
      if (reply.includes('#PROCESS_FORM')) {
        finalReply = finalReply.replace(/#PROCESS_FORM/gi, '').trim();
        try {
          const initForm = await processRealEstateForm(userId, processedText, profile);
          if (initForm?.form) {
            await saveAgentForm(userId, 'PAULA', initForm.form.toJSON(), 60);
          }
          // Primera pregunta del formulario como mensaje de seguimiento
          if (initForm?.nextQuestion) {
            // Pequeño delay para que llegue después del intro del LLM
            await new Promise(r => setTimeout(r, 1200));
            await enviarWhatsApp(userId, initForm.nextQuestion);
            await saveConversationMessage(userId, { role: 'assistant', content: initForm.nextQuestion, agent: 'PAULA' });
          }
        } catch (e) {
          console.error('[PAULA-FORM] ❌ Error iniciando formulario post-LLM:', e.message);
        }
      }
    }

    // 🧠 Auto-learning: detectar gaps de conocimiento (fire-and-forget)
    detectKnowledgeGap(
      normalizeAgentName(resultado.agenteKey),
      auroraInput,
      finalReply
    ).catch(err => console.error('[KNOWLEDGE-GAP] ⚠️', err.message));

    await saveConversationMessage(userId, {
      role: 'assistant',
      content: finalReply,
      agent: normalizeAgentName(resultado.agenteKey),
      metadata: {
        correlationId: resultado.agenteKey === 'AXEL' ? resultado?.quoteCode || null : null
      }
    });

    await saveInteraction({
      userId,
      agent: normalizeAgentName(resultado.agenteKey),
      agentName: resultado.agente || 'Aurora Core',
      intentReason: resultado.razonSeleccion,
      input: auroraInput,
      output: finalReply,
      meta: {
        envelope,
        confirmationActivated,
        replyContext: getReplyContextMetadata(replyContext)
      }
    });

    // 🧠 Auto-aprendizaje: scoring + embedding de la conversación (fire-and-forget)
    scoreConversation(
      normalizeAgentName(resultado.agenteKey),
      [
        { role: 'user', content: auroraInput },
        { role: 'assistant', content: finalReply }
      ],
      'completed',
      userId
    ).catch(err => console.warn('[LEARNING] ⚠️ Score error:', err.message));

    // �📨 Dividir mensaje automáticamente si es largo/estructurado
    const messageProcessed = splitLongMessage(finalReply);
    const shouldSplit = resultado.agenteKey !== 'AXEL' && messageProcessed.shouldDelay && messageProcessed.parts.length > 1;
    
    console.log(`[MESSAGE-SPLIT] Análisis de mensaje:`);
    console.log(`   - Longitud original: ${finalReply.length} caracteres`);
    console.log(`   - Debe dividirse: ${messageProcessed.shouldDelay ? 'SÍ' : 'NO'}`);
    console.log(`   - Partes detectadas: ${messageProcessed.parts.length}`);
    console.log(`   - Delay entre partes: ${messageProcessed.delayMs}ms`);
    
    // � SIEMPRE responder con TEXTO (TTS deshabilitado - causaba fallos)
    const sendMessageToUser = async (messageText) => {
      return await enviarWhatsApp(userId, messageText);
    };

    if (shouldSplit) {
      // Enviar múltiples mensajes con delay
      console.log(`[MESSAGE-SPLIT] 📨 Dividiendo mensaje en ${messageProcessed.parts.length} partes`);
      
      for (let i = 0; i < messageProcessed.parts.length; i++) {
        const part = cleanPromptMarkers(messageProcessed.parts[i]);
        
        console.log(`[MESSAGE-SPLIT] Enviando parte ${i + 1}/${messageProcessed.parts.length} (${part.length} chars)`);
        console.log(`[MESSAGE-SPLIT] Preview: ${part.substring(0, 100)}...`);
        
        // 🚨 FIX: Esperar ANTES de enviar (excepto primer mensaje)
        // Esto garantiza que Wassenger/WhatsApp procese los mensajes en orden
        if (i > 0) {
          console.log(`[MESSAGE-SPLIT] ⏳ Esperando ${messageProcessed.delayMs}ms antes de enviar parte ${i + 1}...`);
          await new Promise(resolve => setTimeout(resolve, messageProcessed.delayMs));
        }
        
        // Enviar mensaje (texto o audio según contexto)
        await sendMessageToUser(part);
        
        // Guardar cada parte en historial
        await saveConversationMessage(userId, {
          role: 'assistant',
          content: part,
          agent: resultado.agenteKey,
          metadata: { partNumber: i + 1, totalParts: messageProcessed.parts.length, sentAsAudio: userSentAudio }
        });
      }
      
      console.log(`[MESSAGE-SPLIT] ✅ Enviados ${messageProcessed.parts.length} mensajes exitosamente`);
    } else {
      // Enviar mensaje único (comportamiento original)
      const cleanedMessage = cleanPromptMarkers(finalReply);
      console.log(`[MESSAGE-SPLIT] Enviando mensaje único (${cleanedMessage.length} chars)`);
      await sendMessageToUser(cleanedMessage);
    }
    
    loggers.webhook.agentResponse(userId, resultado.agenteKey, true);
    
    // ⏱️ T14: Limpiar transacción si agente completó exitosamente su servicio
    // Detectar keywords de finalización en respuesta del agente
    if (profile.transactionStartedAt && profile.transactionAgent) {
      const completionKeywords = [
        'te envío', 'enviado', 'te envié', 'listo', 'completado',
        'confirmada', 'confirmado', 'reserva exitosa', 'cotización enviada',
        'hemos terminado', 'proceso completado', 'análisis finalizado',
        'documentos listos', 'reporte enviado', 'propuesta lista'
      ];
      
      const replyLower = finalReply.toLowerCase();
      const completionDetected = completionKeywords.some(keyword => replyLower.includes(keyword));
      
      if (completionDetected) {
        const completedAgent = profile.transactionAgent;
        profile.transactionStartedAt = null;
        profile.transactionAgent = null;
        profile.followUpSentAt = null;
        await saveProfile(userId, profile);
        console.log('[T14] ✅ Transacción completada (keyword detected):', { 
          userId, 
          agent: completedAgent, 
          keywords: completionKeywords.filter(k => replyLower.includes(k))
        });
      }
    }

    // 🎯 Guardar flag de campaña #2 (OneMind pitch) para detectar follow-up de interés
    if (resultado.metadata?.intent?.flags?.virtualAgentSalesPromo) {
      await updateProfile(userId, { lastVirtualAgentPromoAt: new Date().toISOString() }, { reason: 'virtual_agent_promo_shown' });
      console.log('[CAMPAIGN-2] 🎯 Flag lastVirtualAgentPromoAt guardado — próximo "me interesa" → ENZO');
    }

    // Marcar primera visita después de responder
    if (resultado.agenteKey === 'AURORA' && profile.firstVisit === true) {
      await saveProfile(userId, { ...profile, firstVisit: false });
    }

    // 📦 GABI: Tracking de entregas pendientes (pagos compuestos)
    if (resultado.agenteKey === 'GABI') {
      try {
        const { 
          getPendingDeliveries,
          markDeliveryCompleted,
          generateDeliveryReminder 
        } = await import('../../servicios/gabi-financial-system.js');
        
        const userMessage = messageData?.text?.toLowerCase() || '';
        
        // Detectar solicitud de ver entregas pendientes
        const checkDeliveriesKeywords = [
          'entregas pendientes', 'mis entregas', 'qué debo entregar',
          'entregas pendiente', 'mi entrega', 'pendientes'
        ];
        
        const wantsToCheck = checkDeliveriesKeywords.some(kw => userMessage.includes(kw));
        
        if (wantsToCheck) {
          console.log('[GABI-DELIVERIES] 📦 Usuario solicita ver entregas pendientes');
          const reminder = await generateDeliveryReminder(userId);
          
          if (reminder.hasDeliveries) {
            await enviarWhatsApp(userId, reminder.message);
            console.log('[GABI-DELIVERIES] ✅ Recordatorio enviado:', reminder.count, 'entregas');
          }
        }
        
        // Detectar completación de entrega
        const completedKeywords = [
          'entrega completada', 'completé entrega', 'ya entregué',
          'entrega lista', 'terminé entrega', 'cumplí'
        ];
        
        const completedDetected = completedKeywords.some(kw => userMessage.includes(kw));
        
        if (completedDetected) {
          console.log('[GABI-DELIVERIES] ✅ Usuario reporta entrega completada');
          
          // Extraer número de transacción del mensaje
          const transactionMatch = userMessage.match(/([a-z]{2,4}[\d]{6,}|trf[\d]+|w[\d]+|dup[\d]+)/i);
          
          if (transactionMatch) {
            const transactionNumber = transactionMatch[0].toUpperCase();
            console.log('[GABI-DELIVERIES] 🔍 Transacción detectada:', transactionNumber);
            
            // Buscar pago por número de transacción
            const deliveries = await getPendingDeliveries(userId);
            const delivery = deliveries.find(d => 
              d.transactionNumber.toUpperCase() === transactionNumber
            );
            
            if (delivery) {
              const result = await markDeliveryCompleted(delivery.paymentId, userId);
              
              if (result.success) {
                const confirmMessage = `✅ *¡Entrega Completada!*\n\n` +
                  `📦 Membresía: ${delivery.membershipType}\n` +
                  `💵 Canje: $${delivery.canjeAmount} USD\n` +
                  `📝 Servicio: ${delivery.canjeDescription}\n` +
                  `🔢 Transacción: ${transactionNumber}\n` +
                  `📅 Completado: ${new Date().toLocaleDateString()}\n\n` +
                  `¡Gracias por cumplir con tu compromiso! 🎉`;
                
                await enviarWhatsApp(userId, confirmMessage);
                console.log('[GABI-DELIVERIES] ✅ Entrega marcada como completada');
              }
            } else {
              console.log('[GABI-DELIVERIES] ⚠️ No se encontró entrega con transacción:', transactionNumber);
            }
          }
        }
        
        // Auto-recordatorio periódico (cada 5 interacciones con Gabi)
        const gabiMessages = await memoria.getRecentMessages(userId, 'GABI', 50);
        if (gabiMessages.length % 5 === 0 && gabiMessages.length > 0) {
          const deliveries = await getPendingDeliveries(userId);
          if (deliveries.length > 0) {
            console.log('[GABI-DELIVERIES] 📅 Auto-recordatorio (cada 5 mensajes)');
            const gentleReminder = `\n\n📦 *Recordatorio:*\nTienes ${deliveries.length} entrega(s) pendiente(s) de pago compuesto.\nEscribe "@Gabi entregas pendientes" para ver detalles.`;
            // No enviar de inmediato para no interrumpir, solo agregar al siguiente mensaje
          }
        }
        
      } catch (error) {
        console.error('[GABI-DELIVERIES] ❌ Error en tracking de entregas:', error);
        // No interrumpir flujo principal si falla
      }
    }
      } catch (error) {
        console.error('[WASSENGER] ❌ Error en debounce handler:', {
          userId,
          message: error.message,
          stack: error.stack
        });

        try {
          await enviarWhatsApp(
            userId,
            'Disculpa, tuve un problema técnico procesando tu mensaje. ¿Puedes reenviarlo en unos segundos? 🙏'
          );
        } catch (sendError) {
          console.error('[WASSENGER] ❌ Error enviando fallback tras fallo en debounce:', {
            userId,
            message: sendError.message
          });
        }
      }
    }); // Cierre del debounceUserWebhook
    } catch (error) {
      console.error('[WASSENGER] ❌ Error crítico en procesamiento:', error);
      try {
        if (userId) {
          await enviarWhatsApp(
            userId,
            'Disculpa, tuve un problema técnico procesando tu mensaje. ¿Puedes intentarlo de nuevo? 🙏'
          );
        }
      } catch (sendError) {
        console.error('[WASSENGER] ❌ Error enviando fallback en catch global:', sendError);
      }
    }
  }); // Cierre del setImmediate
}); // Cierre del router.post

/* ─────────────────────────────────────────────────────────────
   Status & verification endpoints
───────────────────────────────────────────────────────────── */
router.get('/webhooks/wassenger/status', (req, res) => {
  const wassengerEnabled = process.env.WASSENGER_ENABLED !== 'false';
  res.json({
    ok: true,
    message: 'Wassenger Webhook activo',
    enabled: wassengerEnabled,
    status: wassengerEnabled ? '✅ ACTIVO' : '⏸️ PAUSADO',
    timestamp: new Date().toISOString()
  });
});

router.get('/webhooks/wassenger', (req, res) => res.send('ok'));

// ─── Magic Notify — endpoint interno para notificaciones desde autopilot ─────
// Protegido con INTERNAL_API_KEY. El agente lo llama con curl durante autopilot.
router.post('/api/magic/notify', async (req, res) => {
  const { notifyDiego } = await import('./internal-notifications.js');
  const secret = req.headers['x-magic-key'] || req.body?.key;
  if (secret !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const { type = 'success', title = 'Autopilot', data = {} } = req.body || {};
  try {
    const result = await notifyDiego(type, title, data);
    return res.json({ ok: result.success, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/webhooks/wassenger/control', (req, res) => {
  return res.json({
    ok: false,
    error: 'NOT_IMPLEMENTED',
    message: 'Use Heroku CLI para cambiar WASSENGER_ENABLED',
    help: {
      disable: 'heroku config:set WASSENGER_ENABLED=false --app coworkia-agent',
      enable: 'heroku config:set WASSENGER_ENABLED=true --app coworkia-agent',
      status: 'heroku config:get WASSENGER_ENABLED --app coworkia-agent'
    }
  });
});

/* ─────────────────────────────────────────────────────────────
   🛡️ ADRIANA FLUJO COMPLETO V2 — handleAdrianaFlow
   Estados en insurance_leads:
     waiting_matricula → waiting_cedula → waiting_competitor → quoted
     → waiting_kyc → accepted
───────────────────────────────────────────────────────────── */

async function handleAdrianaFlow({ userId, profile, processedText, mediaUrl, type, envelope }) {
  try {
    // ───────────────────────────────────────────────────────────────────────
    // 🆕 NUEVO FLUJO CONVERSACIONAL 6 PASOS (adriana_conversations)
    // Prioridad sobre flujo legacy. Maneja cotizaciones automáticas VAZ.
    // ───────────────────────────────────────────────────────────────────────
    
    // Verificar si existe conversación activa en nuevo sistema
    let activeConversation = null;
    try {
      activeConversation = await databaseService.get(
        `SELECT * FROM adriana_conversations 
         WHERE user_phone = $1 AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
    } catch (err) {
      loggers.adriana.warn('[ADRIANA-FORM] Error verificando conversación activa:', err.message);
    }

    // Keywords para iniciar nuevo flujo conversacional
    const isQuoteRequest = processedText && /cotizar|cotizaci[oó]n|seguro.*auto|seguro.*carro|seguro.*veh[ií]culo|quiero.*seguro|necesito.*seguro/i.test(processedText);

    // Si hay conversación activa O user solicita cotización, usar nuevo flujo
    if (activeConversation || isQuoteRequest) {
      loggers.adriana.info(`[ADRIANA-FORM] Usando nuevo flujo conversacional para ${userId}`);
      
      try {
        const result = await processFormMessage(userId, processedText || '', mediaUrl);
        
        if (result.success && result.message) {
          await enviarWhatsApp(userId, result.message);
          await saveConversationMessage(userId, { 
            role: 'assistant', 
            content: result.message, 
            agent: 'ADRIANA' 
          });
          return true;
        }
        
        // Si el form no pudo procesar, caer al flujo legacy
        if (!result.success) {
          loggers.adriana.warn('[ADRIANA-FORM] Form no pudo procesar, fallback a legacy:', result.message);
        }
      } catch (formError) {
        loggers.adriana.error('[ADRIANA-FORM] Error en form conversacional:', formError);
        // En caso de error, caer al flujo legacy
      }
    }
    
    // ───────────────────────────────────────────────────────────────────────
    // ⚠️ FLUJO LEGACY (insurance_leads) — mantener como fallback
    // ───────────────────────────────────────────────────────────────────────
    
    // 1. Buscar lead activo en insurance_leads por teléfono
    let lead = await findLeadByPhone(userId).catch(() => null);

    const NEW_STATES = ['waiting_matricula', 'waiting_cedula', 'waiting_competitor', 'waiting_coverage', 'quoted', 'waiting_kyc', 'accepted'];

    // Si no existe lead con estado nuevo, crear al recibir matrícula o al iniciar con imagen
    if (!lead || !NEW_STATES.includes(lead?.status)) {
      // Solo iniciar si es imagen (matrícula) o texto que inicia el flujo
      if (mediaUrl && type === 'image') {
        const quoteCode = `ADR-${Date.now().toString(36).toUpperCase()}`;
        await createOrUpdateInsuranceLead({ quoteCode, userPhone: userId, status: 'waiting_matricula' });
        lead = await findLeadByPhone(userId).catch(() => null);
        if (!lead) return false;
      } else {
        return false; // Sin lead activo, dejar caer al flujo legacy
      }
    }

    const status = lead.status;
    const quoteCode = lead.quote_code;

    // ── waiting_matricula — espera foto de matrícula ───────────────────────
    if (status === 'waiting_matricula' && mediaUrl && type === 'image') {
      await enviarWhatsApp(userId, '📸 Recibí tu matrícula. Analizando con IA... un momento 🔍');
      const analysis = await analyzeInsuranceDocument(mediaUrl, processedText || '', { documentType: DOCUMENT_TYPES.VEHICLE_REGISTRATION });
      if (!analysis.success) {
        await enviarWhatsApp(userId, '⚠️ No pude leer la matrícula.\n\nEnvíame los datos en texto:\n📋 *Marca, modelo, año y valor del vehículo*');
        return true;
      }
      const vd = extractVehicleData(analysis.analysis);
      const vData = vd.success ? vd.data : {};
      await createOrUpdateInsuranceLead({
        quoteCode,
        userPhone: userId,
        status: 'waiting_cedula',
        vehicleBrand: vData.brand,
        vehicleModel: vData.model,
        vehicleYear: vData.year,
        commercialValue: vData.commercial_value || vData.recommended_sum,
        plate: vData.plate,
        motor: vData.motor,
        chasis: vData.chasis,
        // C2: guardar owner_name de matrícula para validación cruzada con cédula
        premiumBreakdown: { matricula_owner_name: vData.owner_name || '', matricula_owner_id: vData.owner_id || '' },
      });
      const msg = [
        `✅ *Matrícula registrada* 🚗`,
        ``,
        vData.brand ? `🚗 *${[vData.brand, vData.model].filter(Boolean).join(' ')} ${vData.year || ''}*` : '',
        vData.commercial_value ? `💵 Valor: $${Number(vData.commercial_value).toLocaleString()}` : '',
        ``,
        `Ahora necesito tu *cédula de identidad* (NO licencia).`,
        `Envía una foto clara de tu cédula 🪪`,
      ].filter(l => l !== '').join('\n');
      await enviarWhatsApp(userId, msg);
      await saveConversationMessage(userId, { role: 'assistant', content: msg, agent: 'ADRIANA' });
      return true;
    }

    // ── waiting_cedula — espera foto de cédula (NO licencia) ──────────────
    if (status === 'waiting_cedula' && mediaUrl && type === 'image') {
      await enviarWhatsApp(userId, '📸 Recibí tu cédula. Verificando identidad... 🔍');
      const analysis = await analyzeInsuranceDocument(mediaUrl, processedText || '', { documentType: DOCUMENT_TYPES.ID_CARD });
      const cedula = analysis.success ? (analysis.analysis?.match(/\b\d{10}\b/)?.[0] || null) : null;
      const clientName = analysis.success ? (analysis.analysis?.match(/(?:nombre|name)[:\s]+([A-ZÁÉÍÓÚÑ ]+)/i)?.[1]?.trim() || profile.name || null) : (profile.name || null);

      // ── C2: Validación cruzada cédula ↔ matrícula ──────────────────────
      try {
        const breakdown = typeof lead.premium_breakdown === 'string' ? JSON.parse(lead.premium_breakdown) : (lead.premium_breakdown || {});
        const matriculaOwner = (breakdown.matricula_owner_name || '').toUpperCase().trim();
        const cedulaName = (clientName || '').toUpperCase().trim();
        if (matriculaOwner && cedulaName) {
          // Comparar: al menos un apellido o nombre debe coincidir
          const matriculaParts = matriculaOwner.split(/\s+/).filter(w => w.length > 2);
          const cedulaParts = cedulaName.split(/\s+/).filter(w => w.length > 2);
          const match = matriculaParts.some(mp => cedulaParts.includes(mp));
          if (!match && ADMIN_PHONE) {
            const alertMsg = `⚠️ *ADRIANA — Alerta de identidad*\n\n📋 Cotización: *${quoteCode}*\n🪪 Cédula: ${cedulaName}\n🚗 Matrícula: ${matriculaOwner}\n\n❗ El nombre en la cédula NO coincide con el propietario de la matrícula.\nVerificar antes de emitir póliza.`;
            await enviarWhatsApp(ADMIN_PHONE, alertMsg).catch(e => console.error('[ADRIANA] ❌ Alert WA:', e.message));
            console.log(`[ADRIANA] ⚠️ Cross-validation mismatch: cédula="${cedulaName}" vs matrícula="${matriculaOwner}" — ${quoteCode}`);
          }
        }
      } catch (cvErr) {
        console.error('[ADRIANA] Cross-validation error:', cvErr.message);
      }

      await createOrUpdateInsuranceLead({ quoteCode, userPhone: userId, status: 'waiting_competitor', cedula, clientName });
      const msg = [
        `✅ *Cédula registrada* 🪪`,
        cedula ? `📋 Cédula: ${cedula}` : '',
        ``,
        `¿Tienes cotizaciones de otras aseguradoras?`,
        `Envía las fotos (puedes enviar varias) o escribe *OMITIR* para continuar 📊`,
      ].filter(l => l !== '').join('\n');
      await enviarWhatsApp(userId, msg);
      await saveConversationMessage(userId, { role: 'assistant', content: msg, agent: 'ADRIANA' });
      return true;
    }

    // ── waiting_competitor — acepta fotos competencia o texto OMITIR ──────
    if (status === 'waiting_competitor') {
      const isOmit = processedText && /omitir|saltar|skip|no tengo|ninguna/i.test(processedText);
      const isCompetitorImage = mediaUrl && type === 'image';

      if (isOmit || isCompetitorImage) {
        let competitorQuotes = lead.competitor_quotes || [];

        if (isCompetitorImage) {
          await enviarWhatsApp(userId, '📸 Analizando cotización de la competencia... 🔍');
          const analysis = await analyzeInsuranceDocument(mediaUrl, processedText || '', { documentType: DOCUMENT_TYPES.COMPETITOR_QUOTE || 'competitor_quote' });
          if (analysis.success && analysis.analysis) {
            const priceMatch = analysis.analysis.match(/\$[\d,]+(?:\.\d{2})?/);
            const nameMatch  = analysis.analysis.match(/(?:aseguradora|empresa|compañía)[:\s]+([^\n,]+)/i);
            competitorQuotes.push({
              nombre: nameMatch?.[1]?.trim() || 'Competidor',
              prima_anual: priceMatch?.[0] || 'N/A',
              raw: analysis.analysis.slice(0, 300),
            });
          }
          await saveCompetitorQuotes(quoteCode, competitorQuotes);
          // Ask for more or continue
          const msg = `✅ Cotización de competencia registrada.\n\n¿Tienes más cotizaciones para comparar? Envía otra foto o escribe *OMITIR* para continuar.`;
          await enviarWhatsApp(userId, msg);
          return true;
        }

        // A3: Pedir selección de cobertura (deducible) antes de cotizar
        const coverageMsg = [
          `🎯 ¡Casi listo! Elige tu *plan de deducible*:`,
          ``,
          `1️⃣ *Plan Básico — Deducible 7%*`,
          `   • Taller asignado por VAZ`,
          `   • Repuestos de calidad equivalente`,
          `   • Prima más económica 💰`,
          ``,
          `2️⃣ *Plan Premium — Deducible 10%*`,
          `   • Elige tu propio taller`,
          `   • Repuestos originales de fábrica`,
          `   • Mayor flexibilidad ✨`,
          ``,
          `Responde *1* o *2* para continuar`,
        ].join('\n');
        await createOrUpdateInsuranceLead({ quoteCode, userPhone: userId, status: 'waiting_coverage' });
        await enviarWhatsApp(userId, coverageMsg);
        await saveConversationMessage(userId, { role: 'assistant', content: coverageMsg, agent: 'ADRIANA' });
        return true;
      }
    }

    // ── waiting_coverage — espera "1" (básico) o "2" (premium) ───────────
    if (status === 'waiting_coverage' && processedText && /^[12]$/.test(processedText.trim())) {
      const selectedCoverage = processedText.trim() === '2' ? 'premium' : 'standard';
      const deduciblePct = selectedCoverage === 'premium' ? 10 : 7;

      const value = lead.commercial_value || 0;
      const year  = lead.vehicle_year || 2020;
      const cat   = inferVehicleCategory(`${lead.vehicle_brand || ''} ${lead.vehicle_model || ''}`);
      const premiumResult = calculateVehiclePremium({ commercialValue: Number(value), vehicleYear: Number(year), vehicleCategory: cat, coverage: selectedCoverage });

      // Multi-quote: obtener cotizaciones de todas las aseguradoras activas
      const allQuotes = await generateMultiQuotes({ commercialValue: Number(value), vehicleYear: Number(year), vehicleCategory: 'liviano' });
      const { vaz_prima_anual, vaz_prima_mensual, vaz_deducible, competitors: multiCompetitors } = formatQuotesForTemplate(allQuotes);

      const clientEmail = lead.email || '';
      const clientName  = lead.client_name || profile.name || userId;
      const brandModel  = [lead.vehicle_brand, lead.vehicle_model].filter(Boolean).join(' ') || 'Vehículo';
      const competitorQuotes = lead.competitor_quotes || [];
      // Merge competitors: multi-quote DB + Vision AI extracted quotes
      const mergedCompetitors = [
        ...multiCompetitors,
        ...competitorQuotes.filter(c => !multiCompetitors.some(mc => mc.nombre?.toLowerCase() === c.nombre?.toLowerCase())).map(c => ({
          nombre: c.nombre, plan: c.plan || 'Plan estándar',
          prima_anual: c.prima_anual, prima_mensual: c.prima_mensual || 'N/A',
          deducible: c.deducible || 'N/A', asistencia: c.asistencia || '', amparo: c.amparo || '',
        })),
      ];

      if (premiumResult.success && clientEmail) {
        const html = buildEmailTemplate('ADRIANA', 'COMPARISON_V2', {
          nombre: clientName,
          marca: lead.vehicle_brand, modelo: lead.vehicle_model, anio: lead.vehicle_year,
          placa: lead.plate, valor_asegurado: `$${Number(value).toLocaleString()}`,
          vaz_prima_anual: vaz_prima_anual || `$${premiumResult.annual_total}`,
          vaz_prima_mensual: vaz_prima_mensual || `$${Math.round(premiumResult.annual_total / 12)}`,
          vaz_deducible: vaz_deducible || `${deduciblePct}%`,
          analisis_broker: `${clientName.split(' ')[0]}, analicé el mercado ecuatoriano de seguros para tu ${brandModel} y el Plan Elemental de VAZ Seguros ofrece la mejor relación precio-cobertura. Con asistencia 24/7 y taller propio en Quito, es la opción más sólida. Puedes pagarlo en hasta 12 cuotas.`,
          competitors: mergedCompetitors,
          fecha_cotizacion: new Date().toLocaleDateString('es-EC'),
          bot_phone: process.env.BOT_PHONE || '593994837117',
          adriana_email: process.env.ADRIANA_EMAIL || 'adriana@segpopular.com',
          adriana_phone: process.env.ADRIANA_PHONE || '+593 987 770 788',
        });
        await sendEmail({ to: clientEmail, subject: `Cotización de seguro vehicular — ${brandModel} | Ref. ${quoteCode}`, html, from: { name: 'Adriana · SegPopular', address: process.env.ADRIANA_FROM_EMAIL || 'adriana@segpopular.com' }, agent: 'adriana', cc: process.env.ADRIANA_CC_EMAIL || undefined })
          .catch(err => console.error('[ADRIANA-V2] ⚠️ Email error:', err));
      }

      // Persist multi-quotes to DB (async, non-blocking)
      if (allQuotes.length > 0 && lead.id) {
        saveLeadQuotes(lead.id, allQuotes).catch(err => console.error('[ADRIANA-V2] ⚠️ saveLeadQuotes error:', err));
      }

      // Build multi-quote summary for WhatsApp
      const quoteSummaryLines = allQuotes.length > 1
        ? allQuotes.map(q => {
            const star = q.isRecommended ? '⭐' : '•';
            const rec = q.isRecommended ? ' ← *Recomendada*' : '';
            return `  ${star} ${q.provider} — *$${q.annualPremium.toLocaleString()}/año* ($${q.monthlyPremium}/mes)${rec}`;
          })
        : [];

      const waMsg = [
        `✅ *¡Cotización lista!* 🛡️`,
        ``,
        `🚗 *${brandModel} ${lead.vehicle_year || ''}*`,
        `💵 Valor: $${Number(value).toLocaleString()}`,
        ``,
        allQuotes.length > 1 ? `📊 *Comparativa de ${allQuotes.length} aseguradoras:*` : '',
        ...quoteSummaryLines,
        allQuotes.length <= 1 && premiumResult.success ? `💰 Prima VAZ anual: *$${premiumResult.annual_total}*` : '',
        allQuotes.length <= 1 && premiumResult.success ? `📅 Prima mensual: $${Math.round(premiumResult.annual_total / 12)} (hasta 12 cuotas)` : '',
        ``,
        clientEmail ? `📧 Te envié el detalle completo por email.` : '',
        ``,
        `Para aceptar la mejor opción, responde *ACEPTO* 🤝`,
        `Ref: *${quoteCode}*`,
      ].filter(l => l !== '').join('\n');

      await createOrUpdateInsuranceLead({ quoteCode, userPhone: userId, status: 'quoted', quotedPremium: premiumResult.annual_total, selectedCoverage });
      await enviarWhatsApp(userId, waMsg);
      await saveConversationMessage(userId, { role: 'assistant', content: waMsg, agent: 'ADRIANA' });
      return true;
    }

    // Si está en waiting_coverage pero el usuario mandó algo distinto a 1/2
    if (status === 'waiting_coverage' && processedText) {
      await enviarWhatsApp(userId, `Por favor responde *1* (Plan Básico, 7%) o *2* (Plan Premium, 10%) para continuar 😊`);
      return true;
    }

    // ── quoted — espera "ACEPTO" o "QUIERO CAMBIAR" ────────────────────────
    if (status === 'quoted' && processedText) {
      if (/acepto|acepta|acepta|de acuerdo|ok|sí quiero|si quiero/i.test(processedText)) {
        await updateLeadStatus(quoteCode, 'accepted', {
          client_name: lead.client_name || profile.name,
        });

        // Notificar a Diego
        try {
          const { notifyAdrianaAccepted } = await import('../../servicios/notification-service.js');
          await notifyAdrianaAccepted({
            clientName: lead.client_name || profile.name || userId,
            marca: lead.vehicle_brand, modelo: lead.vehicle_model, anio: lead.vehicle_year,
            primaAnual: lead.quoted_premium, quoteCode,
          });
        } catch {}

        const msg = [
          `🎉 *¡Excelente decisión!* Tu seguro está en proceso.`,
          ``,
          `Ref: *${quoteCode}*`,
          ``,
          `Para completar la emisión necesito algunos datos adicionales.`,
          `¿Cuál es tu *estado civil*? (Soltero/Casado/Divorciado/Viudo)`,
        ].join('\n');
        await createOrUpdateInsuranceLead({ quoteCode, userPhone: userId, status: 'waiting_kyc' });
        await enviarWhatsApp(userId, msg);
        await saveConversationMessage(userId, { role: 'assistant', content: msg, agent: 'ADRIANA' });
        return true;
      }
    }

    // ── waiting_kyc — recopilación KYC conversacional ─────────────────────
    if (status === 'waiting_kyc' && processedText) {
      const kycData = {};
      // Estado civil
      if (!lead.kyc_estado_civil && /soltero|casado|divorciado|viudo/i.test(processedText)) {
        kycData.estadoCivil = processedText.match(/soltero|casado|divorciado|viudo/i)[0].toUpperCase();
        const msg = `✅ Estado civil registrado.\n\n¿Cuál es tu *dirección de domicilio*? (ej: Av. República del Salvador N34-183, Quito)`;
        await createOrUpdateInsuranceLead({ quoteCode, userPhone: userId, ...kycData.estadoCivil ? { status: 'waiting_kyc' } : {} });
        const { saveKYCData } = await import('../../database/adrianaRepository.js');
        await saveKYCData(quoteCode, kycData);
        await enviarWhatsApp(userId, msg);
        return true;
      }
      // Dirección
      if (lead.kyc_estado_civil && !lead.kyc_direccion && processedText.length > 10) {
        const { saveKYCData } = await import('../../database/adrianaRepository.js');
        await saveKYCData(quoteCode, { direccion: processedText });
        const msg = [
          `✅ Datos KYC registrados. Adriana coordinará la emisión con VAZ Seguros.`,
          ``,
          `📋 Ref: *${quoteCode}*`,
          `⏱️ Recibirás confirmación en 24-48h laborables.`,
        ].join('\n');
        await updateLeadStatus(quoteCode, 'accepted');
        await enviarWhatsApp(userId, msg);
        await saveConversationMessage(userId, { role: 'assistant', content: msg, agent: 'ADRIANA' });
        return true;
      }
    }

    // ── CONVERSATIONAL FALLBACK: texto sin match en cualquier estado activo ──
    // Responde contextualmente según el estado del lead en vez de caer al orquestador genérico
    if (processedText && lead && NEW_STATES.includes(status)) {
      const clientName = lead.client_name || profile.name || '';
      const firstName = clientName.split(' ')[0] || '';
      const brandModel = [lead.vehicle_brand, lead.vehicle_model].filter(Boolean).join(' ');

      let nudge = '';

      if (status === 'waiting_matricula') {
        nudge = [
          `${firstName ? firstName + ', p' : 'P'}ara cotizar tu seguro necesito la *foto de tu matrícula* 🚗`,
          ``,
          `📸 Envía una foto clara de ambos lados.`,
          `Si no tienes la matrícula a mano, puedes escribirme los datos:`,
          `*Marca, modelo, año y valor comercial del vehículo*.`,
        ].join('\n');
      } else if (status === 'waiting_cedula') {
        nudge = [
          `${firstName ? firstName + ', y' : 'Y'}a tengo los datos de tu ${brandModel || 'vehículo'} ✅`,
          ``,
          `Ahora necesito una *foto de tu cédula de identidad* 🪪`,
          `(NO licencia de conducir)`,
        ].join('\n');
      } else if (status === 'waiting_competitor') {
        nudge = [
          `Si tienes cotizaciones de otras aseguradoras, envíame las *fotos* 📸`,
          ``,
          `O escribe *OMITIR* para que te presente mi comparativa de ${brandModel ? brandModel + ' — ' : ''}4 aseguradoras al mejor precio 📊`,
        ].join('\n');
      } else if (status === 'quoted') {
        const premium = lead.quoted_premium ? `$${Number(lead.quoted_premium).toLocaleString()}/año` : '';
        nudge = [
          `${firstName ? firstName + ', t' : 'T'}u cotización${premium ? ' de *' + premium + '*' : ''} está lista 📋`,
          ``,
          `¿Qué te gustaría hacer?`,
          `• Responde *ACEPTO* para iniciar tu póliza 🤝`,
          `• Si tienes alguna duda sobre coberturas o deducibles, pregúntame 😊`,
          ``,
          `Ref: *${quoteCode}*`,
        ].join('\n');
      } else if (status === 'waiting_kyc') {
        nudge = [
          `Estamos completando tu póliza 🛡️`,
          ``,
          `¿Podrías indicarme tu *estado civil*? (Soltero/Casado/Divorciado/Viudo)`,
          `Y tu *dirección de domicilio* para la documentación UAFE.`,
        ].join('\n');
      }

      if (nudge) {
        await enviarWhatsApp(userId, nudge);
        await saveConversationMessage(userId, { role: 'assistant', content: nudge, agent: 'ADRIANA' });
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('[ADRIANA-V2] ❌ Error en handleAdrianaFlow:', err);
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────
   Exports
───────────────────────────────────────────────────────────── */

// Exportar función de envío para uso interno (notifications, scripts, etc)
export { enviarWhatsApp, enviarWhatsAppVoz };

export default router;
