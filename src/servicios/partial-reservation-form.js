/**
 * 🧠 Formulario Parcial de Reserva Inteligente
 * 
 * Permite a Aurora "recordar" datos entre mensajes y completar
 * progresivamente la información de reserva sin obligar al usuario
 * a seguir un orden estricto.
 * 
 * El usuario puede mencionar datos en cualquier orden:
 * - "quiero un hot desk para hoy, mi correo es yo@diegovillota.com"
 * - "mañana a las 3pm"
 * - "voy con 2 personas más"
 * 
 * Aurora completa el formulario progresivamente y pregunta solo
 * lo que falta.
 */

import { getPendingConfirmation, setPendingConfirmation, clearPendingConfirmation } from './reservation-state.js';
import { detectarSaludoConInteresServicio } from '../deteccion-intenciones/detectar-intencion.js';
import userRepository from '../database/userRepository.js';
import reservationRepository from '../database/reservationRepository.js';
import { HOURS } from '../utils/coworkia-facts.js';
import { validateBusinessHours, suggestAlternativeSlots } from './reservation-validation.js';

// 📲 Enlace genérico para referir amigos al sistema de Coworkia
const REFERRAL_LINK = `https://wa.me/593994837117?text=${encodeURIComponent('¡Hola Coworkia! quiero probar el servicio')}`;

// TTL del formulario: 2 horas (usuarios pueden distraerse, atender llamadas, etc.)
const FORM_TTL_SECONDS = 2 * 60 * 60;

// 🎉 Lista de feriados nacionales de Ecuador (2026)
const FERIADOS_ECUADOR = [
  '2026-01-01', '2026-02-23', '2026-02-24', '2026-04-10', '2026-05-01',
  '2026-05-24', '2026-07-24', '2026-08-10', '2026-10-09', '2026-11-02',
  '2026-11-03', '2026-12-25', '2026-12-31'
];

const NOMBRES_FERIADOS = {
  '01-01': 'Año Nuevo', '12-25': 'Navidad', '12-31': 'Fin de Año',
  '05-01': 'Día del Trabajo', '05-24': 'Batalla de Pichincha',
  '07-24': 'Natalicio de Simón Bolívar', '08-10': 'Primer Grito de Independencia',
  '10-09': 'Independencia de Guayaquil', '11-02': 'Día de los Difuntos',
  '11-03': 'Independencia de Cuenca', '02-10': 'Carnaval', '02-11': 'Carnaval',
  '02-23': 'Carnaval', '02-24': 'Carnaval', '03-28': 'Viernes Santo',
  '04-10': 'Viernes Santo'
};

function timeStrToMinutes(timeStr) {
  if (!timeStr || !/\d{1,2}:\d{2}/.test(timeStr)) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function isFreeTrialWindowEligible(spaceType, timeStr) {
  if (spaceType !== 'hotDesk') return false;
  const mins = timeStrToMinutes(timeStr);
  if (mins === null) return false;
  const start = 8 * 60;  // 08:00
  const end   = 12 * 60; // 12:00
  return mins >= start && mins <= end;
}

function phoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function normalizeComparablePhone(phone) {
  const digits = phoneDigits(phone);
  if (/^09\d{8}$/.test(digits)) return `593${digits.slice(1)}`;
  return digits;
}

function normalizeBeneficiaryPhone(phone) {
  const digits = phoneDigits(phone);
  if (/^09\d{8}$/.test(digits)) return `+593${digits.slice(1)}`;
  if (/^5939\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}

export function isValidBeneficiaryName(name) {
  return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)+$/.test(String(name || '').trim());
}

export function isValidBeneficiaryEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function isAdminReservationUser(userId) {
  const admin = normalizeComparablePhone(process.env.ADMIN_PHONE);
  return Boolean(admin && normalizeComparablePhone(userId) === admin);
}

export function extractAdminBeneficiaryData(message, currentForm = {}) {
  const text = String(message || '').trim();
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const updates = {};

  if (/\b(para mi|para diego|es para mi|yo mismo)\b/.test(normalized)) {
    updates.reservationFor = 'self';
  } else if (/\b(otra persona|un tercero|una tercera persona|un cliente|otra persona)\b/i.test(text)) {
    updates.reservationFor = 'other';
  }

  if ((updates.reservationFor || currentForm.reservationFor) === 'other') {
    const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) updates.beneficiaryEmail = emailMatch[1].toLowerCase();

    const phoneMatch = text.match(/(?:\+?593[\s-]?9|09)[\d\s-]{8,12}/);
    if (phoneMatch) {
      const phone = normalizeBeneficiaryPhone(phoneMatch[0]);
      if (phone) updates.beneficiaryPhone = phone;
    }

    const namedMatch = text.match(/(?:nombre(?: completo)?(?: es)?|se llama)\s*[:,-]?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){1,4})(?=\s*[,;]|\s+(?:tel[eé]fono|celular|correo|email)\b|$)/i);
    const simpleName = !currentForm.beneficiaryName && !emailMatch && !phoneMatch && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){1,4}$/.test(text);
    if (namedMatch || simpleName) updates.beneficiaryName = (namedMatch?.[1] || text).trim();
  }

  return updates;
}

/**
 * 🎯 Clase que representa un formulario parcial de reserva
 */
export class PartialReservationForm {
  constructor(userId, existingData = {}, freeTrialUsed = null) {
    this.userId = userId;
    this.spaceType = existingData.spaceType || null;      // 'hotDesk' | 'meetingRoom'
    this.date = existingData.date || null;                // '2025-11-12'
    this.time = existingData.time || null;                // '10:00'
    this.email = existingData.email || null;              // 'yo@diegovillota.com'
    this.isAdminBooking = existingData.isAdminBooking ?? isAdminReservationUser(userId);
    this.reservationFor = existingData.reservationFor || null;
    this.beneficiaryName = existingData.beneficiaryName || null;
    this.beneficiaryPhone = existingData.beneficiaryPhone || null;
    this.beneficiaryEmail = existingData.beneficiaryEmail || null;
    this.numPeople = existingData.numPeople || 1;         // default 1 (solo el usuario)
    this.durationHours = existingData.durationHours || 2; // default 2h (mínimo según política)
    this.paymentMethod = existingData.paymentMethod || null; // 'transferencia' | 'tarjeta' | 'efectivo'
    this.freeTrialUsed = existingData.freeTrialUsed ?? freeTrialUsed ?? null; // ← null = resolver desde BD/historial
    // 🆕 Segundo espacio (reserva doble Hot Desk + Sala)
    this.secondSpaceType = existingData.secondSpaceType || null;
    this.secondTime = existingData.secondTime || null;
    this.secondDurationHours = existingData.secondDurationHours || 2;
    this.discountPercent = existingData.discountPercent || 0; // 0-10 (% de descuento por reserva doble)
    this.durationWasUpgraded = existingData.durationWasUpgraded || false; // true cuando se sub ió silencioso de 1h → 2h
    this.pendingAlternatives = existingData.pendingAlternatives || null; // alternativas mostradas al usuario [{startTime, endTime, durationHours}]
    this.desksQuantity = existingData.desksQuantity || 1; // multi-hotdesk: cuántos escritorios reservar
    this.updatedAt = new Date();
  }

  /**
   * � Inicializa freeTrialUsed consultando BD (llamar antes de getMissingFields)
   */
  async initializeFreeTrialStatus() {
    try {
      // Si viene explícitamente en true desde contexto persistido, respetarlo
      if (this.freeTrialUsed === true) {
        console.log('[FORM] ✅ freeTrialUsed ya inicializado en true');
        return;
      }

      const user = await userRepository.findByPhone(this.userId);

      // Señales fuertes de trial usado en perfil
      const profileShowsUsed = Boolean(user?.free_trial_used) || Boolean(user?.free_trial_date);

      // Señales fuertes de usuario recurrente en reservas
      const userReservations = await reservationRepository.findByUser(this.userId, 30);
      const hasConfirmedReservations = userReservations.some(r => r.status === 'confirmed');
      const hasAnyFreeReservation = userReservations.some(r => Boolean(r.was_free));
      const hasConfirmedHotDesk = userReservations.some(r => r.status === 'confirmed' && r.service_type === 'hotDesk');

      // Regla de seguridad comercial:
      // Si hay historial confirmado o señales de trial usado, NO volver a ofrecer trial gratis.
      this.freeTrialUsed = profileShowsUsed || hasAnyFreeReservation || hasConfirmedReservations || hasConfirmedHotDesk;

      console.log('[FORM] 🔍 freeTrialUsed cargado desde BD:', {
        userId: this.userId,
        freeTrialUsed: this.freeTrialUsed,
        userFound: !!user,
        profileShowsUsed,
        hasConfirmedReservations,
        hasAnyFreeReservation,
        hasConfirmedHotDesk
      });
    } catch (error) {
      console.error('[FORM] ❌ Error cargando freeTrialUsed, default false:', error);
      // Fallback conservador: no ofrecer trial cuando no se puede verificar estado
      this.freeTrialUsed = true;
    }
  }

  /**
   * �📋 Actualiza un campo del formulario
   */
  updateField(field, value) {
    if (this[field] !== undefined) {
      this[field] = value;
      this.updatedAt = new Date();
      console.log(`[FORM] 📝 Campo actualizado: ${field} = ${value}`);
    }
  }

  /**
   * 📊 Actualiza múltiples campos a la vez
   */
  updateFields(data) {
    Object.keys(data).forEach(key => {
      if (this[key] !== undefined && data[key] !== null && data[key] !== undefined) {
        this[key] = data[key];
      }
    });
    this.updatedAt = new Date();
    console.log('[FORM] 📝 Múltiples campos actualizados:', Object.keys(data));
  }

  /**
   * ❓ Obtiene lista de campos faltantes
   */
  getMissingFields() {
    const missing = [];

    if (this.isAdminBooking) {
      if (!this.reservationFor) return ['reservationFor'];
      if (!isValidBeneficiaryName(this.beneficiaryName)) missing.push('beneficiaryName');
      if (!normalizeBeneficiaryPhone(this.beneficiaryPhone)) missing.push('beneficiaryPhone');
      if (!isValidBeneficiaryEmail(this.beneficiaryEmail)) missing.push('beneficiaryEmail');
    }
    
    if (!this.spaceType) missing.push('spaceType');
    if (!this.date) missing.push('date');
    if (!this.time) missing.push('time');
    if (!this.email) missing.push('email');
    
    // Free trial: primera visita + hotDesk dentro de la ventana 08:00–12:00
    const isFreeTrialApplicable = !this.freeTrialUsed && isFreeTrialWindowEligible(this.spaceType, this.time);

    if (!this.paymentMethod && !isFreeTrialApplicable) {
      missing.push('paymentMethod');
      console.log('[FORM] ⚠️ Cliente debe pagar - requiere paymentMethod:', {
        freeTrialUsed: this.freeTrialUsed,
        spaceType: this.spaceType
      });
    }
    
    return missing;
  }

  /**
   * ✅ Verifica si el formulario está completo
   */
  isComplete() {
    return this.getMissingFields().length === 0;
  }

  /**
   * 💰 Calcula el precio base según tipo de espacio
   */
  /**
   * 💰 Calcula el precio base según duración con descuentos progresivos
   * MODELO DE PRECIOS:
   * - 1º bloque (2h): $10.00 (precio base)
   * - 2º bloque (2h): $8.50 (15% descuento)
   * - 3º bloque (2h): $7.22 (15% descuento adicional sobre $8.50)
   * - 4º bloque (2h): $6.14 (15% descuento adicional sobre $7.22)
   * Y así sucesivamente...
   */
  getBasePrice() {
    if (this.spaceType === 'hotDesk') {
      const basePerBlock = 10; // $10 por 2 horas (primer bloque)
      const hoursPerBlock = 2;
      const blocks = this.durationHours / hoursPerBlock;
      const qty = this.desksQuantity || 1;
      
      // Si es exactamente 2 horas o menos, precio base
      if (blocks <= 1) {
        return basePerBlock * qty;
      }
      
      // Calcular precio con descuentos progresivos del 15% por bloque
      let totalPrice = 0;
      let currentBlockPrice = basePerBlock;
      
      for (let i = 0; i < blocks; i++) {
        totalPrice += currentBlockPrice;
        // Aplicar 15% de descuento para el siguiente bloque
        currentBlockPrice = currentBlockPrice * 0.85;
      }
      
      return Math.round(totalPrice * qty * 100) / 100; // Multiplicar por cantidad de desks
      
    } else if (this.spaceType === 'meetingRoom') {
      const basePerBlock = 29; // $29 por 2 horas
      const hoursPerBlock = 2;
      const blocks = this.durationHours / hoursPerBlock;
      
      // Para sala de reuniones, precio proporcional sin descuentos
      return Math.round(basePerBlock * blocks * 100) / 100;
    }
    return 0;
  }

  /**
   * 💵 Calcula el total con impuestos según método de pago
   * FÓRMULA: Base → +15% IVA → Subtotal → +5% comisión proveedor (solo tarjetas)
   */
  calculateTotalWithTaxes() {
    const basePrice = this.getBasePrice();
    
    if (!this.paymentMethod) {
      return { 
        base: basePrice, 
        total: basePrice, 
        iva: 0,
        cardFee: 0,
        taxes: {} 
      };
    }

    let total = basePrice;
    const taxes = {};

    // Normalizar método de pago para cálculo de impuestos
    const metodoPago = this.paymentMethod?.toLowerCase();
    
    // Métodos de pago con TARJETA (aplican comisión 5% + IVA 15%)
    const esPagoConTarjeta = [
      'tarjeta', 'payphone', 'visa', 'mastercard', 'diners', 'paypal',
      'credito', 'debito', 'american express', 'amex', 'alia'
    ].some(metodo => metodoPago?.includes(metodo));
    
    if (esPagoConTarjeta) {
      // TARJETAS: Base → +15% IVA → Subtotal → +5% comisión proveedor
      // Ejemplo: $10 → +$1.50 = $11.50 → +$0.575 = $12.08 USD
      const iva = basePrice * 0.15;
      taxes.iva = parseFloat(iva.toFixed(2));
      
      const subtotalWithIVA = basePrice + iva;
      const cardFee = subtotalWithIVA * 0.05; // 5% sobre (base + IVA)
      taxes.cardFee = parseFloat(cardFee.toFixed(2));
      
      total = subtotalWithIVA + taxes.cardFee;
      console.log(`[FORM] 💳 Pago con tarjeta (${this.paymentMethod}): Base $${basePrice} + IVA $${taxes.iva} = $${subtotalWithIVA.toFixed(2)} + Comisión $${taxes.cardFee} = $${total}`);
    } else if (metodoPago === 'transferencia' || metodoPago?.includes('banco') || metodoPago?.includes('cooperativa')) {
      // TRANSFERENCIAS BANCARIAS (sin comisión)
      // Solo +15% IVA sobre base
      const iva = basePrice * 0.15;
      taxes.iva = parseFloat(iva.toFixed(2));
      total = basePrice + taxes.iva;
      console.log(`[FORM] 🏦 Transferencia bancaria: Base $${basePrice} + IVA $${taxes.iva} = $${total}`);
    } else if (this.paymentMethod === 'efectivo') {
      // EFECTIVO: Solo +15% IVA sobre base
      const iva = basePrice * 0.15;
      taxes.iva = parseFloat(iva.toFixed(2));
      total = basePrice + taxes.iva;
      console.log(`[FORM] 💵 Efectivo: Base $${basePrice} + IVA $${taxes.iva} = $${total}`);
    }

    return {
      base: parseFloat(basePrice.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      iva: parseFloat((taxes.iva || 0).toFixed(2)),
      cardFee: parseFloat((taxes.cardFee || 0).toFixed(2)),
      taxes
    };
  }

  /**
   * 📋 Genera resumen de pago completo con impuestos
   */
  getPaymentSummary() {
    if (!this.spaceType || !this.paymentMethod) {
      return null;
    }

    const spaceName = this.spaceType === 'hotDesk' ? '📍 Hot Desk' : '🏢 Sala de Reuniones';
    const pricing = this.calculateTotalWithTaxes();
    
    let summary = `${spaceName} (${this.durationHours}h)
`;
    summary += `Subtotal: $${pricing.base.toFixed(2)}
`;

    const metodoPago = this.paymentMethod?.toLowerCase();
    const esPagoConTarjeta = [
      'tarjeta', 'payphone', 'visa', 'mastercard', 'diners', 'paypal',
      'credito', 'debito', 'american express', 'amex', 'alia'
    ].some(metodo => metodoPago?.includes(metodo));
    
    if (esPagoConTarjeta) {
      // Pagos con tarjeta (incluye Payphone, Visa, Mastercard, etc.)
      summary += `ISD (5%): $${pricing.taxes.isd.toFixed(2)}
`;
      summary += `IVA (15%): $${pricing.taxes.iva.toFixed(2)}
`;
      summary += `
💳 Total a pagar: $${pricing.total.toFixed(2)}`;
    } else if (metodoPago === 'transferencia' || metodoPago?.includes('banco') || metodoPago?.includes('cooperativa')) {
      // Transferencias bancarias Ecuador
      summary += `IVA (15%): $${pricing.taxes.iva.toFixed(2)}
`;
      summary += `
🏦 Total a pagar: $${pricing.total.toFixed(2)}`;
    } else if (this.paymentMethod === 'efectivo') {
      // 🔓 BYPASS TEMPORAL para testing
      summary += `
💵 Pago en efectivo: $${pricing.total.toFixed(2)}`;
      summary += `

✅ Pagarás directamente en Coworkia`;
    }

    return summary;
  }

  /**
   * 🎯 Genera pregunta inteligente para el siguiente campo faltante
   */
  getNextQuestion() {
    const missing = this.getMissingFields();
    
    if (missing.length === 0) {
      return null; // Formulario completo
    }

    const field = missing[0];
    const userName = this.userName || '';

    switch(field) {
      case 'reservationFor':
        return '¿La reserva es para ti o para otra persona?';
      case 'beneficiaryName':
        return '¿Cuál es el nombre completo de la persona que usará la reserva?';
      case 'beneficiaryPhone':
        return '¿Cuál es el número de celular de la persona beneficiaria?';
      case 'beneficiaryEmail':
        return '¿Cuál es el correo electrónico de la persona beneficiaria?';
      case 'spaceType':
        return `¿Qué espacio necesitas${userName}? Tenemos:\n\n📍 Hot Desk (individual, $10/2h)\n🏢 Sala de Reuniones (3-4 personas, $29/2h)`;
      
      case 'date':
        return `¿Para qué día${userName}? Puedes decir "hoy", "mañana" o una fecha específica 📅`;
      
      case 'time':
        return `¿A qué hora te gustaría venir? (horario: ${HOURS.display})\nPuedes indicar también hasta cuándo: por ejemplo "9am hasta las 5pm" ⏰`;
      
      case 'email':
        return `¿Cuál es tu correo electrónico? Lo necesito para enviarte la confirmación 📧`;
      
      case 'paymentMethod':
        // 🎉 FREE TRIAL: primera visita + hotDesk dentro de ventana 08:00–12:00
        if (!this.freeTrialUsed && isFreeTrialWindowEligible(this.spaceType, this.time)) {
          return '✅ ¡Tu primera visita es GRATIS! 🎁 No necesitas pagar nada.';
        }
        return `¿Cómo prefieres pagar?\n\n💳 Tarjeta crédito/débito\n🏦 Transferencia bancaria\n💵 Efectivo\n\nEscribe "tarjeta", "transferencia" o "efectivo"`;  
      
      default:
        return `¿Podrías darme más detalles sobre tu reserva${userName}?`;
    }
  }

  /**
   * 📄 Genera resumen del formulario actual
   */
  getSummary() {
    const parts = [];

    if (this.isAdminBooking && this.reservationFor) {
      const who = this.reservationFor === 'self' ? 'Diego (titular)' : (this.beneficiaryName || 'otra persona');
      parts.push(`👤 Reserva para: ${who}`);
      if (this.beneficiaryPhone) parts.push(`📱 Beneficiario: ${this.beneficiaryPhone}`);
      if (this.beneficiaryEmail) parts.push(`📧 Email beneficiario: ${this.beneficiaryEmail}`);
    }
    
    if (this.spaceType) {
      const spaceName = this.spaceType === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones';
      parts.push(`🏢 Espacio: ${spaceName}`);
    }
    
    if (this.date) {
      parts.push(`📅 Fecha: ${this.date}`);
    }
    
    if (this.time) {
      parts.push(`⏰ Hora: ${this.time}`);
    }
    
    if (this.numPeople > 1) {
      const deskInfo = this.spaceType === 'hotDesk' && (this.desksQuantity || 1) > 1
        ? ` (${this.desksQuantity} Hot Desks)` : '';
      parts.push(`👥 Personas: ${this.numPeople}${deskInfo}`);
    }
    
    if (this.email && !this.isAdminBooking) {
      parts.push(`📧 Email: ${this.email}`);
    }

    return parts.join('\n');
  }

  /**
   * 🔄 Genera resumen con pregunta de confirmación al retomar
   */
  getResumeMessage() {
    const missing = this.getMissingFields();
    const hasSomeData = this.spaceType || this.date || this.time || this.email;
    
    if (!hasSomeData) {
      return null; // No hay datos para resumir
    }

    // ✅ Si no falta nada, NO enviar mensaje de resumen (ya está completo)
    if (missing.length === 0) {
      return null;
    }

    let message = 'Ya tengo:\n\n';
    message += this.getSummary();
    
    if (missing.length > 0) {
      message += '\n\n';
      const missingNames = missing.map(f => {
        switch(f) {
          case 'spaceType': return 'tipo de espacio';
          case 'date': return 'fecha';
          case 'time': return 'hora';
          case 'email': return 'email';
          case 'paymentMethod': return 'método de pago';
          default: return f;
        }
      });
      message += `❓ Solo necesito: ${missingNames.join(', ')}`;
    }
    
    return message;
  }

  /**
   * 📋 Genera mensaje de confirmación con precio ANTES de pedir método de pago
   */
  getConfirmationMessage() {
    const missing = this.getMissingFields();
    
    // ✅ CASO 1: Formulario COMPLETO - Confirmación final
    if (missing.length === 0) {

      // ✅ CASO 1A: RESERVA DOBLE (hotDesk + meetingRoom)
      if (this.secondSpaceType) {
        const formattedDate = this.formatDate(this.date);

        // Precios base para cada espacio
        const HOTDESK_BASE = 8.70;    // $10 con IVA
        const SALA_BASE    = 25.22;   // $29 con IVA

        const hotdeskTotal  = HOTDESK_BASE * (this.durationHours / 2);
        const salaTotal     = SALA_BASE    * (this.secondDurationHours / 2);
        const subtotal      = hotdeskTotal + salaTotal;
        const discountAmt   = subtotal * ((this.discountPercent || 0) / 100);
        const subtotalDesc  = subtotal - discountAmt;
        const iva           = subtotalDesc * 0.15;
        const cardFeeApply  = this.paymentMethod === 'tarjeta';
        const cardFee       = cardFeeApply ? subtotalDesc * 0.05 : 0;
        const total         = subtotalDesc + iva + cardFee;

        // Calcular hora fin de cada espacio
        const calcEndTime = (startTime, durationH) => {
          if (!startTime) return '';
          const [h, m] = startTime.split(':').map(Number);
          const endMin = h * 60 + (m || 0) + durationH * 60;
          const eh = Math.floor(endMin / 60) % 24;
          const em = endMin % 60;
          return `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`;
        };

        const endTime1 = calcEndTime(this.time, this.durationHours);
        const endTime2 = calcEndTime(this.secondTime || this.time, this.secondDurationHours);

        const metodoPagoDisplay = { tarjeta: 'Tarjeta 💳', transferencia: 'Transferencia 🏦', efectivo: 'Efectivo 💵' };
        const metodoPago = metodoPagoDisplay[this.paymentMethod] || this.paymentMethod;

        let msg = `📋 *CONFIRMA TU RESERVA — 2 ESPACIOS* 🏢🏢\n\n`;
        msg += `1️⃣ *Hot Desk (Espacio Individual)*\n`;
        msg += `📅 ${formattedDate}\n`;
        msg += `⏰ ${this.time} – ${endTime1} (${this.durationHours}h)\n`;
        msg += `💵 Base: $${hotdeskTotal.toFixed(2)}\n\n`;
        msg += `2️⃣ *Sala de Reuniones*\n`;
        msg += `📅 ${formattedDate}\n`;
        msg += `⏰ ${this.secondTime || this.time} – ${endTime2} (${this.secondDurationHours}h)\n`;
        msg += `💵 Base: $${salaTotal.toFixed(2)}\n\n`;
        msg += `───────────────────\n`;
        if (this.discountPercent > 0) {
          msg += `🎁 *Descuento ${this.discountPercent}% reserva doble:* -$${discountAmt.toFixed(2)}\n`;
        }
        msg += `📊 IVA (15%): $${iva.toFixed(2)}\n`;
        if (cardFee > 0) msg += `💳 Comisión tarjeta (5%): $${cardFee.toFixed(2)}\n`;
        msg += `📧 Email: ${this.email}\n`;
        msg += `💳 Pago: ${metodoPago}\n`;
        msg += `💰 *TOTAL: $${total.toFixed(2)} USD*\n\n`;
        msg += `¿*Confirmas ambas reservas?*\n\n`;
        msg += `Responde *SI* para confirmar o *NO* para cancelar 👍`;
        msg += `\n\n[CONFIRMAR]`;

        console.log('[FORM] ✅ Confirmación DOBLE generada - hotDesk + meetingRoom');
        return msg;
      }

      // ✅ CASO 1B: RESERVA SIMPLE (espacio único)
      const isMultiDesk = this.spaceType === 'hotDesk' && (this.desksQuantity || 1) > 1;
      const spaceName = this.spaceType === 'hotDesk' 
        ? (isMultiDesk ? `${this.desksQuantity} Hot Desks` : 'Hot Desk')
        : 'Sala de Reuniones';

      // ✅ Formatear fecha para mostrar día de semana + mes en español
      const formattedDate = this.formatDate(this.date);
      
      // Free trial: primera visita + hotDesk dentro de ventana 08:00–12:00
      const isFreeTrial = !this.freeTrialUsed && isFreeTrialWindowEligible(this.spaceType, this.time);

      let message = `📋 *CONFIRMA TU RESERVA:*\n\n`;
      message += `📅 Fecha: ${formattedDate}\n`;
      message += `⏰ Horario: ${this.time} (${this.durationHours}h)\n`;
      message += `💻 Espacio: ${spaceName}\n`;
      if (isMultiDesk) message += `👥 Personas: ${this.numPeople}\n`;
      message += `📧 Email: ${this.email}\n`;
      
      // 🎁 BRANCH 1: Cliente NUEVO con Hot Desk - GRATIS
      if (isFreeTrial) {
        message += `💰 Total: *GRATIS* 🎉 (Primera visita - 2h gratis)\n\n`;
        message += `¿*Confirmas esta reserva?*\n\n`;
        message += `Responde *SI* para confirmar o *NO* para cancelar 👍`;
        message += `\n\n[CONFIRMAR]`;
        
        console.log('[FORM] ✅ Confirmación GRATIS generada (primera visita hotDesk)');
        return message;
      }
      
      // 💰 BRANCH 2: Cliente RECURRENTE o Meeting Room - CON COSTO
      const pricing = this.calculateTotalWithTaxes();
      
      // Mapear método de pago a texto legible
      const metodoPagoDisplay = {
        'tarjeta': 'Tarjeta 💳',
        'transferencia': 'Transferencia 🏦',
        'efectivo': 'Efectivo 💵'
      };
      const metodoPago = metodoPagoDisplay[this.paymentMethod] || this.paymentMethod;
      
      message += `\n💰 *Costo:*\n`;
      
      // Mostrar desglose multi-desk
      if (isMultiDesk) {
        const pricePerDesk = Math.round((pricing.base / this.desksQuantity) * 100) / 100;
        message += `📦 ${this.desksQuantity} Hot Desks × $${pricePerDesk.toFixed(2)} = $${pricing.base.toFixed(2)}\n`;
      } else if (this.spaceType === 'hotDesk' && this.durationHours > 2) {
        // Mostrar desglose de bloques si son más de 2 horas (hot desk)
        const blocks = this.durationHours / 2;
        let blockPrice = 10;
        message += `📦 Desglose (bloques de 2h):\n`;
        
        for (let i = 0; i < blocks; i++) {
          const blockNum = i + 1;
          const discount = i > 0 ? ` (${15}% desc)` : '';
          message += `   ${blockNum}º bloque: $${blockPrice.toFixed(2)}${discount}\n`;
          blockPrice = blockPrice * 0.85; // 15% descuento para siguiente bloque
        }
        message += `───────────────────\n`;
      }
      
      message += `Subtotal: $${pricing.base.toFixed(2)}\n`;
      message += `IVA (15%): $${pricing.iva.toFixed(2)}\n`;
      if (pricing.cardFee > 0) {
        message += `Comisión tarjeta (5%): $${pricing.cardFee.toFixed(2)}\n`;
      }
      message += `💵 *TOTAL: $${pricing.total.toFixed(2)} USD*\n\n`;
      message += `💳 Pago: ${metodoPago}\n\n`;
      
      // Si es segunda reserva de hotDesk, agregar referral
      if (this.freeTrialUsed === true && this.spaceType === 'hotDesk') {
        message += `───────────────────\n\n`;
        message += `💡 *¿Sabías que...?*\n\n`;
        message += `Tu amigo o colega TAMBIÉN puede registrarse y disfrutar de *2 horas gratis* 🎁\n\n`;
        message += `📲 *Envíale este enlace:*\n`;
        message += `${REFERRAL_LINK}\n\n`;
        message += `Dile: _"Amigo, regístrate aquí para recibir tus dos horas gratis"_ 😊\n\n`;
        message += `───────────────────\n\n`;
      }
      
      message += `¿*Confirmas esta reserva?*\n\n`;
      message += `Responde *SI* para continuar con el pago o *NO* para cancelar 👍`;
      message += `\n\n[CONFIRMAR]`;
      
      console.log('[FORM] ✅ Confirmación final generada - formulario completo');
      return message;
    }
    
    // ❌ CASO 2: Faltan campos - No generar confirmación, usar getNextQuestion()
    console.log('[FORM] ❌ No generar confirmación - faltan campos:', missing);
    return null;
  }

  /**
   * � Formatea fecha para mostrar al usuario
   * @param {string} date - Fecha en formato '2026-01-27'
   * @returns {string} - Fecha formateada como "Domingo 27 de enero 2026"
   */
  formatDate(date) {
    if (!date) return '';
    
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const dateObj = new Date(dateStr + 'T12:00:00-05:00');
    
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    const dayName = dayNames[dateObj.getDay()];
    const [year, month, day] = dateStr.split('-');
    const monthName = monthNames[parseInt(month, 10) - 1];
    
    return `${dayName} ${parseInt(day, 10)} de ${monthName} ${year}`;
  }

  /**
   * �💾 Convierte a objeto plano para almacenamiento
   */
  toJSON() {
    // Calcular precio con impuestos:
    // - HOT DESK en ventana 08:30-10:30: totalPrice = 0
    // - Sala reuniones SIEMPRE paga (meetingRoom): calcular precio
    // - Fuera de ventana siempre paga
    let pricing = { total: 0 };
    
    const isHotDeskFreeTrial = !this.freeTrialUsed && isFreeTrialWindowEligible(this.spaceType, this.time);

    if (isHotDeskFreeTrial) {
      // Primera visita con Hot Desk dentro de ventana 08:00–12:00 - GRATIS
      pricing = { total: 0 };
      console.log('[FORM] 💰 Primera visita Hot Desk en ventana 08:00–12:00 - Precio: GRATIS');
    } else if (this.paymentMethod) {
      // Sala reuniones O cliente recurrente - CALCULAR PRECIO
      pricing = this.calculateTotalWithTaxes();
      console.log('[FORM] 💰 Precio calculado:', {
        spaceType: this.spaceType,
        freeTrialUsed: this.freeTrialUsed,
        total: pricing.total
      });
    }
    
    return {
      userId: this.userId,
      isAdminBooking: this.isAdminBooking,
      reservationFor: this.reservationFor,
      beneficiaryName: this.beneficiaryName,
      beneficiaryPhone: this.beneficiaryPhone,
      beneficiaryEmail: this.beneficiaryEmail,
      spaceType: this.spaceType,
      date: this.date,
      time: this.time,
      email: this.email,
      numPeople: this.numPeople,
      durationHours: this.durationHours,
      paymentMethod: this.paymentMethod,
      totalPrice: pricing.total,  // ← Calcular total con impuestos
      freeTrialUsed: this.freeTrialUsed,  // ← Valor original (no se consume fuera de ventana)
      freeTrialWindowEligible: isHotDeskFreeTrial,
      secondSpaceType: this.secondSpaceType,
      secondTime: this.secondTime,
      secondDurationHours: this.secondDurationHours,
      discountPercent: this.discountPercent,
      durationWasUpgraded: this.durationWasUpgraded,
      pendingAlternatives: this.pendingAlternatives,
      desksQuantity: this.desksQuantity,
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * 📂 Crea formulario desde objeto almacenado
   */
  static fromJSON(data, freeTrialUsed = null) {
    return new PartialReservationForm(data.userId, {
      spaceType: data.spaceType,
      date: data.date,
      time: data.time,
      email: data.email,
      isAdminBooking: data.isAdminBooking,
      reservationFor: data.reservationFor,
      beneficiaryName: data.beneficiaryName,
      beneficiaryPhone: data.beneficiaryPhone,
      beneficiaryEmail: data.beneficiaryEmail,
      numPeople: data.numPeople,
      durationHours: data.durationHours,
      paymentMethod: data.paymentMethod,
      secondSpaceType: data.secondSpaceType,
      secondTime: data.secondTime,
      secondDurationHours: data.secondDurationHours,
      discountPercent: data.discountPercent,
      durationWasUpgraded: data.durationWasUpgraded,
      pendingAlternatives: data.pendingAlternatives,
      desksQuantity: data.desksQuantity,
    }, data.freeTrialUsed !== undefined ? data.freeTrialUsed : freeTrialUsed);  // ← Preferir valor almacenado
  }
}

/**
 * 🔍 Obtiene o crea formulario parcial para un usuario
 * 
 * NUEVO: Soporta form existente del sistema unificado (agent_forms)
 * Si se proporciona existingFormData, lo usa directamente
 * Esto permite que wassenger pase el form cargado de agent_forms
 */
export async function getOrCreateForm(userId, freeTrialUsed = null, existingFormData = null) {
  try {
    // 🎯 CASO 1: Form existente del sistema unificado (prioridad)
    if (existingFormData) {
      console.log('[FORM] 📜 Form existente del sistema unificado cargado para:', userId);
      const form = PartialReservationForm.fromJSON(existingFormData, freeTrialUsed);
      await form.initializeFreeTrialStatus();
      return form;
    }
    
    // 🔄 CASO 2: Buscar en pending_confirmations (legacy, por compatibilidad)
    const existing = await getPendingConfirmation(userId);
    
    if (existing && existing._type === 'partial_form' && existing._formData) {
      console.log('[FORM] 📂 Formulario legacy cargado desde pending_confirmations:', userId);
      const form = PartialReservationForm.fromJSON(existing._formData, freeTrialUsed);
      await form.initializeFreeTrialStatus();
      return form;
    }
    
    if (existing && existing._type === 'direct') {
      console.log('[FORM] 🔄 Detectado formato normalizado, convirtiendo a formulario...');
      
      const formData = {
        userId: existing.userId,
        spaceType: existing.serviceType,
        date: existing.date,
        time: existing.startTime,
        email: existing.email,
        numPeople: (existing.guestCount || 0) + 1,
        durationHours: existing.durationHours || 2,
        paymentMethod: existing.paymentMethod,
        freeTrialUsed: existing.wasFree !== null ? true : freeTrialUsed
      };
      
      console.log('[FORM] ✅ Datos preservados:', Object.keys(formData).filter(k => formData[k]));
      const form = PartialReservationForm.fromJSON(formData, formData.freeTrialUsed);
      await form.initializeFreeTrialStatus();
      return form;
    }
    
    // 🆕 CASO 3: No hay datos previos - crear formulario nuevo
    console.log('[FORM] ✨ Nuevo formulario creado para:', userId);
    const form = new PartialReservationForm(userId, {}, freeTrialUsed);
    await form.initializeFreeTrialStatus();
    return form;
  } catch (error) {
    console.error('[FORM] ❌ Error obteniendo formulario:', error);
    const form = new PartialReservationForm(userId, {}, freeTrialUsed);
    await form.initializeFreeTrialStatus();
    return form;
  }
}

/**
 * 🎯 Extrae datos del mensaje del usuario y actualiza formulario
 * 
 * Detecta menciones de:
 * - Tipo de espacio: "hot desk", "sala de reuniones"
 * - Fecha: "hoy", "mañana", "lunes", "12/11/2025"
 * - Hora: "10am", "3:30pm", "15:00"
 * - Email: "yo@diegovillota.com"
 * - Número de personas: "voy con 2 personas", "somos 3"
 */
export function extractDataFromMessage(message, currentForm) {
  console.log('[FORM-EXTRACT] 🚀 INICIANDO extractDataFromMessage - mensaje:', message);
  console.log('[FORM-EXTRACT] 📋 Formulario actual:', { 
    time: currentForm.time, 
    date: currentForm.date,
    spaceType: currentForm.spaceType,
    pendingAlternatives: currentForm.pendingAlternatives?.length || 0
  });
  
  const updates = {};
  const lowerMsg = message.toLowerCase();

  // 🎯 SELECCIÓN DE ALTERNATIVA — detectar ANTES de cualquier otro parser
  if (currentForm.pendingAlternatives && currentForm.pendingAlternatives.length > 0) {
    const trimmed = message.trim();
    let chosenIdx = -1;

    // Número directo: "1", "2", "3"
    if (/^[1-3]$/.test(trimmed)) {
      chosenIdx = parseInt(trimmed) - 1;
    }
    // Textual: "la 2", "la primera", "opción 3", "la tercera"
    const textMatch = trimmed.match(/^(?:la\s+)?(?:opci[oó]n\s+)?(\d|primera?|segunda?|tercera?)$/i);
    if (textMatch) {
      const val = textMatch[1].toLowerCase();
      if (/^\d$/.test(val)) chosenIdx = parseInt(val) - 1;
      else if (val.startsWith('primer')) chosenIdx = 0;
      else if (val.startsWith('segund')) chosenIdx = 1;
      else if (val.startsWith('tercer')) chosenIdx = 2;
    }

    if (chosenIdx >= 0 && chosenIdx < currentForm.pendingAlternatives.length) {
      const chosen = currentForm.pendingAlternatives[chosenIdx];
      updates.time = chosen.startTime;
      if (chosen.durationHours) updates.durationHours = chosen.durationHours;
      currentForm.pendingAlternatives = null;
      console.log('[FORM] ✅ Alternativa seleccionada:', chosen);
      return updates; // retornar inmediato — no parsear nada más
    }

    // Si el mensaje NO es selección de alternativa, limpiar para no interferir
    currentForm.pendingAlternatives = null;
    console.log('[FORM] 🧹 pendingAlternatives limpiadas — usuario no seleccionó número');
  }

  // 🏢 Detectar tipo de espacio
  // ✅ CAMBIO: Permitir sobrescribir si usuario menciona explícitamente un espacio
  // Esto permite cambiar de hotDesk → meetingRoom o viceversa
  const mentionsSala = /sala|meeting\s*room|reuni[oó]n/i.test(message);
  const mentionsHotDesk = /hot\s*desk|escritorio|puesto|individual/i.test(message);
  const mentionsBothSpaces = mentionsSala && mentionsHotDesk;
  
  if (mentionsBothSpaces) {
    // 🆕 RESERVA DOBLE: usuario pide Hot Desk + Sala en un solo mensaje
    updates.spaceType = 'hotDesk';
    updates.secondSpaceType = 'meetingRoom';
    updates.discountPercent = 10; // 10% descuento por reserva doble
    console.log('[FORM] 🏢🏢 RESERVA DOBLE detectada → hotDesk + meetingRoom (10% off)');
  } else if (mentionsSala) {
    updates.spaceType = 'meetingRoom';
    updates.secondSpaceType = null; // limpiar si había
    console.log('[FORM] 🏢 Usuario menciona sala/reunión → meetingRoom');
  } else if (mentionsHotDesk) {
    updates.spaceType = 'hotDesk';
    updates.secondSpaceType = null; // limpiar si había
    console.log('[FORM] 🏢 Usuario menciona hot desk → hotDesk');
  } else if (!currentForm.spaceType) {
    // Si no menciona ninguno y no hay spaceType, no hacer nada (Aurora preguntará)
    console.log('[FORM] 🏢 No se detectó mención de espacio');
  }

  // 📅 Detectar fecha (SIEMPRE intentar, permite cambiar fecha)
  // 🌍 Obtener fecha actual en timezone Ecuador
  const formatter = new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const todayStr = `${year}-${month}-${day}`;
  
  const today = new Date(`${year}-${month}-${day}T12:00:00-05:00`); // Ecuador timezone
  const relativeMatch = lowerMsg.match(/\b(hoy|ma[ñn]ana|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|lunes|martes)\b/);
  const isoMatch = message.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  const shortMatch = message.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  
  console.log('[FORM-DATE] 🕐 Buscando fecha en mensaje:', message);
  console.log('[FORM-DATE] 📋 Fecha actual en formulario:', currentForm.date);
  
  // 🆕 Detectar formato "18 de noviembre", "18 noviembre"
  const monthNames = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
  };
  const namedDateMatch = lowerMsg.match(/(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/);
  
  // 🗓️ Detectar "lunes 19 enero 2026" o "lunes 19 enero" o "lunes 19"
  // ⚠️ FIX: El número después del día NO debe ir seguido de am/pm/h/: (eso sería hora, no día del mes)
  // Ejemplo: "jueves 4pm" → NO debe matchear (4 es hora). "jueves 19" → SÍ debe matchear (19 es día).
  const fullDateMatch = lowerMsg.match(/\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s+(\d{1,2})(?!\s*(?:am|pm|h\b|:))(?:\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))?(?:\s+(\d{4}))?(?:\b|(?=[^\d]))/i);
  
  if (fullDateMatch) {
    const [, dayName, dayNum, monthName, yearStr] = fullDateMatch;
    const day = parseInt(dayNum, 10);
    const currentMonth = parseInt(month);
    const currentYear = parseInt(year);
    const currentDay = parseInt(day);
    
    let targetMonth = currentMonth;
    let targetYear = yearStr ? parseInt(yearStr) : currentYear;
    
    // Si se especificó el nombre del mes, usarlo
    if (monthName) {
      const monthNames = {
        'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
        'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
        'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
      };
      targetMonth = monthNames[monthName];
    } else {
      // Si no hay mes explícito, asumir mes actual
      // Si el día ya pasó este mes, usar mes siguiente
      if (day < currentDay) {
        targetMonth = currentMonth + 1;
        if (targetMonth > 12) {
          targetMonth = 1;
          targetYear = currentYear + 1;
        }
      }
    }
    
    updates.date = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    console.log('[FORM-DATE] 📅 Detectado día de semana completo:', updates.date);
  } else if (relativeMatch) {
      const keyword = relativeMatch[1];
      if (keyword === 'hoy') {
        updates.date = todayStr;
      } else if (keyword === 'mañana' || keyword === 'manana') {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowParts = formatter.formatToParts(tomorrow);
        updates.date = `${tomorrowParts.find(p => p.type === 'year').value}-${tomorrowParts.find(p => p.type === 'month').value}-${tomorrowParts.find(p => p.type === 'day').value}`;
      } else {
        // Nombre de día de semana: calcular el próximo día correspondiente
        const dayNameMap = {
          'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3,
          'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6, 'domingo': 0
        };
        const targetDayNum = dayNameMap[keyword];
        if (targetDayNum !== undefined) {
          const currentDayNum = today.getDay();
          let daysAhead = targetDayNum - currentDayNum;
          if (daysAhead <= 0) daysAhead += 7;
          const targetDate = new Date(today);
          targetDate.setDate(today.getDate() + daysAhead);
          const targetParts = formatter.formatToParts(targetDate);
          updates.date = `${targetParts.find(p => p.type === 'year').value}-${targetParts.find(p => p.type === 'month').value}-${targetParts.find(p => p.type === 'day').value}`;
        }
      }
      console.log('[FORM] 📅 Detectado fecha relativa:', updates.date);
    } else if (namedDateMatch) {
      const [, dayStr, monthName] = namedDateMatch;
      const targetMonth = monthNames[monthName.toLowerCase()];
      if (targetMonth) {
        const targetDay = parseInt(dayStr, 10);
        const currentYear = parseInt(year);
        const currentMonth = parseInt(month);
        
        // Si el mes ya pasó este año, usar año siguiente
        let targetYear = currentYear;
        if (targetMonth < currentMonth || (targetMonth === currentMonth && targetDay < parseInt(day))) {
          targetYear = currentYear + 1;
        }
        
        updates.date = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${targetDay.toString().padStart(2, '0')}`;
        console.log('[FORM] 📅 Detectado fecha con nombre de mes:', updates.date);
      }
    } else if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const normalizedYear = year.padStart(4, '0');
      updates.date = `${normalizedYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      console.log('[FORM] 📅 Detectado fecha ISO:', updates.date);
    } else if (shortMatch) {
      const [, day, month, yearPart] = shortMatch;
      let year = yearPart;
      if (yearPart.length === 2) {
        const century = today.getFullYear().toString().slice(0, 2);
        year = `${century}${yearPart.padStart(2, '0')}`;
      } else if (yearPart.length === 3) {
        year = `2${yearPart.padStart(3, '0')}`;
      }
      updates.date = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      console.log('[FORM] 📅 Detectado fecha con barras:', updates.date);
    }
  
  if (updates.date) {
    console.log('[FORM-DATE] 🔄 Sobrescribiendo fecha anterior:', currentForm.date, '→', updates.date);
  } else {
    console.log('[FORM-DATE] ❌ No se detectó fecha en el mensaje');
  }

  // ⏰ Detectar hora — primero buscar rango (start-end), luego hora simple
  console.log('[FORM-TIME] 🕐 Buscando hora en mensaje:', message);
  console.log('[FORM-TIME] 📋 Hora actual en formulario:', currentForm.time);

  // 🎯 Detectar rango horario: "9am hasta las 5pm", "9am a las 17:00", "09:00 - 17:00"
  const rangePattern = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:hasta\s+(?:la[s]?\s+)?|a\s+la[s]?\s+|[-–]\s*)(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi;
  const allRangeMatches = [...message.matchAll(rangePattern)];
  const rangeMatch = allRangeMatches[0] || null; // primer rango = primer espacio
  const rangeMatch2 = allRangeMatches[1] || null; // segundo rango = segundo espacio

  let detectedTime = null;
  let detectedDurationHours = null;

  if (rangeMatch) {
    let startH = parseInt(rangeMatch[1], 10);
    const startM = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    const startMer = rangeMatch[3]?.toLowerCase();
    let endH = parseInt(rangeMatch[4], 10);
    const endM = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : 0;
    const endMer = rangeMatch[6]?.toLowerCase();

    if (startMer === 'pm' && startH < 12) startH += 12;
    if (startMer === 'am' && startH === 12) startH = 0;
    if (endMer === 'pm' && endH < 12) endH += 12;
    if (endMer === 'am' && endH === 12) endH = 0;
    // Sin meridiem en end pero start usa meridiem: inferir pm si end < start
    if (!endMer && startMer && endH !== 0 && endH < startH) endH += 12;

    const totalMins = (endH * 60 + endM) - (startH * 60 + startM);
    if (totalMins > 0 && totalMins <= 13 * 60) { // máximo 13h (7am-8pm)
      detectedTime = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
      detectedDurationHours = Math.round(totalMins / 60 * 10) / 10;
      // 🚨 POLÍTICA MÍNIMO 2h: auto-upgrade silencioso si usuario pide < 2h
      if (detectedDurationHours < 2) {
        console.log(`[FORM-TIME] ⬆️ Duración ${detectedDurationHours}h < 2h mínimo → auto-upgrade a 2h (política Coworkia)`);
        updates.durationWasUpgraded = true;
        detectedDurationHours = 2;
      }
      console.log(`[FORM-TIME] 🎯 Rango detectado: ${detectedTime} → (${detectedDurationHours}h)`);
    }
  }

  // 🆕 Segundo rango horario (para reserva doble)
  if (rangeMatch2 && (updates.secondSpaceType || currentForm.secondSpaceType)) {
    let s2H = parseInt(rangeMatch2[1], 10);
    const s2M = rangeMatch2[2] ? parseInt(rangeMatch2[2], 10) : 0;
    const s2Mer = rangeMatch2[3]?.toLowerCase();
    let e2H = parseInt(rangeMatch2[4], 10);
    const e2M = rangeMatch2[5] ? parseInt(rangeMatch2[5], 10) : 0;
    const e2Mer = rangeMatch2[6]?.toLowerCase();
    if (s2Mer === 'pm' && s2H < 12) s2H += 12;
    if (s2Mer === 'am' && s2H === 12) s2H = 0;
    if (e2Mer === 'pm' && e2H < 12) e2H += 12;
    if (e2Mer === 'am' && e2H === 12) e2H = 0;
    if (!e2Mer && s2Mer && e2H !== 0 && e2H < s2H) e2H += 12;
    const totalMins2 = (e2H * 60 + e2M) - (s2H * 60 + s2M);
    if (totalMins2 > 0 && totalMins2 <= 13 * 60) {
      updates.secondTime = `${s2H.toString().padStart(2, '0')}:${s2M.toString().padStart(2, '0')}`;
      let dur2 = Math.round(totalMins2 / 60 * 10) / 10;
      if (dur2 < 2) { dur2 = 2; updates.durationWasUpgraded = true; }
      updates.secondDurationHours = dur2;
      console.log(`[FORM-TIME] 🆕 Segundo rango: ${updates.secondTime} (${dur2}h)`);
    }
  }

  // Si no hubo rango, detectar hora simple
  if (!detectedTime) {
    // 🆕 MAPA DE NÚMEROS ESCRITOS → números (lenguaje natural)
    const numberWords = {
      'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
      'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9, 'diez': 10,
      'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15,
      'dieciséis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19, 'veinte': 20
    };

    // 🌅 Detectar "diez de la mañana", "tres de la tarde", "ocho de la noche"
    const writtenTimeMatch = lowerMsg.match(/\b(una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+(?:de\s+la\s+)?(ma[ñn]ana|tarde|noche)\b/);
    
    if (writtenTimeMatch) {
      const hourWord = writtenTimeMatch[1];
      const period = writtenTimeMatch[2];
      let hour = numberWords[hourWord] || 0;
      
      // Convertir mañana/tarde/noche a formato 24h
      if (period === 'tarde' && hour < 12) hour += 12;  // 3 tarde = 15:00
      if (period === 'noche' && hour < 12) hour += 12;  // 8 noche = 20:00
      if (period === 'mañana' && hour === 12) hour = 0; // 12 mañana = 00:00 (medianoche)
      
      detectedTime = `${hour.toString().padStart(2, '0')}:00`;
      console.log('[FORM-TIME] ✨ Hora escrita detectada:', writtenTimeMatch[0], '→', detectedTime);
    } else {
      // Regex original para números
      const timeRegex = /(?:\b(a\s+las|a\s+la|las|hora|hacia|sobre|desde\s+las|desde\s+la)\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi;
      for (const match of message.matchAll(timeRegex)) {
        const [fullMatch, prefix, hourStr, minuteStr, meridiemRaw] = match;
        const meridiem = meridiemRaw ? meridiemRaw.toLowerCase() : null;
        const hasExplicitMinutes = Boolean(minuteStr) || /:/.test(match[0]);
        const isTimeContext = Boolean(prefix);
        if (!isTimeContext && !meridiem && !hasExplicitMinutes) continue;
        let hour = parseInt(hourStr, 10);
        if (Number.isNaN(hour)) continue;
        const minute = minuteStr ? parseInt(minuteStr, 10) : 0;
        if (meridiem === 'pm' && hour < 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
        detectedTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        console.log('[FORM-TIME] ✨ Hora simple detectada:', detectedTime);
        break;
      }
    }
  }

  if (detectedTime) {
    updates.time = detectedTime;
    if (detectedDurationHours) updates.durationHours = detectedDurationHours;
    console.log('[FORM] ⏰ Hora detectada:', updates.time, detectedDurationHours ? `(${detectedDurationHours}h)` : '');
    console.log('[FORM] 🔄 Sobrescribiendo hora anterior:', currentForm.time, '→', detectedTime);
  } else {
    console.log('[FORM-TIME] ❌ No se detectó hora en el mensaje');
  }  // 📧 Detectar email (SIEMPRE permitir actualizar, incluso si ya existe)
  const emailMatch = message.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    updates.email = emailMatch[1];
    console.log('[FORM] 📧 Detectado email:', updates.email);
    if (currentForm.email && currentForm.email !== emailMatch[1]) {
      console.log('[FORM] 🔄 Sobrescribiendo email anterior:', currentForm.email, '→', emailMatch[1]);
    }
  }

  // 💳 Detectar método de pago (SIEMPRE intentar, permite cambiar método)
  const paymentMatch = lowerMsg.match(/\b(efectivo|tarjeta|transferencia|cash|credito|crédit|débito|debito|transfer)\b/);
  if (paymentMatch) {
    const term = paymentMatch[1];
    if (term === 'efectivo' || term === 'cash') {
      updates.paymentMethod = 'efectivo';
      console.log('[FORM] 💵 Detectado método: efectivo');
    } else if (term === 'transferencia' || term === 'transfer') {
      updates.paymentMethod = 'transferencia';
      console.log('[FORM] 🏦 Detectado método: transferencia');
    } else if (/tarjeta|credito|crédit|débito|debito/.test(term)) {
      updates.paymentMethod = 'tarjeta';
      console.log('[FORM] 💳 Detectado método: tarjeta');
    }
  }

  // 👥 Detectar número de personas
  const peoplePatterns = [
    /(?:somos|vamos|iremos|voy con)\s+(\d+)/i,
    /(\d+)\s+personas?/i,
    /con\s+(\d+)\s+(?:personas?|acompa[ñn]antes?)/i,
    /(?:yo y|para)\s+(\d+)\s+(?:m[aá]s|personas?)/i,  // "yo y 3 más", "para 4 personas"
    /(\d+)\s+en total/i,  // "4 en total"
    /(?:reservar? para|necesito para)\s+(\d+)/i,  // "reservar para 4"
    /(\d+)\s+(?:hot\s*desks?|escritorios?|puestos?)/i  // "2 hot desks", "3 escritorios"
  ];

  for (const pattern of peoplePatterns) {
    const match = message.match(pattern);
    if (match) {
      let num = parseInt(match[1]);
      
      // Si dice "yo y X más", sumar 1 (el usuario + los demás)
      if (/yo y\s+\d+\s+m[aá]s/i.test(message)) {
        num = num + 1;
        console.log('[FORM] 👥 Detectado "yo y X más", ajustando total:', num);
      }
      
      updates.numPeople = num;
      console.log('[FORM] 👥 Detectado personas:', num);
      
      // ✅ Multi-hotdesk: si numPeople > 1 y spaceType es hotDesk, reservar N escritorios
      const effectiveSpaceType = updates.spaceType || currentForm.spaceType;
      if (num > 1 && effectiveSpaceType === 'hotDesk') {
        updates.desksQuantity = num;
        console.log('[FORM] 💻 Multi-hotdesk: reservando', num, 'escritorios');
      }
      
      break;
    }
  }

  // 🔍 FIX A6.3: DETECCIÓN DE CONTRADICCIONES (comparar valores nuevos vs existentes)
  const conflicts = [];
  
  if (updates.date && currentForm.date && updates.date !== currentForm.date) {
    conflicts.push({
      field: 'date',
      oldValue: currentForm.date,
      newValue: updates.date,
      message: `📅 Cambié la fecha de ${currentForm.date} a ${updates.date} según tu último mensaje`
    });
    console.log('[FORM-CONFLICT] ⚠️ Contradicción en fecha:', currentForm.date, '→', updates.date);
  }
  
  if (updates.time && currentForm.time && updates.time !== currentForm.time) {
    conflicts.push({
      field: 'time',
      oldValue: currentForm.time,
      newValue: updates.time,
      message: `⏰ Cambié la hora de ${currentForm.time} a ${updates.time} según tu último mensaje`
    });
    console.log('[FORM-CONFLICT] ⚠️ Contradicción en hora:', currentForm.time, '→', updates.time);
  }
  
  if (updates.spaceType && currentForm.spaceType && updates.spaceType !== currentForm.spaceType) {
    const oldLabel = currentForm.spaceType === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones';
    const newLabel = updates.spaceType === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones';
    conflicts.push({
      field: 'spaceType',
      oldValue: currentForm.spaceType,
      newValue: updates.spaceType,
      message: `🏢 Cambié de ${oldLabel} a ${newLabel} según tu último mensaje`
    });
    console.log('[FORM-CONFLICT] ⚠️ Contradicción en tipo:', currentForm.spaceType, '→', updates.spaceType);
  }
  
  // Agregar conflictos al objeto updates para que wassenger pueda informar al usuario
  if (conflicts.length > 0) {
    updates._conflicts = conflicts;
    console.log('[FORM-CONFLICT] 📢', conflicts.length, 'cambios detectados - se informará al usuario');
  }

  console.log('[FORM-EXTRACT] ✅ FIN extractDataFromMessage - updates:', updates);
  console.log('[FORM-EXTRACT] 📊 Campos detectados:', Object.keys(updates));
  
  return updates;
}

/**
 * 🤖 Procesa mensaje y actualiza formulario automáticamente
 * Retorna: { form, updates, nextQuestion, needsMoreInfo, validationError }
 */
export async function processMessageWithForm(userId, message, userProfile = null, existingFormData = null) {
  // 🎉 DETECCIÓN: Saludo inicial "quiero probar el servicio" (función unificada)
  const isSpecialWelcome = detectarSaludoConInteresServicio(message);
  
  // 1. Obtener o crear formulario (prioriza existingFormData del sistema unificado)
  const freeTrialUsed = userProfile?.freeTrialUsed ?? null;
  const form = await getOrCreateForm(userId, freeTrialUsed, existingFormData);
  let adminBeneficiaryUpdates = {};

  if (form.isAdminBooking) {
    const beneficiaryUpdates = extractAdminBeneficiaryData(message, form);
    adminBeneficiaryUpdates = beneficiaryUpdates;
    form.updateFields(beneficiaryUpdates);

    if (!form.reservationFor) {
      const reservationUpdates = extractDataFromMessage(message, form);
      form.updateFields(reservationUpdates);
      return {
        form,
        updates: { ...beneficiaryUpdates, ...reservationUpdates },
        isComplete: false,
        nextQuestion: form.getNextQuestion(),
        needsMoreInfo: true,
        summary: form.getSummary(),
        userMessage: message,
        validationError: null,
        confirmationMessage: null,
        canPauseAndResume: true
      };
    }

    if (form.reservationFor === 'self') {
      form.beneficiaryName = isValidBeneficiaryName(form.beneficiaryName)
        ? form.beneficiaryName
        : (isValidBeneficiaryName(userProfile?.name) ? userProfile.name : null);
      form.beneficiaryPhone = normalizeBeneficiaryPhone(form.beneficiaryPhone || userId);
      form.beneficiaryEmail = isValidBeneficiaryEmail(form.beneficiaryEmail)
        ? form.beneficiaryEmail
        : (isValidBeneficiaryEmail(userProfile?.email) ? userProfile.email : null);
      form.email = form.beneficiaryEmail;
    } else {
      // Una reserva para terceros nunca consume ni hereda la prueba gratuita del administrador.
      form.freeTrialUsed = true;
      if (form.beneficiaryEmail) form.email = form.beneficiaryEmail;
    }
  }

  // 2. Si es el saludo especial Y no hay datos en el formulario, generar mensaje de bienvenida
  if (isSpecialWelcome && !form.spaceType && !form.date && !form.time) {
    console.log('[FORM] 🎊 Detectado saludo especial "probar el servicio"');
    
    const userName = userProfile?.name ? ` ${userProfile.name}` : '';
    const hotDeskInfo = freeTrialUsed
      ? `💻 Hot Desk (Escritorio compartido - 1 persona)
• 2 horas: $10
• WiFi + café ☕`
      : `💻 Hot Desk (Escritorio compartido - 1 persona)
• 2 horas: $10
• WiFi + café ☕
• Primera visita GRATIS 🎁`;
    
    const welcomeMessage = `¡Hola${userName}! 👋 Perfecto, tenemos:

${hotDeskInfo}

🏢 Sala Reuniones (3-4 personas) - 2h: $29

¿Qué día y hora prefieres? 📅`;
    
    return {
      form,
      updates: {},
      nextQuestion: welcomeMessage,
      needsMoreInfo: true,
      summary: form.getSummary(),
      userMessage: message,
      validationError: null,
      confirmationMessage: null,
      canPauseAndResume: true,
      isSpecialWelcome: true // Flag para que wassenger sepa que es bienvenida especial
    };
  }

  // 3. Si el perfil tiene email y el formulario no, auto-completar
  if (userProfile?.email && !form.email && (!form.isAdminBooking || form.reservationFor === 'self')) {
    form.email = userProfile.email;
    console.log('[FORM] 📧 Email auto-completado desde perfil:', userProfile.email);
  }

  // 4. Extraer datos del mensaje
  const updates = { ...adminBeneficiaryUpdates, ...extractDataFromMessage(message, form) };

  // 5. Actualizar formulario si hay datos nuevos
  if (Object.keys(updates).length > 0) {
    form.updateFields(updates);
    console.log('[FORM] 📝 Campos actualizados:', Object.keys(updates));
  }

  if (form.isAdminBooking && form.reservationFor === 'other' && form.email) {
    form.beneficiaryEmail = form.email;
  }

  // La validez del horario no depende del tipo de espacio. Responder primero
  // evita pedir Hot Desk/Sala cuando la hora ya está fuera de atención.
  if (form.date && form.time) {
    const [startHour, startMinute = 0] = form.time.split(':').map(Number);
    const endTotalMinutes = startHour * 60 + startMinute + Math.round((form.durationHours || 2) * 60);
    const endTime = `${String(Math.floor(endTotalMinutes / 60)).padStart(2, '0')}:${String(endTotalMinutes % 60).padStart(2, '0')}`;
    const hoursValidation = validateBusinessHours(form.date, form.time, endTime);

    if (!hoursValidation.valid) {
      const alternatives = suggestAlternativeSlots(form.date, form.time, form.durationHours || 2, []).slice(0, 3);
      const alternativesText = alternatives.length
        ? alternatives.map((slot, index) => `${index + 1}. ${slot.startTime} - ${slot.endTime}`).join('\n')
        : HOURS.display;
      const invalidTime = form.time;
      form.pendingAlternatives = alternatives;
      form.time = null;

      return {
        form,
        updates,
        isComplete: false,
        nextQuestion: `⏰ ${invalidTime} está fuera de nuestro horario de atención (${HOURS.display}).\n\nOpciones disponibles para ese día:\n${alternativesText}\n\n¿Te sirve alguna?`,
        needsMoreInfo: true,
        summary: form.getSummary(),
        userMessage: message,
        validationError: null,
        confirmationMessage: null,
        canPauseAndResume: true
      };
    }
  }

  // 6. Verificar si está completo
  const isComplete = form.isComplete();
  const missingFields = form.getMissingFields();
  
  console.log('[FORM] 📊 Estado del formulario:', {
    isComplete,
    missingFields,
    freeTrialUsed: form.freeTrialUsed,
    hasPaymentMethod: !!form.paymentMethod,
    spaceType: form.spaceType,
    date: form.date,
    time: form.time,
    email: form.email
  });
  
  // 🚨 5. VALIDAR DOMINGOS Y FERIADOS SI EL FORMULARIO ESTÁ COMPLETO
  let validationError = null;
  
  if (isComplete && form.date) {
    const requestedDate = new Date(form.date + 'T00:00:00-05:00');
    const dayOfWeek = requestedDate.getDay();
    
    // Validar sábado (day === 6) — aceptar reserva pero avisar pago anticipado
    if (dayOfWeek === 6) {
      // Sábados bajo demanda: Aurora acepta la reserva normalmente
      // La alerta urgente a Diego se envía cuando el cliente paga
      console.log('[FORM] 📅 Sábado detectado — reserva aceptada bajo demanda:', form.date);
    }
    // Validar domingo (day === 0)
    else if (dayOfWeek === 0) {
      // Calcular próximo lunes
      const nextMonday = new Date(requestedDate);
      nextMonday.setDate(requestedDate.getDate() + 1);
      const nextMondayStr = nextMonday.toISOString().split('T')[0];

      validationError = {
        type: 'closed_sunday',
        message: `🚫 Los domingos Coworkia está cerrado, lo siento 😊

Estamos abiertos:
📅 *${HOURS.display}*

¿Qué tal si reservas para el lunes ${nextMondayStr}? 🗓️

📌 Si necesitas un espacio este domingo por un *pedido especial*, escríbele directamente al administrador:
👉 https://wa.me/593994837117`,
        suggestedDate: nextMondayStr
      };

      console.log('[FORM] 🚫 Validación: Domingo detectado -', form.date);
    }
    // Validar feriado
    else if (FERIADOS_ECUADOR.includes(form.date)) {
      const monthDay = form.date.substring(5);
      const nombreFeriado = NOMBRES_FERIADOS[monthDay] || 'Feriado';

      // Buscar próximo día hábil (lun-vie, no feriado)
      let nextWorkingDay = new Date(requestedDate);
      let daysToAdd = 1;

      while (daysToAdd <= 9) {
        nextWorkingDay.setDate(requestedDate.getDate() + daysToAdd);
        const nextDateStr = nextWorkingDay.toISOString().split('T')[0];
        const nextDayOfWeek = nextWorkingDay.getDay();

        // Día hábil = lunes a viernes (1-5) y no feriado
        if (nextDayOfWeek >= 1 && nextDayOfWeek <= 5 && !FERIADOS_ECUADOR.includes(nextDateStr)) {
          validationError = {
            type: 'closed_holiday',
            message: `🎉 ${nombreFeriado} - Coworkia está cerrado ese día 😊

Estamos abiertos:
📅 *${HOURS.display}*

¿Qué tal si reservas para el ${nextDateStr}? 🗓️

📌 Si necesitas un espacio en este feriado por un *pedido especial*, escríbele directamente al administrador:
👉 https://wa.me/593994837117`,
            suggestedDate: nextDateStr,
            holidayName: nombreFeriado
          };
          break;
        }

        daysToAdd++;
      }

      console.log('[FORM] 🎉 Validación: Feriado detectado -', nombreFeriado, form.date);
    }
  }
  
  // 🎯 Generar pregunta siguiente o mensaje de confirmación
  let nextQuestion = null;
  let confirmationMessage = null;

  // Helper: "hoy", "mañana" o fecha legible
  const _dateLabelForAlts = (isoDate) => {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (isoDate === today) return 'hoy';
    if (isoDate === tomorrow) return 'mañana';
    const [, m, d] = isoDate.split('-');
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `el ${parseInt(d)} de ${meses[parseInt(m) - 1]}`;
  };

  // 🛡️ FIX URGENTE: Verificar disponibilidad ANTES de pedir paymentMethod
  // Evita que el usuario pierda tiempo eligiendo método de pago para un slot no disponible
  if (!validationError && !isComplete && form.date && form.time && form.spaceType) {
    const onlyMissingPayment = missingFields.length === 1 && missingFields[0] === 'paymentMethod';
    const missingOnlyPaymentAndEmail = missingFields.every(f => f === 'paymentMethod' || f === 'email');
    
    if (onlyMissingPayment || missingOnlyPaymentAndEmail) {
      try {
        const { checkAvailability } = await import('./calendario.js');
        const { validateReservation, suggestAlternativeSlots } = await import('./reservation-validation.js');
        const reservationRepository = (await import('../database/reservationRepository.js')).default;
        
        // Calcular endTime
        const [startH, startM] = form.time.split(':').map(Number);
        const endMin = startH * 60 + (startM || 0) + Math.round((form.durationHours || 2) * 60);
        const endH = Math.floor(endMin / 60) % 24;
        const endMn = endMin % 60;
        const endTime = `${endH.toString().padStart(2, '0')}:${endMn.toString().padStart(2, '0')}`;
        
        // 1. Validar horario laboral / duración
        const earlyValidation = validateReservation(form.date, form.time, endTime, form.durationHours);
        if (!earlyValidation.valid) {
          console.log('[FORM] 🛡️ Early validation FAILED:', earlyValidation.errors);
          let existingReservations = [];
          try {
            const allRes = await reservationRepository.findByDate(form.date);
            existingReservations = allRes.filter(r => r.status !== 'cancelled' && r.status !== 'rejected');
          } catch (_e) { /* ignore */ }
          const alternatives = suggestAlternativeSlots(form.date, form.time, form.durationHours, existingReservations);
          
          const dateLabel = _dateLabelForAlts(form.date);
          const topAlts = alternatives.slice(0, 3);
          const altText = topAlts.length > 0
            ? topAlts.map((alt, i) => `${i + 1}. ${dateLabel} de ${alt.startTime} a ${alt.endTime}`).join('\n')
            : `No hay alternativas disponibles ${dateLabel}`;
          
          // Guardar alternativas para que el usuario pueda elegir por número
          form.pendingAlternatives = topAlts.map(a => ({ startTime: a.startTime, endTime: a.endTime, durationHours: a.durationHours }));
          // NO limpiar form — mantener date, spaceType, email; solo limpiar time
          form.time = null;
          form.durationHours = 2;
          
          return {
            form,
            updates,
            isComplete: false,
            nextQuestion: `❌ Ese horario no está disponible 😕\n\n📅 ¿Qué tal alguna de estas opciones?\n${altText}\n\n¿Te sirve alguna?`,
            needsMoreInfo: true,
            summary: form.getSummary(),
            userMessage: message,
            validationError: null,
            confirmationMessage: null,
            canPauseAndResume: true
          };
        }
        
        // 2. Verificar disponibilidad real (conflictos con otras reservas)
        const availability = await checkAvailability(
          form.date, form.time, form.durationHours, 
          form.spaceType === 'meetingRoom' ? 'meetingRoom' : 'hotDesk',
          null,
          userId,
          form.spaceType === 'hotDesk' ? (form.desksQuantity || 1) : 1
        );
        if (!availability.available) {
          console.log('[FORM] 🛡️ Early availability check FAILED:', availability.reason);
          const dateLabel2 = _dateLabelForAlts(form.date);
          const topAlts2 = (availability.alternatives || []).slice(0, 3);
          const altText = topAlts2.length > 0
            ? topAlts2.map((alt, i) => `${i + 1}. ${dateLabel2} de ${alt.startTime || alt} a ${alt.endTime || ''}`).join('\n')
            : '';
          
          // Guardar alternativas para que el usuario pueda elegir por número
          form.pendingAlternatives = topAlts2.filter(a => a.startTime).map(a => ({ startTime: a.startTime, endTime: a.endTime, durationHours: a.durationHours }));
          // NO limpiar form — mantener date, spaceType, email; solo limpiar time
          form.time = null;
          form.durationHours = 2;
          
          return {
            form,
            updates,
            isComplete: false,
            nextQuestion: `⚠️ ${availability.reason}${altText ? `\n\n📅 ¿Qué tal estos horarios?\n${altText}` : '\n\n¿Prefieres otro horario? 😊'}`,
            needsMoreInfo: true,
            summary: form.getSummary(),
            userMessage: message,
            validationError: null,
            confirmationMessage: null,
            canPauseAndResume: true
          };
        }
        console.log('[FORM] 🛡️ Early availability check PASSED ✅');
      } catch (earlyCheckErr) {
        console.error('[FORM] ⚠️ Early availability check error (non-blocking):', earlyCheckErr.message);
      }
    }
  }
  
  // ✅ FIX: Si está completo, generar confirmación final
  if (isComplete && !validationError) {
    confirmationMessage = form.getConfirmationMessage();
    console.log('[FORM] ✅ Formulario completo - generando confirmación final');
  }
  // Si no está completo, mostrar pregunta siguiente
  else if (!isComplete && !validationError) {
    // Si solo falta paymentMethod, getConfirmationMessage ya maneja ese caso
    confirmationMessage = form.getConfirmationMessage();
    
    if (!confirmationMessage) {
      // Preguntar por otros campos faltantes
      nextQuestion = form.getNextQuestion();
    }
  }

  return {
    form,
    updates,
    isComplete,                                          // ← necesario para handleFormResult
    nextQuestion: confirmationMessage || nextQuestion,   // Usar confirmationMessage si existe
    needsMoreInfo: !isComplete,
    summary: form.getSummary(),
    userMessage: message, // Para detectar frustración
    validationError, // 🆕 Error de validación si el día está cerrado
    confirmationMessage, // 🆕 Mensaje especial de confirmación con precios
    canPauseAndResume: true // 🆕 Indica que el formulario soporta pausar/reanudar
  };
}

// 💾 Persiste el formulario parcial en pending_confirmations (tabla legacy usada por tests)
export async function saveForm(form, ttlMinutes = 120) {
  try {
    const payload = {
      type: 'partial_form',
      formData: form.toJSON(),
      _type: 'partial_form'
    };

    await setPendingConfirmation(form.userId, payload, ttlMinutes);
    return true;
  } catch (error) {
    console.error('[FORM] ❌ Error guardando formulario parcial:', error);
    return false;
  }
}
