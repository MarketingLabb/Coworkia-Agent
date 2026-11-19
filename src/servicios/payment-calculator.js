/**
 * 💰 PAYMENT CALCULATOR - FUENTE ÚNICA DE VERDAD
 * 
 * Este módulo centraliza toda la lógica de cálculo de precios y pagos.
 * Usado por: memoria-sqlite.js, confirmation-flow.js, wassenger.js
 * 
 * Consolidado desde múltiples implementaciones duplicadas en v256.
 */

// 🏦 CONFIGURACIÓN BANCARIA Y LINKS DE PAGO
const BANK_ACCOUNT = process.env.COWORKIA_BANK_ACCOUNT || 
  'Produbanco\nCta Ahorros: 20059783069\nCédula: 1702683499\nGonzalo Villota Izurieta';

const PAYMENT_LINK = process.env.COWORKIA_PAYMENT_LINK || 
  'https://ppls.me/hnMI9yMRxbQ6rgIVi6L2DA';

// 💵 TARIFAS BASE
const PRICING = {
  hotDesk: {
    baseHours: 2,
    basePrice: 10.00,
    additionalHourPrice: 10.00,
    minPeople: 1,
    maxPeople: 6,
    pricePerUnit: true
  },
  meetingRoom: {
    baseHours: 2,
    basePrice: 30.00,
    additionalHourPrice: 15.00,
    minPeople: 3,
    maxPeople: 4,
    pricePerUnit: false
  }
};

const IVA_PERCENTAGE = 0.15; // 15% IVA Ecuador
const PAYPHONE_FEE_PERCENTAGE = 0.05; // 5% comisión Payphone (sobre subtotal + IVA)

/**
 * 💰 Calcula el costo de una reserva
 * @param {string} serviceType - 'hotDesk' o 'meetingRoom'
 * @param {number} hours - Duración en horas (mínimo 2)
 * @param {number} people - Número de personas (default: 1)
 * @param {string} paymentMethod - 'payphone' o 'transferencia' (default: 'payphone')
 * @returns {Object} Breakdown completo del costo o error
 */
export function calculateReservationCost(serviceType, hours, people = 1, paymentMethod = 'payphone') {
  // Validar tipo de servicio
  const config = PRICING[serviceType];
  if (!config) {
    return { error: `Tipo de servicio no válido: ${serviceType}` };
  }

  // Validar número de personas (debe ser al menos 1)
  if (people < 1 || !Number.isInteger(people)) {
    return { 
      error: `Número de personas debe ser al menos 1` 
    };
  }
  if (people < config.minPeople) {
    return { 
      error: `${serviceType === 'meetingRoom' ? 'Sala de reuniones' : 'Hot Desk'} requiere mínimo ${config.minPeople} persona${config.minPeople > 1 ? 's' : ''}` 
    };
  }
  if (people > config.maxPeople) {
    return { 
      error: `${serviceType === 'meetingRoom' ? 'Sala de reuniones' : 'Hot Desk'} tiene capacidad máxima de ${config.maxPeople} persona${config.maxPeople > 1 ? 's' : ''}` 
    };
  }

  // Calcular precio base (sin impuestos)
  let basePrice = 0;
  if (hours <= config.baseHours) {
    basePrice = config.basePrice;
  } else {
    const additionalHours = hours - config.baseHours;
    basePrice = config.basePrice + (additionalHours * config.additionalHourPrice);
  }

  if (config.pricePerUnit) {
    basePrice *= people;
  }

  // Calcular IVA (15% sobre precio base)
  const iva = basePrice * IVA_PERCENTAGE;
  const subtotalWithIVA = basePrice + iva;

  // Calcular comisión proveedor (5% sobre subtotal con IVA) SOLO si paga con tarjeta
  // Fórmula: Base → +15% IVA → Subtotal → +5% comisión
  // Ejemplo: $10 → +$1.50 = $11.50 → +$0.58 = $12.08 USD
  // IMPORTANTE: Redondear la comisión ANTES de sumar para evitar $12.07 por punto flotante
  let payphoneFee = 0;
  if (paymentMethod === 'payphone' || paymentMethod === 'tarjeta') {
    payphoneFee = parseFloat((subtotalWithIVA * PAYPHONE_FEE_PERCENTAGE).toFixed(2));
  }

  const totalPrice = subtotalWithIVA + payphoneFee;

  // Calcular precio por hora efectivo
  const pricePerHour = (basePrice / hours).toFixed(2);

  return {
    service: serviceType === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones',
    hours,
    people,
    basePrice: parseFloat(basePrice.toFixed(2)),
    iva: parseFloat(iva.toFixed(2)),
    subtotalWithIVA: parseFloat(subtotalWithIVA.toFixed(2)),
    payphoneFee: parseFloat(payphoneFee.toFixed(2)),
    totalPrice: parseFloat(totalPrice.toFixed(2)),
    pricePerHour: parseFloat(pricePerHour),
    paymentMethod,
    currency: 'USD'
  };
}

/**
 * 🧾 Genera mensaje de información de pago
 * @param {Object} profile - Perfil del usuario con freeTrialUsed y freeTrialDate
 * @param {string} serviceType - 'hotDesk' o 'meetingRoom'
 * @param {number} hours - Duración en horas
 * @returns {Object|null} Mensaje de pago formateado o null si no necesita pagar
 */
export function getPaymentInfo(profile, serviceType = 'hotDesk', hours = 2) {
  // Si no usó free trial, no necesita pagar
  if (!profile.freeTrialUsed) {
    return null;
  }

  // Calcular costo
  const costInfo = calculateReservationCost(serviceType, hours);
  
  if (costInfo.error) {
    return {
      error: costInfo.error,
      message: `❌ ${costInfo.error}`
    };
  }

  // Construir mensaje de pago (con desglose claro)
  const paymentMessage = `✅ Ya usaste tu día gratis el ${profile.freeTrialDate || 'anteriormente'}.\n\n🧾 *Desglose de tu reserva:*\n\n• ${costInfo.service} (${costInfo.hours}h): $${costInfo.basePrice.toFixed(2)}\n• IVA (15%): $${costInfo.iva.toFixed(2)}\n• Subtotal: $${costInfo.subtotalWithIVA.toFixed(2)}${costInfo.payphoneFee > 0 ? `\n• Comisión Payphone (5%): $${costInfo.payphoneFee.toFixed(2)}` : ''}\n\n💰 *TOTAL:* $${costInfo.totalPrice.toFixed(2)} USD\n\n💳 *PAGO CON TARJETA (Payphone):*\n${PAYMENT_LINK}\n• Total: $${costInfo.totalPrice.toFixed(2)}\n\n🏦 *Transferencia Bancaria:*\n${BANK_ACCOUNT}\n• Total: $${(costInfo.basePrice + costInfo.iva).toFixed(2)} (sin comisión)\n\n📸 Envía tu comprobante para confirmar ✅`;

  return {
    message: paymentMessage,
    freeTrialDate: profile.freeTrialDate,
    costBreakdown: costInfo,
    paymentMethods: {
      payphone: PAYMENT_LINK,
      bank: BANK_ACCOUNT
    }
  };
}

/**
 * 🏦 Obtiene información bancaria para transferencias
 * @returns {string} Datos bancarios formateados
 */
export function getBankAccountInfo() {
  return BANK_ACCOUNT;
}

/**
 * 💳 Obtiene link de pago Payphone
 * @returns {string} URL de Payphone
 */
export function getPayphoneLink() {
  return PAYMENT_LINK;
}

/**
 * 📊 Obtiene configuración de precios (para debugging/testing)
 * @returns {Object} Configuración de pricing completa
 */
export function getPricingConfig() {
  return {
    ...PRICING,
    payphoneFeePercentage: PAYPHONE_FEE_PERCENTAGE
  };
}

export default {
  calculateReservationCost,
  getPaymentInfo,
  getBankAccountInfo,
  getPayphoneLink,
  getPricingConfig
};
