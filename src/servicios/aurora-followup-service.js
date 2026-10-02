/**
 * 🌟 Aurora Follow-up Service
 * Automatización de seguimientos post-reserva
 *
 * FLUJO:
 * - +1h: Confirmación cálida post-reserva (agradecimiento)
 * - D+7: Re-booking (invitar a volver)
 *
 * CRON JOBS (en index.js):
 * - Cada 15 min: check +1h followup
 * - 10:00 AM ECT: check D+7 re-booking
 */

import { enviarWhatsApp } from '../express-servidor/endpoints-api/wassenger.js';
import { sendEmail } from '../servicios/email.js';
import { buildEmailTemplate } from '../servicios/email-template-system.js';
import databaseService from '../database/database.js';
import { COWORKIA_ADDRESS, COWORKIA_MAPS_URL } from '../utils/constants.js';
import { getServiceLabel } from '../utils/service-labels.js';
import { formatHotDeskNumbers, normalizeHotDeskNumbers } from '../utils/hot-desk-assignments.js';
import {
  findReservationsForOneHourFollowup,
  markFollowup1hSent,
  findReservationsForRebookingReminder,
  markRebookReminderSent
} from '../database/auroraRepository.js';
import { loggers } from '../utils/logger.js';
import { getUserPreferredLanguage } from '../perfiles-interacciones/memoria-sqlite.js';
import { validateEmail } from '../utils/email-validator.js';
import { CONTACT, HOURS, LOCATION, MEMBERSHIP_PLANS, WIFI } from '../utils/coworkia-facts.js';
import {
  findDueAutomationBatches,
  processAutomationBatch,
} from './automation-delivery-service.js';

const logger = loggers.aurora || console;
const AUTOMATION_LANGUAGES = ['es', 'en', 'fr', 'it', 'pt', 'qu'];

function normalizeAutomationLanguage(lang) {
  return AUTOMATION_LANGUAGES.includes(lang) ? lang : 'es';
}

async function getAutomationLanguage(phone) {
  try {
    return normalizeAutomationLanguage(await getUserPreferredLanguage(phone));
  } catch {
    return 'es';
  }
}

function getLocalizedServiceLabel(type, lang = 'es') {
  const labels = {
    hotDesk: { es: 'Hot Desk', en: 'Hot Desk', fr: 'Hot Desk', it: 'Hot Desk', pt: 'Hot Desk', qu: 'Hot Desk' },
    hot_desk: { es: 'Hot Desk', en: 'Hot Desk', fr: 'Hot Desk', it: 'Hot Desk', pt: 'Hot Desk', qu: 'Hot Desk' },
    meetingRoom: { es: 'Sala de Reuniones', en: 'Meeting Room', fr: 'Salle de réunion', it: 'Sala riunioni', pt: 'Sala de reunião', qu: 'Sala de Reuniones' },
    meeting_room: { es: 'Sala de Reuniones', en: 'Meeting Room', fr: 'Salle de réunion', it: 'Sala riunioni', pt: 'Sala de reunião', qu: 'Sala de Reuniones' },
    salaReuniones: { es: 'Sala de Reuniones', en: 'Meeting Room', fr: 'Salle de réunion', it: 'Sala riunioni', pt: 'Sala de reunião', qu: 'Sala de Reuniones' },
    sala_reunion: { es: 'Sala de Reuniones', en: 'Meeting Room', fr: 'Salle de réunion', it: 'Sala riunioni', pt: 'Sala de reunião', qu: 'Sala de Reuniones' },
    deskIndividual: { es: 'Escritorio Individual', en: 'Individual Desk', fr: 'Bureau individuel', it: 'Scrivania individuale', pt: 'Mesa individual', qu: 'Escritorio Individual' },
    privateOffice: { es: 'Oficina Privada', en: 'Private Office', fr: 'Bureau privé', it: 'Ufficio privato', pt: 'Escritório privado', qu: 'Oficina Privada' },
    private_office: { es: 'Oficina Privada', en: 'Private Office', fr: 'Bureau privé', it: 'Ufficio privato', pt: 'Escritório privado', qu: 'Oficina Privada' },
    oficina_privada: { es: 'Oficina Privada', en: 'Private Office', fr: 'Bureau privé', it: 'Ufficio privato', pt: 'Escritório privado', qu: 'Oficina Privada' },
    evento: { es: 'Evento', en: 'Event Space', fr: 'Espace événementiel', it: 'Spazio eventi', pt: 'Espaço para eventos', qu: 'Evento' },
    coworking: { es: 'Espacio Coworking', en: 'Coworking Space', fr: 'Espace de coworking', it: 'Spazio coworking', pt: 'Espaço de coworking', qu: 'Espacio Coworking' },
  };
  return labels[type]?.[lang] ?? labels[type]?.es ?? getServiceLabel(type);
}

function getLocalizedServiceQuestion(type, lang = 'es') {
  const meetingRoom = {
    es: '¿Tu reunión fue un éxito? 🎯',
    en: 'Was your meeting a success? 🎯',
    fr: 'Votre réunion a-t-elle été un succès? 🎯',
    it: 'La tua riunione è andata bene? 🎯',
    pt: 'Sua reunião foi um sucesso? 🎯',
    qu: '¿Tu reunión fue un éxito? 🎯',
  };
  const workspace = {
    es: '¿Tuviste un día productivo? 💪',
    en: 'Was it a productive day? 💪',
    fr: 'Avez-vous eu une journée productive? 💪',
    it: 'È stata una giornata produttiva? 💪',
    pt: 'Foi um dia produtivo? 💪',
    qu: '¿Tuviste un día productivo? 💪',
  };
  const isMeetingRoom = ['meeting_room', 'meetingRoom', 'sala_reunion', 'salaReuniones'].includes(type);
  return (isMeetingRoom ? meetingRoom : workspace)[lang] ?? workspace.es;
}

function getD3FomoLine({ wasFree, serviceType, lang = 'es' }) {
  const isMeetingRoom = ['meeting_room', 'meetingRoom', 'sala_reunion', 'salaReuniones'].includes(serviceType);
  const type = wasFree ? 'free' : isMeetingRoom ? 'meeting' : 'membership';
  const lines = {
    free: {
      es: '🎁 Esperamos que hayas disfrutado tu primera visita. Puedo ayudarte a reservar nuevamente.',
      en: '🎁 We hope you enjoyed your first visit. I can help you book again.',
      fr: '🎁 Nous espérons que vous avez apprécié votre première visite. Je peux vous aider à réserver à nouveau.',
      it: '🎁 Speriamo che la tua prima visita ti sia piaciuta. Posso aiutarti a prenotare di nuovo.',
      pt: '🎁 Esperamos que tenha gostado da sua primeira visita. Posso ajudar você a reservar novamente.',
      qu: '🎁 Esperamos que hayas disfrutado tu primera visita. Puedo ayudarte a reservar de nuevo.',
    },
    meeting: {
      es: '👥 ¿Tienes otra reunión pendiente? Salas disponibles esta semana con horarios flexibles.',
      en: '👥 Do you have another meeting coming up? Meeting rooms are available this week with flexible times.',
      fr: '👥 Avez-vous une autre réunion prévue? Des salles sont disponibles cette semaine avec des horaires flexibles.',
      it: '👥 Hai un’altra riunione in arrivo? Sale disponibili questa settimana con orari flessibili.',
      pt: '👥 Tem outra reunião em breve? Salas disponíveis esta semana com horários flexíveis.',
      qu: '👥 ¿Tienes otra reunión pendiente? Hay salas disponibles esta semana.',
    },
    membership: {
      es: '💡 Si vienes con frecuencia, pregúntame por los planes de *Membresía Coworkia*.',
      en: '💡 If you visit often, ask me about *Coworkia Membership* plans.',
      fr: '💡 Si vous venez souvent, demandez-moi les formules d’abonnement Coworkia.',
      it: '💡 Se vieni spesso, chiedimi dei piani di abbonamento Coworkia.',
      pt: '💡 Se você vem com frequência, pergunte sobre os planos de assinatura Coworkia.',
      qu: '💡 Si vienes con frecuencia, pregúntame por las membresías Coworkia.',
    },
  };
  return lines[type][lang] ?? lines[type].es;
}

function whatsappDelivery(recipient, message) {
  return { channel: 'whatsapp', recipient, payload: { recipient, message } };
}

function emailDelivery(recipient, subject, html) {
  return {
    channel: 'email',
    recipient,
    payload: { to: recipient, subject, html, agent: 'aurora' },
  };
}

async function dispatchAutomationDelivery(delivery) {
  const payload = typeof delivery.payload === 'string'
    ? JSON.parse(delivery.payload)
    : delivery.payload;
  if (delivery.channel === 'whatsapp') {
    return enviarWhatsApp(payload.recipient, payload.message);
  }
  if (delivery.channel === 'email') {
    return sendEmail(payload);
  }
  throw new Error('Unsupported automation delivery channel');
}

async function deliverReservationAutomation(record, automationKey, legacyColumn, deliveries = null) {
  return processAutomationBatch({
    entityId: record.id || record.last_reservation_id,
    automationKey,
    legacyColumn,
    deliveries,
    dispatch: dispatchAutomationDelivery,
  });
}

/**
 * 🚫 No enviar automatizaciones a teléfonos internos definidos por configuración.
 */
function isInternalPhone(phone) {
  if (!phone) return false;
  const norm = String(phone).replace(/\D/g, '');
  const adminNorm = (process.env.ADMIN_PHONE || '').replace(/\D/g, '');
  const diegoNorm = (process.env.DIEGO_PERSONAL_PHONE || '').replace(/\D/g, '');
  return (adminNorm && norm === adminNorm) || (diegoNorm && norm === diegoNorm);
}

function describeAutomationTarget(record) {
  const id = record?.id || record?.last_reservation_id;
  return id ? `reserva ${id}` : 'contacto sin id';
}

function shouldSkipInternalAutomation(record, scope) {
  if (!isInternalPhone(record?.user_phone)) return false;
  logger.info(`[${scope}] ⏭️ Saltando contacto interno (${describeAutomationTarget(record)})`);
  return true;
}

// ─────────────────────────────────────────────────────────────
// FOLLOW-UP +1H POST-RESERVA
// ─────────────────────────────────────────────────────────────

/**
 * Envía mensajes de confirmación 1 hora después de reservar
 * Se llama desde cron cada 15 min
 */
export async function sendOneHourFollowups() {
  logger.info('[AURORA-FOLLOWUP] 🔔 Iniciando follow-ups +1h...');

  try {
    const reservations = await findReservationsForOneHourFollowup();

    if (!reservations || reservations.length === 0) {
      logger.info('[AURORA-FOLLOWUP] ℹ️ Sin reservas para +1h followup');
      return { success: true, sent: 0 };
    }

    logger.info(`[AURORA-FOLLOWUP] 📊 ${reservations.length} reservas para +1h`);

    let sent = 0;
    let errors = 0;

    for (const reservation of reservations) {
      try {
        if (shouldSkipInternalAutomation(reservation, 'AURORA-FOLLOWUP')) {
          await markFollowup1hSent(reservation.id);
          continue;
        }
        const waMessage = buildOneHourWhatsApp(reservation);
        const delivery = await deliverReservationAutomation(
          reservation,
          'aurora_followup_1h',
          'followup_1h_sent_at',
          [whatsappDelivery(reservation.user_phone, waMessage)]
        );
        if (delivery.complete) sent++;
        if (delivery.failed) errors++;

        if (delivery.complete) {
          logger.info(`[AURORA-FOLLOWUP] ✅ +1h enviado: ${describeAutomationTarget(reservation)} (${reservation.service_type})`);
        }

        // Delay entre envíos
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (err) {
        errors++;
        logger.error(`[AURORA-FOLLOWUP] ❌ Error +1h (${describeAutomationTarget(reservation)}):`, err);
      }
    }

    logger.info(`[AURORA-FOLLOWUP] ✅ +1h completado: ${sent} enviados, ${errors} errores`);
    return { success: true, sent, errors };

  } catch (err) {
    logger.error('[AURORA-FOLLOWUP] ❌ Error general +1h:', err);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────
// RE-BOOKING D+7
// ─────────────────────────────────────────────────────────────

/**
 * Envía invitación a volver 7 días después de la reserva completada
 * Se llama desde cron una vez al día (10am)
 */
export async function sendRebookingReminders() {
  logger.info('[AURORA-FOLLOWUP] 🔁 Iniciando re-booking D+7...');

  try {
    const reservations = await findReservationsForRebookingReminder();

    if (!reservations || reservations.length === 0) {
      logger.info('[AURORA-FOLLOWUP] ℹ️ Sin reservas para re-booking D+7');
      return { success: true, sent: 0 };
    }

    logger.info(`[AURORA-FOLLOWUP] 📊 ${reservations.length} reservas para D+7`);

    let sent = 0;
    let errors = 0;

    for (const reservation of reservations) {
      try {
        if (shouldSkipInternalAutomation(reservation, 'AURORA-FOLLOWUP')) {
          await markRebookReminderSent(reservation.id);
          continue;
        }
        const waMessage = buildRebookingWhatsApp(reservation);
        const delivery = await deliverReservationAutomation(
          reservation,
          'aurora_rebook_d7',
          'rebook_reminder_sent_at',
          [whatsappDelivery(reservation.user_phone, waMessage)]
        );
        if (delivery.complete) sent++;
        if (delivery.failed) errors++;

        if (delivery.complete) {
          logger.info(`[AURORA-FOLLOWUP] ✅ D+7 enviado: ${describeAutomationTarget(reservation)}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1500));

      } catch (err) {
        errors++;
        logger.error(`[AURORA-FOLLOWUP] ❌ Error D+7 (${describeAutomationTarget(reservation)}):`, err);
      }
    }

    logger.info(`[AURORA-FOLLOWUP] ✅ D+7 completado: ${sent} enviados, ${errors} errores`);
    return { success: true, sent, errors };

  } catch (err) {
    logger.error('[AURORA-FOLLOWUP] ❌ Error general D+7:', err);
    return { success: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────
// TEMPLATES DE MENSAJES
// ─────────────────────────────────────────────────────────────

// getServiceLabel — imported from utils/service-labels.js

// ─────────────────────────────────────────────────────────────
// TRIGGER MANUAL (una reserva específica)
// ─────────────────────────────────────────────────────────────

/**
 * Envía follow-up +1h a una reserva específica (uso manual desde dashboard)
 */
export async function sendOneHourFollowup(reservation) {
  if (shouldSkipInternalAutomation(reservation, 'AURORA-FOLLOWUP')) {
    await markFollowup1hSent(reservation.id);
    return { success: true, skipped: true };
  }
  const waMessage = buildOneHourWhatsApp(reservation);
  const result = await enviarWhatsApp(reservation.user_phone, waMessage);
  if (result?.ok !== true) throw new Error('WhatsApp provider rejected manual follow-up');
  await markFollowup1hSent(reservation.id);
  logger.info(`[AURORA-FOLLOWUP] ✅ +1h manual enviado: ${describeAutomationTarget(reservation)}`);
}

/**
 * Envía recordatorio de re-booking a una reserva específica (uso manual desde dashboard)
 */
export async function sendRebookingReminder(reservation) {
  if (shouldSkipInternalAutomation(reservation, 'AURORA-FOLLOWUP')) {
    await markRebookReminderSent(reservation.id);
    return { success: true, skipped: true };
  }
  const waMessage = buildRebookingWhatsApp(reservation);
  const result = await enviarWhatsApp(reservation.user_phone, waMessage);
  if (result?.ok !== true) throw new Error('WhatsApp provider rejected manual rebooking reminder');
  await markRebookReminderSent(reservation.id);
  logger.info(`[AURORA-FOLLOWUP] ✅ D+7 manual enviado: ${describeAutomationTarget(reservation)}`);
}

function buildOneHourWhatsApp(reservation) {
  const servicio = getServiceLabel(reservation.service_type);
  const fecha = reservation.date
    ? new Date(reservation.date).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'tu fecha reservada';
  const hora = reservation.start_time || '';

  return (
    `@aurora\n✅ Tu reserva en Coworkia está confirmada.\n\n` +
    `📍 *${servicio}*\n` +
    `📅 ${fecha}${hora ? ` a las ${hora}` : ''}\n` +
    (reservation.total_price > 0 ? `💵 $${reservation.total_price}\n` : '') +
    `\n¿Necesitas algo antes de llegar? Estamos aquí para ayudarte 🙌\n\n` +
    `_Coworkia — Espacios que inspiran_`
  );
}

function buildRebookingWhatsApp(reservation) {
  const servicio = getServiceLabel(reservation.service_type);

  return (
    `@aurora\n¡Hola! 👋 Han pasado 7 días desde tu visita a Coworkia.\n\n` +
    `Esperamos que tu experiencia con la *${servicio}* haya sido excelente.\n\n` +
    `¿Tienes un próximo proyecto o reunión? Reservar es fácil:\n` +
    `👉 Escríbeme "quiero reservar" y te ayudo al instante 🚀\n\n` +
    `_Coworkia — Siempre hay una mesa para ti_ ☕`
  );
}

// ─────────────────────────────────────────────────────────────
// MIGRATED FROM OLD aurora-followup-cron.js (Sprint 1 — dedup)
// These 8 functions were unique to the old monolith.
// ─────────────────────────────────────────────────────────────

function formatDateEs(dateStr) {
  const date = new Date(dateStr);
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
}

// getServiceLabelLegacy — replaced by getServiceLabel from utils/service-labels.js
const getServiceLabelLegacy = getServiceLabel;

// ─── Aurora D+1: Feedback post-visit ────────────────────────

export async function sendAuroraD1Followups() {
  logger.info('[AURORA-D1] 📨 Buscando reservas para follow-up D+1...');
  try {
    const reservations = await databaseService.all(`
      SELECT r.id, r.user_phone, r.service_type, r.date, r.start_time,
             u.name AS user_name, u.email AS user_email
      FROM reservations r
      LEFT JOIN users u ON r.user_phone = u.phone_number
      WHERE r.status IN ('confirmed', 'completed')
        AND r.date = CURRENT_DATE - INTERVAL '1 day'
        AND r.followup_d1_sent_at IS NULL
      ORDER BY r.date ASC LIMIT 30
    `);

    if (!reservations.length) {
      logger.info('[AURORA-D1] ℹ️ No hay reservas para D+1');
      return { success: true, sent: 0, errors: 0 };
    }

    let sent = 0, errors = 0;
    for (const r of reservations) {
      try {
        if (shouldSkipInternalAutomation(r, 'AURORA-D1')) {
          await databaseService.run(`UPDATE reservations SET followup_d1_sent_at = NOW() WHERE id = $1`, [r.id]);
          continue;
        }
        const firstName = r.user_name ? r.user_name.split(' ')[0] : 'amig@';
        const userLang = await getAutomationLanguage(r.user_phone);
        const serviceLabel = getLocalizedServiceLabel(r.service_type, userLang);
        const serviceQuestion = getLocalizedServiceQuestion(r.service_type, userLang);

        const D1_MSG = {
          es: `¡Hola ${firstName}! 😊\n\nAyer disfrutaste de tu *${serviceLabel}* en Coworkia. ${serviceQuestion}\n\nTu feedback nos ayuda a mejorar. ¿Qué calificación nos das del 1 al 5? ⭐\n\nY si quieres volver pronto, solo dime y reservo para ti 📅`,
          en: `Hi ${firstName}! 😊\n\nYesterday you enjoyed your *${serviceLabel}* at Coworkia. ${serviceQuestion}\n\nYour feedback helps us improve. How would you rate us from 1 to 5? ⭐\n\nIf you'd like to come back soon, just let me know and I'll book for you 📅`,
          fr: `Bonjour ${firstName}! 😊\n\nHier vous avez profité de votre *${serviceLabel}* chez Coworkia. ${serviceQuestion}\n\nVotre avis nous aide à nous améliorer. Quelle note nous donneriez-vous de 1 à 5? ⭐\n\nSi vous souhaitez revenir bientôt, dites-le moi et je réserve pour vous 📅`,
          it: `Ciao ${firstName}! 😊\n\nIeri hai usufruito della tua *${serviceLabel}* da Coworkia. ${serviceQuestion}\n\nIl tuo feedback ci aiuta a migliorare. Che voto ci dai da 1 a 5? ⭐\n\nSe vuoi tornare presto, dimmelo e prenoto per te 📅`,
          pt: `Olá ${firstName}! 😊\n\nOntem você aproveitou a sua *${serviceLabel}* na Coworkia. ${serviceQuestion}\n\nSeu feedback nos ajuda a melhorar. Que nota nos dá de 1 a 5? ⭐\n\nSe quiser voltar em breve, me avise e faço a reserva 📅`,
          qu: `Napaykullayki ${firstName}! 😊\n\nAyer disfrutaste de tu *${serviceLabel}* en Coworkia. ${serviceQuestion}\n\nTu calificación nos ayuda. ¿Qué nota nos das del 1 al 5? ⭐\n\n¿Quieres volver? Solo avísame 📅`,
        };
        const waMessage = D1_MSG[userLang] ?? D1_MSG.es;
        const deliveries = [whatsappDelivery(r.user_phone, waMessage)];
        if (r.user_email && validateEmail(r.user_email).valid) {
          const html = buildEmailTemplate('AURORA', 'D1', {
            nombre: r.user_name || firstName, servicio: serviceLabel, dia: formatDateEs(r.date)
          });
          deliveries.push(emailDelivery(r.user_email, '¿Cómo estuvo tu experiencia en Coworkia? 🌟', html));
        }
        const delivery = await deliverReservationAutomation(r, 'aurora_d1', 'followup_d1_sent_at', deliveries);
        if (delivery.complete) sent++;
        if (delivery.failed) errors++;
        await new Promise(resolve => setTimeout(resolve, 2500));
      } catch (err) {
        errors++;
        logger.error(`[AURORA-D1] ❌ Error ${describeAutomationTarget(r)}:`, err.message);
      }
    }
    logger.info(`[AURORA-D1] 📊 D+1: ${sent} enviados, ${errors} fallidos`);
    return { success: true, sent, errors };
  } catch (err) {
    logger.error('[AURORA-D1] ❌ Error general:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Aurora D+3: FOMO / upselling suave ─────────────────────

export async function sendAuroraD3Followups() {
  logger.info('[AURORA-D3] 🔥 Buscando reservas para follow-up D+3 FOMO...');
  try {
    const reservations = await databaseService.all(`
      SELECT r.id, r.user_phone, r.service_type, r.date, r.total_price,
             u.name AS user_name, u.email AS user_email
      FROM reservations r
      LEFT JOIN users u ON r.user_phone = u.phone_number
      WHERE r.status IN ('confirmed', 'completed')
        AND r.date BETWEEN CURRENT_DATE - INTERVAL '4 days' AND CURRENT_DATE - INTERVAL '3 days'
        AND r.followup_d3_sent_at IS NULL
        AND r.followup_d1_sent_at IS NOT NULL
      ORDER BY r.date ASC LIMIT 30
    `);

    if (!reservations.length) {
      logger.info('[AURORA-D3] ℹ️ No hay reservas para D+3');
      return { success: true, sent: 0, errors: 0 };
    }

    let sent = 0, errors = 0;
    for (const r of reservations) {
      try {
        if (shouldSkipInternalAutomation(r, 'AURORA-D3')) {
          await databaseService.run(`UPDATE reservations SET followup_d3_sent_at = NOW() WHERE id = $1`, [r.id]);
          continue;
        }
        const firstName = r.user_name ? r.user_name.split(' ')[0] : 'amig@';
        const wasFree = parseFloat(r.total_price || 0) === 0;
        const userLangD3 = await getAutomationLanguage(r.user_phone);
        const serviceLabel = getLocalizedServiceLabel(r.service_type, userLangD3);
        const fomoLine = getD3FomoLine({
          wasFree,
          serviceType: r.service_type,
          lang: userLangD3,
        });
        const D3_MSG = {
          es: `¡Hola ${firstName}! 🚀\n\nHan pasado 3 días desde tu visita a Coworkia. ¿Cuándo vuelves?\n\n${fomoLine}\n\n✅ ${WIFI.display}\n🕐 ${HOURS.display}\n📍 ${LOCATION.addressFull}\n📱 ${CONTACT.phoneDisplay}\n\nSolo dime qué día y hora y reservo para ti 📅`,
          en: `Hi ${firstName}! 🚀\n\nIt's been 3 days since your visit to Coworkia. When are you coming back?\n\n${fomoLine}\n\n✅ ${WIFI.display}\n🕐 ${HOURS.display}\n📍 ${LOCATION.addressFull}\n📱 ${CONTACT.phoneDisplay}\n\nJust tell me what day and time and I'll book for you 📅`,
          fr: `Bonjour ${firstName}! 🚀\n\nCela fait 3 jours depuis votre visite chez Coworkia. Quand revenez-vous?\n\n${fomoLine}\n\n✅ ${WIFI.display}\n🕐 ${HOURS.display}\n📍 ${LOCATION.addressFull}\n📱 ${CONTACT.phoneDisplay}\n\nDites-moi le jour et l'heure et je réserve pour vous 📅`,
          it: `Ciao ${firstName}! 🚀\n\nSono passati 3 giorni dalla tua visita da Coworkia. Quando torni?\n\n${fomoLine}\n\n✅ ${WIFI.display}\n🕐 ${HOURS.display}\n📍 ${LOCATION.addressFull}\n📱 ${CONTACT.phoneDisplay}\n\nDimmi giorno e orario e prenoto per te 📅`,
          pt: `Olá ${firstName}! 🚀\n\nFaz 3 dias desde a sua visita à Coworkia. Quando volta?\n\n${fomoLine}\n\n✅ ${WIFI.display}\n🕐 ${HOURS.display}\n📍 ${LOCATION.addressFull}\n📱 ${CONTACT.phoneDisplay}\n\nMe diga o dia e horário e faço a reserva 📅`,
          qu: `Napaykullayki ${firstName}! 🚀\n\nKinsa punchaumanta Coworkia-pi kashqaykimanta. ¿Cuándo vuelves?\n\n${fomoLine}\n\n✅ ${WIFI.display}\n🕐 ${HOURS.display}\n📍 ${LOCATION.addressFull}\n📱 ${CONTACT.phoneDisplay}\n\nDime el día y hora 📅`,
        };
        const waMessage = D3_MSG[userLangD3] ?? D3_MSG.es;
        const deliveries = [whatsappDelivery(r.user_phone, waMessage)];
        if (r.user_email && validateEmail(r.user_email).valid) {
          const html = buildEmailTemplate('AURORA', 'D3', {
            nombre: r.user_name || firstName, servicio: serviceLabel, wasFree
          });
          const subjectName = (firstName && firstName !== '.' && firstName !== 'amig@' && firstName.length > 1)
            ? `, ${firstName}`
            : '';
          deliveries.push(emailDelivery(r.user_email, `¿Cuándo vuelves a Coworkia${subjectName}? 🚀`, html));
        }
        const delivery = await deliverReservationAutomation(r, 'aurora_d3', 'followup_d3_sent_at', deliveries);
        if (delivery.complete) sent++;
        if (delivery.failed) errors++;
        await new Promise(resolve => setTimeout(resolve, 2500));
      } catch (err) {
        errors++;
        logger.error(`[AURORA-D3] ❌ Error ${describeAutomationTarget(r)}:`, err.message);
      }
    }
    logger.info(`[AURORA-D3] 📊 D+3: ${sent} enviados, ${errors} fallidos`);
    return { success: true, sent, errors };
  } catch (err) {
    logger.error('[AURORA-D3] ❌ Error general:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Recordatorio 24h antes de reserva ──────────────────────

export async function sendAuroraReminder24h() {
  logger.info('[AURORA-24H] 📅 Buscando reservas para recordatorio 24h...');
  try {
    const reservations = await databaseService.all(`
      SELECT r.id, r.user_phone, r.service_type, r.date, r.start_time,
             u.name AS user_name, u.email AS user_email
      FROM reservations r
      LEFT JOIN users u ON r.user_phone = u.phone_number
      WHERE r.status = 'confirmed'
        AND r.date = CURRENT_DATE + INTERVAL '1 day'
        AND r.reminder_24h_sent_at IS NULL
      ORDER BY r.start_time ASC LIMIT 30
    `);

    if (!reservations.length) {
      logger.info('[AURORA-24H] ℹ️ No hay reservas para recordatorio 24h');
      return { success: true, sent: 0, errors: 0 };
    }

    let sent = 0, errors = 0;
    for (const r of reservations) {
      try {
        if (shouldSkipInternalAutomation(r, 'AURORA-24H')) {
          await databaseService.run(`UPDATE reservations SET reminder_24h_sent_at = NOW() WHERE id = $1`, [r.id]);
          continue;
        }
        const serviceLabel = getServiceLabelLegacy(r.service_type);
        const firstName = r.user_name ? r.user_name.split(' ')[0] : 'amig@';

        const waMessage = `¡Hola ${firstName}! 📅\n\nTe recordamos que *mañana* a las *${r.start_time}* tienes tu reserva de *${serviceLabel}* en Coworkia.\n\n📍 *Dirección:* ${COWORKIA_ADDRESS}\n🏙️ Zona segura — acceso directo en planta baja\n📍 ${COWORKIA_MAPS_URL}\n☕ Café incluido\n\n¿Todo listo? Si necesitas cancelar o cambiar la hora, escríbeme y te ayudo 😊`;
        const deliveries = [whatsappDelivery(r.user_phone, waMessage)];
        if (r.user_email && validateEmail(r.user_email).valid) {
          const html = buildEmailTemplate('AURORA', 'REMINDER_24H', {
            nombre: r.user_name || firstName, servicio: serviceLabel,
            dia: formatDateEs(r.date), hora: r.start_time
          });
          deliveries.push(emailDelivery(r.user_email, `📅 Mañana a las ${r.start_time} te esperamos en Coworkia`, html));
        }
        const delivery = await deliverReservationAutomation(r, 'aurora_reminder_24h', 'reminder_24h_sent_at', deliveries);
        if (delivery.complete) sent++;
        if (delivery.failed) errors++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        errors++;
        logger.error(`[AURORA-24H] ❌ Error ${describeAutomationTarget(r)}:`, err.message);
      }
    }
    logger.info(`[AURORA-24H] 📊 24h: ${sent} enviados, ${errors} fallidos`);
    return { success: true, sent, errors };
  } catch (err) {
    logger.error('[AURORA-24H] ❌ Error general:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Recordatorio 2h antes de reserva (solo WA) ────────────

export async function sendAuroraReminder2h() {
  logger.info('[AURORA-2H] 🔔 Buscando reservas para recordatorio 2h...');
  try {
    const reservations = await databaseService.all(`
      SELECT r.id, r.user_phone, r.service_type, r.date, r.start_time,
             u.name AS user_name
      FROM reservations r
      LEFT JOIN users u ON r.user_phone = u.phone_number
      WHERE r.status = 'confirmed'
        AND r.date = CURRENT_DATE
        AND r.start_time::time BETWEEN (NOW() + INTERVAL '1 hour 30 minutes')::time
                                     AND (NOW() + INTERVAL '2 hours 30 minutes')::time
        AND r.reminder_2h_sent_at IS NULL
      ORDER BY r.start_time ASC LIMIT 20
    `);

    if (!reservations.length) {
      logger.info('[AURORA-2H] ℹ️ No hay reservas para recordatorio 2h');
      return { success: true, sent: 0, errors: 0 };
    }

    let sent = 0, errors = 0;
    for (const r of reservations) {
      try {
        if (shouldSkipInternalAutomation(r, 'AURORA-2H')) {
          await databaseService.run(`UPDATE reservations SET reminder_2h_sent_at = NOW() WHERE id = $1`, [r.id]);
          continue;
        }
        const serviceLabel = getServiceLabelLegacy(r.service_type);
        const firstName = r.user_name ? r.user_name.split(' ')[0] : 'amig@';

        const waMessage = `🔔 *¡Recordatorio!* ${firstName}\n\nEn *2 horas* te esperamos en Coworkia para tu *${serviceLabel}* a las *${r.start_time}*.\n\n📍 ${COWORKIA_ADDRESS}\n📍 ${COWORKIA_MAPS_URL}\n\n¡Nos vemos pronto! 😊`;
        const delivery = await deliverReservationAutomation(
          r, 'aurora_reminder_2h', 'reminder_2h_sent_at',
          [whatsappDelivery(r.user_phone, waMessage)]
        );
        if (delivery.complete) sent++;
        if (delivery.failed) errors++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        errors++;
        logger.error(`[AURORA-2H] ❌ Error ${describeAutomationTarget(r)}:`, err.message);
      }
    }
    logger.info(`[AURORA-2H] 📊 2h: ${sent} enviados, ${errors} fallidos`);
    return { success: true, sent, errors };
  } catch (err) {
    logger.error('[AURORA-2H] ❌ Error general:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Recordatorio 10 min antes de reserva (solo WA) ────────

export async function sendAuroraReminder10min() {
  logger.info('[AURORA-10MIN] ⏰ Buscando reservas para recordatorio 10min...');
  try {
    const reservations = await databaseService.all(`
      SELECT r.id, r.user_phone, r.service_type, r.date, r.start_time, r.end_time,
             r.hot_desk_number, r.hot_desk_numbers, r.payment_status, r.total_price,
             u.name AS user_name
      FROM reservations r
      LEFT JOIN users u ON r.user_phone = u.phone_number
      WHERE r.status = 'confirmed'
        AND r.date = CURRENT_DATE
        AND r.start_time::time BETWEEN (NOW() + INTERVAL '5 minutes')::time
                                     AND (NOW() + INTERVAL '15 minutes')::time
        AND r.reminder_10min_sent_at IS NULL
      ORDER BY r.start_time ASC LIMIT 20
    `);

    if (!reservations.length) {
      logger.info('[AURORA-10MIN] ℹ️ No hay reservas para recordatorio 10min');
      return { success: true, sent: 0, errors: 0 };
    }

    let sent = 0, errors = 0;
    for (const r of reservations) {
      try {
        if (shouldSkipInternalAutomation(r, 'AURORA-10MIN')) {
          await databaseService.run(`UPDATE reservations SET reminder_10min_sent_at = NOW() WHERE id = $1`, [r.id]);
          continue;
        }
        const serviceLabel = getServiceLabelLegacy(r.service_type);
        const firstName = r.user_name ? r.user_name.split(' ')[0] : '';
        const assignedDesks = normalizeHotDeskNumbers(r.hot_desk_numbers, r.hot_desk_number);
        const deskInfo = assignedDesks.length
          ? `\n🪑 ${assignedDesks.length > 1 ? 'Tus puestos' : 'Tu puesto'}: *${formatHotDeskNumbers(assignedDesks)}*`
          : '';
        const payInfo = r.payment_status === 'paid'
          ? '\n✅ Pago confirmado'
          : r.total_price > 0
            ? `\n💰 Pago pendiente: $${parseFloat(r.total_price).toFixed(2)} (efectivo al llegar)`
            : '';

        const waMessage = `⏰ *¡${firstName ? firstName + ', f' : 'F'}altan 10 minutos!*\n\nTu *${serviceLabel}* comienza a las *${r.start_time}* ${r.end_time ? `hasta las *${r.end_time}*` : ''}.\n${deskInfo}${payInfo}\n\n📍 *Coworkia Quito*\n${LOCATION.addressFull}\n📍 ${LOCATION.mapsUrl}\n📶 ${WIFI.display}\n📱 ${CONTACT.phoneDisplay}\n\n¡Te esperamos! 😊`;
        const delivery = await deliverReservationAutomation(
          r, 'aurora_reminder_10min', 'reminder_10min_sent_at',
          [whatsappDelivery(r.user_phone, waMessage)]
        );
        if (delivery.complete) sent++;
        if (delivery.failed) errors++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        errors++;
        logger.error(`[AURORA-10MIN] ❌ Error ${describeAutomationTarget(r)}:`, err.message);
      }
    }
    logger.info(`[AURORA-10MIN] 📊 10min: ${sent} enviados, ${errors} fallidos`);
    return { success: true, sent, errors };
  } catch (err) {
    logger.error('[AURORA-10MIN] ❌ Error general:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── No-Show Detection + Re-engagement ──────────────────────

export async function detectAuroraNoShows() {
  logger.info('[AURORA-NOSHOW] 👻 Detectando no-shows...');
  try {
    const noShows = await databaseService.all(`
      SELECT r.id, r.user_phone, r.service_type, r.date, r.start_time, r.total_price,
             u.name AS user_name
      FROM reservations r
      LEFT JOIN users u ON r.user_phone = u.phone_number
      WHERE r.status = 'confirmed'
        AND r.payment_status NOT IN ('paid', 'verified')
        AND (r.date::date + r.start_time::time) < (NOW() - INTERVAL '3 hours')
        AND r.followup_1h_sent_at IS NULL
        AND r.no_show_detected_at IS NULL
        AND r.date >= CURRENT_DATE - INTERVAL '3 days'
      ORDER BY r.date DESC, r.start_time DESC LIMIT 20
    `);

    if (!noShows.length) {
      logger.info('[AURORA-NOSHOW] ℹ️ No se detectaron no-shows');
      return { success: true, sent: 0 };
    }

    let sent = 0;
    for (const r of noShows) {
      try {
        if (shouldSkipInternalAutomation(r, 'AURORA-NOSHOW')) {
          await databaseService.run(`UPDATE reservations SET no_show_detected_at = NOW() WHERE id = $1`, [r.id]);
          continue;
        }
        const firstName = r.user_name ? r.user_name.split(' ')[0] : 'amig@';

        const waMessage = `Hola ${firstName} 👋\n\nNotamos que no pudiste venir a tu reserva en Coworkia. ¡Esperamos que todo esté bien!\n\nNo te preocupes, estas cosas pasan. ¿Te gustaría reagendar para otro día?\n\nSolo dime la fecha y hora que te queden mejor y reservo para ti 😊`;
        const delivery = await deliverReservationAutomation(
          r, 'aurora_no_show', 'no_show_detected_at',
          [whatsappDelivery(r.user_phone, waMessage)]
        );
        if (delivery.complete) sent++;
        await new Promise(resolve => setTimeout(resolve, 2500));
      } catch (err) {
        logger.error(`[AURORA-NOSHOW] ❌ Error ${r.id}:`, err.message);
      }
    }
    logger.info(`[AURORA-NOSHOW] 📊 ${sent} no-shows procesados`);
    return { success: true, sent };
  } catch (err) {
    logger.error('[AURORA-NOSHOW] ❌ Error general:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Upselling: Power Users → Membresía Aluna ──────────────

export async function sendAuroraUpsellAluna() {
  logger.info('[AURORA-UPSELL] 🎯 Buscando power users para upselling...');
  try {
    const powerUsers = await databaseService.all(`
      SELECT r.user_phone, u.name AS user_name, u.email AS user_email,
             COUNT(*) AS total_reservas, SUM(COALESCE(r.total_price, 0)) AS total_gastado,
             MAX(r.id) AS last_reservation_id
      FROM reservations r
      LEFT JOIN users u ON r.user_phone = u.phone_number
      WHERE r.status IN ('confirmed', 'completed')
        AND r.date >= CURRENT_DATE - INTERVAL '30 days'
        AND r.payment_status IN ('paid', 'verified', 'completed')
        AND r.created_at <= NOW() - INTERVAL '24 hours'
      GROUP BY r.user_phone, u.name, u.email
      HAVING COUNT(DISTINCT r.date) >= 4 AND MAX(r.upsell_aluna_sent_at) IS NULL
      ORDER BY SUM(COALESCE(r.total_price, 0)) DESC LIMIT 10
    `);

    if (!powerUsers.length) {
      logger.info('[AURORA-UPSELL] ℹ️ No hay power users para upselling');
      return { success: true, sent: 0 };
    }

    let sent = 0;
    for (const u of powerUsers) {
      try {
        if (shouldSkipInternalAutomation(u, 'AURORA-UPSELL')) {
          await databaseService.run(`UPDATE reservations SET upsell_aluna_sent_at = NOW() WHERE id = $1`, [u.last_reservation_id]);
          continue;
        }
        const firstName = u.user_name ? u.user_name.split(' ')[0] : 'amig@';

        const waMessage = `¡Hola ${firstName}! 🌟\n\nHemos notado que eres un usuario frecuente de Coworkia — *${u.total_reservas} visitas* este mes. ¡Nos encanta tenerte!\n\nAluna puede contarte sobre nuestros planes vigentes:\n• *${MEMBERSHIP_PLANS.plan10.name}:* ${MEMBERSHIP_PLANS.plan10.priceDisplay}\n• *${MEMBERSHIP_PLANS.plan20.name}:* ${MEMBERSHIP_PLANS.plan20.priceDisplay}\n\n🕐 ${HOURS.display}\n📶 ${WIFI.display}\n\n¿Te interesa conocer cuál se ajusta mejor a tu rutina? 📋`;
        const delivery = await deliverReservationAutomation(
          u, 'aurora_upsell_aluna', 'upsell_aluna_sent_at',
          [whatsappDelivery(u.user_phone, waMessage)]
        );
        if (delivery.complete) sent++;
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (err) {
        logger.error(`[AURORA-UPSELL] ❌ Error ${describeAutomationTarget(u)}:`, err.message);
      }
    }
    logger.info(`[AURORA-UPSELL] 📊 ${sent} upsells enviados`);
    return { success: true, sent };
  } catch (err) {
    logger.error('[AURORA-UPSELL] ❌ Error general:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Payment Reminders (pendientes de pago) ─────────────────

export async function sendAuroraPaymentReminders() {
  logger.info('[AURORA-PAY] 💳 Buscando reservas pendientes de pago...');
  try {
    const pending = await databaseService.all(`
      SELECT r.id, r.user_phone, r.service_type, r.date, r.start_time, r.total_price,
             u.name AS user_name
      FROM reservations r
      LEFT JOIN users u ON r.user_phone = u.phone_number
      WHERE r.status = 'confirmed'
        AND r.payment_status IN ('pending', 'pending_efectivo')
        AND r.date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 days'
        AND r.payment_reminder_sent_at IS NULL
        AND r.total_price > 0
      ORDER BY r.date ASC LIMIT 20
    `);

    if (!pending.length) {
      logger.info('[AURORA-PAY] ℹ️ No hay reservas pendientes de pago');
      return { success: true, sent: 0 };
    }

    let sent = 0;
    for (const r of pending) {
      try {
        if (shouldSkipInternalAutomation(r, 'AURORA-PAY')) {
          await databaseService.run(`UPDATE reservations SET payment_reminder_sent_at = NOW() WHERE id = $1`, [r.id]);
          continue;
        }
        const firstName = r.user_name ? r.user_name.split(' ')[0] : 'amig@';
        const serviceLabel = getServiceLabelLegacy(r.service_type);

        const waMessage = `Hola ${firstName} 👋\n\nTienes una reserva de *${serviceLabel}* para el *${formatDateEs(r.date)}* a las *${r.start_time}* pendiente de pago.\n\n💰 *Monto:* $${parseFloat(r.total_price).toFixed(2)}\n\nPuedes pagar en efectivo al llegar o por transferencia bancaria. Si necesitas ayuda con el pago, escríbeme 😊\n\n💳 Responde con tu forma de pago preferida:\n   1️⃣ Efectivo al llegar\n   2️⃣ Transferencia bancaria`;
        const delivery = await deliverReservationAutomation(
          r, 'aurora_payment_reminder', 'payment_reminder_sent_at',
          [whatsappDelivery(r.user_phone, waMessage)]
        );
        if (delivery.complete) sent++;
        await new Promise(resolve => setTimeout(resolve, 2500));
      } catch (err) {
        logger.error(`[AURORA-PAY] ❌ Error ${describeAutomationTarget(r)}:`, err.message);
      }
    }
    logger.info(`[AURORA-PAY] 📊 ${sent} recordatorios de pago enviados`);
    return { success: true, sent };
  } catch (err) {
    logger.error('[AURORA-PAY] ❌ Error general:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Recupera entregas con backoff cumplido o leases vencidos. El payload queda
 * persistido en la outbox, por lo que no depende de que la ventana original
 * de selección de la automatización siga abierta.
 */
export async function retryPendingAuroraDeliveries() {
  try {
    const batches = await findDueAutomationBatches();
    let completed = 0;
    let failed = 0;

    for (const batch of batches) {
      try {
        const result = await processAutomationBatch({
          entityId: batch.entity_id,
          automationKey: batch.automation_key,
          legacyColumn: batch.legacy_column,
          dispatch: dispatchAutomationDelivery,
        });
        if (result.complete) completed++;
        if (result.failed) failed++;
      } catch (error) {
        failed++;
        logger.error(`[AURORA-DELIVERY] Error recuperando ${batch.automation_key} para reserva ${batch.entity_id}:`, error.message);
      }
    }

    return { success: true, processed: batches.length, completed, failed };
  } catch (error) {
    logger.error('[AURORA-DELIVERY] Error general de recuperación:', error.message);
    return { success: false, error: error.message };
  }
}
