/**
 * ✅ Validaciones mejoradas para reservas
 * Asegura que las reservas cumplan con todas las reglas de negocio
 */

import { HOURS } from '../utils/coworkia-facts.js';

// Configuración de horarios de negocio
const BUSINESS_CONFIG = {
  // Horarios laborales (horario de Ecuador UTC-5)
  // IMPORTANTE: Debe coincidir con lo que Aurora comunica a los usuarios
  weekdayStart: HOURS.open24,
  weekdayEnd: HOURS.close24,
  weekendStart: null,
  weekendEnd: null,
  
  // Restricciones de duración
  minDurationHours: 2,    // Mínimo 2 horas (no existe tarifa de 1 hora)
  maxDurationHours: 12,   // Sin cap artificial — limitado por horario de negocio + grace
  defaultDurationHours: 2,
  
  // Ventana de reserva
  minAdvanceHours: 2,    // Mínimo 2 horas de anticipación
  maxAdvanceDays: 90,    // Máximo 90 días adelante (3 meses)
  
  // Break de almuerzo
  lunchBreakStart: '12:30',
  lunchBreakEnd: '14:00'
};

/**
 * 🕐 Valida que el horario esté dentro del horario laboral
 */
export function validateBusinessHours(date, startTime, endTime) {
  // Usar date string con hora para evitar timezone issues
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  if (isWeekend) {
    return {
      valid: false,
      reason: `Fuera del horario laboral (${HOURS.display})`,
      suggestion: `Horario disponible: ${HOURS.display}`
    };
  }

  const businessStart = BUSINESS_CONFIG.weekdayStart;
  const businessEnd = BUSINESS_CONFIG.weekdayEnd;
  
  // Convertir a minutos para comparación fácil
  const toMinutes = (time) => {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  };
  
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  const businessStartMinutes = toMinutes(businessStart);
  const businessEndMinutes = toMinutes(businessEnd);
  if (startMinutes < businessStartMinutes || endMinutes > businessEndMinutes) {
    return {
      valid: false,
      reason: `Fuera del horario laboral (${HOURS.display})`,
      suggestion: `Horario disponible: ${HOURS.display}`
    };
  }
  
  return { valid: true };
}

/**
 * ⏰ Valida la duración de la reserva
 */
export function validateDuration(durationHours) {
  if (durationHours < BUSINESS_CONFIG.minDurationHours) {
    return {
      valid: false,
      reason: `Duración mínima: ${BUSINESS_CONFIG.minDurationHours} hora${BUSINESS_CONFIG.minDurationHours > 1 ? 's' : ''}`,
      suggestion: `Las reservas deben ser de al menos ${BUSINESS_CONFIG.minDurationHours} hora${BUSINESS_CONFIG.minDurationHours > 1 ? 's' : ''}`
    };
  }
  
  if (durationHours > BUSINESS_CONFIG.maxDurationHours) {
    return {
      valid: false,
      reason: `Duración máxima: ${BUSINESS_CONFIG.maxDurationHours} horas (jornada completa)`,
      suggestion: `Puedes reservar hasta ${BUSINESS_CONFIG.maxDurationHours} horas dentro del horario laboral`
    };
  }
  
  return { valid: true };
}

/**
 * 📅 Valida la ventana de tiempo permitida para reservar
 */
export function validateReservationWindow(date, time) {
  // IMPORTANTE: Obtener hora actual en timezone Ecuador
  const formatter = new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const hour = parts.find(p => p.type === 'hour').value;
  const minute = parts.find(p => p.type === 'minute').value;
  const second = parts.find(p => p.type === 'second').value;
  
  const nowEcuador = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`);
  const reservationDateTime = new Date(`${date}T${time}:00-05:00`); // Explicit Ecuador timezone
  
  const hoursUntilReservation = (reservationDateTime - nowEcuador) / (1000 * 60 * 60);
  const daysUntilReservation = (reservationDateTime - nowEcuador) / (1000 * 60 * 60 * 24);
  
  // Validar mínimo de anticipación (más flexible para desarrollo)
  // Solo rechazar si es literalmente en el pasado o muy cercano (30 min)
  if (hoursUntilReservation < -0.5) {
    return {
      valid: false,
      reason: `No se pueden hacer reservas para horarios pasados`,
      suggestion: `Por favor, selecciona un horario futuro`
    };
  }
  
  // Validar máximo de anticipación
  if (daysUntilReservation > BUSINESS_CONFIG.maxAdvanceDays) {
    return {
      valid: false,
      reason: `Las reservas se pueden hacer con máximo ${BUSINESS_CONFIG.maxAdvanceDays} días de anticipación`,
      suggestion: `Intenta reservar para una fecha dentro de los próximos ${BUSINESS_CONFIG.maxAdvanceDays} días`
    };
  }
  
  return { valid: true };
}

/**
 * 🍴 Valida si interfiere con el break de almuerzo
 */
export function validateLunchBreak(startTime, endTime) {
  const toMinutes = (time) => {
    const [hours, mins] = time.split(':').map(Number);
    return hours * 60 + mins;
  };
  
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  const lunchStart = toMinutes(BUSINESS_CONFIG.lunchBreakStart);
  const lunchEnd = toMinutes(BUSINESS_CONFIG.lunchBreakEnd);
  
  // Verificar si la reserva interfiere con el almuerzo
  const overlapsLunch = (startMinutes < lunchEnd && endMinutes > lunchStart);
  
  if (overlapsLunch) {
    return {
      valid: false,
      reason: `La reserva interfiere con el horario de almuerzo (${BUSINESS_CONFIG.lunchBreakStart} - ${BUSINESS_CONFIG.lunchBreakEnd})`,
      suggestion: `Considera reservar antes de ${BUSINESS_CONFIG.lunchBreakStart} o después de ${BUSINESS_CONFIG.lunchBreakEnd}`,
      warning: true // Es warning, no error crítico
    };
  }
  
  return { valid: true };
}

/**
 * 🔍 Validación completa de una reserva
 */
export function validateReservation(date, startTime, endTime, durationHours) {
  const errors = [];
  const warnings = [];
  
  // 1. Validar duración
  const durationValidation = validateDuration(durationHours);
  if (!durationValidation.valid) {
    errors.push(durationValidation);
  }
  
  // 2. Validar horario laboral
  const businessHoursValidation = validateBusinessHours(date, startTime, endTime);
  if (!businessHoursValidation.valid) {
    errors.push(businessHoursValidation);
  }
  
  // 3. Validar ventana de reserva
  const windowValidation = validateReservationWindow(date, startTime);
  if (!windowValidation.valid) {
    errors.push(windowValidation);
  }
  
  // 4. Validar break de almuerzo (solo warning)
  const lunchValidation = validateLunchBreak(startTime, endTime);
  if (!lunchValidation.valid && lunchValidation.warning) {
    warnings.push(lunchValidation);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    hasWarnings: warnings.length > 0
  };
}

/**
 * 🔄 Sugiere horarios alternativos si hay conflictos
 */
export function suggestAlternativeSlots(date, requestedStart, durationHours, existingReservations = []) {
  const alternatives = [];
  const businessStart = HOURS.open24;
  const businessEnd = HOURS.close24;
  
  // Convertir hora solicitada a minutos para calcular proximidad
  const [reqH, reqM] = (requestedStart || '12:00').split(':').map(Number);
  const requestedMinutes = reqH * 60 + (reqM || 0);
  
  // Generar slots de 30 minutos durante todo el día
  const slots = [];
  let currentTime = businessStart;
  
  while (currentTime < businessEnd) {
    const [hours, mins] = currentTime.split(':').map(Number);
    const endHours = hours + durationHours;
    const endTime = `${endHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    
    if (endTime <= businessEnd) {
      // Verificar si hay conflicto con reservas existentes
      const hasConflict = existingReservations.some(res => {
        return res.date === date && 
               res.startTime < endTime && 
               res.endTime > currentTime &&
               res.status === 'confirmed';
      });
      
      if (!hasConflict) {
        const validation = validateReservation(date, currentTime, endTime, durationHours);
        if (validation.valid) {
          const slotMinutes = hours * 60 + mins;
          alternatives.push({
            startTime: currentTime,
            endTime,
            durationHours,
            _distance: Math.abs(slotMinutes - requestedMinutes) // proximidad al horario pedido
          });
        }
      }
    }
    
    // Avanzar 30 minutos
    const totalMinutes = hours * 60 + mins + 30;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    currentTime = `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  }
  
  // Ordenar por proximidad al horario solicitado (más cercano primero)
  alternatives.sort((a, b) => a._distance - b._distance);
  
  // Limpiar campo interno y devolver top 5
  return alternatives.slice(0, 5).map(({ _distance, ...alt }) => ({ ...alt, recommended: true }));
}

/**
 * ⏭️ Calcula el próximo horario disponible
 */
function getNextAvailableTime(fromDate, hoursAhead) {
  const next = new Date(fromDate.getTime() + hoursAhead * 60 * 60 * 1000);
  const hours = next.getHours();
  const mins = next.getMinutes();
  
  // Redondear al siguiente slot de 30 minutos
  const roundedMins = mins < 30 ? 30 : 0;
  const roundedHours = mins >= 30 ? hours + 1 : hours;
  
  const date = next.toISOString().split('T')[0];
  const time = `${roundedHours.toString().padStart(2, '0')}:${roundedMins.toString().padStart(2, '0')}`;
  
  return { date, time };
}

/**
 * 📊 Genera mensaje amigable con los errores de validación
 */
export function formatValidationErrors(validation) {
  if (validation.valid && !validation.hasWarnings) {
    return null;
  }
  
  let message = '';
  
  if (!validation.valid) {
    message += '❌ *No se puede completar la reserva:*\n\n';
    validation.errors.forEach((error, index) => {
      message += `${index + 1}. ${error.reason}\n`;
      if (error.suggestion) {
        message += `   💡 ${error.suggestion}\n`;
      }
      message += '\n';
    });
  }
  
  if (validation.hasWarnings) {
    message += '⚠️ *Advertencia:*\n\n';
    validation.warnings.forEach((warning) => {
      message += `• ${warning.reason}\n`;
      if (warning.suggestion) {
        message += `  ${warning.suggestion}\n`;
      }
    });
  }
  
  return message.trim();
}

export const CONFIG = BUSINESS_CONFIG;
