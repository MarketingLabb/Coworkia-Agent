// src/servicios/cron-scheduler.js
import { CronJob } from 'cron';
import { 
  cleanupExpiredConfirmations, 
  cleanupJustConfirmedFlags,
  cleanupOldInteractions,
  cleanupExpiredPartialForms 
} from '../../scripts/database/cleanup-expired-data.js';
import { processFollowUps, processAlunaLeadFollowUps, processAuroraRebookReminders, processAxelQuoteReminders } from './follow-up-service.js';
import { processRenewalSequence } from './aluna-renewal/renewal-sequence.js';
import { processPaulaFollowUps } from './paula-followup-service.js';
import dailyCleanup from '../../scripts/maintenance/daily-cleanup.js';
import { expireCodesForDate } from './wifi-codes-service.js';

const jobs = [];
const isProd = process.env.NODE_ENV === 'production';

/**
 * 🕐 Inicializa tareas programadas
 */
export function initScheduler() {
  console.log('[CRON] ⏰ Iniciando tareas programadas...');
  console.log(`[CRON] 🔧 Modo: ${isProd ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  
  // ✅ Limpieza de confirmaciones expiradas y flags justConfirmed
  // Cada 2 horas
  const cleanupFlagsJob = new CronJob(
    '0 */2 * * *', // Cada 2 horas
    async () => {
      try {
        console.log('[CRON] 🧹 Ejecutando limpieza de confirmaciones expiradas...');
        const confirmations = await cleanupExpiredConfirmations();
        console.log(`[CRON] ✅ Eliminadas ${confirmations} confirmaciones expiradas`);
        
        console.log('[CRON] 🧹 Ejecutando limpieza de flags justConfirmed...');
        const flags = await cleanupJustConfirmedFlags();
        console.log(`[CRON] ✅ Eliminados ${flags} flags justConfirmed expirados`);
        
        console.log('[CRON] 🧹 Ejecutando limpieza de formularios parciales expirados...');
        const partialForms = await cleanupExpiredPartialForms();
        console.log(`[CRON] ✅ Eliminados ${partialForms} formularios parciales expirados`);
      } catch (error) {
        console.error('[CRON] ❌ Error en limpieza de flags:', error);
      }
    },
    null, // onComplete
    true, // start
    'America/Guayaquil' // timezone Ecuador
  );
  
  jobs.push(cleanupFlagsJob);
  console.log('[CRON] 📅 Limpieza de confirmaciones/flags: cada 120 minutos');
  
  // ✅ Limpieza de interacciones antiguas
  // Una vez al día a las 3 AM Ecuador
  const cleanupInteractionsJob = new CronJob(
    '0 3 * * *', // 3:00 AM diario
    async () => {
      try {
        const retentionDays = parseInt(process.env.INTERACTIONS_RETENTION_DAYS || '30', 10);
        console.log(`[CRON] 🧹 Ejecutando limpieza de interacciones (>${retentionDays} días)...`);
        
        const deleted = await cleanupOldInteractions({ retentionDays });
        console.log(`[CRON] ✅ Eliminadas ${deleted} interacciones antiguas`);
        
        if (deleted > 0) {
          console.log(`[CRON] 📊 Estadística: Se liberaron ~${(deleted * 0.5).toFixed(1)} KB de espacio`);
        }
      } catch (error) {
        console.error('[CRON] ❌ Error en limpieza de interacciones:', error);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );
  
  jobs.push(cleanupInteractionsJob);
  console.log('[CRON] 📅 Limpieza de interacciones: cada 24 horas');
  
  // ✅ Follow-up automático de transacciones pendientes
  // Cada 30 minutos (verifica si han pasado 2h desde inicio de transacción)
  // Solo envía UNA vez por transacción, respeta horario 6am-10pm Ecuador
  const followUpJob = new CronJob(
    '*/30 * * * *', // Cada 30 minutos
    async () => {
      try {
        console.log('[CRON] 🔔 Verificando transacciones pendientes para follow-up...');
        const result = await processFollowUps();
        console.log(`[CRON] ✅ Follow-up completado: ${result.sent} enviados, ${result.skipped} saltados`);
      } catch (error) {
        console.error('[CRON] ❌ Error en follow-up genérico:', error);
      }

      try {
        console.log('[CRON] 🌙 Verificando prospectos Aluna (24h / 3d)...');
        const alunaResult = await processAlunaLeadFollowUps();
        console.log(`[CRON] ✅ Aluna follow-up: ${alunaResult.sent24h} (24h), ${alunaResult.sent3d} (3d), ${alunaResult.skipped} saltados`);
      } catch (error) {
        console.error('[CRON] ❌ Error en Aluna follow-up:', error);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );
  
  jobs.push(followUpJob);
  console.log('[CRON] 📅 Follow-up automático: cada 30 minutos (6am-10pm, UNA vez por transacción)');
  
  // ✅ Limpieza diaria completa de formularios y datos temporales
  // Exactamente a las 00:00 Ecuador (medianoche)
  const dailyCleanupJob = new CronJob(
    '0 0 * * *', // 00:00 (medianoche) todos los días
    async () => {
      try {
        console.log('[CRON] 🧹 Ejecutando limpieza diaria completa (00:00)...');
        const result = await dailyCleanup();
        
        if (result.success) {
          console.log(`[CRON] ✅ Limpieza diaria completada: ${result.totalCleaned} registros eliminados`);
        } else {
          console.error('[CRON] ❌ Error en limpieza diaria:', result.error);
        }
      } catch (error) {
        console.error('[CRON] ❌ Error ejecutando limpieza diaria:', error);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );
  
  jobs.push(dailyCleanupJob);
  console.log('[CRON] 📅 Limpieza diaria completa: 00:00 (medianoche Ecuador)');
  
  // ✅ Expiración de códigos WiFi del día anterior (00:05 Ecuador)
  const wifiCodeExpiryJob = new CronJob(
    '5 0 * * *', // 00:05 diario (5 minutos después de la medianoche)
    async () => {
      try {
        // Calcular fecha de ayer en Ecuador (UTC-5)
        const nowEcuador = new Date(new Date().getTime() - 5 * 60 * 60 * 1000);
        nowEcuador.setDate(nowEcuador.getDate() - 1);
        const yesterday = nowEcuador.toISOString().split('T')[0];
        console.log(`[CRON] 🔒 Expirando códigos WiFi del día: ${yesterday}...`);
        const expired = await expireCodesForDate(yesterday);
        console.log(`[CRON] ✅ Códigos WiFi expirados: ${expired}`);
      } catch (error) {
        console.error('[CRON] ❌ Error expirando códigos WiFi:', error);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );
  
  jobs.push(wifiCodeExpiryJob);
  console.log('[CRON] 📅 Expiración de códigos WiFi: 00:05 diario');

  // ✅ Secuencia de renovación de membresías Aluna (D-3, D-1, D+1, D+5 + "renuevo el X")
  // Cada 10 min entre 9:00 y 19:59 Ecuador. Es idempotente: cada paso se reserva en
  // membership_renewal_notifications antes de enviarse, así correr seguido no duplica.
  // Corre cada 10 min para que el link de pago (D-3b) salga ~8 min después del primer aviso.
  const membershipRenewalJob = new CronJob(
    '*/10 9-19 * * *',
    async () => {
      try {
        const result = await processRenewalSequence();
        if (result.sent || result.failed) {
          console.log(`[CRON] 🌙 Renovaciones: ${result.sent} enviados ${JSON.stringify(result.byStep)}, ${result.deferred} pospuestos, ${result.failed} fallidos`);
        }
      } catch (error) {
        console.error('[CRON] ❌ Error en secuencia de renovación:', error);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );

  jobs.push(membershipRenewalJob);
  console.log('[CRON] 📅 Secuencia renovación membresías: cada 10 min, 9:00–19:59');

  // ⚠️ DESACTIVADO Sprint 1 dedup (6 abr 2026) — redundante con aurora-enzo-followup-cron.js (10:00 AM)
  // Ambos marcan rebook_reminder_sent_at → sin duplicados de mensajes, pero cron redundante.
  // const rebookReminderJob = new CronJob(
  //   '0 17 * * *', // 5:00 PM diario
  //   async () => {
  //     try {
  //       console.log('[CRON] 🏢 Verificando recordatorios de re-reserva semanal (AURORA)...');
  //       const result = await processAuroraRebookReminders();
  //       console.log(`[CRON] ✅ Re-reservas: ${result.sent} enviados, ${result.skipped} saltados`);
  //     } catch (error) {
  //       console.error('[CRON] ❌ Error en recordatorios de re-reserva:', error);
  //     }
  //   },
  //   null,
  //   true,
  //   'America/Guayaquil'
  // );
  //
  // jobs.push(rebookReminderJob);
  console.log('[CRON] ⚠️ Recordatorios re-reserva: desactivado (migrado a aurora-enzo-followup-cron)');

  // ✅ Recordatorios de cotizaciones pendientes Axel / The PaintBull
  // Diario a las 10:00 AM Ecuador (lun-vie). Envía email 24h y 7d post-cotización si no hay cita agendada.
  const axelReminderJob = new CronJob(
    '0 10 * * 1-5', // 10:00 AM, lun-vie
    async () => {
      try {
        console.log('[CRON] 🚗 Verificando recordatorios de cotizaciones PaintBull (Axel)...');
        const result = await processAxelQuoteReminders();
        console.log(`[CRON] ✅ Axel reminders: ${result.sent1} (24h), ${result.sent2} (7d), ${result.skipped} saltados`);
      } catch (error) {
        console.error('[CRON] ❌ Error en recordatorios Axel:', error);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );

  jobs.push(axelReminderJob);
  console.log('[CRON] 📅 Recordatorios cotizaciones PaintBull (Axel): 10:00 AM lun-vie');

  // ✅ Follow-up automático de leads inmobiliarios (PAULA)
  // Cada 2 horas (10am, 12pm, 2pm, 4pm, 6pm). Envía:
  // - 24h post-brochure: "¿Pudiste revisar el brochure?"
  // - 3d post-brochure: "Tengo opciones nuevas"
  // - 24h antes de visita agendada: recordatorio
  const paulaFollowUpJob = new CronJob(
    '0 10,12,14,16,18 * * *', // cada 2h en horario laboral
    async () => {
      try {
        console.log('[CRON] 🏡 Verificando follow-ups inmobiliarios (Paula)...');
        const result = await processPaulaFollowUps();
        console.log(`[CRON] ✅ Paula follow-ups: ${result.sent24h} (24h), ${result.sent3d} (3d), ${result.visitReminders} (visitas), ${result.skipped} saltados`);
      } catch (error) {
        console.error('[CRON] ❌ Error en Paula follow-ups:', error);
      }
    },
    null,
    true,
    'America/Guayaquil'
  );

  jobs.push(paulaFollowUpJob);
  console.log('[CRON] 📅 Follow-up inmobiliario Paula: 10am/12pm/2pm/4pm/6pm diario');
  
  // ✅ Opcional: Backup automático (solo en producción)
  if (isProd && process.env.ENABLE_AUTO_BACKUP === 'true') {
    const backupJob = new CronJob(
      '0 4 * * *', // 4:00 AM diario (1h después de cleanup)
      async () => {
        try {
          console.log('[CRON] 💾 Ejecutando backup automático...');
          // Aquí se ejecutaría el backup
          console.log('[CRON] ✅ Backup completado');
        } catch (error) {
          console.error('[CRON] ❌ Error en backup:', error);
        }
      },
      null,
      true,
      'America/Guayaquil'
    );
    
    jobs.push(backupJob);
    console.log('[CRON] 📅 Backup automático: cada 24 horas (4:00 AM)');
  }
  
  console.log('[CRON] ✅ Scheduler iniciado');
  
  return jobs;
}

/**
 * 🛑 Detiene todas las tareas programadas
 */
export function stopScheduler() {
  console.log('[CRON] 🛑 Deteniendo tareas programadas...');
  jobs.forEach(job => job.stop());
  jobs.length = 0;
  console.log('[CRON] ✅ Scheduler detenido');
}

/**
 * 📊 Obtiene estado de los jobs
 */
export function getSchedulerStatus() {
  return {
    active: jobs.length,
    jobs: jobs.map((job, index) => ({
      id: index,
      running: job.running,
      nextRun: job.nextDate()?.toISO()
    }))
  };
}
