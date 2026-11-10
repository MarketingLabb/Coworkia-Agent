/**
 * 🏥 health-monitor.js — Monitor de salud del sistema
 *
 * Revisa OpenAI, PostgreSQL, Wassenger y RAM cada 10 minutos.
 * Solo notifica si el problema persiste en 2 checks consecutivos
 * para evitar spam por fallos transitorios.
 *
 * Uso: llamar startHealthMonitor() en el boot del servidor.
 * API:  getLastStatus() → snapshot del último check (para /status WA)
 */

import { notifyCriticalError } from './notification-service.js';
import { query }               from '../database/database.js';

// ─── Config ───────────────────────────────────────────────────────────────────
const CHECK_INTERVAL_MS  = 10 * 60 * 1000; // 10 minutos (ahorra llamadas en eco dyno)
const FAIL_THRESHOLD     = 2;              // Notificar solo tras N fallos seguidos
const RAM_WARN_MB        = 450;            // Alerta si RSS supera este umbral

// ─── Estado interno ───────────────────────────────────────────────────────────
const failCounters = { openai: 0, db: 0, wassenger: 0 };
// Sesión WhatsApp: alertar una sola vez por corte y avisar al recuperarse
let sessionDownSince = null;
let intervalId = null;
let _lastStatus = { checkedAt: null, openai: 'unknown', db: 'unknown', wassenger: 'unknown', whatsappSession: 'unknown', ramMB: 0 };

// ─── Checks individuales ──────────────────────────────────────────────────────

async function checkOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[HEALTH] ⚠️ OPENAI_API_KEY no configurada — skip OpenAI check');
    failCounters.openai = 0;
    return true;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s — margen para red de eco dyno

  try {
    const res = await fetch('https://api.openai.com/v1/models?limit=1', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (res.ok || res.status === 429) {
      // 429 = rate limited → servicio UP
      failCounters.openai = 0;
      return true;
    }

    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    if (err.name === 'AbortError') {
      // Timeout de red: OpenAI lento pero no necesariamente caído — no genera ERROR CRÍTICO
      console.warn('[HEALTH] ⏱️ OpenAI check timeout (>15s) — lentitud de red, no se genera alerta');
      return false;
    }

    failCounters.openai++;
    console.warn(`[HEALTH] ❌ OpenAI check failed (${failCounters.openai}/${FAIL_THRESHOLD}):`, err.message);

    if (failCounters.openai >= FAIL_THRESHOLD) {
      await notifyCriticalError('Health Monitor — OpenAI', err);
      failCounters.openai = 0; // Reset para no re-notificar en cada ciclo hasta que vuelva a fallar
    }
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkDatabase() {
  try {
    await query('SELECT 1');
    failCounters.db = 0;
    return true;
  } catch (err) {
    failCounters.db++;
    console.warn(`[HEALTH] ❌ DB check failed (${failCounters.db}/${FAIL_THRESHOLD}):`, err.message);

    if (failCounters.db >= FAIL_THRESHOLD) {
      await notifyCriticalError('Health Monitor — PostgreSQL', err);
      failCounters.db = 0;
    }
    return false;
  }
}

async function checkWassenger() {
  const token = process.env.WASSENGER_TOKEN || process.env.WASSENGER_API_KEY;
  if (!token) {
    failCounters.wassenger = 0; // Sin token = no monitorear
    return true;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('https://api.wassenger.com/v1/account', {
      headers: { Token: token },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    // 401/403 = token inválido (servicio UP), 5xx = servicio caído
    if (res.status < 500) {
      failCounters.wassenger = 0;
      return true;
    }
    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    if (err.name === 'AbortError') {
      failCounters.wassenger++;
      console.warn(`[HEALTH] ❌ Wassenger timeout (${failCounters.wassenger}/${FAIL_THRESHOLD})`);
    } else {
      failCounters.wassenger++;
      console.warn(`[HEALTH] ❌ Wassenger check failed (${failCounters.wassenger}/${FAIL_THRESHOLD}):`, err.message);
    }
    if (failCounters.wassenger >= FAIL_THRESHOLD) {
      await notifyCriticalError('Health Monitor — Wassenger', err);
      failCounters.wassenger = 0;
    }
    return false;
  }
}

/**
 * 📱 Sesión WhatsApp del dispositivo Wassenger.
 * checkWassenger() solo valida token/API: devuelve OK aunque la sesión de
 * WhatsApp esté desconectada (incidente 10-nov-2026: Aurora sin responder).
 * Aquí consultamos GET /v1/devices/{id} y miramos session.status.
 *
 * La alerta va por WhatsApp Y por email: si la sesión está caída, el
 * WhatsApp de alerta tampoco sale, así que el email es el canal fiable.
 */
async function checkWhatsAppSession() {
  const token = process.env.WASSENGER_TOKEN || process.env.WASSENGER_API_KEY;
  const deviceId = process.env.WASSENGER_DEVICE_ID;
  if (!token || !deviceId) return 'unknown';

  let status;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://api.wassenger.com/v1/devices/${deviceId}`, {
      headers: { Token: token },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return 'unknown'; // API caída/lenta la cubre checkWassenger()
    const device = await res.json();
    status = device?.session?.status || 'unknown';
  } catch {
    return 'unknown';
  }

  if (status === 'online') {
    if (sessionDownSince) {
      const minutes = Math.round((Date.now() - sessionDownSince) / 60000);
      sessionDownSince = null;
      console.log(`[HEALTH] ✅ Sesión WhatsApp recuperada tras ~${minutes} min`);
      await sendSessionAlert(
        '✅ WhatsApp reconectado',
        `La sesión de WhatsApp de Wassenger volvió a estar online tras ~${minutes} min. Los agentes ya reciben mensajes.`
      );
    }
    return 'online';
  }

  if (!sessionDownSince) {
    sessionDownSince = Date.now();
    console.error(`[HEALTH] 🚨 Sesión WhatsApp NO online (status=${status})`);
    await sendSessionAlert(
      '🚨 WhatsApp desconectado — los agentes no reciben mensajes',
      `La sesión de WhatsApp en Wassenger está en estado "${status}". ` +
      `Mientras siga así, Aurora y los demás agentes no reciben mensajes de clientes.\n\n` +
      `Acción: abrir el panel de Wassenger y reconectar el dispositivo (escanear QR si lo pide).`
    );
  }
  return status;
}

async function sendSessionAlert(subject, body) {
  // 1) WhatsApp (puede no salir si la sesión está caída)
  notifyCriticalError(`Health Monitor — ${subject}`, new Error(body)).catch(() => {});
  // 2) Email (canal fiable cuando WhatsApp está caído). Import dinámico para no cargar SMTP en tests.
  try {
    const { sendEmail, getAdminCC } = await import('./email.js');
    const to = getAdminCC();
    if (to) {
      await sendEmail({
        to,
        subject: `[Coworkia Agent] ${subject}`,
        text: body,
        html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
      });
    }
  } catch (err) {
    console.warn('[HEALTH] ⚠️ No se pudo enviar alerta por email:', err.message);
  }
}

function checkRAM() {
  const rss = Math.round(process.memoryUsage().rss / 1024 / 1024);
  if (rss > RAM_WARN_MB) {
    console.warn(`[HEALTH] ⚠️ RAM alta: ${rss}MB (umbral: ${RAM_WARN_MB}MB)`);
    notifyCriticalError('Health Monitor — RAM Alta', new Error(`RSS: ${rss}MB`)).catch(() => {});
  }
  return rss;
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runChecks() {
  console.log('[HEALTH] 🔍 Ejecutando checks...');
  const [openaiOk, dbOk, wassengerOk, whatsappSession] = await Promise.all([
    checkOpenAI(), checkDatabase(), checkWassenger(), checkWhatsAppSession()
  ]);
  const ramMB = checkRAM();
  const status = openaiOk && dbOk ? '✅' : '⚠️';
  console.log(`[HEALTH] ${status} OpenAI: ${openaiOk ? 'OK' : 'FAIL'} | DB: ${dbOk ? 'OK' : 'FAIL'} | Wassenger: ${wassengerOk ? 'OK' : 'FAIL'} | WhatsApp: ${whatsappSession} | RAM: ${ramMB}MB`);
  _lastStatus = { checkedAt: new Date().toISOString(), openai: openaiOk ? 'ok' : 'fail', db: dbOk ? 'ok' : 'fail', wassenger: wassengerOk ? 'ok' : 'fail', whatsappSession, ramMB };
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Inicia el monitor de salud. Llámalo una vez en el boot del servidor.
 */
export function startHealthMonitor() {
  if (intervalId) {
    console.warn('[HEALTH] ⚠️ Monitor ya iniciado — ignorando llamada duplicada');
    return;
  }

  console.log(`[HEALTH] 🏥 Health monitor iniciado (cada ${CHECK_INTERVAL_MS / 60000} min)`);

  // Primer check con pequeño delay (servidor aún levantando)
  setTimeout(() => runChecks(), 30_000);

  intervalId = setInterval(runChecks, CHECK_INTERVAL_MS);
}

/**
 * Detiene el monitor (útil en tests).
 */
export function stopHealthMonitor() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[HEALTH] 🛑 Health monitor detenido');
  }
}

/**
 * Devuelve el snapshot del último check (para el comando /status desde WA).
 */
export function getLastStatus() {
  return { ..._lastStatus };
}

/** @internal Solo para tests unitarios */
export function _resetCountersForTest() {
  failCounters.openai = 0;
  failCounters.db = 0;
  failCounters.wassenger = 0;
  sessionDownSince = null;
}

/** @internal Solo para tests unitarios */
export { checkOpenAI as _checkOpenAI, checkWhatsAppSession as _checkWhatsAppSession };
