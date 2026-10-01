/**
 * 📊 Sistema de Observabilidad - Coworkia Agent
 * 
 * Métricas, logs estructurados, health checks, performance monitoring
 * 
 * Versión: v425
 * Fecha: 2026-01-12
 */

/**
 * 📈 Clase para tracking de métricas del sistema
 */
class MetricsCollector {
  constructor() {
    this.metrics = {
      // Métricas de Requests
      requests: {
        total: 0,
        success: 0,
        failed: 0,
        avgResponseTime: 0,
        lastError: null,
        lastErrorTime: null
      },
      
      // Métricas de Database
      database: {
        queriesTotal: 0,
        queriesSuccess: 0,
        queriesFailed: 0,
        slowQueries: 0,
        avgQueryTime: 0,
        poolActive: 0,
        poolIdle: 0,
        poolWaiting: 0
      },
      
      // Métricas de Agentes
      agents: {
        AURORA: { activations: 0, avgResponseTime: 0 },
        ALUNA: { activations: 0, avgResponseTime: 0 },
        ENZO: { activations: 0, avgResponseTime: 0 },
        ADRIANA: { activations: 0, avgResponseTime: 0 },
        ANGELA: { activations: 0, avgResponseTime: 0 },
        AXEL: { activations: 0, avgResponseTime: 0 },
        GABI: { activations: 0, avgResponseTime: 0 },
        PAULA: { activations: 0, avgResponseTime: 0 }
      },
      
      // Métricas de OpenAI
      openai: {
        requestsTotal: 0,
        requestsSuccess: 0,
        requestsFailed: 0,
        tokensUsed: 0,
        avgLatency: 0,
        errors: []
      },
      
      // Métricas de Sistema
      system: {
        uptime: Date.now(),
        memoryUsage: 0,
        cpuUsage: 0,
        activeConnections: 0
      }
    };
    
    this.startTime = Date.now();
  }

  /**
   * 🔵 Registrar request HTTP
   */
  recordRequest(success, duration, error = null) {
    this.metrics.requests.total++;
    
    if (success) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.failed++;
      this.metrics.requests.lastError = error?.message || 'Unknown error';
      this.metrics.requests.lastErrorTime = new Date().toISOString();
    }
    
    // Actualizar promedio de tiempo de respuesta
    const total = this.metrics.requests.total;
    this.metrics.requests.avgResponseTime = 
      (this.metrics.requests.avgResponseTime * (total - 1) + duration) / total;
  }

  /**
   * 🗄️ Registrar query de database
   */
  recordQuery(success, duration, isSlow = false) {
    this.metrics.database.queriesTotal++;
    
    if (success) {
      this.metrics.database.queriesSuccess++;
    } else {
      this.metrics.database.queriesFailed++;
    }
    
    if (isSlow) {
      this.metrics.database.slowQueries++;
    }
    
    // Actualizar promedio
    const total = this.metrics.database.queriesTotal;
    this.metrics.database.avgQueryTime = 
      (this.metrics.database.avgQueryTime * (total - 1) + duration) / total;
  }

  /**
   * 🤖 Registrar activación de agente
   */
  recordAgentActivation(agentName, responseTime) {
    if (this.metrics.agents[agentName]) {
      this.metrics.agents[agentName].activations++;
      
      const total = this.metrics.agents[agentName].activations;
      this.metrics.agents[agentName].avgResponseTime = 
        (this.metrics.agents[agentName].avgResponseTime * (total - 1) + responseTime) / total;
    }
  }

  /**
   * 🧠 Registrar request a OpenAI
   */
  recordOpenAIRequest(success, latency, tokensUsed = 0, error = null) {
    this.metrics.openai.requestsTotal++;
    
    if (success) {
      this.metrics.openai.requestsSuccess++;
      this.metrics.openai.tokensUsed += tokensUsed;
    } else {
      this.metrics.openai.requestsFailed++;
      this.metrics.openai.errors.push({
        error: error?.message || 'Unknown',
        timestamp: new Date().toISOString()
      });
      
      // Mantener solo últimos 10 errores
      if (this.metrics.openai.errors.length > 10) {
        this.metrics.openai.errors.shift();
      }
    }
    
    // Actualizar latencia promedio
    const total = this.metrics.openai.requestsTotal;
    this.metrics.openai.avgLatency = 
      (this.metrics.openai.avgLatency * (total - 1) + latency) / total;
  }

  /**
   * 💻 Actualizar métricas de sistema
   */
  updateSystemMetrics() {
    const usage = process.memoryUsage();
    this.metrics.system.memoryUsage = Math.round(usage.heapUsed / 1024 / 1024); // MB
    this.metrics.system.uptime = Date.now() - this.startTime;
  }

  /**
   * 📊 Actualizar métricas del pool de conexiones
   */
  updatePoolMetrics(pool) {
    if (pool) {
      this.metrics.database.poolActive = pool.totalCount;
      this.metrics.database.poolIdle = pool.idleCount;
      this.metrics.database.poolWaiting = pool.waitingCount;
    }
  }

  /**
   * 📈 Obtener todas las métricas
   */
  getMetrics() {
    this.updateSystemMetrics();
    
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000)
    };
  }

  /**
   * 🔄 Resetear métricas
   */
  reset() {
    const newMetrics = new MetricsCollector();
    this.metrics = newMetrics.metrics;
    this.startTime = Date.now();
  }
}

/**
 * 📝 Logger estructurado
 */
class StructuredLogger {
  constructor(serviceName = 'coworkia-agent') {
    this.serviceName = serviceName;
  }

  /**
   * 🔵 Log INFO
   */
  info(message, metadata = {}) {
    this.log('INFO', message, metadata);
  }

  /**
   * ⚠️ Log WARNING
   */
  warn(message, metadata = {}) {
    this.log('WARN', message, metadata);
  }

  /**
   * ❌ Log ERROR
   */
  error(message, error = null, metadata = {}) {
    const errorData = error ? {
      error: error.message,
      stack: error.stack,
      code: error.code
    } : {};
    
    this.log('ERROR', message, { ...metadata, ...errorData });
  }

  /**
   * 🔍 Log DEBUG
   */
  debug(message, metadata = {}) {
    if (process.env.DEBUG_MODE === 'true') {
      this.log('DEBUG', message, metadata);
    }
  }

  /**
   * 📝 Log genérico estructurado
   */
  log(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...metadata
    };
    
    // En producción, usar JSON para parsing fácil
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } else {
      // En desarrollo, formato legible
      const emoji = {
        INFO: '🔵',
        WARN: '⚠️',
        ERROR: '❌',
        DEBUG: '🔍'
      }[level] || '📝';
      
      console.log(`${emoji} [${level}] ${message}`, metadata);
    }
  }

  /**
   * 📊 Log de métrica
   */
  metric(metricName, value, unit = '', tags = {}) {
    this.log('METRIC', `${metricName}: ${value}${unit}`, { metric: metricName, value, unit, tags });
  }
}

/**
 * ❤️ Health Check System
 */
class HealthChecker {
  constructor(database) {
    this.database = database;
    this.checks = new Map();
    
    // Registrar checks por defecto
    this.registerCheck('database', () => this.checkDatabase());
    this.registerCheck('memory', () => this.checkMemory());
  }

  /**
   * 📋 Registrar nuevo health check
   */
  registerCheck(name, checkFn) {
    this.checks.set(name, checkFn);
  }

  /**
   * 🗄️ Check database
   */
  async checkDatabase() {
    try {
      const startTime = Date.now();
      await this.database.get('SELECT 1 as health');
      const duration = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime: duration,
        message: 'Database connection OK'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        message: 'Database connection failed'
      };
    }
  }

  /**
   * 💾 Check memory
   */
  checkMemory() {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const percentUsed = Math.round((heapUsedMB / heapTotalMB) * 100);
    
    const status = percentUsed > 90 ? 'warning' : 'healthy';
    
    return {
      status,
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      percentUsed: `${percentUsed}%`,
      message: status === 'warning' ? 'High memory usage' : 'Memory usage OK'
    };
  }

  /**
   * ✅ Ejecutar todos los health checks
   */
  async runAllChecks() {
    const results = {};
    let overallStatus = 'healthy';
    
    for (const [name, checkFn] of this.checks) {
      try {
        results[name] = await checkFn();
        
        if (results[name].status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (results[name].status === 'warning' && overallStatus === 'healthy') {
          overallStatus = 'warning';
        }
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message
        };
        overallStatus = 'unhealthy';
      }
    }
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: results
    };
  }
}

function getHealthStatusCode(status) {
  return status === 'healthy' || status === 'warning' ? 200 : 503;
}

// Instancias singleton
const metricsCollector = new MetricsCollector();
const logger = new StructuredLogger('coworkia-agent');
let healthChecker = null; // Se inicializa después con database

/**
 * 🚀 Inicializar observabilidad
 */
function initializeObservability(database) {
  healthChecker = new HealthChecker(database);
  logger.info('Observability system initialized', {
    metrics: true,
    healthChecks: true,
    structuredLogging: true
  });
}

/**
 * 📊 Middleware para tracking de requests
 */
function requestTrackingMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    userAgent: req.get('user-agent')
  });
  
  // Interceptar response
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    metricsCollector.recordRequest(success, duration);
    
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
    
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * 🔍 Wrapper para queries con tracking
 */
function withQueryTracking(queryFn, queryName = 'unnamed') {
  return async function(...args) {
    const startTime = Date.now();
    
    try {
      const result = await queryFn.apply(this, args);
      const duration = Date.now() - startTime;
      const isSlow = duration > 1000;
      
      metricsCollector.recordQuery(true, duration, isSlow);
      
      if (isSlow) {
        logger.warn('Slow query detected', {
          queryName,
          duration: `${duration}ms`,
          threshold: '1000ms'
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      metricsCollector.recordQuery(false, duration);
      
      logger.error('Query failed', error, {
        queryName,
        duration: `${duration}ms`
      });
      
      throw error;
    }
  };
}

export {
  metricsCollector,
  logger,
  healthChecker,
  initializeObservability,
  requestTrackingMiddleware,
  withQueryTracking,
  getHealthStatusCode,
  MetricsCollector,
  StructuredLogger,
  HealthChecker
};
