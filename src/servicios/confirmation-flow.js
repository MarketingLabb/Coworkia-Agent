/**
 * 🔄 Servicio de Confirmaciones SI/NO para WhatsApp
 * Maneja flujos de confirmación de reservas antes del pago
 */

import { loadProfile, saveProfile, updateUser } from '../perfiles-interacciones/memoria-sqlite.js';
import { getPaymentInfo } from './payment-calculator.js';
import { createReservation } from './calendario.js';
import { sendReservationConfirmation } from './email.js';
import { createCalendarEvent } from './google-calendar.js';
import databaseService from '../database/database.js';
import { enqueueBackgroundTask } from './task-queue.js';
import { 
  clearPendingConfirmation, 
  getPendingConfirmation, 
  savePendingConfirmation 
} from '../perfiles-interacciones/memoria-sqlite.js';
import { markJustConfirmed } from './reservation-state.js';
import reservationRepository from '../database/reservationRepository.js';
import { sendReservationNotifications } from './notification-helper.js';
import { generateWifiCode, getWifiCodeForReservation } from './wifi-codes-service.js';
import { isPositiveResponse, isNegativeResponse } from './generic-confirmation-flow.js';
import { COWORKIA_ADDRESS, COWORKIA_MAPS_URL } from '../utils/constants.js';
import { formatHotDeskNumbers, getHotDeskNumbers } from '../utils/hot-desk-assignments.js';
import { sendReservationReceiptByGabi } from './payment-receipt-email.js';
export { isPositiveResponse, isNegativeResponse };

class ConfirmationFlowError extends Error {
  constructor(payload) {
    super(payload?.message || 'CONFIRMATION_FLOW_ERROR');
    this.payload = payload;
  }
}

/**
 * 📅 Formatea una fecha para mostrar al usuario
 * @param {string|Date} date - Fecha en formato '2025-11-26' o Date object
 * @returns {string} - Fecha formateada como "Miércoles 26/11/2025"
 */
function formatUserDate(date) {
  // 🔧 FIX: Usar timezone de Ecuador para obtener el día correcto
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  
  // Crear Date con timezone explícito de Ecuador
  const dateObj = new Date(dateStr + 'T12:00:00-05:00');
  
  // Array correcto: 0=domingo, 1=lunes, 2=martes, ..., 6=sábado
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  
  const dayName = dayNames[dateObj.getDay()];
  
  // Parsear la fecha del string directamente para evitar issues de timezone
  const [year, month, day] = dateStr.split('-');
  const monthName = monthNames[parseInt(month, 10) - 1];
  
  // ✅ Formato: "Domingo 27 de enero 2026"
  return `${dayName} ${parseInt(day, 10)} de ${monthName} ${year}`;
}

function buildHotDeskMessageLine(reservationLike) {
  const numbers = getHotDeskNumbers(reservationLike);
  if (!numbers.length) return '';

  const label = numbers.length > 1 ? '🪑 *Puestos:*' : '🪑 *Puesto:*';
  return `\n${label} ${formatHotDeskNumbers(numbers)}`;
}

/**
 * 🔄 Detecta intención de modificar/cambiar reserva (no cancelar)
 */
export function isModificationRequest(message) {
  if (!message || typeof message !== 'string') return false;
  
  const text = message.toLowerCase().trim();
  
  // Patrones que indican que quiere mantener la reserva pero modificarla
  const modificationPatterns = [
    /cambiar/,
    /modificar/,
    /editar/,
    /ajustar/,
    /otro horario/,
    /otra hora/,
    /otra fecha/,
    /diferente hora/,
    /diferente fecha/,
    /puedo.*otro/,
    /mejor.*otro/,
    /prefiero.*otro/,
    /en vez de/,
    /en lugar de/,
    /más tarde/,
    /más temprano/
  ];
  
  return modificationPatterns.some(pattern => pattern.test(text));
}

/**
 * 💡 Genera mensaje de confirmación de reserva
 */
export function generateConfirmationMessage(reservationData, userProfile) {
  const {
    date,
    startTime,
    endTime,
    serviceType,
    durationHours,
    totalPrice,
    wasFree,
    guestCount = 0
  } = reservationData;
  
  const isThirdParty = reservationData.reservationFor === 'other';
  const displayName = isThirdParty ? reservationData.userName : userProfile.name;
  const userName = displayName ? `, ${displayName}` : '';
  const serviceName = serviceType === 'hotDesk' ? 'Hot Desk' : 
                     serviceType === 'meetingRoom' ? 'Sala de Reuniones' : 
                     serviceType === 'privateOffice' ? 'Oficina Privada' : serviceType;
  
  const formattedDate = new Date(date).toLocaleDateString('es-EC', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  // Solo Hot Desk puede ser gratis, sala de reuniones NUNCA
  const isActuallyFree = wasFree && serviceType === 'hotDesk';
  
  // Información de acompañantes
  const totalPeople = 1 + guestCount;
  const peopleInfo = isThirdParty
    ? `👥 *Personas:* ${totalPeople} (${reservationData.userName}${guestCount > 0 ? ` + ${guestCount} acompañante${guestCount > 1 ? 's' : ''}` : ''})`
    : guestCount > 0
      ? `👥 *Personas:* ${totalPeople} (tú + ${guestCount} acompañante${guestCount > 1 ? 's' : ''})`
      : `👥 *Personas:* Solo tú`;
  const beneficiaryInfo = isThirdParty
    ? `👤 *Beneficiario:* ${reservationData.userName}\n📱 *Celular:* ${reservationData.userId}\n📧 *Email:* ${reservationData.email}`
    : '';
  
  if (isActuallyFree) {
    return `Perfecto${userName}! 👍

📋 *Resumen de tu visita:*

📅 ${formattedDate}
⏰ ${startTime} - ${endTime} 
🏢 ${serviceName}
${beneficiaryInfo}
${peopleInfo}
⏱️ ${durationHours} hora${durationHours > 1 ? 's' : ''}
💰 Sin costo (primera visita)

¿Te viene bien este horario?

Responde *SI* para confirmar o *NO* si prefieres otro horario.`;
  }

  return `¡Perfecto${userName}! 🎉

📋 *CONFIRMA TU RESERVA:*

📅 *Fecha:* ${formattedDate}
⏰ *Horario:* ${startTime} - ${endTime}
🏢 *Espacio:* ${serviceName}
${beneficiaryInfo}
${peopleInfo}
⏱️ *Duración:* ${durationHours} hora${durationHours > 1 ? 's' : ''}
💰 *Total:* $${totalPrice} USD

¿*Confirmas esta reserva?*

Responde *SI* para continuar con el pago o *NO* para cancelar 👍`;
}

/**
 * 💳 Confirma una reserva cuyo pago ya fue verificado por Aurora.
 * Se invoca cuando el usuario responde SI al prompt de confirmación de comprobante.
 */
async function processPaymentVerificationConfirmation(userProfile, pendingReservation) {
  const userName = userProfile.name ? `, ${userProfile.name}` : '';
  const { reservationId, paymentReceipt } = pendingReservation;

  // 1. Confirmar la reserva (el pago ya quedó registrado en DB por processPaymentReceipt)
  const reservationRecord = await reservationRepository.updateStatus(reservationId, 'confirmed');
  if (!reservationRecord) {
    return {
      success: false,
      message: '❌ No se encontró la reserva. Por favor contacta al administrador.',
      needsAction: false
    };
  }

  const confirmedDate = reservationRecord.date;
  const confirmedStart = reservationRecord.start_time;
  const confirmedEnd = reservationRecord.end_time;
  const durationHours = reservationRecord.duration_hours || 2;
  const formattedDate = formatUserDate(confirmedDate);

  // 2. Limpiar confirmación pendiente y registrar como recién confirmado
  await clearPendingConfirmation(userProfile.userId);
  await markJustConfirmed(userProfile.userId, reservationId);

  // 3. Generar código WiFi
  let wifiLine = '';
  let wifiCode = null;
  try {
    const wifiResult = await generateWifiCode({
      reservationId,
      userPhone: userProfile.userId,
      durationHours,
      validForDate: confirmedDate
    });
    if (wifiResult.success) {
      wifiCode = wifiResult.code;
      wifiLine = `\n\n🔑 *Código WiFi:* \`${wifiResult.code}\`\n⏱️ Válido por ${durationHours}h desde que te conectes`;
      console.log('[Confirmation] 🔑 Código WiFi generado para reserva pagada:', wifiResult.code);
    }
  } catch (wifiErr) {
    console.error('[Confirmation] ⚠️ No se pudo generar código WiFi (no bloquea):', wifiErr.message);
  }

  // 4. Enviar notificaciones (email + calendar) en background
  if (userProfile.email) {
    enqueueBackgroundTask(
      'notifications',
      'paid-confirmation-notifications',
      () => sendReservationNotifications({
        email: userProfile.email,
        userName: userProfile.name || 'Cliente',
        date: confirmedDate,
        startTime: confirmedStart,
        endTime: confirmedEnd,
        serviceType: reservationRecord.service_type || 'hotDesk',
        guestCount: reservationRecord.guest_count || 0,
        wasFree: false,
        durationHours,
        totalPrice: reservationRecord.total_price || 0,
        reservation: reservationRecord,
        paymentReceipt,
        wifiCode
      }),
      { circuitId: 'notifications-job' }
    ).catch(err => console.error('[Confirmation] ❌ Error en notificaciones pago confirmado:', err.message));

    // 💼 Gabi envía recibo oficial de reserva SILENCIOSAMENTE (sin WA al cliente)
    const serviceLabels = {
      hotDesk: 'Hot Desk',
      meetingRoom: 'Sala de Reuniones',
      permanentDesk: 'Escritorio Permanente',
      privateOffice: 'Oficina Privada'
    };
    enqueueBackgroundTask(
      'gabi-receipt',
      `gabi-reservation-receipt-${reservationId}`,
      () => sendReservationReceiptByGabi({
        clientName: userProfile.name || 'Cliente',
        clientEmail: userProfile.email,
        serviceType: serviceLabels[reservationRecord.service_type] || reservationRecord.service_type || 'Hot Desk',
        reservationDate: confirmedDate,
        startTime: confirmedStart,
        endTime: confirmedEnd,
        totalAmount: reservationRecord.total_price || 0,
        paymentMethod: paymentReceipt?.method || 'Transferencia Bancaria',
        bankName: null,
        transactionReference: paymentReceipt?.reference || null,
        authorizationCode: paymentReceipt?.authorizationCode || null,
        receiptImageUrl: null,
        reservationId: reservationRecord.id
      }),
      { circuitId: 'gabi-receipt-job' }
    ).catch(err => console.error('[Confirmation] ❌ Error en recibo Gabi:', err.message));
  }

  enqueueBackgroundTask(
    'calendar-events',
    'paid-confirmation-calendar',
    () => createCalendarEvent({
      userName: userProfile.name || 'Cliente',
      email: userProfile.email || 'noemail@coworkia.com',
      date: confirmedDate,
      startTime: confirmedStart,
      endTime: confirmedEnd,
      serviceType: reservationRecord.service_type || 'hotDesk',
      duration: `${durationHours} horas`,
      price: reservationRecord.total_price || 0,
      guestCount: reservationRecord.guest_count || 0,
      hotDeskNumber: reservationRecord.hot_desk_number || null,
      hotDeskNumbers: reservationRecord.hot_desk_numbers || null,
      paymentMethod: reservationRecord.payment_method || null
    }),
    { circuitId: 'calendar-events-job' }
  ).catch(err => console.error('[Confirmation] ❌ Error creando evento calendar (pago):', err.message));

  const emailLine = userProfile.email
    ? '📧 Te enviamos la confirmación por email.'
    : 'ℹ️ No tengo tu email registrado para enviarte la confirmación.';

  return {
    success: true,
    message: `✅ *¡Pago confirmado${userName}!* 🎉

Tu reserva está activa:

📅 *${formattedDate}*
⏰ *${confirmedStart} - ${confirmedEnd}*
🔢 *Reserva:* ${reservationRecord.id}
💰 *Pago:* ✅ Verificado${wifiLine}

    ${emailLine}

📍 *Ubicación:* ${COWORKIA_ADDRESS}
🗺️ ${COWORKIA_MAPS_URL}

¡Te esperamos! 🚀`,
    needsAction: false,
    reservation: reservationRecord
  };
}

/**
 * 🎯 Procesa confirmación positiva
 */
export async function processPositiveConfirmation(userProfile, pendingReservation) {
  try {
    console.log('[Confirmation] 🔍 INICIO - processPositiveConfirmation con datos:', {
      userProfile: {
        userId: userProfile?.userId,
        name: userProfile?.name,
        email: userProfile?.email
      },
      pendingReservation: {
        userId: pendingReservation?.userId,
        date: pendingReservation?.date,
        startTime: pendingReservation?.startTime,
        serviceType: pendingReservation?.serviceType,
        wasFree: pendingReservation?.wasFree,
        paymentMethod: pendingReservation?.paymentMethod
      }
    });
    
    const reservationPhone = pendingReservation.userId || userProfile.userId;
    const reservationName = pendingReservation.userName || userProfile.name || 'Cliente';
    const reservationEmail = pendingReservation.email || userProfile.email || null;
    const isThirdPartyBooking = pendingReservation.reservationFor === 'other';
    const userName = reservationName ? `, ${reservationName}` : '';
    let reservationRecord = null;
    
    // 🚨 CRÍTICO: Asegurar que pendingReservation tenga el userId (usado como user_phone)
    if (!pendingReservation.userId && userProfile.userId) {
      pendingReservation.userId = userProfile.userId;
      console.log('[Confirmation] ✅ userId agregado desde userProfile:', pendingReservation.userId);
    }

    // 💳 PAGO VERIFICADO: el usuario confirmó un comprobante que Aurora ya procesó
    if (pendingReservation.paymentVerified === true && pendingReservation.reservationId) {
      return await processPaymentVerificationConfirmation(userProfile, pendingReservation);
    }
    
    // Agregar userName si existe
    if (!pendingReservation.userName && userProfile.name) {
      pendingReservation.userName = userProfile.name;
    }

    if (isThirdPartyBooking) {
      await databaseService.run(
        `INSERT INTO users (phone_number, name, email, first_visit, free_trial_used, last_message_at)
         VALUES ($1, $2, $3, TRUE, TRUE, NOW())
         ON CONFLICT (phone_number) DO UPDATE SET
           name = COALESCE(EXCLUDED.name, users.name),
           email = COALESCE(EXCLUDED.email, users.email)`,
        [reservationPhone, reservationName, reservationEmail]
      );
    }
    
    // 🧹 PASO 0: LIMPIAR RESERVAS CONFLICTIVAS DEL MISMO USUARIO PRIMERO
    // Cancelar TODAS las reservas del usuario en la misma fecha/hora ANTES de validar disponibilidad
    console.log('[Confirmation] 🧹 PASO 0: Limpiando reservas conflictivas del usuario...');
    const { default: reservationRepository } = await import('../database/reservationRepository.js');
    const allReservationsOnDate = await reservationRepository.findByDate(pendingReservation.date);
    
    // Filtrar solo las del usuario actual
    const userReservations = allReservationsOnDate.filter(r => r.user_phone === pendingReservation.userId);
    
    for (const existing of userReservations) {
      // Cancelar si es la misma hora Y NO está ya cancelada
      if (existing.status !== 'cancelled' && existing.start_time === pendingReservation.startTime) {
        console.log(`[Confirmation] 🗑️ Cancelando reserva conflictiva: ${existing.id} (status: ${existing.status})`);
        await reservationRepository.updateStatus(existing.id, 'cancelled');
      }
    }
    
    // 🔍 PASO 1: Verificar disponibilidad de Hot Desks DESPUÉS de limpiar
    if (pendingReservation.serviceType === 'hotDesk') {
      console.log('[Confirmation] 📍 PASO 1: Verificando disponibilidad de Hot Desk...');
      
      // 🕐 Calcular endTime y durationHours si no existen (2h por defecto para Hot Desk)
      if (!pendingReservation.endTime && pendingReservation.startTime) {
        // ⚠️ VALIDACIÓN: Asegurar que startTime no sea null antes de split
        if (typeof pendingReservation.startTime !== 'string' || !pendingReservation.startTime) {
          throw new ConfirmationFlowError({
            success: false,
            message: '❌ Error: La hora de inicio no está definida correctamente. Por favor, proporciona una hora válida.',
            needsAction: true,
            actionType: 'request_time'
          });
        }
        
        const durationHours = 2; // Hot Desk siempre 2 horas
        const [hours, minutes] = pendingReservation.startTime.split(':').map(Number);
        const endHours = hours + durationHours;
        pendingReservation.endTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        pendingReservation.durationHours = durationHours;
        console.log(`[Confirmation] 🕐 Calculado: ${pendingReservation.startTime} + ${durationHours}h = ${pendingReservation.endTime}`);
      }
      
      const { checkHotDeskAvailability, assignHotDeskNumbers } = await import('./calendario.js');
      const desksNeeded = pendingReservation.desksQuantity || 1;
      
      const availability = await checkHotDeskAvailability(
        pendingReservation.date,
        pendingReservation.startTime,
        pendingReservation.endTime,
        desksNeeded
      );
      console.log('[Confirmation] 📊 Disponibilidad verificada:', availability, 'desks necesarios:', desksNeeded);
      
      if (!availability.available || availability.availableCount < desksNeeded) {
        console.log('[Confirmation] ❌ Hot Desks insuficientes:', availability.availableCount, 'de', desksNeeded);
        
        const reason = availability.availableCount === 0
          ? `${availability.message}\n\nDéjame revisar otros horarios disponibles...`
          : `Solo hay ${availability.availableCount} Hot Desk${availability.availableCount !== 1 ? 's' : ''} disponible${availability.availableCount !== 1 ? 's' : ''}, pero necesitas ${desksNeeded}.\n\n¿Prefieres reservar ${availability.availableCount} o buscar otro horario?`;
        
        throw new ConfirmationFlowError({
          success: false,
          message: reason,
          needsAction: true,
          actionType: 'check_alternatives'
        });
      }
      
      // Asignar número(s) de Hot Desk automáticamente
      const hotDeskNumbers = await assignHotDeskNumbers(
        pendingReservation.date,
        pendingReservation.startTime,
        pendingReservation.endTime,
        desksNeeded
      );

      if (hotDeskNumbers.length < desksNeeded) {
        throw new ConfirmationFlowError({
          success: false,
          message: `Solo pude asignar ${hotDeskNumbers.length} Hot Desk${hotDeskNumbers.length !== 1 ? 's' : ''}, pero necesitas ${desksNeeded}. ¿Prefieres otro horario?`,
          needsAction: true,
          actionType: 'check_alternatives'
        });
      }

      pendingReservation.hotDeskNumbers = hotDeskNumbers;
      pendingReservation.hotDeskNumber = hotDeskNumbers[0] ?? null;
      console.log(`[Confirmation] ✅ Hot Desks asignados: ${formatHotDeskNumbers(hotDeskNumbers)} / ${availability.maxCapacity}`);
    }
    
    // 🔄 Crear reserva
    console.log('[Confirmation] 📍 PASO 2: Creando reserva...');
    const reservationResult = await createReservation(pendingReservation);
    
    console.log('[Confirmation] 📊 Resultado de createReservation:', reservationResult);
    
    if (!reservationResult.success) {
      console.error('[Confirmation] ❌ createReservation falló:', reservationResult.error);
      throw new ConfirmationFlowError({
        success: false,
        message: `❌ ${reservationResult.error}`,
        needsAction: false,
        alternatives: reservationResult.alternatives
      });
    }

    reservationRecord = reservationResult.reservation;
    console.log('[Confirmation] ✅ Reserva creada con ID:', reservationRecord?.id);

    if (!pendingReservation.wasFree) {
      console.log('[Confirmation] 📍 PASO 2.2: Actualizando estado a pending_payment...');
      reservationRecord = await reservationRepository.updateStatus(reservationRecord.id, 'pending_payment');
    } else {
      // 🎁 Reserva gratis: marcar como confirmada inmediatamente
      console.log('[Confirmation] 📍 PASO 2.2: Reserva gratis - actualizando estado a confirmed...');
      reservationRecord = await reservationRepository.updateStatus(reservationRecord.id, 'confirmed');
      console.log('[Confirmation] ✅ Reserva gratis confirmada automáticamente');
    }

    // 🏢🏢 PASO 2.5: Si es reserva doble, crear segunda reserva (meetingRoom)
    let secondReservationRecord = null;
    if (pendingReservation.secondSpaceType) {
      console.log('[Confirmation] 🏢🏢 RESERVA DOBLE: Creando segunda reserva...', {
        secondSpaceType: pendingReservation.secondSpaceType,
        secondTime: pendingReservation.secondTime,
        secondDurationHours: pendingReservation.secondDurationHours
      });

      const secondStartTime = pendingReservation.secondTime || pendingReservation.startTime;
      const secondDurationH = pendingReservation.secondDurationHours || 2;
      const [sh, sm] = secondStartTime.split(':').map(Number);
      const secEndMin = sh * 60 + (sm || 0) + secondDurationH * 60;
      const secEh = Math.floor(secEndMin / 60) % 24;
      const secEm = secEndMin % 60;
      const secondEndTime = `${secEh.toString().padStart(2, '0')}:${secEm.toString().padStart(2, '0')}`;

      const SALA_BASE_PER_2H = 25.22;
      const discountFactor = 1 - (pendingReservation.discountPercent || 0) / 100;
      const secondBase = SALA_BASE_PER_2H * (secondDurationH / 2) * discountFactor;
      const secondIva   = secondBase * 0.15;
      const secondCardFee = pendingReservation.paymentMethod === 'tarjeta' ? secondBase * 0.05 : 0;
      const secondTotal = Math.round((secondBase + secondIva + secondCardFee) * 100) / 100;

      const secondReservationData = {
        userId: pendingReservation.userId,
        userName: pendingReservation.userName,
        date: pendingReservation.date,
        startTime: secondStartTime,
        endTime: secondEndTime,
        serviceType: pendingReservation.secondSpaceType,
        durationHours: secondDurationH,
        email: pendingReservation.email,
        guestCount: pendingReservation.guestCount || 0,
        totalPrice: secondTotal,
        wasFree: false,
        paymentMethod: pendingReservation.paymentMethod
      };

      const secondResult = await createReservation(secondReservationData);

      if (secondResult.success) {
        secondReservationRecord = secondResult.reservation;
        secondReservationRecord = await reservationRepository.updateStatus(secondReservationRecord.id, 'pending_payment');
        console.log('[Confirmation] ✅ Segunda reserva creada con ID:', secondReservationRecord?.id);

        enqueueBackgroundTask(
          'calendar-events',
          `create-reservation-2-${secondReservationRecord.id}`,
          () => createCalendarEvent({
            userName: pendingReservation.userName,
            email: reservationEmail || 'noemail@coworkia.com',
            date: pendingReservation.date,
            startTime: secondStartTime,
            endTime: secondEndTime,
            serviceType: pendingReservation.secondSpaceType,
            duration: `${secondDurationH} horas`,
            price: secondTotal,
            guestCount: 0,
            paymentMethod: pendingReservation.paymentMethod
          }),
          { circuitId: 'calendar-events-job' }
        ).catch(e => console.error('[Confirmation] ⚠️ Error calendario segunda reserva:', e));
      } else {
        console.error('[Confirmation] ⚠️ No se pudo crear segunda reserva (primera sí creada):', secondResult.error);
      }
    }

    console.log('[Confirmation] 📍 PASO 2.3: Limpiando confirmación pendiente...');
    await clearPendingConfirmation(userProfile.userId);
    
    console.log('[Confirmation] 📍 PASO 2.4: Actualizando perfil de usuario...');
    const userUpdates = {
      lastReservation: reservationRecord
    };
    
    // 📧 Guardar email del formulario en users.email si está presente
    if (!isThirdPartyBooking && pendingReservation.email && pendingReservation.email !== userProfile.email) {
      console.log('[Confirmation] 📧 Guardando email del formulario en BD:', pendingReservation.email);
      userUpdates.email = pendingReservation.email;
      userProfile.email = pendingReservation.email; // Actualizar también en memoria para notificaciones
    }
    
    // 🎁 CRÍTICO: Si es Hot Desk gratis (primera reserva), marcar trial usado
    // BUG FIX v636: Verificar también que el precio sea 0 y que sea Hot Desk
    const isFirstFreeHotDesk = (
      pendingReservation.wasFree === true || 
      (pendingReservation.totalPrice === 0 && pendingReservation.serviceType === 'hotDesk')
    ) && !userProfile.freeTrialUsed;
    
    if (isFirstFreeHotDesk) {
      console.log('[Confirmation] 🎁 Marcando trial gratis como usado (primera reserva Hot Desk)');
      userUpdates.freeTrialUsed = true; // ← camelCase para saveProfile
      userUpdates.freeTrialDate = new Date().toISOString(); // ← camelCase
    }
    
    await updateUser(reservationPhone, userUpdates);
    
    console.log('[Confirmation] ✅ Operaciones completadas exitosamente');

    console.log('[Confirmation] 📍 PASO 3: Marcando como confirmado recientemente...');
    await markJustConfirmed(userProfile.userId, reservationRecord?.id);

    const confirmedDate = reservationRecord?.date || pendingReservation.date;
    const confirmedStart = reservationRecord?.start_time || pendingReservation.startTime;
    const confirmedEnd = reservationRecord?.end_time || pendingReservation.endTime;
    const confirmedDeskLine = buildHotDeskMessageLine(reservationRecord || pendingReservation);
    
    // 🆕 v283: Formatear fecha para mensajes al usuario
    const formattedConfirmedDate = formatUserDate(confirmedDate);
    
    console.log('[Confirmation] 📋 Datos confirmados:', { 
      confirmedDate, 
      formattedConfirmedDate,
      confirmedStart, 
      confirmedEnd 
    });

    // 2. Crear evento en Google Calendar (SOLO UNA VEZ)
    // ⚠️ NO duplicar: sendReservationNotifications ya crea el evento inline
    // Solo encolar si NO es gratis (las gratis se envían inline abajo)
    if (!pendingReservation.wasFree) {
      enqueueBackgroundTask(
        'calendar-events',
        'create-reservation',
        () => createCalendarEvent({
          userName: pendingReservation.userName,
          email: reservationEmail || 'noemail@coworkia.com',
          date: confirmedDate,
          startTime: confirmedStart,
          endTime: confirmedEnd,
          serviceType: pendingReservation.serviceType,
          duration: `${pendingReservation.durationHours} horas`,
          price: pendingReservation.totalPrice,
          guestCount: pendingReservation.guestCount || 0,
          hotDeskNumber: reservationRecord?.hot_desk_number || pendingReservation.hotDeskNumber || null,
          hotDeskNumbers: reservationRecord?.hot_desk_numbers || pendingReservation.hotDeskNumbers || null,
          paymentMethod: pendingReservation.paymentMethod || reservationRecord.payment_method || null
        }),
        { circuitId: 'calendar-events-job' }
      )
        .then(calendarEvent => {
          if (calendarEvent?.success) {
            console.log('[Confirmation] ✅ Evento en Google Calendar en background:', calendarEvent.eventUrl);
          } else {
            console.error('[Confirmation] ❌ Calendario reportó error:', calendarEvent?.error || 'Unknown');
          }
        })
        .catch(calendarError => {
          console.error('[Confirmation] ❌ Error creando evento en background:', calendarError);
        });
    }

    // 4. Si es gratis, enviar email y calendar INLINE (no encolar)
    if (pendingReservation.wasFree) {
      if (process.env.DEBUG_MODE === 'true') {
        console.log('[Confirmation] 🔍 DEBUG: Reserva gratis detectada, enviando notificaciones INLINE');
        console.log('[Confirmation] 🔍 DEBUG: Email usuario:', reservationEmail);
        console.log('[Confirmation] 🔍 DEBUG: Datos reserva:', {
          date: confirmedDate,
          startTime: confirmedStart,
          endTime: confirmedEnd,
          serviceType: pendingReservation.serviceType,
          wasFree: true
        });
      }
      
      let confirmationDeliveryLine = reservationEmail
        ? '📧 Te enviaré la confirmación por email en unos segundos.'
        : 'ℹ️ No tengo tu email registrado todavía para enviarte la confirmación.';

      // 🔑 BUG FIX: Generar código WiFi ANTES de enviar notificaciones
      let wifiCode = null;
      let freeWifiLine = '';
      try {
        const wifiResult = await generateWifiCode({
          reservationId: reservationRecord.id,
          userPhone: reservationPhone,
          durationHours: pendingReservation.durationHours || 2,
          validForDate: confirmedDate
        });
        if (wifiResult.success) {
          wifiCode = wifiResult.code;
          freeWifiLine = `\n\n🔑 *Código WiFi:* \`${wifiResult.code}\`\n⏱️ Válido por ${wifiResult.durationHours}h desde que te conectes`;
          console.log('[Confirmation] 🔑 Código WiFi generado para reserva gratuita:', wifiResult.code);
        }
      } catch (wifiErr) {
        console.error('[Confirmation] ⚠️ No se pudo generar código WiFi (no bloquea):', wifiErr.message);
      }

      if (reservationEmail) {
        console.log('[Confirmation] 📧 Enviando notificaciones INLINE (email + calendar)...');
        
        try {
          // EJECUTAR INLINE con reintentos automáticos
          const notificationResults = await sendReservationNotifications({
            email: reservationEmail,
            userName: reservationName,
            date: confirmedDate,
            startTime: confirmedStart,
            endTime: confirmedEnd,
            serviceType: pendingReservation.serviceType || 'hotDesk',
            guestCount: pendingReservation.guestCount || 0,
            wasFree: true,
            durationHours: pendingReservation.durationHours || 2,
            totalPrice: 0,
            reservation: reservationRecord,
            wifiCode // ✅ Ahora se pasa el código WiFi
          });
          
          // Log detallado de resultados
          console.log('[Confirmation] 📊 Resultado notificaciones:', JSON.stringify(notificationResults, null, 2));
          
          if (notificationResults.bothSucceeded) {
            console.log('[Confirmation] ✅ AMBAS notificaciones enviadas exitosamente (email + calendar)');
          } else if (notificationResults.anySucceeded) {
            console.warn('[Confirmation] ⚠️ PARCIAL: Solo algunas notificaciones se enviaron:', {
              email: notificationResults.email?.success ? 'OK' : 'FAILED',
              calendar: notificationResults.calendar?.success ? 'OK' : 'FAILED'
            });
          } else {
            console.error('[Confirmation] 🚨 CRÍTICO: NINGUNA notificación se envió - Revisión manual requerida');
          }

          confirmationDeliveryLine = notificationResults.email?.success
            ? '📧 Te envié la confirmación por email.'
            : '⚠️ La reserva quedó confirmada. El email falló; si quieres, te lo reenvío enseguida.';
        } catch (notifError) {
          console.error('[Confirmation] ❌ ERROR al enviar notificaciones:', notifError.message);
          console.error('[Confirmation] Stack:', notifError.stack);
          confirmationDeliveryLine = '⚠️ La reserva quedó confirmada. Hubo un problema enviando el email; si quieres, te lo reenvío enseguida.';
        }
      } else {
        console.warn('[Confirmation] ⚠️ Email no enviado: usuario sin email configurado');
      }

      // ✅ El código WiFi ya se generó antes del email (líneas arriba)
      // No es necesario generarlo de nuevo

      return {
        success: true,
        message: `✅ *¡Reserva confirmada${userName}!*

🎉 Tus 2 horas gratis están listas:

📅 *${formattedConfirmedDate}*
⏰ *${confirmedStart} - ${confirmedEnd}*
🔢 *Reserva:* ${reservationRecord.id}
🏢 *${pendingReservation.serviceType === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones'}*${confirmedDeskLine}
💰 *Precio:* ¡GRATIS! (primera visita)${freeWifiLine}

    ${confirmationDeliveryLine}

📍 *Ubicación:* ${COWORKIA_ADDRESS}
🗺️ ${COWORKIA_MAPS_URL}

¡Te esperamos! 🚀`,
        needsAction: false,
        reservation: reservationRecord
      };
    }

    // 🔓 BYPASS: Si es efectivo, confirmar reserva pero dejar pago pendiente
    if (pendingReservation.paymentMethod === 'efectivo') {

      // 🚨 SÁBADOS: NO aceptar efectivo — requiere transferencia o link de pago
      const isSaturday = new Date(confirmedDate + 'T12:00:00').getDay() === 6;
      if (isSaturday) {
        console.log('[Confirmation] 🚨 Sábado + efectivo BLOQUEADO — redirigir a transferencia');
        return {
          success: true,
          message: `⚠️ *Reserva de sábado — pago anticipado requerido*

Los sábados Coworkia abre *solo bajo demanda*, por eso necesitamos confirmar tu pago *antes* del sábado.

❌ No aceptamos efectivo para reservas de sábado.

✅ *Opciones de pago:*

1️⃣ *Transferencia bancaria:*
🏦 Produbanco · Cta. Ahorros *20059783069*
👤 Gonzalo Villota Izurieta
💵 Monto: *$${pendingReservation.totalPrice}*
📱 Envía tu comprobante aquí por WhatsApp

2️⃣ *Link de pago:* Escribe "link de pago" y te lo envío al instante 💳

Tu reserva queda *pre-reservada* hasta confirmar el pago. ¡Gracias! 😊`,
          needsAction: true,
          actionType: 'saturday_prepaid_required',
          reservation: reservationRecord
        };
      }

      console.log('[Confirmation] 🔓 BYPASS: Efectivo detectado, confirmando reserva con pago pendiente');
      
      // Confirmar reserva pero NO marcar como pagada (el pago se recibe en persona)
      await reservationRepository.update(reservationRecord.id, {
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        payment_method: 'efectivo',
        payment_status: 'pending_efectivo'
      });
      
      // Enviar notificaciones
      let notificationResults = null;
      if (reservationEmail) {
        notificationResults = await sendReservationNotifications({
          email: reservationEmail,
          userName: reservationName,
          date: confirmedDate,
          startTime: confirmedStart,
          endTime: confirmedEnd,
          serviceType: pendingReservation.serviceType || 'Hot Desk',
          guestCount: pendingReservation.guestCount || 0,
          wasFree: false,
          durationHours: pendingReservation.durationHours || 2,
          totalPrice: pendingReservation.totalPrice,
          reservation: reservationRecord
        });
      }

      const confirmationDeliveryLine = notificationResults?.email?.success
        ? '📧 Te envié la confirmación por email.'
        : reservationEmail
        ? '⚠️ La reserva quedó confirmada. El email falló; si quieres, te lo reenvío enseguida.'
        : 'ℹ️ No tengo tu email registrado todavía para enviarte la confirmación.';
      
      return {
        success: true,
        message: `✅ *¡Reserva confirmada${userName}!* 🎉

📅 *${formattedConfirmedDate}*
⏰ *${confirmedStart} - ${confirmedEnd}*
🔢 *Reserva:* ${reservationRecord.id}
🏢 *${pendingReservation.serviceType === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones'}*${confirmedDeskLine}
💰 *Pago pendiente:* $${pendingReservation.totalPrice} (efectivo en Coworkia)

✅ Pagarás directamente al llegar
ℹ️ _El código WiFi lo recibirás al completar tu pago en recepción._

    ${confirmationDeliveryLine}

📍 *Ubicación:* ${COWORKIA_ADDRESS}
🗺️ ${COWORKIA_MAPS_URL}

¡Te esperamos! 🚀`,
        needsAction: false,
        reservation: reservationRecord
      };
    }
    
    // 4. Si requiere pago, calcular desglose y enviar datos de pago
    const { calculateReservationCost } = await import('./payment-calculator.js');
    
    // Calcular con método de pago específico si está disponible
    const paymentMethod = pendingReservation.paymentMethod === 'transferencia' ? 'transferencia' : 'payphone';
    const billingUnits = pendingReservation.serviceType === 'hotDesk'
      ? (pendingReservation.desksQuantity || 1)
      : (pendingReservation.guestCount || 1);
    const costBreakdown = calculateReservationCost(
      pendingReservation.serviceType,
      pendingReservation.durationHours || 2,
      billingUnits,
      paymentMethod
    );
    
    let priceBreakdown = '';
    if (!costBreakdown.error) {
      priceBreakdown = costBreakdown.payphoneFee > 0
        ? `💵 *Total:* $${costBreakdown.totalPrice.toFixed(2)} USD (incluye IVA y comisión tarjeta)`
        : `💵 *Total:* $${costBreakdown.subtotalWithIVA.toFixed(2)} USD (incluye IVA)`;
    } else {
      priceBreakdown = `💵 *Total:* $${pendingReservation.totalPrice} USD`;
    }
    
    // 🆕 v283: Mostrar solo el método de pago seleccionado
    let paymentInstructions = '';
    
    if (paymentMethod === 'transferencia') {
      paymentInstructions = `🏦 *Transferencia bancaria:*
    Produbanco · Cta Ahorros 20059783069
    Titular: Gonzalo Villota Izurieta · Cédula: 1702683499
    📲 Envíame tu comprobante para confirmar automáticamente ✅`;
    } else {
      // Default: tarjeta/payphone
      paymentInstructions = `💳 *Pago con tarjeta (Payphone):*
    https://ppls.me/hnMI9yMRxbQ6rgIVi6L2DA
    📲 Envíame tu comprobante para confirmar automáticamente ✅`;
    }

    // 📧 Enviar email de confirmación para reservas de pago (tarjeta / transferencia)
    let confirmationEmailLine = '';
    if (reservationEmail) {
      try {
        console.log('[Confirmation] 📧 Enviando email de confirmación (pago pendiente) a:', reservationEmail);
        const notificationResults = await sendReservationNotifications({
          email: reservationEmail,
          userName: reservationName,
          date: confirmedDate,
          startTime: confirmedStart,
          endTime: confirmedEnd,
          serviceType: pendingReservation.serviceType || 'hotDesk',
          guestCount: pendingReservation.guestCount || 0,
          wasFree: false,
          durationHours: pendingReservation.durationHours || 2,
          totalPrice: costBreakdown.error ? pendingReservation.totalPrice : costBreakdown.totalPrice,
          reservation: reservationRecord
        });

        confirmationEmailLine = notificationResults?.email?.success
          ? '\n📧 Te enviamos la confirmación por email.'
          : '';

        if (notificationResults?.email?.success) {
          console.log('[Confirmation] ✅ Email de confirmación enviado exitosamente');
        } else {
          console.warn('[Confirmation] ⚠️ Email de confirmación no se pudo enviar:', notificationResults?.email?.error);
        }
      } catch (emailError) {
        console.error('[Confirmation] ❌ Error enviando email de confirmación:', emailError.message);
      }
    } else {
      console.warn('[Confirmation] ⚠️ Sin email registrado, omitiendo envío de confirmación');
    }

    return {
      success: true,
      message: `✅ *¡Reserva confirmada${userName}!* 🎉

📅 *${formattedConfirmedDate}*
⏰ *${confirmedStart} - ${confirmedEnd}*
🏢 *${pendingReservation.serviceType === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones'}*${confirmedDeskLine}
${priceBreakdown}
🔢 *Referencia:* ${reservationRecord.id}
${paymentInstructions}${confirmationEmailLine}

📍 ${COWORKIA_ADDRESS}
🗺️ ${COWORKIA_MAPS_URL}`,
      needsAction: true,
      actionType: 'payment_pending',
      reservation: reservationRecord
    };

  } catch (error) {
    if (error instanceof ConfirmationFlowError) {
      return error.payload;
    }
    
    // 🚨 LOG CRÍTICO CON CONTEXTO COMPLETO
    console.error('[Confirmation] 🚨 ERROR CRÍTICO procesando confirmación positiva:', {
      error: error.message,
      stack: error.stack,
      userId: userProfile?.userId || 'unknown',
      pendingReservationExists: !!pendingReservation,
      userProfileExists: !!userProfile,
      pendingReservationDetails: pendingReservation ? {
        date: pendingReservation.date,
        time: pendingReservation.startTime,
        serviceType: pendingReservation.serviceType,
        email: pendingReservation.email,
        wasFree: pendingReservation.wasFree
      } : 'none',
      timestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      message: `❌ Hubo un problema al procesar tu confirmación.\n\n⚠️ Error: ${error.message}\n\n¿Puedes intentar de nuevo escribiendo *SI*?`,
      needsAction: false
    };
  }
}

/**
 * ❌ Procesa confirmación negativa
 */
export async function processNegativeConfirmation(userProfile, message = '') {
  const userName = userProfile.name ? `, ${userProfile.name}` : '';
  
  // Detectar si quiere cambiar o realmente cancelar
  const wantsToModify = isModificationRequest(message);
  
  // Limpiar confirmación pendiente (perfil en memoria)
  await updateUser(userProfile.userId, {
    pendingConfirmation: null
  });
  
  // Limpiar confirmación pendiente (DB PostgreSQL)
  await clearPendingConfirmation(userProfile.userId);
  
  // Marcar que acaba de cancelar para evitar re-procesamiento de campañas
  try {
    await databaseService.initialize();
    // Borrar registro existente primero
    await databaseService.run(
      `DELETE FROM just_confirmed WHERE user_phone = ?`,
      [userProfile.userId]
    );
    // Calcular timestamp de expiración (5 minutos desde ahora)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    // Insertar nuevo registro con expiración en 5 minutos
    await databaseService.run(
      `INSERT INTO just_confirmed (user_phone, expires_at) 
       VALUES (?, ?)`,
      [userProfile.userId, expiresAt]
    );
  } catch (err) {
    console.error('[Confirmation] Error marcando justConfirmed en cancelación:', err);
  }

  if (wantsToModify) {
    return {
      success: true,
      message: `Entiendo${userName}. Si decides continuar con tu reserva, ¿qué espacio necesitas? Tenemos:

📍 Hot Desk
🏢 Sala de Reuniones (3-4 personas, $29/2h)

Déjame saber cómo te gustaría proceder. 😊`,
      needsAction: false,
      actionType: 'reservation_modification'
    };
  }

  return {
    success: true,
    message: `Entendido${userName} 👍

❌ He cancelado la reserva pendiente.

¿En qué más puedo ayudarte?

• Otra fecha/hora
• Información de espacios  
• Planes mensuales

¡Estoy aquí para lo que necesites! 😊`,
    needsAction: false,
    actionType: 'reservation_cancelled'
  };
}

/**
 * 🤔 Maneja respuestas ambiguas o no reconocidas
 */
export async function processAmbiguousResponse(userProfile, message) {
  const userName = userProfile.name ? `, ${userProfile.name}` : '';
  
  // Incrementar contador de intentos ambiguos
  const ambiguousAttempts = (userProfile.pendingConfirmation?.ambiguousAttempts || 0) + 1;
  
  // Si ya intentó 3 veces, auto-cancelar
  if (ambiguousAttempts >= 3) {
    clearPendingConfirmation(userProfile.userId);
    
    // Marcar que acaba de cancelar para evitar re-procesamiento de campañas
    try {
      await databaseService.initialize();
      // Borrar registro existente primero
      await databaseService.run(
        `DELETE FROM just_confirmed WHERE user_phone = ?`,
        [userProfile.userId]
      );
      // Calcular timestamp de expiración (5 minutos desde ahora)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      // Insertar nuevo registro con expiración en 5 minutos
      await databaseService.run(
        `INSERT INTO just_confirmed (user_phone, expires_at) 
         VALUES (?, ?)`,
        [userProfile.userId, expiresAt]
      );
    } catch (err) {
      console.error('[Confirmation] Error marcando justConfirmed:', err);
    }
    
    return {
      success: false,
      message: `Entiendo que prefieres no confirmar ahora${userName}.

✅ He cancelado la reserva pendiente.

¿Quieres agendar para otra fecha u horario? Avísame cuando quieras 😊`,
      needsAction: false,
      actionType: 'auto_cancelled_after_attempts'
    };
  }
  
  // Actualizar contador en pending confirmation
  try {
    await databaseService.initialize();
    // Actualizar el contador de intentos ambiguos en la confirmación pendiente
    const pending = await getPendingConfirmation(userProfile.userId);
    if (pending) {
      const updatedData = { ...pending, ambiguousAttempts };
      await savePendingConfirmation(userProfile.userId, updatedData);
    }
  } catch (err) {
    console.error('[Confirmation] Error actualizando contador:', err);
  }
  
  return {
    success: false,
    message: `No estoy seguro de tu respuesta${userName} 🤔

Por favor responde claramente:

• *SI* - para confirmar la reserva
• *NO* - para cancelar

Tu mensaje: "${message}"

¿Confirmas la reserva? 👍

_(Intento ${ambiguousAttempts}/3)_`,
    needsAction: true,
    actionType: 'confirmation_clarification'
  };
}

/**
 * 🎛️ Procesador principal de confirmaciones
 */
export async function processConfirmationResponse(message, userProfile) {
  try {
    const pendingConfirmation = await getPendingConfirmation(userProfile.userId);
    
    if (!pendingConfirmation) {
      return {
        success: false,
        message: 'No tienes ninguna solicitud pendiente de confirmación.',
        needsAction: false
      };
    }

    // Detectar tipo de respuesta
    if (isPositiveResponse(message)) {
      // Si tiene agentName (ALUNA, PAULA, etc), procesarlo de forma especializada
      if (pendingConfirmation.agentName) {
        return await processSpecializedConfirmation(userProfile.userId, pendingConfirmation, userProfile);
      }
      // Si no, es una reserva de Aurora (formato legacy)
      return await processPositiveConfirmation(userProfile, pendingConfirmation);
    }
    
    if (isNegativeResponse(message)) {
      // Limpiar confirmación pendiente sin importar el tipo
      await clearPendingConfirmation(userProfile.userId);
      
      const isReservation = pendingConfirmation.serviceType || pendingConfirmation.secondSpaceType;
      const hasDualSpace  = Boolean(pendingConfirmation.secondSpaceType);
      
      if (isReservation) {
        return {
          success: false,
          cancelledReservation: true,
          message: `Entendido, cancelo la solicitud 👍\n\n` +
            `📋 *Política de espacios Coworkia:*\n` +
            `• Mínimo *2 horas* por reserva\n` +
            `• El precio es el mismo para 1h o 2h\n` +
            `• Hot Desk: $10/2h · Sala de Reuniones: $29/2h\n\n` +
            (hasDualSpace
              ? `🎁 *Oferta especial:* Reserva Hot Desk + Sala hoy y te doy el *10% de descuento* en el total!\n\n`
              : '') +
            `¿Qué necesitas? Dime y estoy pendiente 😊`,
          needsAction: false
        };
      }

      return {
        success: false,
        cancelledReservation: true,
        message: 'Entendido, cancelé la solicitud. Si cambias de opinión, solo escríbeme nuevamente! 😊',
        needsAction: false
      };
    }
    
    // Respuesta ambigua
    return await processAmbiguousResponse(userProfile, message);

  } catch (error) {
    console.error('[Confirmation] Error procesando respuesta:', error);
    return {
      success: false,
      message: '❌ Error procesando tu respuesta. Intenta nuevamente.',
      needsAction: false
    };
  }
}

/**
 * 🎯 Procesa confirmaciones especializadas de otros agentes (ALUNA, PAULA, etc.)
 */
async function processSpecializedConfirmation(userId, pendingData, userProfile) {
  console.log(`[Confirmation] 🎯 Procesando confirmación especializada para ${pendingData.agentName}`);
  
  try {
    let result;
    
    switch (pendingData.agentName) {
      case 'ALUNA': {
        const { confirmMembershipLead } = await import('./membership-confirmation.js');
        result = await confirmMembershipLead(userId, userProfile);
        break;
      }
      case 'PAULA': {
        const { confirmRealEstateLead } = await import('./real-estate-confirmation.js');
        result = await confirmRealEstateLead(userId, userProfile);
        break;
      }
      case 'GABI': {
        const { confirmLegalConsultation } = await import('./gabi-confirmation.js');
        result = await confirmLegalConsultation(userId, userProfile);
        break;
      }
      // Agregar más agentes aquí cuando se implementen
      default:
        console.error(`[Confirmation] ⚠️ Agente no soportado: ${pendingData.agentName}`);
        return {
          success: false,
          message: 'Error: Este tipo de confirmación aún no está implementado.',
          needsAction: false
        };
    }
    
    return {
      success: result.success,
      message: result.message,
      needsAction: false,
      actionType: 'specialized_confirmation'
    };
    
  } catch (error) {
    console.error(`[Confirmation] ❌ Error en confirmación especializada:`, error);
    return {
      success: false,
      message: `Error al procesar tu solicitud: ${error.message}`,
      needsAction: false
    };
  }
}

/**
 * 🔍 Verifica si el usuario tiene confirmación pendiente
 */
export function hasPendingConfirmation(userProfile) {
  return !!(userProfile?.pendingConfirmation);
}

export default {
  isPositiveResponse,
  isNegativeResponse,
  generateConfirmationMessage,
  processConfirmationResponse,
  hasPendingConfirmation,
  processPositiveConfirmation,
  processNegativeConfirmation,
  processAmbiguousResponse
};
