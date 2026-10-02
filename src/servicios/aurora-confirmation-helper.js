/**
 * 🎯 Helper para integrar sistema de confirmaciones con Aurora
 * Permite que Aurora active confirmaciones SI/NO desde sus respuestas
 */

import confirmationFlowService, { generateConfirmationMessage } from './confirmation-flow.js';
import databaseService from '../database/database.js';
import calendario, { checkAvailability } from './calendario.js';
import { 
  validateReservation, 
  suggestAlternativeSlots, 
  formatValidationErrors 
} from './reservation-validation.js';
import { savePendingConfirmation } from '../perfiles-interacciones/memoria-sqlite.js';
import reservationRepository from '../database/reservationRepository.js';
import { normalizeTimeFormat, parseDate } from '../utils/date-time-parser.js';
import { HOURS } from '../utils/coworkia-facts.js';

/**
 * ✅ Detecta si Aurora quiere activar un flujo de confirmación
 */
export function shouldActivateConfirmation(message) {
  // Patrones que indican que Aurora quiere activar confirmación
  const confirmationTriggers = [
    /confirmas?\s+(esta\s+)?reserva/i,
    /\?\s*responde\s+(si|sí)/i,
    /continuar\s+con\s+el\s+pago/i,
    /acepta[rs]?\s+(esta\s+)?reserva/i,
    /\[CONFIRMAR\]/i,
    /sistema\s+confirmacion/i,
    /responde\s+(si|sí)\s+para\s+continuar/i
  ];

  return confirmationTriggers.some(pattern => pattern.test(message));
}

/**
 * 🎯 Extrae datos de reserva de la respuesta de Aurora
 */
export function extractReservationData(message, userProfile) {
  try {
    // 🎯 DETECTAR TIPO DE SERVICIO DESDE EL MENSAJE
    let serviceType = 'hotDesk'; // Por defecto Hot Desk
    const guestCount = extractGuestCount(message);
    
    // Detectar sala de reunión
    const meetingRoomPatterns = [
      /sala\s+de\s+reun(ión|ion)/i,
      /meeting\s+room/i,
      /sala\s+reun(ión|ion)/i,
      /espacio\s+para\s+reun(ión|ion)/i,
      /sala\s+privada/i,
      /reunirse/i
    ];
    
    if (meetingRoomPatterns.some(pattern => pattern.test(message))) {
      serviceType = 'meetingRoom';
      if (process.env.DEBUG_MODE === 'true') {
        console.log('[DEBUG] 🏢 DETECTADO: Sala de Reunión solicitada');
      }
    }

    // 🎯 MEJORADO: Buscar patrones de fecha con más flexibilidad
    if (process.env.DEBUG_MODE === 'true') {
      console.log('[AURORA-EXTRACT] 📝 Analizando mensaje:', message.substring(0, 200) + '...');
    }
    
    // Detectar fechas: números, "hoy", "mañana", días de semana
    const dateMatch = message.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|mañana|ma\u00f1ana|hoy|hoi|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)/i);
    if (process.env.DEBUG_MODE === 'true') {
      console.log('[AURORA-EXTRACT] 📅 dateMatch:', dateMatch ? dateMatch[1] : 'NO DETECTADO');
    }
    
    // 🎯 MEJORADO: Detectar horarios con múltiples formatos naturales
    // Patrones: "10am", "10 am", "10:00", "10:30am", "3pm", "15:00", "6pm"
    // PRIORIDAD: Primero buscar con am/pm (más específico), luego formato 24h
    const timeMatch = message.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)/gi) ||  // "6pm", "10:30am"
                     message.match(/(\d{1,2}:\d{2})/g) ||                        // "14:30", "9:00"
                     message.match(/(\d{1,2})\s+(am|pm|AM|PM)/gi);               // "6 pm" con espacio
    if (process.env.DEBUG_MODE === 'true') {
      console.log('[AURORA-EXTRACT] 🕐 timeMatch:', timeMatch ? timeMatch : 'NO DETECTADO');
    }
    
    const priceMatch = message.match(/\$(\d+\.?\d*)/);
    const durationMatch = message.match(/(\d+)\s*hora[s]?/i);
    if (process.env.DEBUG_MODE === 'true') {
      console.log('[AURORA-EXTRACT] ⏱️ durationMatch:', durationMatch ? durationMatch[1] + 'h' : 'NO DETECTADO');
    }
    
    // 🚨 VALIDACIÓN TEMPRANA: Si no hay hora, abortar con mensaje útil
    if (!timeMatch || timeMatch.length === 0) {
      console.error('[AURORA-EXTRACT] ❌ NO SE DETECTÓ HORARIO en el mensaje');
      console.error('[AURORA-EXTRACT] 💡 Mensaje recibido:', message);
      return null; // Esto hará que Aurora pida aclaración
    }

    // Valores por defecto si no se detectan
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 🔧 FIX: Mejorar lógica de horarios - normalizar formato
    let startTime = '09:00';
    let endTime = '11:00';
    let durationHours = 2; // SIEMPRE 2 HORAS POR DEFECTO
    
    if (timeMatch && timeMatch.length >= 1) {
      // Normalizar primer horario detectado (SIEMPRE ES LA HORA DE INICIO)
      startTime = normalizeTimeFormat(timeMatch[0]);
      if (process.env.DEBUG_MODE === 'true') {
        console.log('[DEBUG] 🕐 startTime normalizado:', startTime);
      }
      
      // 🎯 Prioridad: 1) rango start-end en mensaje, 2) durationMatch explícita, 3) default 2h
      if (timeMatch && timeMatch.length >= 2) {
        // Hay dos tiempos en el mensaje (ej: "09:00 - 17:00" o "9am hasta las 5pm")
        const endNormalized = normalizeTimeFormat(timeMatch[1]);
        const startH = parseInt(startTime.split(':')[0]);
        const startM = parseInt(startTime.split(':')[1] || '0');
        const endH = parseInt(endNormalized.split(':')[0]);
        const endM = parseInt(endNormalized.split(':')[1] || '0');
        const diffMins = (endH * 60 + endM) - (startH * 60 + startM);
        if (diffMins > 0 && diffMins <= 13 * 60) {
          durationHours = Math.round(diffMins / 60 * 10) / 10;
          if (process.env.DEBUG_MODE === 'true') {
            console.log(`[AURORA-EXTRACT] 🎯 Rango detectado: ${startTime} → ${endNormalized} = ${durationHours}h`);
          }
        } else if (durationMatch) {
          durationHours = Math.min(parseInt(durationMatch[1]), 13);
        }
      } else if (durationMatch) {
        const requestedDuration = parseInt(durationMatch[1]);
        durationHours = Math.min(requestedDuration, 13);
        if (process.env.DEBUG_MODE === 'true') {
          console.log('[DEBUG] ⏱️ Duración explícita:', durationHours, 'horas');
        }
      } else {
        // Sin duración ni rango = 2 horas por defecto
        durationHours = 2;
      }
      
      // 🎯 CALCULAR endTime desde startTime + duración validada
      const startHour = parseInt(startTime.split(':')[0]);
      const startMinutes = parseInt(startTime.split(':')[1] || '0');
      
      // 🎯 FIX A6: Calcular endTime correctamente con duraciones decimales
      const startTotalMinutes = startHour * 60 + startMinutes;
      const durationMinutes = Math.round(durationHours * 60);
      const endTotalMinutes = startTotalMinutes + durationMinutes;
      let endHour = Math.floor(endTotalMinutes / 60);
      const endMin = endTotalMinutes % 60;
      
      // 🛡️ FIX: Validar desborde de día (ej: 23:30 + 2h → 01:30 del día siguiente)
      if (endHour >= 24) {
        endHour = endHour % 24; // Convertir 25:30 → 01:30
        if (process.env.DEBUG_MODE === 'true') {
          console.log('[DEBUG] ⚠️ Horario desbordaría día siguiente, ajustando a:', endHour);
        }
      }
      
      endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
      
      if (process.env.DEBUG_MODE === 'true') {
        console.log('[DEBUG] 📅 Horario final:', startTime, '-', endTime, `(${durationHours}h)`);
      }
    }

    const reservationDate = dateMatch ? parseDate(dateMatch[1]) : tomorrow.toISOString().split('T')[0];
    
    // 🚨 VALIDACIÓN: Usar zona horaria de Ecuador (America/Guayaquil) con Intl
    const now = new Date();
    const ecuadorFormatter = new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const ecuadorParts = ecuadorFormatter.formatToParts(now);
    const ecuadorHour = parseInt(ecuadorParts.find(p => p.type === 'hour').value);
    const ecuadorMinute = parseInt(ecuadorParts.find(p => p.type === 'minute').value);
    const ecuadorDate = `${ecuadorParts.find(p => p.type === 'year').value}-${ecuadorParts.find(p => p.type === 'month').value}-${ecuadorParts.find(p => p.type === 'day').value}`;
    
    if (process.env.DEBUG_MODE === 'true') {
      console.log('[VALIDATION] Hora Ecuador actual:', ecuadorHour, '- Fecha:', ecuadorDate);
      console.log('[VALIDATION] Horario solicitado:', startTime, 'fecha:', reservationDate);
    }
    
    // Solo validar si es el mismo día
    if (reservationDate === ecuadorDate) {
      const [requestedHourRaw, requestedMinutesRaw = '0'] = startTime.split(':');
      const requestedHour = parseInt(requestedHourRaw, 10);
      const requestedMinutes = parseInt(requestedMinutesRaw, 10);

      const isPastHour = requestedHour < ecuadorHour;
      const isSameHourPastMinutes = requestedHour === ecuadorHour && requestedMinutes <= ecuadorMinute;

      if (isPastHour || isSameHourPastMinutes) {
        console.warn('[VALIDATION] Horario en el pasado detectado Ecuador:', startTime, 'actual Ecuador:', ecuadorHour);
        // Ajustar a próxima hora disponible en Ecuador
        const nextHour = ecuadorHour + 1;
        startTime = `${nextHour.toString().padStart(2, '0')}:00`;
        const endHour = nextHour + durationHours;
        endTime = `${endHour.toString().padStart(2, '0')}:00`;
        if (process.env.DEBUG_MODE === 'true') {
          console.log('[VALIDATION] Horario ajustado Ecuador:', startTime, '-', endTime);
        }
      } else {
        if (process.env.DEBUG_MODE === 'true') {
          console.log('[VALIDATION] ✅ Horario válido para Ecuador');
        }
      }
    }

    // 🔧 CÁLCULO AUTOMÁTICO DE PRECIOS SEGÚN SERVICIO
    const { totalPrice, wasFree } = calculateServicePrice(
      serviceType, 
      durationHours, 
      guestCount, 
      userProfile, 
      priceMatch
    );

    return {
      date: reservationDate,
      startTime,
      endTime,
      durationHours,
      serviceType, // 🎯 Ahora detecta correctamente hotDesk o meetingRoom
      totalPrice,
      wasFree,
      guestCount,
      userId: userProfile.userId,
      userName: userProfile.name || 'Cliente'
    };
  } catch (error) {
    console.error('[Confirmation Helper] Error extrayendo datos:', error);
    return null;
  }
}

/**

 * 🎯 Procesa y activa confirmación desde respuesta de Aurora
 */
export async function processAuroraConfirmationRequest(originalMessage, userProfile, formResult = null) {
  try {
    console.log('[AURORA-PROCESS] 🎯 Iniciando procesamiento de confirmación');
    console.log('[AURORA-PROCESS] 👤 Usuario:', userProfile.userId);
    console.log('[AURORA-PROCESS] 📨 Mensaje:', originalMessage.substring(0, 150) + '...');
    console.log('[AURORA-PROCESS] 📋 FormResult disponible:', formResult ? 'SÍ' : 'NO');
    
    // 1. PRIORIDAD: Usar datos del formulario parcial si están disponibles
    let reservationData = null;
    
    if (formResult && formResult.form) {
      const form = formResult.form;
      console.log('[AURORA-PROCESS] 📝 Usando datos del formulario parcial:', {
        spaceType: form.spaceType,
        date: form.date,
        time: form.time,
        email: form.email
      });
      
      // Construir reservationData desde el formulario
      if (form.date && form.time && form.spaceType) {
        const [hour, minutes = '0'] = form.time.split(':');
        
        // 🎯 FIX A6: Calcular endTime correctamente con duraciones decimales
        const startMinutes = parseInt(hour) * 60 + parseInt(minutes);
        const durationMinutes = Math.round((form.durationHours || 2) * 60);
        const endMinutes = startMinutes + durationMinutes;
        const endHour = Math.floor(endMinutes / 60) % 24;
        const endMin = endMinutes % 60;
        
        const _serviceType = form.spaceType === 'meetingRoom' ? 'meetingRoom' : 'hotDesk';
        const _isFreeWindow = !userProfile.freeTrialUsed && _serviceType === 'hotDesk' && (() => {
          const mins = form.time ? parseInt(form.time.split(':')[0]) * 60 + parseInt(form.time.split(':')[1] || '0') : -1;
          return mins >= 8 * 60 && mins <= 12 * 60;
        })();

        // ✅ Resolver totalPrice de forma robusta:
        // 1) valor explícito en form.totalPrice
        // 2) cálculo de la instancia PartialReservationForm (calculateTotalWithTaxes)
        // 3) fallback a precio base
        let resolvedTotalPrice = Number.isFinite(Number(form.totalPrice)) ? Number(form.totalPrice) : 0;
        if (resolvedTotalPrice <= 0 && typeof form.calculateTotalWithTaxes === 'function' && form.paymentMethod) {
          const pricing = form.calculateTotalWithTaxes();
          resolvedTotalPrice = Number.isFinite(Number(pricing?.total)) ? Number(pricing.total) : 0;
        }
        if (resolvedTotalPrice <= 0 && typeof form.getBasePrice === 'function') {
          const base = Number(form.getBasePrice());
          resolvedTotalPrice = Number.isFinite(base) ? base : 0;
        }
        if (_isFreeWindow) {
          resolvedTotalPrice = 0;
        }

        reservationData = {
          userId: form.isAdminBooking ? form.beneficiaryPhone : userProfile.userId,
          userName: form.isAdminBooking ? form.beneficiaryName : (userProfile.name || 'Cliente'),
          bookedByPhone: form.isAdminBooking ? userProfile.userId : null,
          reservationFor: form.isAdminBooking ? form.reservationFor : null,
          date: form.date,
          startTime: form.time,
          endTime: `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`,
          durationHours: form.durationHours || 2,
          serviceType: _serviceType,
          email: form.isAdminBooking ? form.beneficiaryEmail : (form.email || userProfile.email),
          numPeople: form.numPeople || 1,
          paymentMethod: form.paymentMethod || null, // 💳 efectivo | transferencia | tarjeta
          totalPrice: resolvedTotalPrice,
          // wasFree: primera visita + hotDesk + dentro ventana 08:00–12:00
          wasFree: form.reservationFor === 'other' ? false : _isFreeWindow
        };
        
        console.log('[AURORA-PROCESS] ✅ Datos construidos desde formulario:', reservationData);
      }
    }
    
    // 2. Fallback: Intentar extraer del mensaje si no hay formulario
    if (!reservationData) {
      console.log('[AURORA-PROCESS] 📨 Intentando extraer datos del mensaje (fallback)...');
      reservationData = extractReservationData(originalMessage, userProfile);
    }
    
    if (!reservationData) {
      console.error('[AURORA-PROCESS] ❌ FALLO: No se pudieron obtener datos de reserva');
      console.error('[AURORA-PROCESS] 💡 Mensaje:', originalMessage.substring(0, 200));
      console.error('[AURORA-PROCESS] 💡 Formulario:', formResult ? 'disponible pero incompleto' : 'no disponible');
      
      // 🎯 RESPUESTA AMIGABLE: Explica qué falta
      return {
        success: false,
        error: 'parsing_failed',
        userMessage: `Lo siento, no logré entender la hora que mencionaste 🤔

Por favor, intenta así:
• "Quiero un hot desk para hoy a las 10am"
• "Necesito una sala para mañana a las 2pm"
• "Hot desk el lunes a las 9:00"

¿A qué hora te gustaría venir?`
      };
    }
    
    console.log('[AURORA-PROCESS] ✅ Datos extraídos:', {
      date: reservationData.date,
      startTime: reservationData.startTime,
      endTime: reservationData.endTime,
      duration: reservationData.durationHours,
      serviceType: reservationData.serviceType
    });

    // 1.5. 🕐 VALIDACIÓN PREVIA: Verificar que fecha/hora no estén en el pasado
    const now = new Date();
    const ecuadorFormatter = new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const ecuadorParts = ecuadorFormatter.formatToParts(now);
    const currentEcuadorDate = `${ecuadorParts.find(p => p.type === 'year').value}-${ecuadorParts.find(p => p.type === 'month').value}-${ecuadorParts.find(p => p.type === 'day').value}`;
    const currentEcuadorHour = parseInt(ecuadorParts.find(p => p.type === 'hour').value);
    const currentEcuadorMinute = parseInt(ecuadorParts.find(p => p.type === 'minute').value);
    
    // Comparar fechas
    const requestedDate = new Date(reservationData.date + 'T00:00:00');
    const ecuadorCurrentDate = new Date(currentEcuadorDate + 'T00:00:00');
    
    // 🚫 VALIDAR DÍA DE LA SEMANA - Domingo cerrado
    const dayOfWeek = requestedDate.getDay(); // 0 = domingo, 6 = sábado
    
    if (dayOfWeek === 0) {
      console.warn('[AURORA-PROCESS] 🚫 Domingo detectado - Coworkia CERRADO');
      
      // Sugerir lunes siguiente (mañana si es domingo)
      const nextMonday = new Date(requestedDate);
      nextMonday.setDate(nextMonday.getDate() + 1); // Domingo + 1 día = Lunes
      
      // Formatear lunes usando timezone Ecuador
      const formatter = new Intl.DateTimeFormat('es-EC', {
        timeZone: 'America/Guayaquil',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const mondayParts = formatter.formatToParts(nextMonday);
      const nextMondayStr = `${mondayParts.find(p => p.type === 'year').value}-${mondayParts.find(p => p.type === 'month').value}-${mondayParts.find(p => p.type === 'day').value}`;
      
      return {
        success: false,
        error: 'closed_sunday',
        userMessage: `🚫 Los domingos Coworkia está cerrado, Diego 😊

Estamos abiertos:
📅 ${HOURS.display}

¿Qué tal si reservas para el lunes ${nextMondayStr}? 🗓️`
      };
    }
    
    // 🎉 VALIDAR FERIADOS - Cerrado en días festivos (2026)
    const FERIADOS_ECUADOR = [
      '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-05-01',
      '2026-05-24', '2026-07-24', '2026-08-10', '2026-10-09', '2026-11-02',
      '2026-11-03', '2026-12-25', '2026-12-31'
    ];
    
    const NOMBRES_FERIADOS = {
      '01-01': 'Año Nuevo', '02-10': 'Carnaval', '02-11': 'Carnaval',
      '02-16': 'Carnaval', '02-17': 'Carnaval', '03-28': 'Viernes Santo',
      '04-03': 'Viernes Santo', '05-01': 'Día del Trabajo', 
      '05-24': 'Batalla de Pichincha', '07-24': 'Natalicio de Simón Bolívar',
      '08-10': 'Primer Grito de Independencia', '10-09': 'Independencia de Guayaquil',
      '11-02': 'Día de los Difuntos', '11-03': 'Independencia de Cuenca',
      '12-25': 'Navidad', '12-31': 'Fin de Año'
    };
    
    if (FERIADOS_ECUADOR.includes(reservationData.date)) {
      const monthDay = reservationData.date.substring(5);
      const nombreFeriado = NOMBRES_FERIADOS[monthDay] || 'Feriado';
      console.warn('[AURORA-PROCESS] 🎉 Feriado detectado:', nombreFeriado);
      
      // Buscar siguiente día hábil
      let nextWorkingDay = new Date(requestedDate);
      let daysToAdd = 1;
      
      while (daysToAdd < 7) {
        nextWorkingDay.setDate(nextWorkingDay.getDate() + 1);
        const nextDateStr = nextWorkingDay.toISOString().split('T')[0];
        const nextDayOfWeek = nextWorkingDay.getDay();
        
        // Si no es domingo ni feriado, es día hábil
        if (nextDayOfWeek !== 0 && !FERIADOS_ECUADOR.includes(nextDateStr)) {
          break;
        }
        daysToAdd++;
      }
      
      const nextWorkingDayStr = nextWorkingDay.toISOString().split('T')[0];
      
      return {
        success: false,
        error: 'closed_holiday',
        userMessage: `🎉 ${nombreFeriado} - Coworkia está cerrado, Diego 😊

Los feriados no atendemos, pero puedes reservar para el próximo día hábil.

¿Qué tal si reservas para el ${nextWorkingDayStr}? 📅`
      };
    }
    
    if (requestedDate < ecuadorCurrentDate) {
      // Fecha en el pasado
      console.warn('[AURORA-PROCESS] 📅 Fecha en el pasado:', reservationData.date, 'vs', currentEcuadorDate);
      return {
        success: false,
        error: 'past_date',
        userMessage: `⚠️ Esa fecha ya pasó en el calendario, Diego 😅

📅 La fecha que mencionaste es: ${reservationData.date}
🗓️ Hoy es: ${currentEcuadorDate}

Por favor, verifica la fecha de tu reserva e intenta nuevamente. ¿Para qué día quieres venir? 😊`
      };
    } else if (requestedDate.getTime() === ecuadorCurrentDate.getTime()) {
      // Mismo día - verificar hora
      const [reqHour, reqMin = '0'] = reservationData.startTime.split(':');
      const requestedHour = parseInt(reqHour);
      const requestedMinute = parseInt(reqMin);
      
      // 🎯 FIX A6: Permitir reservas con 5 minutos de buffer (ej: si son 10:45, permitir hasta 10:40)
      const requestedTotalMinutes = requestedHour * 60 + requestedMinute;
      const currentTotalMinutes = currentEcuadorHour * 60 + currentEcuadorMinute;
      const BUFFER_MINUTES = 5;
      
      const isPast = requestedTotalMinutes < (currentTotalMinutes - BUFFER_MINUTES);
      
      if (isPast) {
        console.warn('[AURORA-PROCESS] ⏰ Hora en el pasado:', reservationData.startTime, 'vs', `${currentEcuadorHour}:${currentEcuadorMinute}`);
        
        // Sugerir próxima hora disponible
        const nextAvailableHour = currentEcuadorHour + 1;
        
        return {
          success: false,
          error: 'past_time',
          userMessage: `⏰ Esa hora ya pasó, Diego 😅

🕐 La hora que mencionaste: ${reservationData.startTime}
🕐 Hora actual en Ecuador: ${currentEcuadorHour.toString().padStart(2, '0')}:${currentEcuadorMinute.toString().padStart(2, '0')}

¿Qué tal si reservas para las ${nextAvailableHour.toString().padStart(2, '0')}:00 o más tarde? 😊`
        };
      }
    }

    // 2. ✅ VALIDACIONES MEJORADAS: Duración, horario laboral, ventana de reserva
    const validation = validateReservation(
      reservationData.date,
      reservationData.startTime,
      reservationData.endTime,
      reservationData.durationHours
    );
    
    if (!validation.valid) {
      console.error('[AURORA-PROCESS] ❌ VALIDACIÓN FALLIDA:', validation.errors);
      
      // Obtener reservas existentes del día para evitar conflictos
      let existingReservations = [];
      try {
        const allReservations = await reservationRepository.findByDate(reservationData.date);
        existingReservations = allReservations.filter(r => 
          r.status !== 'cancelled' && r.status !== 'rejected'
        );
        console.log('[AURORA-PROCESS] 📅 Reservas del día:', existingReservations.length);
      } catch (error) {
        console.error('[AURORA-PROCESS] ⚠️ Error obteniendo reservas:', error);
      }
      
      // Sugerir horarios alternativos considerando reservas reales
      const alternatives = suggestAlternativeSlots(
        reservationData.date,
        reservationData.startTime,
        reservationData.durationHours,
        existingReservations
      );
      
      console.log('[AURORA-PROCESS] 💡 Alternativas sugeridas:', alternatives.slice(0, 3));
      
      // 🎯 RESPUESTA AMIGABLE basada en el tipo de error
      let userMessage = '';
      
      // FIX: validation.errors contiene objetos {valid, reason, suggestion}, no strings
      if (validation.errors.some(err => err.reason?.includes('horario') || err.reason?.includes('Fuera del horario'))) {
        userMessage += `❌ Ese horario no está disponible 😕

📅 ¿Qué tal alguna de estas opciones?
${alternatives.slice(0, 3).map((alt, i) => `${i+1}. ${alt.startTime} - ${alt.endTime}`).join('\n')}

¿Te sirve alguna?`;
      } else if (validation.errors.some(err => err.reason?.includes('duración') || err.reason?.includes('Duración'))) {
        // 🎯 FIX: Mensaje detallado con horario solicitado y límites correctos
        const calcEndTime = (start, durationH) => {
          const [h, m] = start.split(':').map(Number);
          const totalMin = h * 60 + (m || 0) + Math.round(durationH * 60);
          const eh = Math.floor(totalMin / 60) % 24;
          const em = totalMin % 60;
          return `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`;
        };
        
        const endTime = calcEndTime(reservationData.startTime, reservationData.durationHours);
        const isOverMax = reservationData.durationHours > 12;
        
        if (isOverMax) {
          // Calcular el máximo hasta las 7pm (cierre)
          const closeTime = HOURS.close24;
          const [startH, startM] = reservationData.startTime.split(':').map(Number);
          const [closeH, closeM] = closeTime.split(':').map(Number);
          const startMinutes = startH * 60 + startM;
          const closeMinutes = closeH * 60 + closeM;
          const maxDurationToClose = Math.floor((closeMinutes - startMinutes) / 60 * 10) / 10;
          const suggestedDuration = Math.min(12, maxDurationToClose);
          const suggestedEnd = calcEndTime(reservationData.startTime, suggestedDuration);
          const basePricePerHour = 5; // $5 por hora
          const baseTotal = suggestedDuration * basePricePerHour;
          const totalWithTax = Math.round(baseTotal * 1.15 * 100) / 100;
          
          userMessage += `⚠️ La reserva que solicitaste excede nuestro límite:

📍 *Tu solicitud:*
🕐 Horario: ${reservationData.startTime} - ${endTime}
⏱️ Duración: ${reservationData.durationHours}h

📋 *Límites de reserva:*
• Mínimo: 2 horas
• Horario: ${HOURS.display}

💡 *Ajustando a máximo disponible:*
🕐 ${reservationData.startTime} - ${suggestedEnd} (${suggestedDuration}h)
💰 Costo: $${baseTotal} base + IVA = $${totalWithTax} total

¿Te parece bien con ${suggestedDuration} horas?`;
        } else {
          userMessage += `❌ La duración mínima es 2 horas 🕐

*Tu solicitud:*
🕐 ${reservationData.startTime} - ${endTime}
⏱️ Duración: ${reservationData.durationHours}h

¿Cuántas horas necesitas? (mínimo 2h)`;
        }
      } else {
        userMessage += '❌ ' + formatValidationErrors(validation);
      }
      
      return {
        success: false,
        error: 'validation_failed',
        userMessage,
        alternatives: alternatives.slice(0, 3).map(alt => 
          `${alt.startTime} - ${alt.endTime} (${alt.durationHours}h)`
        ),
        validationDetails: validation
      };
    }
    
    // Log warnings pero continuar
    if (validation.hasWarnings) {
      console.log('[Validation] ⚠️ Advertencias:', validation.warnings);
    }

    // 3. Verificar disponibilidad (pasando userId para ignorar reservas pending propias)
    const availability = await checkAvailability(
      reservationData.date,
      reservationData.startTime,
      reservationData.durationHours,
      reservationData.serviceType,
      null, // baseTime
      userProfile.userId, // userId para ignorar sus propias reservas pending
      reservationData.serviceType === 'hotDesk' ? (reservationData.desksQuantity || 1) : 1
    );

    if (!availability.available) {
      console.error('[AURORA-PROCESS] ❌ NO DISPONIBLE:', availability.reason);
      console.log('[AURORA-PROCESS] 💡 Alternativas de calendario:', availability.alternatives);
      
      // 🎯 RESPUESTA AMIGABLE con alternativas
      const altText = availability.alternatives && availability.alternatives.length > 0
        ? `\n\n📅 ¿Qué tal estos horarios?\n${availability.alternatives.slice(0, 3).map((alt, i) => 
            `${i+1}. ${alt.startTime || alt}`
          ).join('\n')}`
        : '\n\n¿Prefieres otro horario? 😊';
      
      return {
        success: false,
        error: 'availability_failed',
        userMessage: `⚠️ ${availability.reason}${altText}`,
        alternatives: availability.alternatives
      };
    }
    
    console.log('[AURORA-PROCESS] ✅ Disponibilidad confirmada');

    // 3. Guardar confirmación pendiente
    await savePendingConfirmation(userProfile.userId, reservationData);

    // 4. Generar mensaje de confirmación
    const confirmationMessage = generateConfirmationMessage(reservationData, userProfile);

    return {
      success: true,
      confirmationMessage,
      reservationData,
      replaceOriginalMessage: true
    };

  } catch (error) {
    console.error('[Confirmation Helper] Error procesando solicitud:', error);
    console.error('[Confirmation Helper] Stack trace:', error.stack);
    console.error('[Confirmation Helper] Error name:', error.name);
    console.error('[Confirmation Helper] Error message:', error.message);
    return {
      success: false,
      error: 'Error interno procesando confirmación',
      userMessage: `¡Ups! 😅 Tuve un problema técnico procesando tu reserva.\n\n¿Podrías intentar de nuevo o probar con otro horario? 🔄`
    };
  }
}

/**
 * 🧠 Modifica respuesta de Aurora para incluir confirmación si es necesario
 */
export async function enhanceAuroraResponse(originalResponse, userProfile, formResult = null) {
  try {
    // Verificar si Aurora quiere activar confirmación
    if (!shouldActivateConfirmation(originalResponse)) {
      return {
        enhanced: false,
        finalMessage: originalResponse
      };
    }

    console.log('[Confirmation Helper] Aurora quiere activar confirmación, procesando...');
    console.log('[Confirmation Helper] FormResult disponible:', formResult ? 'SÍ' : 'NO');

    // 🚨 GUARD: Si el usuario acaba de confirmar o ya tiene una confirmación pendiente,
    // evitar re-activar el sistema de confirmación para prevenir loops.
    if (userProfile?.justConfirmed) {
      console.log('[Confirmation Helper] ⚠️ Usuario en ventana justConfirmed - no reactivar confirmación');
      return {
        enhanced: false,
        finalMessage: originalResponse,
        note: 'skipped_due_to_justConfirmed'
      };
    }

    if (userProfile?.pendingConfirmation) {
      console.log('[Confirmation Helper] ⚠️ Ya existe pendingConfirmation - evitando re-activación');
      return {
        enhanced: false,
        finalMessage: originalResponse,
        note: 'skipped_due_to_existing_pending'
      };
    }

    const confirmationResult = await processAuroraConfirmationRequest(originalResponse, userProfile, formResult);

    if (!confirmationResult.success) {
      console.log('[Confirmation Helper] ❌ Error:', confirmationResult.error);
      
      // 🎯 USAR MENSAJE PERSONALIZADO si está disponible
      const errorMessage = confirmationResult.userMessage 
        ? confirmationResult.userMessage
        : generateErrorMessage(confirmationResult.error, confirmationResult.alternatives);
      
      console.log('[Confirmation Helper] 💬 Mensaje de error generado:', errorMessage.substring(0, 100) + '...');
      
      return {
        enhanced: true, // Sí modificamos el mensaje
        finalMessage: errorMessage,
        error: confirmationResult.error
      };
    }

    return {
      enhanced: true,
      finalMessage: confirmationResult.confirmationMessage,
      reservationData: confirmationResult.reservationData,
      originalMessage: originalResponse
    };

  } catch (error) {
    console.error('[Confirmation Helper] Error enhancing response:', error);
    return {
      enhanced: false,
      finalMessage: originalResponse,
      error: error.message
    };
  }
}

/**
 * � Genera mensaje de error amigable cuando falla la confirmación
 */
function generateErrorMessage(error, alternatives) {
  let message = '¡Ups! 😅 ';
  
  // Identificar tipo de error y dar respuesta apropiada
  if (error.includes('Fuera del horario laboral')) {
    message += `Ese horario está fuera de nuestro horario de atención (${HOURS.display}). `;
    message += '\n\n¿Te gustaría reservar para mañana o en otro horario? 🗓️';
  } else if (error.includes('pasado')) {
    message += 'Ese horario ya pasó. ';
    message += '\n\n¿Prefieres reservar para mañana o más tarde hoy? 📅';
  } else if (error.includes('ocupado') || error.includes('no disponible')) {
    message += 'Ese horario ya está ocupado. ';
    if (alternatives && alternatives.length > 0) {
      message += '\n\nTe sugiero estas alternativas:\n';
      alternatives.forEach(alt => {
        message += `• ${alt}\n`;
      });
    } else {
      message += '\n\n¿Te gustaría probar otro horario? 🕐';
    }
  } else {
    message += 'No pude procesar esa reserva. ';
    message += '\n\n¿Podrías intentar con otro horario o fecha? 🤔';
  }
  
  return message;
}

/**
 * �👥 Extrae número de acompañantes del mensaje
 */
function extractGuestCount(message) {
  const guestPatterns = [
    /(\d+)\s*personas?/i,
    /somos\s+(\d+)/i,
    /(\d+)\s*acompañantes?/i,
    /\+(\d+)/i,
    /con\s+(\d+)/i
  ];
  
  for (const pattern of guestPatterns) {
    const match = message.match(pattern);
    if (match) {
      const count = parseInt(match[1]);
      return Math.max(0, count - 1); // Restar 1 porque el cliente no cuenta como acompañante
    }
  }
  
  return 0; // Sin acompañantes por defecto
}

/**
 * 💰 Calcula precio automáticamente según tipo de servicio
 */
function calculateServicePrice(serviceType, durationHours, guestCount, userProfile, priceMatch) {
  const isFirstTimeUser = !userProfile.freeTrialUsed;
  
  // Si hay precio explícito en el mensaje de Aurora, usar ese
  if (priceMatch) {
    return {
      totalPrice: parseFloat(priceMatch[1]),
      wasFree: false
    };
  }
  
  // SALA DE REUNIÓN - NUNCA GRATIS, SIEMPRE PAGADA
  if (serviceType === 'meetingRoom') {
    // $29 por sala (primeras 2h), luego $15 por hora adicional
    const totalPeople = 1 + guestCount;
    
    // Validar capacidad (3-4 personas)
    if (totalPeople < 3 || totalPeople > 4) {
      console.log(`[PRICING] ⚠️ Sala de Reunión requiere 3-4 personas (solicitaron: ${totalPeople})`);
      return {
        totalPrice: 0,
        wasFree: false,
        error: totalPeople < 3 ? 'Sala de reuniones requiere mínimo 3 personas' : 'Sala de reuniones tiene capacidad máxima de 4 personas'
      };
    }
    
    let totalPrice = 0;
    if (durationHours <= 2) {
      totalPrice = 29.0;
    } else {
      const additionalHours = durationHours - 2;
      totalPrice = 29.0 + (additionalHours * 15.0);
    }
    
    console.log(`[PRICING] 🏢 Sala de Reunión: ${totalPeople} personas × ${durationHours}h = $${totalPrice}`);
    
    return {
      totalPrice,
      wasFree: false
    };
  }
  
  // HOT DESK - Puede ser gratis solo en primera visita
  // $10 por primeras 2h, luego $10 por hora adicional
  
  if (isFirstTimeUser && durationHours <= 2) {
    // Primera visita hasta 2 horas: GRATIS
    console.log('[PRICING] 🆓 Hot Desk GRATIS (primera visita, ≤2h)');
    return {
      totalPrice: 0,
      wasFree: true
    };
  } else if (isFirstTimeUser && durationHours > 2) {
    // Primera visita más de 2h: Gratis las primeras 2h, pagar el resto
    const paidHours = durationHours - 2;
    const totalPrice = paidHours * 10.0;
    console.log(`[PRICING] 🔄 Hot Desk Mixto: 2h gratis + ${paidHours}h × $10 = $${totalPrice}`);
    return {
      totalPrice,
      wasFree: false
    };
  } else {
    // Cliente recurrente: $10 por primeras 2h, luego $10 por hora adicional
    let totalPrice = 0;
    if (durationHours <= 2) {
      totalPrice = 10.0;
    } else {
      const additionalHours = durationHours - 2;
      totalPrice = 10.0 + (additionalHours * 10.0);
    }
    console.log(`[PRICING] 💰 Hot Desk Pagado: ${durationHours}h = $${totalPrice}`);
    return {
      totalPrice,
      wasFree: false
    };
  }
}

export default {
  shouldActivateConfirmation,
  extractReservationData,
  processAuroraConfirmationRequest,
  enhanceAuroraResponse
};
