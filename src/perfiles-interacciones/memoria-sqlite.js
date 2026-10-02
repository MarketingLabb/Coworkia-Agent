/**
 * Sistema de memoria: perfiles de usuarios e historial de interacciones
 * Migrado a PostgreSQL para mejor performance y escalabilidad
 */

import databaseService from '../database/database.js';
import userRepository from '../database/userRepository.js';
import reservationRepository from '../database/reservationRepository.js';
import { SUPPORTED_LANGUAGES } from '../utils/multi-language.js';
import fs from 'fs';
import path from 'path';
import {
  getPendingConfirmation as dbGetPendingConfirmation,
  setPendingConfirmation as dbSetPendingConfirmation,
  clearPendingConfirmation as dbClearPendingConfirmation,
  getJustConfirmedState
} from '../servicios/reservation-state.js';
import { calculateReservationCost, getPaymentInfo } from '../servicios/payment-calculator.js';

// Mantener compatibilidad con archivos JSON durante transición
const DATA_DIR = path.resolve(process.cwd(), 'data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const INTERACTIONS_FILE = path.join(DATA_DIR, 'interactions.jsonl');

// Asegurar que existe la carpeta data/
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Cache en memoria para perfiles
 * TTL: 120 segundos (aumentado de 30s para prevenir timeouts)
 * MAX: 100 perfiles (reducido para Heroku Eco)
 * 
 * OPTIMIZACIÓN v688: TTL más agresivo + invalidación selectiva
 * Solo invalida si cambian campos críticos (activeAgent, email, etc)
 * NO invalida si solo cambió lastMessageAt
 */
const profileCache = new Map();
const CACHE_TTL = 120000; // 120 segundos (aumentado de 30s)
const MAX_CACHE_SIZE = 100; // Reducido de 1000 → 100 para ahorrar memoria

function getCachedProfile(userId) {
  const cached = profileCache.get(userId);
  if (!cached) return null;
  
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    profileCache.delete(userId);
    return null;
  }
  
  if (process.env.DEBUG_MODE === 'true') {
    console.log(`[CACHE] ⚡ HIT para ${userId} (edad: ${now - cached.timestamp}ms)`);
  }
  
  return cached.profile;
}

function setCachedProfile(userId, profile) {
  // Limitar tamaño del cache (FIFO)
  if (profileCache.size >= MAX_CACHE_SIZE) {
    const firstKey = profileCache.keys().next().value;
    profileCache.delete(firstKey);
    if (process.env.DEBUG_MODE === 'true') {
      console.log(`[CACHE] 🗑️ EVICT (límite alcanzado): ${firstKey}`);
    }
  }
  
  profileCache.set(userId, {
    profile,
    timestamp: Date.now()
  });
  
  if (process.env.DEBUG_MODE === 'true') {
    console.log(`[CACHE] 💾 SET para ${userId} (total: ${profileCache.size})`);
  }
}

function invalidateCachedProfile(userId) {
  profileCache.delete(userId);
  if (process.env.DEBUG_MODE === 'true') {
    console.log(`[CACHE] 🗑️ INVALIDATE para ${userId}`);
  }
}

/**
 * Limpieza periódica del cache (eliminar entradas expiradas)
 * Se ejecuta automáticamente cada 5 minutos
 */
function cleanupExpiredCache() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [userId, cached] of profileCache.entries()) {
    if (now - cached.timestamp > CACHE_TTL) {
      profileCache.delete(userId);
      cleaned++;
    }
  }
  
  if (cleaned > 0 && process.env.DEBUG_MODE === 'true') {
    console.log(`[CACHE] 🧹 Limpieza: ${cleaned} perfiles expirados (${profileCache.size} restantes)`);
  }
}

// Ejecutar limpieza cada 5 minutos
setInterval(cleanupExpiredCache, 5 * 60 * 1000);

/**
 * Inicializar base de datos al importar el módulo
 */
let dbInitialized = false;

async function ensureDbInitialized() {
  if (!dbInitialized) {
    try {
      await databaseService.initialize();
      dbInitialized = true;
      console.log('[MEMORIA] ✅ Base de datos SQLite inicializada');
    } catch (error) {
      console.error('[MEMORIA] ❌ Error inicializando SQLite:', error);
      throw error;
    }
  }
}

/**
 * Carga todos los perfiles (para compatibilidad)
 */
export async function loadAllProfiles() {
  await ensureDbInitialized();
  
  try {
    const users = await userRepository.list(1000, 0);
    const profiles = {};
    
    users.forEach(user => {
      profiles[user.phone_number] = {
        userId: user.phone_number,
        name: user.name,
        email: user.email,
        whatsappDisplayName: user.whatsapp_display_name,
        firstVisit: user.first_visit,
        freeTrialUsed: user.free_trial_used,
        freeTrialDate: user.free_trial_date,
        conversationCount: user.conversation_count,
        lastMessageAt: user.last_message_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
    });
    
    return JSON.stringify(profiles, null, 2);
  } catch (error) {
    console.error('[MEMORIA] Error cargando perfiles desde SQLite:', error);
    
    // Fallback a archivo JSON si SQLite falla
    if (fs.existsSync(PROFILES_FILE)) {
      return fs.promises.readFile(PROFILES_FILE, 'utf-8');
    }
    
    return Promise.resolve('{}');
  }
}

/**
 * 👤 Carga un perfil de usuario (OPTIMIZADO v427 - caché + queries paralelas)
 */
export async function loadProfile(userId) {
  await ensureDbInitialized();
  
  // ⚡ P1: Verificar caché primero
  const cached = getCachedProfile(userId);
  if (cached) {
    return cached;
  }
  
  try {
    if (process.env.DEBUG_MODE === 'true') {
      console.log('[MEMORIA DEBUG] Llamando userRepository.findByPhone...');
    }
    
    // ⚡ OPTIMIZACIÓN v426: Ejecutar queries en paralelo
    const [user, reservationHistory, upcomingReservations, pendingConfirmation, justState] = await Promise.all([
      userRepository.findByPhone(userId),
      getReservationHistory(userId),
      getUpcomingReservations(userId),
      dbGetPendingConfirmation(userId),
      getJustConfirmedState(userId)
    ]);
    
    if (process.env.DEBUG_MODE === 'true') {
      console.log('[MEMORIA DEBUG] findByPhone completado, user:', user ? 'FOUND' : 'NULL');
    }
    
    if (!user) {
      if (process.env.DEBUG_MODE === 'true') {
        console.log('[MEMORIA DEBUG] Usuario no encontrado, retornando null');
      }
      return null;
    }

    const profile = {
      userId: user.phone_number,
      name: user.name,
      email: user.email,
      whatsappDisplayName: user.whatsapp_display_name,
      channel: 'whatsapp',
      firstVisit: user.first_visit,
      freeTrialUsed: user.free_trial_used,
      freeTrialDate: user.free_trial_date,
      conversationCount: user.conversation_count,
      lastMessageAt: user.last_message_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      activeAgent: user.active_agent || 'AURORA', // Agente activo actual
      preferredLanguage: user.preferred_language || 'es', // 🌍 Idioma preferido
      dataConsentAt: user.data_consent_at || null, // 🔐 LOPDP consentimiento
      dataConsentSource: user.data_consent_source || null,
      dataConsentRequestedAt: user.data_consent_requested_at || null,
      reservationHistory,
      upcomingReservations, // 🆕 Reservas confirmadas futuras
      pendingConfirmation,
      justConfirmed: justState.isActive,
      justConfirmedUntil: justState.until
    };
    
    // ⚡ P1: Guardar en caché
    setCachedProfile(userId, profile);
    
    return profile;
  } catch (error) {
    console.error('[MEMORIA] Error cargando perfil desde SQLite:', error);
    
    // Fallback a archivo JSON
    try {
      if (fs.existsSync(PROFILES_FILE)) {
        const content = await fs.promises.readFile(PROFILES_FILE, 'utf-8');
        const profiles = JSON.parse(content);
        return profiles[userId] || null;
      }
    } catch (fallbackError) {
      console.error('[MEMORIA] Error en fallback JSON:', fallbackError);
    }
    
    return null;
  }
}

/**
 * 💾 Guarda un perfil de usuario (OPTIMIZADO v427 - invalidación de caché)
 */
export async function saveProfile(userId, partialProfile = {}) {
  await ensureDbInitialized();
  
  // ⚡ P1: Invalidación selectiva de caché (v688 optimización)
  // Solo invalidar si cambió activeAgent u otros campos críticos
  // NO invalidar si solo cambió lastMessageAt (evita invalidación constante)
  const shouldInvalidateCache = partialProfile.activeAgent 
    || partialProfile.email 
    || partialProfile.preferredLanguage
    || partialProfile.whatsappDisplayName
    || partialProfile.name
    || partialProfile.firstVisit !== undefined
    || partialProfile.freeTrialUsed !== undefined
    || partialProfile.freeTrialDate !== undefined;
  
  if (shouldInvalidateCache) {
    invalidateCachedProfile(userId);
  }
  
  try {
    // 🔥 NOMBRE: Priorizar nombre real (limpio/formulario/mensaje) sobre alias crudo de WA
    const displayName = partialProfile.whatsappDisplayName || null;
    const syncedName = partialProfile.name || displayName || null;
    
    // 🌍 VALIDACIÓN IDIOMA: Solo ES/EN/QU permitidos
    let validatedLanguage = partialProfile.preferredLanguage;
    if (validatedLanguage) {
      const allSupportedLanguages = [...SUPPORTED_LANGUAGES.STANDARD, ...SUPPORTED_LANGUAGES.ANGELA_EXTENDED.filter(lang => !SUPPORTED_LANGUAGES.STANDARD.includes(lang))];
      if (!allSupportedLanguages.includes(validatedLanguage)) {
        console.warn(`⚠️ Invalid language '${validatedLanguage}' for user ${userId}, defaulting to 'es'`);
        validatedLanguage = 'es';
      }
    }

    // Convertir formato de aplicación a formato SQLite
    const sqliteData = {
      name: syncedName, // 🎯 Siempre sincronizado con display name
      email: partialProfile.email,
      whatsapp_display_name: displayName, // Guardar también el display name
      first_visit: partialProfile.firstVisit,
      // 🛡️ free_trial_used: solo escribir si se marca como USADO (true/1)
      // NUNCA sobreescribir a false/0 — evita race condition donde el perfil
      // en memoria (freeTrialUsed=0) se guarda un instante DESPUÉS de que
      // confirmation-flow lo marcó como 1 en BD.
      free_trial_used: partialProfile.freeTrialUsed === true || partialProfile.freeTrialUsed === 1
        ? true
        : undefined,
      free_trial_date: partialProfile.freeTrialDate,
      conversation_count: partialProfile.conversationCount,
      last_message_at: partialProfile.lastMessageAt || new Date().toISOString(),
      active_agent: partialProfile.activeAgent,
      preferred_language: validatedLanguage // 🌍 Idioma preferido (validado)
    };
    
    // Remover campos undefined
    Object.keys(sqliteData).forEach(key => {
      if (sqliteData[key] === undefined) {
        delete sqliteData[key];
      }
    });
    
    await userRepository.createOrUpdate(userId, sqliteData);
    
    // También guardar en JSON para backup (temporal)
    await saveProfileToJson(userId, partialProfile);
    
    console.log(`[MEMORIA] ✅ Perfil guardado para ${userId}`);
    return true;
  } catch (error) {
    console.error('[MEMORIA] Error guardando perfil en SQLite:', error);
    
    // Fallback a JSON
    return await saveProfileToJson(userId, partialProfile);
  }
}

/**
 * 🔄 Actualiza un usuario (alias de saveProfile para compatibilidad)
 */
export async function updateUser(userId, updateData) {
  return await saveProfile(userId, updateData);
}

/**
 * 📅 Obtiene historial de reservas de un usuario
 */
async function getReservationHistory(userId) {
  try {
    const reservations = await reservationRepository.findByUser(userId, 10);
    
    return reservations.map(reservation => ({
      date: reservation.date,
      startTime: reservation.start_time,
      endTime: reservation.end_time,
      time: `${reservation.start_time}-${reservation.end_time}`,
      type: reservation.service_type === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones',
      serviceType: reservation.service_type,
      status: reservation.status,
      wasFree: reservation.was_free,
      createdAt: reservation.created_at
    }));
  } catch (error) {
    console.error('[MEMORIA] Error obteniendo historial de reservas:', error);
    return [];
  }
}

/**
 * 📅 Obtiene reservas confirmadas futuras de un usuario
 */
async function getUpcomingReservations(userId) {
  try {
    const reservations = await reservationRepository.findUpcomingByUser(userId);
    
    return reservations.map(reservation => ({
      date: reservation.date,
      start_time: reservation.start_time,
      end_time: reservation.end_time,
      time: `${reservation.start_time}-${reservation.end_time}`,
      space: reservation.service_type === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones',
      service_type: reservation.service_type,
      people: reservation.num_people || 1,
      price: reservation.was_free ? 'GRATIS' : `$${parseFloat(reservation.total_amount).toFixed(2)}`,
      was_free: reservation.was_free
    }));
  } catch (error) {
    console.error('[MEMORIA] Error obteniendo reservas futuras:', error);
    return [];
  }
}

/**
 * 💾 Guarda perfil en JSON (backup/fallback)
 */
async function saveProfileToJson(userId, partialProfile) {
  try {
    let profiles = {};
    if (fs.existsSync(PROFILES_FILE)) {
      const content = await fs.promises.readFile(PROFILES_FILE, 'utf-8');
      profiles = JSON.parse(content);
    }
    
    profiles[userId] = { ...profiles[userId], ...partialProfile };
    
    await fs.promises.writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2));
    return true;
  } catch (error) {
    console.error('[MEMORIA] Error guardando perfil en JSON:', error);
    return false;
  }
}

/**
 * 💬 Guarda una interacción en la base de datos
 */
export async function saveInteraction(interactionData) {
  await ensureDbInitialized();
  
  try {
    const query = `
      INSERT INTO interactions (
        user_phone, agent, agent_name, intent_reason,
        input, output, meta
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      interactionData.userId,
      interactionData.agent,
      interactionData.agentName,
      interactionData.intentReason,
      interactionData.input,
      interactionData.output,
      JSON.stringify(interactionData.meta || {})
    ];
    
    await databaseService.run(query, params);
    
    // También guardar en JSONL para backup
    await saveInteractionToJsonl(interactionData);
    
    return true;
  } catch (error) {
    console.error('[MEMORIA] Error guardando interacción en SQLite:', error);
    
    // Fallback a JSONL
    return await saveInteractionToJsonl(interactionData);
  }
}

/**
 * 💬 Guarda interacción en JSONL (backup)
 */
async function saveInteractionToJsonl(interactionData) {
  try {
    const interactionJson = JSON.stringify({
      ...interactionData,
      timestamp: new Date().toISOString()
    });
    
    await fs.promises.appendFile(INTERACTIONS_FILE, interactionJson + '\n');
    return true;
  } catch (error) {
    console.error('[MEMORIA] Error guardando interacción en JSONL:', error);
    return false;
  }
}

/**
 * 🔍 Busca confirmación pendiente
 */
export async function getPendingConfirmation(userId) {
  await ensureDbInitialized();
  return await dbGetPendingConfirmation(userId);
}

export async function savePendingConfirmation(userId, reservationData) {
  await ensureDbInitialized();
  try {
    await dbSetPendingConfirmation(userId, reservationData);
    return true;
  } catch (error) {
    console.error('[MEMORIA] Error guardando confirmación pendiente:', error);
    return false;
  }
}

export async function clearPendingConfirmation(userId) {
  await ensureDbInitialized();
  try {
    await dbClearPendingConfirmation(userId);
    return true;
  } catch (error) {
    console.error('[MEMORIA] Error eliminando confirmación pendiente:', error);
    return false;
  }
}

/**
 * 🆕 Las siguientes funciones mantienen compatibilidad con el código existente
 */

export async function updateReservationHistory(userId, reservation) {
  // Esta función ahora es manejada automáticamente por reservationRepository
  // Mantener para compatibilidad
  console.log('[MEMORIA] updateReservationHistory llamada - ahora manejada por SQLite automáticamente');
  return await loadProfile(userId);
}

/**
 * 💾 Guardar formulario parcial cuando usuario cancela
 */
export async function savePartialForm(userId, formData, formType = 'reservation') {
  await ensureDbInitialized();
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2); // Expira en 2 horas
    
    await databaseService.run(
      `INSERT INTO partial_forms (user_phone, form_data, form_type, cancelled_at, expires_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
       ON CONFLICT(user_phone) DO UPDATE SET
         form_data = excluded.form_data,
         form_type = excluded.form_type,
         cancelled_at = CURRENT_TIMESTAMP,
         expires_at = excluded.expires_at`,
      [userId, JSON.stringify(formData), formType, expiresAt.toISOString()]
    );
    console.log('[MEMORIA] ✅ Formulario parcial guardado:', { userId, formType });
    return true;
  } catch (error) {
    console.error('[MEMORIA] ❌ Error guardando formulario parcial:', error);
    return false;
  }
}

/**
 * 📋 Obtener último formulario parcial guardado
 */
export async function getPartialForm(userId) {
  await ensureDbInitialized();
  try {
    const row = await databaseService.get(
      'SELECT form_data, form_type, cancelled_at FROM partial_forms WHERE user_phone = ?',
      [userId]
    );
    if (!row) return null;
    return {
      formData: JSON.parse(row.form_data),
      formType: row.form_type,
      cancelledAt: row.cancelled_at
    };
  } catch (error) {
    console.error('[MEMORIA] Error obteniendo formulario parcial:', error);
    return null;
  }
}

/**
 * 🗑️ Eliminar formulario parcial
 */
export async function clearPartialForm(userId) {
  await ensureDbInitialized();
  try {
    await databaseService.run('DELETE FROM partial_forms WHERE user_phone = ?', [userId]);
    return true;
  } catch (error) {
    console.error('[MEMORIA] Error eliminando formulario parcial:', error);
    return false;
  }
}

// Removido: calculateReservationCost y getPaymentInfo movidas a payment-calculator.js
// Re-exportadas automáticamente en línea 16 para compatibilidad
export { calculateReservationCost, getPaymentInfo } from '../servicios/payment-calculator.js';

/**
 * Carga historial de conversación
 * Implementado con tabla interactions
 */
export async function loadConversationHistory(userId, limit = 10) {
  try {
    const interactions = await databaseService.all(
      'SELECT * FROM interactions WHERE user_phone = ? ORDER BY timestamp DESC LIMIT ?',
      [userId, limit]
    );
    return interactions.reverse(); // Orden cronológico
  } catch (error) {
    console.error('[MEMORIA-SQLITE] Error cargando historial:', error);
    return [];
  }
}

/**
 * Guarda mensaje de conversación
 * Almacenamiento estructurado en interactions
 */
export async function saveConversationMessage(userId, message, role = 'user') {
  try {
    // Si message es objeto con role, content, agent - extraer datos
    const isObjectMessage = typeof message === 'object' && message.content;
    const content = isObjectMessage ? message.content : message;
    const actualRole = isObjectMessage ? message.role : role;
    const agentName = isObjectMessage && message.agent ? message.agent : 'Aurora';
    const agentKey = agentName.toLowerCase();
    
    await saveInteraction({
      userId: userId,
      agent: agentKey,
      agentName: agentName,
      intentReason: 'conversation',
      input: actualRole === 'user' ? content : '',
      output: actualRole === 'assistant' ? content : '',
      meta: { role: actualRole, timestamp: new Date().toISOString() }
    });
    return true;
  } catch (error) {
    console.error('[MEMORIA-SQLITE] Error guardando mensaje:', error);
    return false;
  }
}

/**
 * 🌍 Obtiene el idioma preferido del usuario
 * @param {string} userId - ID del usuario
 * @returns {string} Código de idioma (es, en, fr, it, pt, qu) o 'es' por defecto
 */
export async function getUserPreferredLanguage(userId) {
  await ensureDbInitialized();
  try {
    const user = await userRepository.findByPhone(userId);
    return user?.preferred_language || 'es';
  } catch (error) {
    console.error('[MEMORIA] Error obteniendo idioma preferido:', error);
    return 'es';
  }
}

/**
 * 🌍 Actualiza el idioma preferido del usuario
 * @param {string} userId - ID del usuario
 * @param {string} language - Código de idioma (es, en, fr, it, pt, qu)
 * @returns {boolean} true si se guardó exitosamente
 */
export async function setUserPreferredLanguage(userId, language) {
  await ensureDbInitialized();
  try {
    await saveProfile(userId, { preferredLanguage: language });
    console.log(`[MEMORIA] ✅ Idioma preferido actualizado para ${userId}: ${language}`);
    return true;
  } catch (error) {
    console.error('[MEMORIA] Error actualizando idioma preferido:', error);
    return false;
  }
}

// Mantener exports para compatibilidad
export { saveProfile as updateProfile };
export { databaseService };
export { invalidateCachedProfile };
