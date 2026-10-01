// src/express-servidor/index.js
'use strict';

import dotenv from 'dotenv';
dotenv.config();

// 🚨 VALIDAR DATABASE_URL ANTES DE INICIAR
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR CRÍTICO: DATABASE_URL no está configurado');
  console.error('   Esta aplicación usa ÚNICA base de datos: PostgreSQL en Heroku');
  console.error('   Configura DATABASE_URL para conectarte a la base de datos en Heroku');
  process.exit(1);
}

import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

// 🗄️ Inicializar PostgreSQL Database (ÚNICA BASE DE DATOS)
import databaseService from '../database/database.js';

// 🕐 Scheduler para tareas programadas
import { initScheduler, stopScheduler, getSchedulerStatus } from '../servicios/cron-scheduler.js';

// � Aluna Follow-up Automation
import { startFollowupCronJobs } from '../servicios/aluna-followup-cron.js';
// 🔔 Aurora + Enzo Follow-up Automation
import { startAuroraEnzoCronJobs } from '../servicios/aurora-enzo-followup-cron.js';
// 🔧 Axel Follow-up Automation
import { startAxelFollowupCronJobs } from '../servicios/axel-followup-cron.js';
// 🏡 Paula Follow-up Automation
import { startPaulaFollowupCronJobs } from '../servicios/paula-followup-cron.js';
// �🔔 FASE 4: Sistema de notificaciones
import { startHealthMonitor } from '../servicios/health-monitor.js';
import { runMigrations } from '../database/migrations/migration-runner.js';
import { startDailyReportCron, startWeeklyPerfReportCron, startAuroraWeeklyMetricsCron } from '../cron/daily-report.js';
import { startSelfHealingCron } from '../cron/self-healing-cron.js';
import { startEmailReplyCron } from '../cron/email-reply-cron.js';
// �📊 Sistema de monitoreo
import { getAllCircuits } from '../servicios/external-dispatcher.js';
import { getQueueStats } from '../servicios/task-queue.js';
import { circuitBreakerManager } from '../utils/circuit-breaker.js';

// 👁️ Sistema de observabilidad (T7)
import {
  metricsCollector,
  logger,
  healthChecker,
  getHealthStatusCode,
  initializeObservability,
  requestTrackingMiddleware
} from '../utils/observability.js';

// Endpoints API
import healthRouter from './endpoints-api/health.js';
import healthcheckRouter from './endpoints-api/healthcheck.js';
import aiRouter from './endpoints-api/ai.js';
import chatRouter from './endpoints-api/chat.js';
import agentRouter from './endpoints-api/agent.js';
import wassengerRouter from './endpoints-api/wassenger.js';
import gabiDashboardRouter from './endpoints-api/gabi-dashboard.js';
import alunaDashboardRouter from './endpoints-api/aluna-dashboard.js';
import auroraDashboardRouter from './endpoints-api/aurora-dashboard.js';
import enzoDashboardRouter from './endpoints-api/enzo-dashboard.js';
import adminSeedRouter from './endpoints-api/admin-seed.js';
import paulaDashboardRouter from './endpoints-api/paula-dashboard.js';
import axelDashboardRouter from './endpoints-api/axel-dashboard.js';
import adrianaDashboardRouter from './endpoints-api/adriana-dashboard.js';
import adrianaApiRouter from './endpoints-api/adriana.js'; // Cotizaciones automáticas VAZ
import todosDashboardRouter from './endpoints-api/todos-dashboard.js';
import wifiCodesRouter from './endpoints-api/wifi-codes.js';
import portalwifiDashboardRouter from './endpoints-api/portalwifi-dashboard.js';
import autopilotApiRouter from './endpoints-api/autopilot-api.js';
import privacidadRouter from './endpoints-api/privacidad.js';
import emailRepliesRouter from './endpoints-api/email-replies.js';
import emailBouncesRouter from './endpoints-api/email-bounces.js';

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORTANTES para Heroku / proxies (evita error X-Forwarded-For)
app.set('trust proxy', 1);

// Seguridad básica
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors());

// Sitio web estático (OneMind landing page)
app.use(express.static('public'));

// 👁️ Observabilidad (tracking de requests)
app.use(requestTrackingMiddleware);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limit (seguro para proxy)
const limiter = rateLimit({
  windowMs: 60 * 1000,          // 1 minuto
  max: 90,                      // 90 req / minuto
  standardHeaders: true,
  legacyHeaders: false,
  // usar IP ya respetando 'trust proxy'
  keyGenerator: (req) => req.ip,
});
app.use(limiter);

// Healthcheck raíz
app.get('/', (_req, res) => res.json({ ok: true, service: 'coworkia-agent', env: process.env.ENV || 'local', version: 'v425' }));

// 📊 Sistema completo de salud
app.get('/health/system', async (_req, res) => {
  try {
    // 1. Circuit Breakers (nuevo sistema)
    const circuitBreakers = circuitBreakerManager.getAllStates();
    
    // 2. Circuit Breakers legacy (external-dispatcher)
    const legacyCircuits = getAllCircuits();
    
    // 3. Task Queues
    const queues = getQueueStats();
    
    // 4. Cron Jobs
    const scheduler = getSchedulerStatus();
    
    // 5. Database Metrics
    const [usersCount, reservationsCount, interactionsCount, pendingConfirmationsCount] = await Promise.all([
      databaseService.get('SELECT COUNT(*) as count FROM users'),
      databaseService.get('SELECT COUNT(*) as count FROM reservations'),
      databaseService.get('SELECT COUNT(*) as count FROM interactions'),
      databaseService.get('SELECT COUNT(*) as count FROM pending_confirmations')
    ]);
    
    // 6. Database Size (aproximación basada en row counts)
    const dbStats = {
      users: usersCount.count,
      reservations: reservationsCount.count,
      interactions: interactionsCount.count,
      pendingConfirmations: pendingConfirmationsCount.count,
      totalRecords: usersCount.count + reservationsCount.count + interactionsCount.count + pendingConfirmationsCount.count
    };
    
    // 7. Calcular health status general
    const circuitBreakerHealth = Object.values(circuitBreakers).every(cb => cb.state === 'CLOSED');
    const overallHealth = circuitBreakerHealth ? 'healthy' : 'degraded';
    
    res.json({
      ok: true,
      health: overallHealth,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || 'unknown',
      
      circuitBreakers: {
        total: Object.keys(circuitBreakers).length,
        healthy: Object.values(circuitBreakers).filter(cb => cb.state === 'CLOSED').length,
        degraded: Object.values(circuitBreakers).filter(cb => cb.state === 'HALF_OPEN').length,
        failed: Object.values(circuitBreakers).filter(cb => cb.state === 'OPEN').length,
        breakers: circuitBreakers
      },
      
      legacyCircuitBreakers: {
        total: Object.keys(legacyCircuits).length,
        circuits: legacyCircuits
      },
      
      taskQueues: {
        total: Object.keys(queues).length,
        queues: queues
      },
      
      scheduler: {
        active: scheduler.active,
        jobs: scheduler.jobs
      },
      
      database: dbStats
    });
    
  } catch (error) {
    console.error('[HEALTH][SYSTEM] Error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'SYSTEM_CHECK_FAILED', 
      message: error.message 
    });
  }
});

// 📊 Endpoints de Observabilidad (T7) - PRIORIDAD MÁXIMA
app.get('/metrics', (req, res) => {
  const metrics = metricsCollector.getMetrics();
  res.json(metrics);
});

app.get('/health', async (req, res) => {
  const health = await healthChecker.runAllChecks();
  const statusCode = getHealthStatusCode(health.status);
  res.status(statusCode).json(health);
});

// Health para Wassenger (evita 404 en pruebas GET)
app.get('/webhooks/wassenger', (_req, res) => res.status(200).send('ok'));

// Rutas del proyecto
app.use('/', healthRouter);
app.use('/', healthcheckRouter);  // Healthcheck legacy para dyno sleep
app.use('/', aiRouter);
app.use('/', chatRouter);
app.use('/', agentRouter);
app.use('/', wassengerRouter);
app.use('/api/gabi', gabiDashboardRouter);
app.use('/api/aluna', alunaDashboardRouter);
app.use('/api/aurora', auroraDashboardRouter);
app.use('/api/enzo', enzoDashboardRouter);
app.use('/api/paula', paulaDashboardRouter);
app.use('/api/axel', axelDashboardRouter);
app.use('/api/adriana/dashboard', adrianaDashboardRouter); // Dashboard interno
app.use('/api/adriana', adrianaApiRouter); // API cotizaciones automáticas (debe ir después)
app.use('/api/todos', todosDashboardRouter);
app.use('/api/admin', adminSeedRouter);
app.use('/', autopilotApiRouter);
app.use('/', wifiCodesRouter);
app.use('/', portalwifiDashboardRouter);
app.use('/', privacidadRouter);
app.use('/api/email-replies', emailRepliesRouter);
app.use('/api/email-bounces', emailBouncesRouter);

// 🛡️ Middleware de captura de errores para Self-Healing System
app.use(async (err, req, res, next) => {
  try {
    // Log completo del error
    console.error('[ERROR MIDDLEWARE]', err.message);
    console.error('[ERROR STACK]', err.stack);

    // Capturar en error_events table para análisis nocturno
    await databaseService.run(
      `INSERT INTO error_events (source, error_type, message, stack, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'api',
        err.name || 'UNHANDLED_EXCEPTION',
        err.message,
        err.stack || '',
        JSON.stringify({ path: req.path, method: req.method, ip: req.ip })
      ]
    ).catch(dbErr => {
      // Si falla el insert, no crashear - solo log
      console.error('[ERROR MIDDLEWARE] Failed to log to DB:', dbErr.message);
    });
  } catch (captureError) {
    console.error('[ERROR MIDDLEWARE] Failed to capture error:', captureError.message);
  }

  // Responder al cliente
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    ok: false,
    error: err.name || 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 final
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not Found' });
});

// 🚀 Inicializar base de datos antes de arrancar servidor
async function startServer() {
  try {
    console.log('🗄️ Inicializando base de datos PostgreSQL...');
    await databaseService.initialize();
    console.log('✅ Base de datos PostgreSQL inicializada correctamente');
    
    // Inicializar observabilidad
    console.log('👁️ Inicializando sistema de observabilidad...');
    initializeObservability(databaseService);
    logger.info('Observability system ready', { version: 'v425' });
    
    // Iniciar tareas programadas
    console.log('⏰ Iniciando tareas programadas...');
    initScheduler();
    
    // Iniciar follow-ups automatizados de Aluna
    console.log('📧 Iniciando follow-ups automatizados de Aluna...');
    startFollowupCronJobs();
    console.log('✅ Aluna follow-ups activos (D+1: 10am, D+3: 11am Ecuador)');

    // Iniciar follow-ups Aurora + Enzo
    console.log('🔔 Iniciando follow-ups Aurora + Enzo...');
    startAuroraEnzoCronJobs();
    console.log('✅ Aurora follow-ups activos (+1h: cada 15min, D+7: 10am)');
    console.log('✅ Enzo follow-ups activos (D+1: 11am, D+3: 2pm, D+7: 10:30am)');

    // Iniciar follow-ups Axel
    console.log('🔧 Iniciando follow-ups automatizados de Axel...');
    startAxelFollowupCronJobs();
    console.log('✅ Axel follow-ups activos (D+2: 10am, D+7: 11am Ecuador)');

    // Iniciar follow-ups Paula (inmobiliaria)
    console.log('🏡 Iniciando follow-ups automatizados de Paula...');
    startPaulaFollowupCronJobs();
    console.log('✅ Paula follow-ups activos (24h: 10am, 3d: 10am, reminder: 10am Ecuador)');

    // Ejecutar migraciones de base de datos
    console.log('🗃️ Ejecutando migraciones de base de datos...');
    await runMigrations();
    console.log('✅ Migraciones completadas');

    startHealthMonitor();
    console.log('✅ Health monitor activo (OpenAI + DB, checks cada 5 min)');
    startDailyReportCron();
    console.log('✅ Reporte diario configurado (09:00 AM Ecuador vía WhatsApp)');
    startWeeklyPerfReportCron();
    console.log('✅ Reporte semanal performance configurado (lunes 09:00 Ecuador)');
    startAuroraWeeklyMetricsCron();
    console.log('✅ Métricas semanales Aurora configuradas (viernes 18:00 Ecuador)');
    startSelfHealingCron();
    console.log('✅ Self-Healing System activo (análisis nocturno 02:00 AM Ecuador)');
    startEmailReplyCron();
    console.log('✅ Email Reply Reader activo (polling cada 10 min)');
    
    // Arrancar servidor después de DB
    app.listen(PORT, () => {
      console.log(`> Coworkia Agent listo en http://localhost:${PORT}`);
      console.log(`> PostgreSQL Database: HEROKU (única base de datos)`);
      console.log(`> Cron Jobs: ACTIVOS`);
      console.log(`> Observabilidad: /metrics, /health`);
    });
    
  } catch (error) {
    console.error('💥 Error inicializando aplicación:', error);
    process.exit(1);
  }
}

// Manejar shutdown graceful
process.on('SIGTERM', () => {
  console.log('\n🛑 Recibida señal SIGTERM, cerrando...');
  stopScheduler();
  // NO cerramos pool - Heroku mata el proceso de todas formas
  // Cerrar pool causa "Cannot use a pool after calling end" en restart
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Recibida señal SIGINT, cerrando...');
  stopScheduler();
  // NO cerramos pool - proceso local se cierra inmediatamente
  process.exit(0);
});

// Iniciar la aplicación
startServer();
