// Sistema de Calendario para Coworkia
// Maneja disponibilidad, reservas y límites de espacios

import reservationRepository from '../database/reservationRepository.js';
import { HOURS } from '../utils/coworkia-facts.js';

const IS_TEST = (process.env.NODE_ENV || '').toLowerCase() === 'test';

/**
 * 📅 Configuración del calendario
 */
const CALENDAR_CONFIG = {
  maxSimultaneousSpaces: 5, // Máximo 5 espacios al mismo tiempo
  workingHours: {
    startMinutes: timeToMinutes(HOURS.open24),
    endMinutes: timeToMinutes(HOURS.close24)
  },
  timeSlots: 60, // Slots de 60 minutos
  availableSpaces: ['hotDesk1', 'hotDesk2', 'hotDesk3', 'hotDesk4', 'meetingRoom1', 'privateOffice1']
};

const BUFFER_MINUTES_BETWEEN_RESERVATIONS = 15; // Margen mínimo entre reservas

/**
 * 🎉 Feriados de Ecuador (actualizados anualmente)
 * Formato: 'YYYY-MM-DD'
 */
const FERIADOS_ECUADOR = [
  // 2026 - Feriados nacionales Ecuador
  
  // 2026 (adelantarse para no tener problemas)
  '2026-01-01', // Año Nuevo
  '2026-02-16', // Carnaval (lunes)
  '2026-02-17', // Carnaval (martes)
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajo
  '2026-05-24', // Batalla de Pichincha
  '2026-07-24', // Natalicio de Simón Bolívar
  '2026-08-10', // Primer Grito de Independencia
  '2026-10-09', // Independencia de Guayaquil
  '2026-11-02', // Día de los Difuntos
  '2026-11-03', // Independencia de Cuenca
  '2026-12-25', // Navidad
  '2026-12-31'  // Fin de Año
];

/**
 * 🎉 Verifica si una fecha es feriado en Ecuador
 */
function esFeriado(dateString) {
  return FERIADOS_ECUADOR.includes(dateString);
}

/**
 * 📅 Obtiene el nombre del feriado si aplica
 */
function getNombreFeriado(dateString) {
  const feriados = {
    '01-01': 'Año Nuevo',
    '02-10': 'Carnaval',
    '02-11': 'Carnaval',
    '02-16': 'Carnaval',
    '02-17': 'Carnaval',
    '03-28': 'Viernes Santo',
    '04-03': 'Viernes Santo',
    '05-01': 'Día del Trabajo',
    '05-24': 'Batalla de Pichincha',
    '07-24': 'Natalicio de Simón Bolívar',
    '08-10': 'Primer Grito de Independencia',
    '10-09': 'Independencia de Guayaquil',
    '11-02': 'Día de los Difuntos',
    '11-03': 'Independencia de Cuenca',
    '12-25': 'Navidad',
    '12-31': 'Fin de Año'
  };
  
  const monthDay = dateString.substring(5); // Extrae MM-DD de YYYY-MM-DD
  return feriados[monthDay] || 'Feriado';
}

const SERVICE_NAMES = {
  hotDesk: 'Hot Desk',
  meetingRoom: 'Sala de Reuniones',
  privateOffice: 'Oficina Privada'
};

function parseCapacity(value, fallback = 1) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SERVICE_CAPACITY = {
  // Total físico: 6 hot desks. Los permanentes se restan dinámicamente.
  hotDesk: IS_TEST ? 1 : parseCapacity(process.env.COWORKIA_HOTDESK_CAPACITY, 6),
  meetingRoom: parseCapacity(process.env.COWORKIA_MEETINGROOM_CAPACITY, 1),
  privateOffice: parseCapacity(process.env.COWORKIA_PRIVATEOFFICE_CAPACITY, 1)
};

function hasOverlapWithBuffer(startMinutes, endMinutes, resStart, resEnd, bufferMinutes = BUFFER_MINUTES_BETWEEN_RESERVATIONS) {
  // Requiere al menos buffer entre el fin de una y el inicio de la otra
  return !(endMinutes + bufferMinutes <= resStart || startMinutes >= resEnd + bufferMinutes);
}

function getServiceCapacity(serviceType) {
  return SERVICE_CAPACITY[serviceType] > 0 ? SERVICE_CAPACITY[serviceType] : 1;
}

function getServiceName(serviceType) {
  return SERVICE_NAMES[serviceType] || 'Espacio';
}

/**
 * � Valida el número de personas para Sala de Reuniones
 * @param {number} guestCount - Número de personas que asistirán
 * @returns {Object} { valid: boolean, reason?: string }
 */
export function validateMeetingRoomGuests(guestCount) {
  const min = parseInt(process.env.COWORKIA_MEETINGROOM_MIN_GUESTS || '3', 10);
  const max = parseInt(process.env.COWORKIA_MEETINGROOM_MAX_GUESTS || '4', 10);
  
  if (!guestCount || guestCount < min) {
    return {
      valid: false,
      reason: `La sala de reuniones es para grupos de ${min}-${max} personas 🏢\n\n¿Prefieres un Hot Desk? Perfecto para 1 persona ($10/2h) 💻`
    };
  }
  
  if (guestCount > max) {
    return {
      valid: false,
      reason: `Disculpa, nuestra sala acomoda máximo ${max} personas 😊\n\nNuestra infraestructura es compacta. ¿Tienes otra opción?`
    };
  }
  
  return { valid: true };
}

/**
 * �🕐 Convierte string de hora "14:30" a minutos desde medianoche
 */
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * 🕐 Convierte minutos desde medianoche a string "14:30"
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * 🌍 Obtiene la fecha/hora actual en Ecuador (America/Guayaquil UTC-5)
 * 
 * IMPORTANTE: Esta función devuelve el timestamp UTC actual (sin cambios),
 * para que la comparación con requestedDateTime (que también está en UTC) funcione.
 * 
 * @param {Date} [baseTime] - Timestamp base (útil para testing con fake timers)
 * @returns {Date} Date object con el timestamp UTC actual
 */
export function getNowInGuayaquil(baseTime = null) {
  // Simplemente devolver el timestamp actual (o el baseTime para testing)
  // La comparación se hace en UTC, y requestedDateTime ya tiene el offset correcto
  return baseTime || new Date();
}

/**
 * �️ Cancela todas las reservas pendientes de un usuario
 * Útil cuando el usuario dice "cancelar", "ya no quiero", "olvida", etc.
 */
export async function cancelUserPendingReservations(userId) {
  try {
    console.log('[CALENDARIO] 🗑️ Cancelando reservas pendientes de:', userId);
    
    // 1. Buscar todas las reservas pendientes del usuario
    const pendingReservations = await reservationRepository.findByUser(userId, 50);
    const pendingToCancel = pendingReservations.filter(res => 
      res.status === 'pending' || res.status === 'pending_payment'
    );
    
    if (pendingToCancel.length === 0) {
      console.log('[CALENDARIO] ℹ️ No hay reservas pendientes para cancelar');
      return {
        success: true,
        message: 'No tienes reservas pendientes',
        cancelledCount: 0
      };
    }
    
    // 2. Cancelar cada reserva pendiente
    for (const reservation of pendingToCancel) {
      await reservationRepository.updateStatus(reservation.id, 'cancelled');
      console.log('[CALENDARIO] ✅ Reserva cancelada:', reservation.id);
    }
    
    // 3. Limpiar estado de confirmación pendiente del usuario
    const { clearPendingConfirmation } = await import('../perfiles-interacciones/memoria-sqlite.js');
    await clearPendingConfirmation(userId);
    console.log('[CALENDARIO] 🧹 Estado de confirmación limpiado para:', userId);
    
    return {
      success: true,
      message: `Se cancelaron ${pendingToCancel.length} reserva(s) pendiente(s)`,
      cancelledCount: pendingToCancel.length,
      cancelledReservations: pendingToCancel.map(r => ({
        id: r.id,
        date: r.date,
        time: r.start_time,
        serviceType: r.service_type
      }))
    };
  } catch (error) {
    console.error('[CALENDARIO] ❌ Error cancelando reservas pendientes:', error);
    return {
      success: false,
      error: 'Error al cancelar reservas',
      details: error.message
    };
  }
}

/**
 * �🔍 Verifica disponibilidad para una fecha y horario específico
 * 
 * IMPORTANTE: Todas las validaciones de "horario pasado" se hacen
 * usando la hora de Quito/Ecuador (UTC-5), NO la hora del servidor.
 * 
 * @param {Date} baseTime - (Opcional) Tiempo base para testing con fake timers
 */
export async function checkAvailability(
  date,
  startTime,
  durationHours,
  serviceType = 'hotDesk',
  baseTime = null,
  userId = null,
  requiredSpaces = 1
) {
  // 🌍 Obtener hora actual en Ecuador de forma robusta
  const currentDateTime = getNowInGuayaquil(baseTime);
  
  // Construir fecha solicitada con offset explícito de Ecuador
  const requestedDateTime = new Date(`${date}T${startTime}:00-05:00`);
  
  // 📅 VALIDAR DÍA DE LA SEMANA - Domingo cerrado
  const dayOfWeek = requestedDateTime.getDay(); // 0 = domingo, 6 = sábado
  
  if (dayOfWeek === 0) {
    console.log('[CALENDARIO] 🚫 Domingo detectado - Coworkia está CERRADO');
    return {
      available: false,
      reason: '🚫 Los domingos Coworkia está cerrado',
      suggestion: 'Estamos abiertos de lunes a sábado',
      alternatives: await suggestAlternatives(date, durationHours, serviceType, startTime, requiredSpaces)
    };
  }
  
  // 🎉 VALIDAR FERIADOS - Cerrado en días festivos
  if (esFeriado(date)) {
    const nombreFeriado = getNombreFeriado(date);
    console.log('[CALENDARIO] 🎉 Feriado detectado:', nombreFeriado, '-', date);
    return {
      available: false,
      reason: `🎉 ${nombreFeriado} - Coworkia está cerrado`,
      suggestion: 'Estamos cerrados en feriados',
      alternatives: await suggestAlternatives(date, durationHours, serviceType, startTime, requiredSpaces)
    };
  }
  
  if (requestedDateTime < currentDateTime) {
    console.log('[CALENDARIO] ⏰ Horario pasado detectado (hora Ecuador):', {
      requested: requestedDateTime.toISOString(),
      currentEcuador: currentDateTime.toISOString()
    });
    
    // Sugerir próxima hora disponible
    const nextHour = currentDateTime.getHours() + 1;
    const nextTime = `${nextHour.toString().padStart(2, '0')}:00`;
    
    return {
      available: false,
      reason: 'Ese horario ya pasó',
      suggestion: `¿Qué tal ${nextTime}?`,
      alternatives: await suggestAlternatives(date, durationHours, serviceType, startTime, requiredSpaces)
    };
  }

  const reservations = await reservationRepository.findByDate(date, serviceType);
  
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + (durationHours * 60);
  
  // Verificar horario laboral canónico.
  const workStart = CALENDAR_CONFIG.workingHours.startMinutes;
  const workEnd = CALENDAR_CONFIG.workingHours.endMinutes;
  
  if (startMinutes < workStart || endMinutes > workEnd) {
    return {
      available: false,
      reason: `Fuera del horario laboral (${HOURS.display})`,
      alternatives: await suggestAlternatives(date, durationHours, serviceType, startTime, requiredSpaces)
    };
  }
  
  // Contar espacios ocupados en ese momento
  const overlappingReservations = reservations.filter(res => {
    if (res.status === 'cancelled') return false;
    
    // 🔧 FIX: Ignorar reservas 'pending' del MISMO usuario (evita conflicto con nueva reserva)
    if (res.status === 'pending' && userId && res.user_phone === userId) {
      console.log('[CALENDARIO] ⏭️ Ignorando reserva pending del mismo usuario:', res.id);
      return false;
    }
    
    const resStart = timeToMinutes(res.start_time);
    const resEnd = timeToMinutes(res.end_time);
    
    return hasOverlapWithBuffer(startMinutes, endMinutes, resStart, resEnd);
  });

  const serviceCapacity = getServiceCapacity(serviceType);
  const requestedUnits = serviceType === 'hotDesk'
    ? Math.max(Number.parseInt(requiredSpaces, 10) || 1, 1)
    : 1;
  const occupiedUnits = serviceType === 'hotDesk'
    ? overlappingReservations.reduce((sum, r) => sum + (Number.parseInt(r.desks_quantity, 10) || 1), 0)
    : overlappingReservations.length;
  const availableUnits = Math.max(serviceCapacity - occupiedUnits, 0);

  if (occupiedUnits + requestedUnits > serviceCapacity) {
    const reason = serviceType === 'hotDesk' && requestedUnits > 1
      ? `Solo hay ${availableUnits} Hot Desk${availableUnits !== 1 ? 's' : ''} disponible${availableUnits !== 1 ? 's' : ''} en ese horario`
      : `${getServiceName(serviceType)} ocupado en ese horario`;

    return {
      available: false,
      reason,
      occupiedSpaces: occupiedUnits,
      availableSpaces: availableUnits,
      capacity: serviceCapacity,
      alternatives: await suggestAlternatives(date, durationHours, serviceType, startTime, requestedUnits)
    };
  }

  // Validar límite global de espacios si aplica
  if (CALENDAR_CONFIG.maxSimultaneousSpaces) {
    const dayReservations = await reservationRepository.findByDate(date);
    const overlappingAll = dayReservations.filter(res => {
      if (res.status === 'cancelled') return false;
      
      const resStart = timeToMinutes(res.start_time);
      const resEnd = timeToMinutes(res.end_time);
      
      return hasOverlapWithBuffer(startMinutes, endMinutes, resStart, resEnd);
    });

    if (overlappingAll.length >= CALENDAR_CONFIG.maxSimultaneousSpaces) {
      return {
        available: false,
        reason: `Máximo ${CALENDAR_CONFIG.maxSimultaneousSpaces} espacios ocupados en ese horario`,
        occupiedSpaces: overlappingAll.length,
        capacity: CALENDAR_CONFIG.maxSimultaneousSpaces,
        alternatives: await suggestAlternatives(date, durationHours, serviceType, startTime, requestedUnits)
      };
    }
  }
  
  return {
    available: true,
    occupiedSpaces: occupiedUnits,
    availableSpaces: availableUnits,
    capacity: serviceCapacity
  };
}

/**
 * 💡 Sugiere horarios alternativos si no hay disponibilidad
 */
async function suggestAlternatives(
  date,
  durationHours,
  serviceType = 'hotDesk',
  requestedStartTime = null,
  requiredSpaces = 1
) {
  const alternatives = [];
  const capacity = getServiceCapacity(serviceType);
  const dayReservations = await reservationRepository.findByDate(date, serviceType);
  const durationMinutes = durationHours * 60;
  const startLimit = CALENDAR_CONFIG.workingHours.startMinutes;
  const endLimit = CALENDAR_CONFIG.workingHours.endMinutes - durationMinutes;
  
  // Calcular minutos del horario solicitado para ordenar por proximidad
  const requestedMinutes = requestedStartTime 
    ? timeToMinutes(requestedStartTime) 
    : Math.round((startLimit + endLimit) / 2); // centro del día si no hay referencia

  // Recolectar TODOS los slots disponibles
  const allSlots = [];
  for (let minutes = startLimit; minutes <= endLimit; minutes += 30) {
    const startMinutes = minutes;
    const endMinutes = startMinutes + durationMinutes;
    
    const overlapping = dayReservations.filter(res => {
      if (res.status === 'cancelled') return false;
      const resStart = timeToMinutes(res.start_time);
      const resEnd = timeToMinutes(res.end_time);
      return hasOverlapWithBuffer(startMinutes, endMinutes, resStart, resEnd);
    });
    
    const occupiedUnits = serviceType === 'hotDesk'
      ? overlapping.reduce((sum, r) => sum + (Number.parseInt(r.desks_quantity, 10) || 1), 0)
      : overlapping.length;

    if (occupiedUnits + (serviceType === 'hotDesk' ? requiredSpaces : 1) <= capacity) {
      allSlots.push({
        date,
        time: minutesToTime(startMinutes),
        startTime: minutesToTime(startMinutes),
        endTime: minutesToTime(endMinutes),
        duration: `${durationHours}h`,
        _distance: Math.abs(startMinutes - requestedMinutes)
      });
    }
  }
  
  // Ordenar por proximidad al horario solicitado
  allSlots.sort((a, b) => a._distance - b._distance);
  
  // Tomar los 3 más cercanos y limpiar campo interno
  for (const slot of allSlots.slice(0, 3)) {
    const { _distance, ...clean } = slot;
    alternatives.push(clean);
  }
  
  // Si no hay alternativas el mismo día, sugerir día siguiente
  if (alternatives.length === 0) {
    const nextDate = getNextDate(date);
    const testTime = '09:00';
    const nextReservations = await reservationRepository.findByDate(nextDate, serviceType);
    const nextStart = timeToMinutes(testTime);
    const nextEnd = nextStart + (durationHours * 60);
    const overlappingNext = nextReservations.filter(res => {
      if (res.status === 'cancelled') return false;
      const resStart = timeToMinutes(res.start_time);
      const resEnd = timeToMinutes(res.end_time);
      return hasOverlapWithBuffer(nextStart, nextEnd, resStart, resEnd);
    });
    
    const occupiedNextUnits = serviceType === 'hotDesk'
      ? overlappingNext.reduce((sum, r) => sum + (Number.parseInt(r.desks_quantity, 10) || 1), 0)
      : overlappingNext.length;

    if (occupiedNextUnits + (serviceType === 'hotDesk' ? requiredSpaces : 1) <= capacity) {
      alternatives.push({
        date: nextDate,
        time: testTime,
        duration: `${durationHours}h`,
        note: 'Día siguiente disponible'
      });
    }
  }
  
  return alternatives;
}

/**
 * 📅 Obtiene la fecha del día siguiente (timezone-aware para Ecuador)
 */
function getNextDate(dateString) {
  // Crear fecha en timezone Ecuador para evitar issues de UTC
  const date = new Date(dateString + 'T12:00:00-05:00');
  date.setDate(date.getDate() + 1);
  
  // Formatear usando Intl para mantener timezone correcto
  const formatter = new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  
  return `${year}-${month}-${day}`;
}

/**
 * ➕ Crea una nueva reserva
 */
export async function createReservation(reservationData) {
  const {
    userId,
    userName,
    date,
    startTime,
    durationHours,
    serviceType = 'hotDesk',
    wasFree = false,
    email = null,
    total,
    totalPrice,
    guestCount = 0,
    hotDeskNumber = null, // Nuevo campo: número de Hot Desk asignado
    hotDeskNumbers = null, // Multi-hotdesk: números asignados
    paymentMethod = null, // Nuevo campo: método de pago
    desksQuantity = 1 // Multi-hotdesk: cantidad de escritorios
  } = reservationData;

  // Resolver precio: acepta tanto "total" como "totalPrice"
  const resolvedTotal = total ?? totalPrice ?? 0;
  
  // Verificar disponibilidad primero (pasando userId para ignorar sus propias reservas pending)
  const availability = await checkAvailability(
    date,
    startTime,
    durationHours,
    serviceType,
    null,
    userId,
    desksQuantity
  );
  if (!availability.available) {
    return {
      success: false,
      error: availability.reason,
      alternatives: availability.alternatives
    };
  }
  
  const endTime = minutesToTime(timeToMinutes(startTime) + (durationHours * 60));
  
  try {
    const newReservation = await reservationRepository.create({
      user_phone: userId,
      service_type: serviceType,
      date,
      start_time: startTime,
      end_time: endTime,
      duration_hours: durationHours,
      guest_count: guestCount,
      total_price: resolvedTotal,
      was_free: wasFree,
      status: 'pending',
      payment_status: wasFree ? 'waived' : 'pending',
      payment_data: email ? { email } : null,
      payment_method: paymentMethod, // Guardar método de pago
      hot_desk_number: hotDeskNumber, // Guardar número de Hot Desk
      hot_desk_numbers: hotDeskNumbers, // Guardar números de Hot Desk
      desks_quantity: desksQuantity // Multi-hotdesk
    });
    
    return {
      success: true,
      reservation: {
        id: newReservation.id,
        userId,
        userName,
        date,
        startTime,
        endTime,
        durationHours,
        serviceType,
        status: 'pending',
        wasFree,
        email,
        total: resolvedTotal,
        guestCount,
        hotDeskNumber,
        hotDeskNumbers,
        paymentMethod,
        createdAt: newReservation.created_at
      },
      message: `Reserva creada: ${date} de ${startTime} a ${endTime} (${durationHours}h)${hotDeskNumber ? ` - Hot Desk ${hotDeskNumber}/4` : ''}`
    };
  } catch (error) {
    console.error('[CALENDARIO] Error creando reserva:', error);
    const fallbackAlternatives = await suggestAlternatives(date, durationHours, serviceType, startTime);
    return {
      success: false,
      error: error?.code === 'SQLITE_CONSTRAINT'
        ? 'Ese horario acaba de ocuparse hace segundos. Intentemos con otro horario.'
        : 'Error guardando la reserva',
      alternatives: fallbackAlternatives
    };
  }
}

/**
 * ✅ Confirma una reserva existente
 */
export async function confirmReservation(reservationId) {
  try {
    const reservation = await reservationRepository.findById(reservationId);
    
    if (!reservation) {
      return {
        success: false,
        error: 'Reserva no encontrada'
      };
    }
    
    if (reservation.status === 'confirmed') {
      return {
        success: true,
        message: 'Reserva ya estaba confirmada',
        reservation
      };
    }
    
    const updated = await reservationRepository.updateStatus(reservationId, 'confirmed');
    
    return {
      success: true,
      message: 'Reserva confirmada exitosamente',
      reservation: updated
    };
  } catch (error) {
    console.error('[CALENDARIO] Error confirmando reserva:', error);
    return {
      success: false,
      error: 'Error confirmando la reserva'
    };
  }
}

/**
 * ❌ Cancela una reserva
 */
export async function cancelReservation(reservationId, reason = 'Cancelada por usuario') {
  try {
    const reservation = await reservationRepository.findById(reservationId);
    
    if (!reservation) {
      return {
        success: false,
        error: 'Reserva no encontrada'
      };
    }
    
    const updated = await reservationRepository.updateStatus(reservationId, 'cancelled');
    
    return {
      success: true,
      message: 'Reserva cancelada',
      reservation: updated
    };
  } catch (error) {
    console.error('[CALENDARIO] Error cancelando reserva:', error);
    return {
      success: false,
      error: 'Error cancelando la reserva'
    };
  }
}

/**
 * 📋 Obtiene reservas de un usuario específico
 */
export async function getUserReservations(userId) {
  return await reservationRepository.findByUser(userId);
}

/**
 * 📅 Obtiene reservas confirmadas futuras de un usuario
 * Retorna formato legible para mostrar en conversación
 */
export async function getUpcomingReservations(userId) {
  const reservations = await reservationRepository.findUpcomingByUser(userId);
  
  if (reservations.length === 0) {
    return {
      hasReservations: false,
      count: 0,
      summary: 'No tienes reservas confirmadas próximas.',
      reservations: []
    };
  }
  
  const formatted = reservations.map((r, index) => {
    const spaceName = r.service_type === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones';
    const price = r.was_free ? 'GRATIS' : `$${parseFloat(r.total_price).toFixed(2)}`;
    const people = r.num_people > 1 ? ` (${r.num_people} personas)` : '';
    
    return {
      index: index + 1,
      date: r.date,
      time: `${r.start_time} - ${r.end_time}`,
      space: spaceName,
      people: r.num_people,
      price: price,
      formatted: `${index + 1}. ${r.date} ${r.start_time}-${r.end_time} - ${spaceName}${people} - ${price}`
    };
  });
  
  const summary = formatted.map(r => r.formatted).join('\n');
  
  return {
    hasReservations: true,
    count: reservations.length,
    summary: `📋 TUS PRÓXIMAS RESERVAS:\n${summary}`,
    reservations: formatted
  };
}

/**
 * 🔍 Detecta conflictos de horario con reservas existentes del usuario
 */
export async function checkUserConflicts(userId, requestedDate, requestedTime, durationHours = 2) {
  const upcoming = await reservationRepository.findUpcomingByUser(userId);
  
  // Convertir hora solicitada a minutos
  const [reqHour, reqMin] = requestedTime.split(':').map(Number);
  const reqStartMinutes = reqHour * 60 + reqMin;
  const reqEndMinutes = reqStartMinutes + (durationHours * 60);
  
  // Buscar conflictos en la misma fecha
  const conflicts = upcoming.filter(r => {
    if (r.date !== requestedDate) return false;
    
    const [startHour, startMin] = r.start_time.split(':').map(Number);
    const [endHour, endMin] = r.end_time.split(':').map(Number);
    
    const existingStart = startHour * 60 + startMin;
    const existingEnd = endHour * 60 + endMin;
    
    // Hay conflicto si los rangos se sobreponen
    return (reqStartMinutes < existingEnd && reqEndMinutes > existingStart);
  });
  
  if (conflicts.length === 0) {
    return {
      hasConflict: false,
      conflicts: []
    };
  }
  
  const conflictDetails = conflicts.map(c => {
    const spaceName = c.service_type === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones';
    return {
      date: c.date,
      time: `${c.start_time} - ${c.end_time}`,
      space: spaceName,
      message: `Ya tienes ${spaceName} reservado para ${c.date} de ${c.start_time} a ${c.end_time}`
    };
  });
  
  return {
    hasConflict: true,
    conflicts: conflictDetails,
    message: conflictDetails.map(c => c.message).join('. ')
  };
}

/**
 * 💳 Actualiza información de pago de una reserva
 * @param {boolean} autoConfirm - Si false, solo guarda payment info sin confirmar reserva
 */
export async function updateReservationPayment(reservationId, paymentInfo, autoConfirm = true) {
  try {
    const reservation = await reservationRepository.findById(reservationId);
    
    if (!reservation) {
      throw new Error(`Reserva ${reservationId} no encontrada`);
    }
    
    // Obtener fecha actual en timezone Ecuador
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
    const ecuadorNow = `${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`;
    
    const updated = await reservationRepository.markAsPaid(reservationId, {
      payment_method: paymentInfo.paymentMethod || 'transfer',
      payment_reference: paymentInfo.reference || null,
      payment_amount: paymentInfo.amount || reservation.total_price,
      payment_date: paymentInfo.date || ecuadorNow
    }, autoConfirm);
    
    return updated;
  } catch (error) {
    console.error('[CALENDARIO] Error actualizando pago:', error);
    throw error;
  }
}

/**
 * 🔍 Busca reserva por información de pago
 */
export async function getReservationByPaymentInfo(paymentData) {
  try {
    // Obtener reservas recientes (últimos 7 días) - timezone Ecuador
    const formatter = new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil'
    });
    
    const now = new Date();
    const dateLimit = new Date(now);
    dateLimit.setDate(dateLimit.getDate() - 7);
    
    const allReservations = await reservationRepository.findByUser(paymentData.userId);
    
    // Buscar por monto y fecha
    const matches = allReservations.filter(r => {
      if (r.status === 'cancelled' || r.payment_status === 'paid') return false;
      
      const amountMatch = Math.abs(parseFloat(r.total_price) - parseFloat(paymentData.amount)) < 0.50;
      const dateMatch = r.created_at && paymentData.date && 
                       Math.abs(new Date(r.created_at) - new Date(paymentData.date)) < 24 * 60 * 60 * 1000;
      
      return amountMatch && dateMatch;
    });
    
    return matches.length > 0 ? matches[0] : null;
  } catch (error) {
    console.error('[CALENDARIO] Error buscando reserva por pago:', error);
    return null;
  }
}

/**
 * 📊 Obtiene estadísticas del día
 */
export async function getDayStats(date) {
  const reservations = await reservationRepository.findByDate(date);
  const dayReservations = reservations.filter(r => r.status !== 'cancelled');
  
  return {
    date,
    totalReservations: dayReservations.length,
    maxCapacity: CALENDAR_CONFIG.maxSimultaneousSpaces,
    occupancyRate: `${Math.round((dayReservations.length / CALENDAR_CONFIG.maxSimultaneousSpaces) * 100)}%`,
    reservations: dayReservations
  };
}

/**
 * 🔍 Verifica disponibilidad de Hot Desks para un slot específico
 * Retorna información detallada para validación y mensajes de Aurora
 * 
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @param {string} startTime - Hora de inicio HH:MM
 * @param {string} endTime - Hora de fin HH:MM
 * @returns {Object} Estado de disponibilidad con detalles
 */
export async function checkHotDeskAvailability(date, startTime, endTime, requiredSpaces = 1) {
  const availability = await reservationRepository.countOccupiedHotDesks(date, startTime, endTime);

  const hasEnoughCapacity = availability.availableCount >= requiredSpaces;
  const message = !hasEnoughCapacity
    ? availability.availableCount === 0
      ? '❌ Lo siento, todos los Hot Desks están reservados para ese horario.'
      : `❌ Solo hay ${availability.availableCount} Hot Desk${availability.availableCount !== 1 ? 's' : ''} disponible${availability.availableCount !== 1 ? 's' : ''}.`
    : `✅ Hay ${availability.availableCount} Hot Desk${availability.availableCount !== 1 ? 's' : ''} disponible${availability.availableCount !== 1 ? 's' : ''}.`;
  
  return {
    available: hasEnoughCapacity,
    occupiedCount: availability.occupiedCount,
    availableCount: availability.availableCount,
    occupiedNumbers: availability.occupiedNumbers,
    permanentCount: availability.permanentCount || 0,
    maxCapacity: 6,
    message
  };
}

/**
 * 🔢 Asigna número de Hot Desk para una reserva
 * Utiliza el repository para obtener el siguiente número disponible
 * 
 * @param {string} date - Fecha de la reserva
 * @param {string} startTime - Hora de inicio
 * @param {string} endTime - Hora de fin
 * @returns {number|null} Número asignado (1-6) o null si no hay disponibles
 */
export async function assignHotDeskNumber(date, startTime, endTime) {
  return await reservationRepository.assignHotDeskNumber(date, startTime, endTime);
}

export async function assignHotDeskNumbers(date, startTime, endTime, quantity = 1) {
  return await reservationRepository.assignHotDeskNumbers(date, startTime, endTime, quantity);
}

export { CALENDAR_CONFIG, SERVICE_CAPACITY };

export default {
  checkAvailability,
  createReservation,
  confirmReservation,
  cancelReservation,
  cancelUserPendingReservations,
  getUserReservations,
  getUpcomingReservations,
  checkUserConflicts,
  updateReservationPayment,
  getReservationByPaymentInfo,
  getDayStats,
  checkHotDeskAvailability,
  assignHotDeskNumber,
  assignHotDeskNumbers,
  CALENDAR_CONFIG,
  SERVICE_CAPACITY
};
