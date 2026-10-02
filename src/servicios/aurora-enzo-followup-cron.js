/**
 * ⏰ Aurora + Enzo Follow-up Cron Jobs
 * 
 * HORARIOS (zona America/Guayaquil configurada en cada CronJob):
 * Aurora:
 *   - Cada 15 min: +1h post-reserva (verificación frecuente)
 *   - 10:00 AM:    D+7 rebooking reminder
 * Enzo:
 *   - 11:00 AM:    D+1 follow-up (recordatorio amigable)
 *   - 14:00 PM:    D+3 follow-up (FOMO + 15% OFF)
 *   - 10:30 AM:    D+7 follow-up (caso de éxito)
 */

import { CronJob } from 'cron';
import {
  sendOneHourFollowups, sendRebookingReminders,
  sendAuroraD1Followups, sendAuroraD3Followups,
  sendAuroraReminder24h, sendAuroraReminder2h, sendAuroraReminder10min,
  detectAuroraNoShows, sendAuroraUpsellAluna, sendAuroraPaymentReminders,
  retryPendingAuroraDeliveries
} from './aurora-followup-service.js';
import { sendEnzoD1Followups, sendEnzoD3Followups, sendEnzoD7Followups } from './enzo-followup-service.js';
import { sendAdrianaS1Followups, sendAdrianaS2Followups, sendAdrianaS3Followups } from './adriana-followup-service.js';
import { analyzeConversations } from './autotraining-service.js';
import { loggers } from '../utils/logger.js';

const logger = loggers.aurora || console;

export function startAuroraEnzoCronJobs() {

  // ─── AURORA: +1h post-reserva (cada 15 min) ───────────────────
  const aurora1hJob = new CronJob(
    '*/15 * * * *',
    async function () {
      logger.info('[CRON-AURORA] ⏰ Verificando follow-ups +1h...');
      try {
        const result = await sendOneHourFollowups();
        if (result.success && result.sent > 0) {
          logger.info(`[CRON-AURORA] ✅ +1h: ${result.sent} enviados`);
        }
      } catch (err) {
        logger.error('[CRON-AURORA] ❌ Error +1h:', err);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );

  logger.info('[CRON] ✅ Aurora +1h configurado (cada 15 min)');

  // ─── AURORA: recuperación outbox (cada 5 min) ─────────────
  const auroraDeliveryRetryJob = new CronJob(
    '*/5 * * * *',
    async function () {
      try {
        const result = await retryPendingAuroraDeliveries();
        if (result.success && result.processed > 0) {
          logger.info(`[CRON-AURORA] Outbox: ${result.completed} completados, ${result.failed} fallidos`);
        }
      } catch (err) {
        logger.error('[CRON-AURORA] Error recuperando outbox:', err);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );

  logger.info('[CRON] ✅ Aurora outbox configurada (cada 5 min)');

  // ─── AURORA: D+7 rebooking (10:00 AM Ecuador) ────────────────────
  const auroraRebookJob = new CronJob(
    '0 10 * * *',
    async function () {
      logger.info('[CRON-AURORA] 📅 Ejecutando rebooking D+7...');
      try {
        const result = await sendRebookingReminders();
        if (result.success) {
          logger.info(`[CRON-AURORA] ✅ Rebooking: ${result.sent} enviados`);
        }
      } catch (err) {
        logger.error('[CRON-AURORA] ❌ Error rebooking:', err);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );

  logger.info('[CRON] ✅ Aurora rebooking D+7 configurado (10:00 AM Ecuador)');

  // ─── ENZO: D+1 (11:00 AM Ecuador = 16:00 UTC) ─────────────────
  const enzoD1Job = new CronJob(
    '0 16 * * *',
    async function () {
      logger.info('[CRON-ENZO] 📬 Ejecutando D+1 follow-up...');
      try {
        const result = await sendEnzoD1Followups();
        if (result.success) {
          logger.info(`[CRON-ENZO] ✅ D+1: ${result.sent} enviados, ${result.errors} errores`);
        }
      } catch (err) {
        logger.error('[CRON-ENZO] ❌ Error D+1:', err);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );

  logger.info('[CRON] ✅ Enzo D+1 configurado (11:00 AM Ecuador)');

  // ─── ENZO: D+3 (14:00 Ecuador = 19:00 UTC) ────────────────────
  const enzoD3Job = new CronJob(
    '0 19 * * *',
    async function () {
      logger.info('[CRON-ENZO] 🔥 Ejecutando D+3 FOMO follow-up...');
      try {
        const result = await sendEnzoD3Followups();
        if (result.success) {
          logger.info(`[CRON-ENZO] ✅ D+3: ${result.sent} enviados, ${result.errors} errores`);
        }
      } catch (err) {
        logger.error('[CRON-ENZO] ❌ Error D+3:', err);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );

  logger.info('[CRON] ✅ Enzo D+3 configurado (14:00 PM Ecuador)');

  // ─── ENZO: D+7 (10:30 AM Ecuador = 15:30 UTC) ─────────────────
  const enzoD7Job = new CronJob(
    '30 15 * * *',
    async function () {
      logger.info('[CRON-ENZO] 🏆 Ejecutando D+7 caso-éxito follow-up...');
      try {
        const result = await sendEnzoD7Followups();
        if (result.success) {
          logger.info(`[CRON-ENZO] ✅ D+7: ${result.sent} enviados, ${result.errors} errores`);
        }
      } catch (err) {
        logger.error('[CRON-ENZO] ❌ Error D+7:', err);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );

  logger.info('[CRON] ✅ Enzo D+7 configurado (10:30 AM Ecuador)');

  // ─── ADRIANA: S1 D+1 (10:00 AM Ecuador = 15:00 UTC) ──────────
  const adrianaS1Job = new CronJob(
    '0 15 * * *',
    async function () {
      logger.info('[CRON-ADRIANA] 📅 Ejecutando S1 D+1 follow-up...');
      try {
        const result = await sendAdrianaS1Followups();
        logger.info(`[CRON-ADRIANA] ✅ S1: ${result.sent} enviados`);
      } catch (err) {
        logger.error('[CRON-ADRIANA] ❌ Error S1:', err);
      }
    },
    null, true, 'America/Guayaquil'
  );
  logger.info('[CRON] ✅ Adriana S1 configurado (10:00 AM Ecuador)');

  // ─── ADRIANA: S2 D+3 (11:30 AM Ecuador = 16:30 UTC) ──────────
  const adrianaS2Job = new CronJob(
    '30 16 * * *',
    async function () {
      logger.info('[CRON-ADRIANA] ⏰ Ejecutando S2 D+3 FOMO...');
      try {
        const result = await sendAdrianaS2Followups();
        logger.info(`[CRON-ADRIANA] ✅ S2: ${result.sent} enviados`);
      } catch (err) {
        logger.error('[CRON-ADRIANA] ❌ Error S2:', err);
      }
    },
    null, true, 'America/Guayaquil'
  );
  logger.info('[CRON] ✅ Adriana S2 configurado (11:30 AM Ecuador)');

  // ─── ADRIANA: S3 D+7 (09:30 AM Ecuador = 14:30 UTC) ──────────
  const adrianaS3Job = new CronJob(
    '30 14 * * *',
    async function () {
      logger.info('[CRON-ADRIANA] 🤝 Ejecutando S3 D+7 reconexión...');
      try {
        const result = await sendAdrianaS3Followups();
        logger.info(`[CRON-ADRIANA] ✅ S3: ${result.sent} enviados`);
      } catch (err) {
        logger.error('[CRON-ADRIANA] ❌ Error S3:', err);
      }
    },
    null, true, 'America/Guayaquil'
  );
  logger.info('[CRON] ✅ Adriana S3 configurado (09:30 AM Ecuador)');

  // ─── AURORA: D+1 feedback (10:05 AM Ecuador) ─────────────────
  const auroraD1Job = new CronJob(
    '5 10 * * *',
    async function () {
      logger.info('[CRON-AURORA] 📨 Ejecutando D+1 follow-up...');
      try {
        const result = await sendAuroraD1Followups();
        if (result.success) logger.info(`[CRON-AURORA] ✅ D+1: ${result.sent} enviados`);
      } catch (err) { logger.error('[CRON-AURORA] ❌ Error D+1:', err); }
    },
    null, true, 'America/Guayaquil'
  );
  logger.info('[CRON] ✅ Aurora D+1 configurado (10:05 AM Ecuador)');

  // ─── AURORA: D+3 seguimiento (14:00 Ecuador) ─────────────────
  const auroraD3Job = new CronJob(
    '0 14 * * *',
    async function () {
      logger.info('[CRON-AURORA] 🔥 Ejecutando D+3 FOMO follow-up...');
      try {
        const result = await sendAuroraD3Followups();
        if (result.success) logger.info(`[CRON-AURORA] ✅ D+3: ${result.sent} enviados`);
      } catch (err) { logger.error('[CRON-AURORA] ❌ Error D+3:', err); }
    },
    null, true, 'America/Guayaquil'
  );
  logger.info('[CRON] ✅ Aurora D+3 FOMO configurado (14:00 PM Ecuador)');

  // ─── AURORA: Reminder 24h (18:00 Ecuador) ────────────────────
  const auroraReminder24hJob = new CronJob(
    '0 18 * * *',
    async function () {
      logger.info('[CRON-AURORA] 📅 Ejecutando recordatorio 24h...');
      try {
        const result = await sendAuroraReminder24h();
        if (result.success) logger.info(`[CRON-AURORA] ✅ 24h: ${result.sent} enviados`);
      } catch (err) { logger.error('[CRON-AURORA] ❌ Error 24h:', err); }
    },
    null, true, 'America/Guayaquil'
  );
  logger.info('[CRON] ✅ Aurora reminder 24h configurado (18:00 PM Ecuador)');

  // ─── AURORA: Reminder 2h (cada 30min 8-18h) ──────────────────
  const auroraReminder2hJob = new CronJob(
    '*/30 8-18 * * *',
    async function () {
      try {
        const result = await sendAuroraReminder2h();
        if (result.success && result.sent > 0) logger.info(`[CRON-AURORA] ✅ 2h: ${result.sent} enviados`);
      } catch (err) { logger.error('[CRON-AURORA] ❌ Error 2h:', err); }
    },
    null, true, 'America/Guayaquil'
  );
  logger.info('[CRON] ✅ Aurora reminder 2h configurado (cada 30min 8-18h Ecuador)');

  // ─── AURORA: Reminder 10min (cada 5min 8-18h) ────────────────
  const auroraReminder10minJob = new CronJob(
    '*/5 8-18 * * *',
    async function () {
      try {
        const result = await sendAuroraReminder10min();
        if (result.success && result.sent > 0) logger.info(`[CRON-AURORA] ✅ 10min: ${result.sent} enviados`);
      } catch (err) { logger.error('[CRON-AURORA] ❌ Error 10min:', err); }
    },
    null, true, 'America/Guayaquil'
  );
  logger.info('[CRON] ✅ Aurora reminder 10min configurado (cada 5min 8-18h Ecuador)');

  // ─── AURORA: No-Show Detection (cada 4h) ─────────────────────
  const auroraNoShowJob = new CronJob(
    '0 */4 * * *',
    async function () {
      logger.info('[CRON-AURORA] 👻 Ejecutando no-show detection...');
      try {
        const result = await detectAuroraNoShows();
        if (result.success && result.sent > 0) logger.info(`[CRON-AURORA] ✅ No-shows: ${result.sent} procesados`);
      } catch (err) { logger.error('[CRON-AURORA] ❌ Error no-show:', err); }
    },
    null, true, 'America/Guayaquil'
  );
  logger.info('[CRON] ✅ Aurora no-show detection configurado (cada 4h)');

  // ─── AURORA: Upsell Aluna (lunes 10:00 AM) ───────────────────
  const auroraUpsellJob = new CronJob(
    '0 10 * * 1',
    async function () {
      logger.info('[CRON-AURORA] 🎯 Ejecutando upselling Aluna...');
      try {
        const result = await sendAuroraUpsellAluna();
        if (result.success) logger.info(`[CRON-AURORA] ✅ Upsell: ${result.sent} enviados`);
      } catch (err) { logger.error('[CRON-AURORA] ❌ Error upsell:', err); }
    },
    null, true, 'America/Guayaquil'
  );
  logger.info('[CRON] ✅ Aurora upsell Aluna configurado (lunes 10:00 AM Ecuador)');

  // ─── AURORA: Payment Reminders (8:00 AM diario) ──────────────
  const auroraPaymentJob = new CronJob(
    '0 8 * * *',
    async function () {
      logger.info('[CRON-AURORA] 💳 Ejecutando payment reminders...');
      try {
        const result = await sendAuroraPaymentReminders();
        if (result.success && result.sent > 0) logger.info(`[CRON-AURORA] ✅ Pagos: ${result.sent} enviados`);
      } catch (err) { logger.error('[CRON-AURORA] ❌ Error pagos:', err); }
    },
    null, true, 'America/Guayaquil'
  );
  logger.info('[CRON] ✅ Aurora payment reminders configurado (8:00 AM Ecuador)');

  // ─── AUTOTRAINING: Análisis semanal (domingo 3:00 AM Ecuador = 08:00 UTC) ─
  const autotrainingJob = new CronJob(
    '0 8 * * 0',
    async function () {
      logger.info('[CRON-AUTOTRAINING] 🧠 Ejecutando análisis semanal...');
      try {
        const result = await analyzeConversations();
        if (result.success) {
          const analyzed = result.agents.filter(a => !a.skipped).length;
          logger.info(`[CRON-AUTOTRAINING] ✅ ${analyzed} agentes analizados en ${result.duration}s`);
        }
      } catch (err) { logger.error('[CRON-AUTOTRAINING] ❌ Error:', err); }
    },
    null, true, 'America/Guayaquil'
  );
  logger.info('[CRON] ✅ Autotraining semanal configurado (domingo 3:00 AM Ecuador)');

  logger.info('[CRON] 🚀 Aurora + Enzo + Adriana follow-up crons activos (18 jobs)');

  return {
    aurora1hJob, auroraDeliveryRetryJob, auroraRebookJob, enzoD1Job, enzoD3Job, enzoD7Job,
    adrianaS1Job, adrianaS2Job, adrianaS3Job,
    auroraD1Job, auroraD3Job, auroraReminder24hJob, auroraReminder2hJob,
    auroraReminder10minJob, auroraNoShowJob, auroraUpsellJob, auroraPaymentJob,
    autotrainingJob
  };
}
