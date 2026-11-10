// src/servicios/follow-up-service.js
// 🔔 Sistema de seguimiento automático - UNA vez, 2 horas post-transacción
// + Follow-up específico de Aluna: 24h y 3 días post-consulta de membresías

import databaseService from '../database/database.js';
import { normalizePhoneEC } from '../utils/validators.js';
import reservationRepository from '../database/reservationRepository.js';
import {
  findProspectsFor24hFollowUp,
  findProspectsFor3dFollowUp,
  markProspect24hSent,
  markProspect3dSent,
  markProspect24hEmailSent,
  markProspect3dEmailSent,
  findMembersForRenewalReminder1,
  findMembersForRenewalReminder2,
  markRenewalReminder1Sent,
  markRenewalReminder2Sent,
  findMembersExpiringTomorrow
} from '../database/alunaRepository.js';
import {
  findQuotesForReminder1,
  findQuotesForReminder2,
  markReminder1Sent,
  markReminder2Sent
} from '../database/axelRepository.js';
import { sendAxelReminderEmail } from './axel-quote-email.js';
import { sendEmail, AGENT_FROM_NAMES, DEFAULT_FROM_EMAIL } from './email.js';
import { generateAlunaFollowup2HTML, generateAlunaFollowup3HTML } from './generic-email-templates.js';
import { buildEmailTemplate } from './email-template-system.js';

const TWO_HOURS_MS = 120 * 60 * 1000; // 2 horas en milisegundos

/**
 * ⏰ Verifica si estamos en horario permitido para enviar mensajes (6am - 10pm Ecuador)
 * @returns {boolean}
 */
export function isWithinAllowedHours() {
  const now = new Date();
  
  // Convertir a hora de Ecuador (UTC-5)
  const ecuadorTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
  const hour = ecuadorTime.getHours();
  
  // Solo entre 6:00 AM y 10:00 PM (22:00)
  const isAllowed = hour >= 6 && hour < 22;
  
  console.log(`[FOLLOW-UP] ⏰ Hora Ecuador: ${ecuadorTime.toLocaleTimeString('es-EC')} - Permitido: ${isAllowed}`);
  
  return isAllowed;
}

/**
 * 🔍 Encuentra usuarios con transacciones pendientes que necesitan follow-up
 * Criterios:
 * - transactionStartedAt existe (hay transacción en curso)
 * - Han pasado >= 120 minutos desde inicio
 * - followUpSentAt es NULL (no se ha enviado follow-up)
 * @returns {Promise<Array>}
 */
export async function findUsersNeedingFollowUp() {
  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - TWO_HOURS_MS);
    
    // Buscar usuarios con transacciones >= 2h sin follow-up enviado
    const query = `
      SELECT 
        u.phone_number,
        u.name,
        u.active_agent,
        u.transaction_started_at,
        u.transaction_agent,
        u.follow_up_sent_at
      FROM users u
      WHERE u.transaction_started_at IS NOT NULL
        AND u.transaction_started_at <= $1
        AND u.follow_up_sent_at IS NULL
      ORDER BY u.transaction_started_at ASC
      LIMIT 50
    `;
    
    const users = await databaseService.all(query, [twoHoursAgo]);
    
    console.log(`[FOLLOW-UP] 🔍 Encontrados ${users.length} usuarios que necesitan follow-up`);
    
    return users;
  } catch (error) {
    console.error('[FOLLOW-UP] ❌ Error buscando usuarios:', error);
    return [];
  }
}

/**
 * � Genera mensaje de seguimiento según agente especializado
 * @param {Object} user
 * @returns {string}
 */
export function generateFollowUpMessage(user) {
  const name = user.name || 'Hola';
  const agent = user.transaction_agent || user.active_agent || 'AURORA';
  
  // Mensajes específicos por agente
  const messages = {
    AURORA: `Hola ${name},

Vi que iniciaste una reserva pero no la completamos. El tiempo de sesión ya cerró.

Cuando quieras hacer una nueva reserva, escríbeme y te ayudo de inmediato.

¡Hasta pronto!`,

    AXEL: `Hola ${name} 🚗

Han pasado 2 horas desde tu consulta de cotización. 

Con todo gusto puedes retomar el servicio cuando lo necesites, solo envíame un mensaje.

¡Estoy aquí para ayudarte! 🔧`,

    ALUNA: `Hola ${name},

Vi que estuviste revisando nuestros planes de membresía pero no llegamos a completar el proceso.

Cuando quieras retomar, con gusto te ayudo a encontrar el plan que mejor se ajuste a ti.

¡Que tengas un excelente día!`,

    ADRIANA: `Hola ${name} 📄

Han pasado 2 horas desde que iniciamos el proceso de constitución.

Si deseas continuar en otro momento, estaré aquí para apoyarte.

¡Saludos cordiales!`,

    ENZO: `Hola ${name} 🎨

Han pasado 2 horas desde tu consulta de marketing.

Cuando quieras retomar el proyecto, con gusto te atiendo.

¡Nos vemos pronto!`,

    ANGELA: `Hola ${name} 💰

Han pasado 2 horas desde tu consulta contable.

Estoy disponible cuando necesites mis servicios nuevamente.

¡Cuídate!`,

    GABI: `Hola ${name} 📊

Han pasado 2 horas desde tu consulta administrativa.

Con gusto te ayudo cuando lo necesites.

¡Hasta pronto!`
  };
  
  return messages[agent] || messages.AURORA;
}

/**
 * 📤 Envía mensaje de seguimiento via Wassenger
 * @param {string} phoneNumber
 * @param {string} message
 * @param {string} agent - Agente que envía el follow-up
 * @returns {Promise<boolean>}
 */
export async function sendFollowUpMessage(phoneNumber, message, agent = 'AURORA') {
  try {
    const WASSENGER_TOKEN = process.env.WASSENGER_TOKEN;
    const WASSENGER_DEVICE_ID = process.env.WASSENGER_DEVICE_ID;
    
    if (!WASSENGER_TOKEN || !WASSENGER_DEVICE_ID) {
      console.error('[FOLLOW-UP] ❌ Credenciales de Wassenger no configuradas');
      return false;
    }
    
    const response = await fetch(`https://api.wassenger.com/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Token': WASSENGER_TOKEN
      },
      body: JSON.stringify({
        phone: phoneNumber,
        message: message,
        device: WASSENGER_DEVICE_ID
      })
    });
    
    if (!response.ok) {
      throw new Error(`Wassenger error: ${response.status}`);
    }
    
    console.log(`[FOLLOW-UP] ✅ Mensaje enviado a ${phoneNumber} via ${agent}`);
    
    // Registrar en interactions
    await databaseService.run(
      `INSERT INTO interactions (
        user_phone, agent, agent_name, intent_reason, input, output, meta
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        phoneNumber,
        agent.toLowerCase(),
        agent,
        'follow_up_2h_timeout',
        '',
        message,
        JSON.stringify({ 
          role: 'assistant', 
          timestamp: new Date().toISOString(),
          automatic: true,
          followUp: true,
          type: '2h_transaction_timeout'
        })
      ]
    );
    
    // Marcar follow-up como enviado
    await databaseService.run(
      `UPDATE users 
       SET follow_up_sent_at = $1 
       WHERE phone_number = $2`,
      [Date.now(), phoneNumber]
    );
    
    return true;
  } catch (error) {
    console.error(`[FOLLOW-UP] ❌ Error enviando mensaje a ${phoneNumber}:`, error);
    return false;
  }
}

/**
 * ⏰ Verifica si estamos en horario de Aluna para enviar follow-ups (8am - 7pm Ecuador)
 */
export function isWithinAlunaFollowUpHours() {
  const now = new Date();
  const ecuadorTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
  const hour = ecuadorTime.getHours();
  const isAllowed = hour >= 8 && hour < 19; // 8:00 AM – 7:00 PM
  console.log(`[ALUNA-FOLLOWUP] ⏰ Hora Ecuador: ${ecuadorTime.toLocaleTimeString('es-EC')} - Aluna permitido: ${isAllowed}`);
  return isAllowed;
}

/**
 * 💌 Genera mensaje de follow-up 24h para Aluna
 */
function buildAluna24hMessage(prospect) {
  const name = (prospect.user_name || '').split(' ')[0] || 'Hola';
  const plan = prospect.membership_type ? `*${prospect.membership_type}*` : 'nuestros planes de membresía';
  return `Hola ${name} 🌙

Ayer conversamos sobre ${plan} y quería saber si tuviste la oportunidad de revisar la info 😊

¿Tienes alguna duda o necesitas más detalles?

Y si quieres conocer el espacio antes de decidir, *te invito a venir un día completo sin ningún costo* — de *8am a 7pm*, usas todo como si ya fuera tu oficina. Solo di que eres invitada/o de Aluna en recepción 🏢✨

Sin compromiso, solo para que lo vivas. ¿Cuándo te quedaría bien?`;
}

/**
 * 💌 Genera mensaje de follow-up 3 días para Aluna
 */
function buildAluna3dMessage(prospect) {
  const name = (prospect.user_name || '').split(' ')[0] || 'Hola';
  const plan = prospect.membership_type ? `*${prospect.membership_type}*` : 'una membresía';
  return `Hola ${name} 👋

¿Cómo estás? Hace unos días charlamos sobre ${plan} y quería hacer un último intento antes de cerrar tu expediente 😊

*Mi propuesta concreta:* ven a Coworkia un día completo, completamente gratis.

📍 *Tu día de prueba:*
• Sin costo, sin restricciones de horario
• De *8am a 7pm* — usas todo el espacio
• Hot desk, WiFi ultra rápido, café, locker, sala de reuniones
• Solo di en recepción que eres invitada/o de Aluna 🏢

Es mi invitación personal para que lo vivas y decidas con info de primera mano.

¿Qué día de esta semana te queda bien? 🗓️

_(Si ya tomaste otra decisión o las circunstancias cambiaron, no hay problema — aquí estaré cuando lo necesites 😊)_`;
}

/**
 * 📤 Envía mensaje Aluna y registra en interactions
 */
async function sendAlunaFollowUpMessage(prospect, message, followUpType) {
  try {
    const WASSENGER_TOKEN = process.env.WASSENGER_TOKEN;
    const WASSENGER_DEVICE_ID = process.env.WASSENGER_DEVICE_ID;

    if (!WASSENGER_TOKEN || !WASSENGER_DEVICE_ID) {
      console.error('[ALUNA-FOLLOWUP] ❌ Credenciales Wassenger no configuradas');
      return false;
    }

    // Wassenger rechaza (400) números sin código de país, ej. 0987423072
    const targetPhone = normalizePhoneEC(prospect.user_phone);
    if (!targetPhone) {
      console.warn(`[ALUNA-FOLLOWUP] ⚠️ Teléfono inválido, se omite envío: ${prospect.user_phone}`);
      return false;
    }

    const response = await fetch('https://api.wassenger.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Token': WASSENGER_TOKEN },
      body: JSON.stringify({
        phone: targetPhone,
        message,
        device: WASSENGER_DEVICE_ID
      })
    });

    if (!response.ok) throw new Error(`Wassenger error: ${response.status}`);

    console.log(`[ALUNA-FOLLOWUP] ✅ ${followUpType} enviado a ${prospect.user_phone}`);

    await databaseService.run(
      `INSERT INTO interactions (
        user_phone, agent, agent_name, intent_reason, input, output, meta
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        prospect.user_phone,
        'aluna',
        'Aluna - Closer Membresías',
        `aluna_followup_${followUpType}`,
        '',
        message,
        JSON.stringify({ automatic: true, followUp: true, type: followUpType, timestamp: new Date().toISOString() })
      ]
    );
    return true;
  } catch (err) {
    console.error(`[ALUNA-FOLLOWUP] ❌ Error enviando a ${prospect.user_phone}:`, err.message);
    return false;
  }
}

/**
 * 🌙 Proceso principal de follow-up Aluna (24h + 3 días)
 * Corre cada 30 min desde el cron. Respeta horario 8am-7pm Ecuador.
 */
export async function processAlunaLeadFollowUps() {
  console.log('[ALUNA-FOLLOWUP] 🚀 Iniciando verificación de prospectos Aluna...');

  if (!isWithinAlunaFollowUpHours()) {
    console.log('[ALUNA-FOLLOWUP] ⏸️ Fuera de horario (8am-7pm). Saltando ejecución.');
    return { sent24h: 0, sent3d: 0, skipped: 0 };
  }

  let sent24h = 0, sent3d = 0, skipped = 0;

  // ── RONDA 1: Follow-up de 24 horas ──────────────────────────────────────
  const prospects24h = await findProspectsFor24hFollowUp();
  console.log(`[ALUNA-FOLLOWUP] 🔍 Prospectos para 24h: ${prospects24h.length}`);

  for (const prospect of prospects24h) {
    try {
      const message = buildAluna24hMessage(prospect);
      const ok = await sendAlunaFollowUpMessage(prospect, message, '24h');
      if (ok) {
        await markProspect24hSent(prospect.user_phone);
        sent24h++;
        // Email simultáneo si tiene email registrado
        if (prospect.email) {
          const expiryDate = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'long' }); })();
          try {
            const html = generateAlunaFollowup2HTML({ userName: prospect.user_name, membershipType: prospect.membership_type, membershipCode: prospect.membership_code, expiryDate });
            await sendEmail({ to: prospect.email, subject: `🔥 ${(prospect.user_name||'').split(' ')[0]}, 15% adicional reservado para ti — vence en 7 días`, html, from: { name: AGENT_FROM_NAMES.aluna, address: DEFAULT_FROM_EMAIL } });
            await markProspect24hEmailSent(prospect.user_phone);
            console.log(`[ALUNA-FOLLOWUP] 📧 Email oferta 24h enviado a ${prospect.email}`);
          } catch (emailErr) { console.warn('[ALUNA-FOLLOWUP] ⚠️ Email 24h falló (no crítico):', emailErr.message); }
        }
        await new Promise(r => setTimeout(r, 2000)); // pausa entre mensajes
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[ALUNA-FOLLOWUP] ❌ Error 24h ${prospect.user_phone}:`, err.message);
      skipped++;
    }
  }

  // ── RONDA 2: Follow-up de 3 días ─────────────────────────────────────────
  const prospects3d = await findProspectsFor3dFollowUp();
  console.log(`[ALUNA-FOLLOWUP] 🔍 Prospectos para 3d: ${prospects3d.length}`);

  for (const prospect of prospects3d) {
    try {
      const message = buildAluna3dMessage(prospect);
      const ok = await sendAlunaFollowUpMessage(prospect, message, '3d');
      if (ok) {
        await markProspect3dSent(prospect.user_phone);
        sent3d++;
        // Email FOMO simultáneo si tiene email registrado
        if (prospect.email) {
          try {
            const html = generateAlunaFollowup3HTML({ userName: prospect.user_name, membershipType: prospect.membership_type, membershipCode: prospect.membership_code });
            await sendEmail({ to: prospect.email, subject: `⏰ ${(prospect.user_name||'').split(' ')[0]}, hoy es el último día — oferta cierra a medianoche`, html, from: { name: AGENT_FROM_NAMES.aluna, address: DEFAULT_FROM_EMAIL } });
            await markProspect3dEmailSent(prospect.user_phone);
            console.log(`[ALUNA-FOLLOWUP] 📧 Email FOMO enviado a ${prospect.email}`);
          } catch (emailErr) { console.warn('[ALUNA-FOLLOWUP] ⚠️ Email 3d falló (no crítico):', emailErr.message); }
        }
        await new Promise(r => setTimeout(r, 2000));
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[ALUNA-FOLLOWUP] ❌ Error 3d ${prospect.user_phone}:`, err.message);
      skipped++;
    }
  }

  console.log(`[ALUNA-FOLLOWUP] 📊 Resumen: ${sent24h} enviados (24h), ${sent3d} enviados (3d), ${skipped} saltados`);
  return { sent24h, sent3d, skipped };
}

/**
 * 🚀 Proceso principal de follow-up
 * Ejecuta cada 30 minutos, envía UNA vez después de 2h de iniciar transacción
 */
export async function processFollowUps() {
  console.log('[FOLLOW-UP] 🚀 Iniciando verificación de transacciones pendientes...');
  
  // 1. Verificar horario permitido
  if (!isWithinAllowedHours()) {
    console.log('[FOLLOW-UP] ⏸️ Fuera de horario permitido (6am-10pm Ecuador). Saltando ejecución.');
    return { processed: 0, sent: 0, skipped: 0 };
  }
  
  // 2. Buscar usuarios que necesitan follow-up
  const usersNeedingFollowUp = await findUsersNeedingFollowUp();
  
  if (usersNeedingFollowUp.length === 0) {
    console.log('[FOLLOW-UP] ✅ No hay transacciones que requieran seguimiento');
    return { processed: 0, sent: 0, skipped: 0 };
  }
  
  let sent = 0;
  let skipped = 0;
  
  // 3. Procesar cada usuario
  for (const user of usersNeedingFollowUp) {
    try {
      // Generar mensaje según agente
      const message = generateFollowUpMessage(user);
      
      // Enviar mensaje
      const success = await sendFollowUpMessage(
        user.phone_number, 
        message, 
        user.transaction_agent || user.active_agent
      );
      
      if (success) {
        sent++;
        // Pausa entre mensajes
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`[FOLLOW-UP] ❌ Error procesando ${user.phone_number}:`, error);
      skipped++;
    }
  }
  
  console.log(`[FOLLOW-UP] 📊 Resumen: ${sent} enviados, ${skipped} saltados de ${usersNeedingFollowUp.length} encontrados`);
  
  return {
    processed: usersNeedingFollowUp.length,
    sent,
    skipped
  };
}

/**
 * 💌 Genera mensaje de recordatorio de renovación día 25 (5 días antes)
 */
function buildRenewalReminder1Message(member) {
  const name = (member.client_name || '').split(' ')[0] || 'Hola';
  const plan = member.membership_type ? `*${member.membership_type}*` : 'tu membresía';
  return `Hola ${name} 🌙 Tu ${plan} vence en 5 días. Cuando quieras renovar, me avisas y te ayudo con todo 😊`;
}

/**
 * 💌 Genera mensaje de recordatorio de vencimiento día 30
 */
function buildRenewalReminder2Message(member) {
  const name = (member.client_name || '').split(' ')[0] || 'Hola';
  const plan = member.membership_type ? `*${member.membership_type}*` : 'tu membresía';
  return `Hola ${name} 🌟 Hoy se cumple el mes de tu ${plan}. ¿Todo listo para renovar? Cuando digas, estoy aquí ✨`;
}

/**
 * 🚨 Genera mensaje de último recordatorio (1 día antes)
 */
function buildRenewalFinalReminderMessage(member) {
  const name = (member.client_name || '').split(' ')[0] || 'Hola';
  const plan = member.membership_type ? `*${member.membership_type}*` : 'tu membresía';
  return `Hola ${name} ⏰ Tu ${plan} vence *mañana*. Renueva hoy y mantén tu espacio asegurado. ¿Te ayudo con la renovación? 🙌`;
}

/**
 * 📤 Envía recordatorio de renovación y registra en interactions
 */
async function sendRenewalReminderMessage(member, message, reminderType) {
  try {
    const WASSENGER_TOKEN = process.env.WASSENGER_TOKEN;
    const WASSENGER_DEVICE_ID = process.env.WASSENGER_DEVICE_ID;

    if (!WASSENGER_TOKEN || !WASSENGER_DEVICE_ID) {
      console.error('[ALUNA-RENEWAL] ❌ Credenciales Wassenger no configuradas');
      return false;
    }

    // Wassenger rechaza (400) números sin código de país, ej. 0987423072
    const targetPhone = normalizePhoneEC(member.user_phone);
    if (!targetPhone) {
      console.warn(`[ALUNA-RENEWAL] ⚠️ Teléfono inválido, se omite envío: ${member.user_phone}`);
      return false;
    }

    const response = await fetch('https://api.wassenger.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Token': WASSENGER_TOKEN },
      body: JSON.stringify({
        phone: targetPhone,
        message,
        device: WASSENGER_DEVICE_ID
      })
    });

    if (!response.ok) throw new Error(`Wassenger error: ${response.status}`);

    console.log(`[ALUNA-RENEWAL] ✅ ${reminderType} enviado a ${member.user_phone}`);

    await databaseService.run(
      `INSERT INTO interactions (
        user_phone, agent, agent_name, intent_reason, input, output, meta
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        member.user_phone,
        'aluna',
        'Aluna - Closer Membresías',
        `renewal_reminder_${reminderType}`,
        '',
        message,
        JSON.stringify({ automatic: true, followUp: true, type: `renewal_${reminderType}`, timestamp: new Date().toISOString() })
      ]
    );
    return true;
  } catch (err) {
    console.error(`[ALUNA-RENEWAL] ❌ Error enviando a ${member.user_phone}:`, err.message);
    return false;
  }
}

/**
 * 🌙 Proceso de recordatorios de renovación de membresías (día 25 y día 30)
 * Corre diariamente a las 9:00am Ecuador.
 */
export async function processMembershipRenewalReminders() {
  console.log('[ALUNA-RENEWAL] 🚀 Iniciando recordatorios de renovación de membresías...');

  let sent1 = 0, sent2 = 0, skipped = 0;

  // ── RONDA 1: Recordatorio 5 días antes (día 25) ─────────────────────────
  const members1 = await findMembersForRenewalReminder1();
  console.log(`[ALUNA-RENEWAL] 🔍 Miembros para recordatorio 1 (día 25): ${members1.length}`);

  for (const member of members1) {
    try {
      const message = buildRenewalReminder1Message(member);
      const ok = await sendRenewalReminderMessage(member, message, '1');
      if (ok) {
        await markRenewalReminder1Sent(member.id);
        sent1++;
        await new Promise(r => setTimeout(r, 2000));
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[ALUNA-RENEWAL] ❌ Error reminder1 ${member.user_phone}:`, err.message);
      skipped++;
    }
  }

  // ── RONDA 2: Recordatorio de vencimiento (día 30) ────────────────────────
  const members2 = await findMembersForRenewalReminder2();
  console.log(`[ALUNA-RENEWAL] 🔍 Miembros para recordatorio 2 (día 30): ${members2.length}`);

  for (const member of members2) {
    try {
      const message = buildRenewalReminder2Message(member);
      const ok = await sendRenewalReminderMessage(member, message, '2');
      if (ok) {
        await markRenewalReminder2Sent(member.id);
        sent2++;
        await new Promise(r => setTimeout(r, 2000));
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[ALUNA-RENEWAL] ❌ Error reminder2 ${member.user_phone}:`, err.message);
      skipped++;
    }
  }

  // ── RONDA 3: Recordatorio 1 día antes (WA + Email HTML) ───────────────
  let sent3 = 0;
  const members3 = await findMembersExpiringTomorrow();
  console.log(`[ALUNA-RENEWAL] 🔍 Miembros expirando mañana (1 día antes): ${members3.length}`);

  for (const member of members3) {
    try {
      // WhatsApp
      const waMessage = buildRenewalFinalReminderMessage(member);
      const waOk = await sendRenewalReminderMessage(member, waMessage, 'final');

      // Email HTML con upsale
      if (member.email) {
        const firstName = (member.client_name || '').split(' ')[0] || 'Hola';
        const html = buildEmailTemplate('ALUNA', 'RENEWAL', {
          name: member.client_name || firstName,
          plan: member.membership_type || 'tu plan',
          expirationDate: member.expiration_date,
          monthlyFee: member.monthly_fee
        }, { xiaomiSafe: true });
        await sendEmail({
          to: member.email,
          subject: `⏰ ${firstName}, tu membresía vence mañana — renueva con beneficio`,
          html,
          from: { name: AGENT_FROM_NAMES.aluna, address: DEFAULT_FROM_EMAIL }
        });
        console.log(`[ALUNA-RENEWAL] 📧 Email renovación enviado a ${member.email}`);
      }

      if (waOk) {
        await markRenewalReminder2Sent(member.id); // reuse marker for final
        sent3++;
        await new Promise(r => setTimeout(r, 2000));
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[ALUNA-RENEWAL] ❌ Error reminder final ${member.user_phone}:`, err.message);
      skipped++;
    }
  }

  console.log(`[ALUNA-RENEWAL] 📊 Resumen: ${sent1} enviados (día 25), ${sent2} enviados (día 30), ${sent3} enviados (1 día antes), ${skipped} saltados`);
  return { sent1, sent2, sent3, skipped };
}

/**
 * 💬 Genera mensaje de sugerencia de re-reserva para AURORA
 */
function buildRebookReminderMessage(reservation) {
  const name = (reservation.user_name || '').split(' ')[0] || 'Hola';
  const serviceLabel = reservation.service_type === 'meetingRoom' ? '*Sala de Reuniones*' : '*Hot Desk*';

  // Día de semana de la reserva original en español
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const reservationDate = new Date(reservation.date + 'T12:00:00'); // mediodía para evitar desfases de zona
  const dayName = days[reservationDate.getDay()];

  return `Hola ${name} 👋 La semana pasada reservaste el ${serviceLabel} el ${dayName}. ¿Lo agendamos para esta semana también? Solo dime y lo dejamos listo 😊`;
}

/**
 * 📤 Envía recordatorio de re-reserva y registra en interactions
 */
async function sendRebookReminderMessage(reservation, message) {
  try {
    const WASSENGER_TOKEN = process.env.WASSENGER_TOKEN;
    const WASSENGER_DEVICE_ID = process.env.WASSENGER_DEVICE_ID;

    if (!WASSENGER_TOKEN || !WASSENGER_DEVICE_ID) {
      console.error('[AURORA-REBOOK] ❌ Credenciales Wassenger no configuradas');
      return false;
    }

    // Wassenger rechaza (400) números sin código de país, ej. 0987423072
    const targetPhone = normalizePhoneEC(reservation.user_phone);
    if (!targetPhone) {
      console.warn(`[AURORA-REBOOK] ⚠️ Teléfono inválido, se omite envío: ${reservation.user_phone}`);
      return false;
    }

    const response = await fetch('https://api.wassenger.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Token': WASSENGER_TOKEN },
      body: JSON.stringify({
        phone: targetPhone,
        message,
        device: WASSENGER_DEVICE_ID
      })
    });

    if (!response.ok) throw new Error(`Wassenger error: ${response.status}`);

    console.log(`[AURORA-REBOOK] ✅ Recordatorio enviado a ${reservation.user_phone}`);

    await databaseService.run(
      `INSERT INTO interactions (
        user_phone, agent, agent_name, intent_reason, input, output, meta
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        reservation.user_phone,
        'aurora',
        'Aurora - Coworkia',
        'rebook_weekly_reminder',
        '',
        message,
        JSON.stringify({
          automatic: true,
          followUp: true,
          type: 'rebook_weekly_reminder',
          reservationId: reservation.id,
          timestamp: new Date().toISOString()
        })
      ]
    );
    return true;
  } catch (err) {
    console.error(`[AURORA-REBOOK] ❌ Error enviando a ${reservation.user_phone}:`, err.message);
    return false;
  }
}

/**
 * 🏢 Proceso de recordatorios de re-reserva semanal (AURORA)
 * Corre diariamente a las 5:00pm Ecuador.
 * Busca reservas de hace 7 días y sugiere repetir en la misma semana.
 */
export async function processAuroraRebookReminders() {
  console.log('[AURORA-REBOOK] 🚀 Iniciando recordatorios de re-reserva semanal...');

  let sent = 0, skipped = 0;

  const reservations = await reservationRepository.findReservationsForRebookReminder();
  console.log(`[AURORA-REBOOK] 🔍 Reservas candidatas: ${reservations.length}`);

  for (const reservation of reservations) {
    try {
      const message = buildRebookReminderMessage(reservation);
      const ok = await sendRebookReminderMessage(reservation, message);
      if (ok) {
        await reservationRepository.markRebookReminderSent(reservation.id);
        sent++;
        await new Promise(r => setTimeout(r, 2000));
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[AURORA-REBOOK] ❌ Error ${reservation.user_phone}:`, err.message);
      skipped++;
    }
  }

  console.log(`[AURORA-REBOOK] 📊 Resumen: ${sent} enviados, ${skipped} saltados`);
  return { sent, skipped };
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔔 AXEL — Recordatorios automáticos de cotizaciones PaintBull
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⏰ Verifica horario permitido para recordatorios Axel (9am-6pm Ecuador, lun-vie)
 */
function isWithinAxelReminderHours() {
  const now = new Date();
  const ec = new Date(now.toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
  const hour = ec.getHours();
  const day = ec.getDay(); // 0=dom, 6=sáb
  const isWeekday = day >= 1 && day <= 5;
  const isAllowed = isWeekday && hour >= 9 && hour < 18;
  console.log(`[AXEL-REMINDER] ⏰ Hora Ecuador: ${ec.toLocaleTimeString('es-EC')} día ${day} — Permitido: ${isAllowed}`);
  return isAllowed;
}

/**
 * 🚗 Proceso de recordatorios para cotizaciones Axel (24h + 7 días)
 * Solo envía email — respeta horario 9am-6pm lun-vie Ecuador.
 * No envía si el cliente ya agendó inspección.
 */
export async function processAxelQuoteReminders() {
  console.log('[AXEL-REMINDER] 🚀 Iniciando recordatorios de cotizaciones PaintBull...');

  if (!isWithinAxelReminderHours()) {
    console.log('[AXEL-REMINDER] ⏸️ Fuera de horario (9am-6pm lun-vie). Saltando.');
    return { sent1: 0, sent2: 0, skipped: 0 };
  }

  let sent1 = 0, sent2 = 0, skipped = 0;

  // ── RONDA 1: Recordatorio 24h ─────────────────────────────────────────────
  const quotes24h = await findQuotesForReminder1();
  console.log(`[AXEL-REMINDER] 🔍 Cotizaciones para recordatorio 24h: ${quotes24h.length}`);

  for (const q of quotes24h) {
    try {
      const result = await sendAxelReminderEmail({
        type: 1,
        customerEmail: q.email,
        customerName: q.client_name,
        vehicleData: { brand: q.vehicle_brand, model: q.vehicle_model, year: q.vehicle_year },
        quoteCode: q.quote_code,
        priceRange: { min: q.price_min, max: q.price_max }
      });
      if (result.success) {
        await markReminder1Sent(q.quote_code);
        sent1++;
        await new Promise(r => setTimeout(r, 1500));
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[AXEL-REMINDER] ❌ Error 24h ${q.quote_code}:`, err.message);
      skipped++;
    }
  }

  // ── RONDA 2: Recordatorio 7 días ─────────────────────────────────────────
  const quotes7d = await findQuotesForReminder2();
  console.log(`[AXEL-REMINDER] 🔍 Cotizaciones para recordatorio 7d: ${quotes7d.length}`);

  for (const q of quotes7d) {
    try {
      const result = await sendAxelReminderEmail({
        type: 2,
        customerEmail: q.email,
        customerName: q.client_name,
        vehicleData: { brand: q.vehicle_brand, model: q.vehicle_model, year: q.vehicle_year },
        quoteCode: q.quote_code,
        priceRange: { min: q.price_min, max: q.price_max }
      });
      if (result.success) {
        await markReminder2Sent(q.quote_code);
        sent2++;
        await new Promise(r => setTimeout(r, 1500));
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[AXEL-REMINDER] ❌ Error 7d ${q.quote_code}:`, err.message);
      skipped++;
    }
  }

  console.log(`[AXEL-REMINDER] 📊 Resumen: ${sent1} enviados (24h), ${sent2} enviados (7d), ${skipped} saltados`);
  return { sent1, sent2, skipped };
}
