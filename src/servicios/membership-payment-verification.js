/**
 * 💼💳 Sistema de Verificación de Pagos de Membresías - ALUNA
 * 
 * Procesa automáticamente comprobantes de pago para membresías de Coworkia.
 * Valida 20 parámetros, verifica cuenta destino, previene duplicados.
 * 
 * Flujo:
 * 1. Usuario envía comprobante por WhatsApp
 * 2. VisionAI extrae 20 parámetros
 * 3. Sistema valida monto, cuenta, fecha, duplicados
 * 4. Si pasa validación → aprueba automáticamente
 * 5. Si falla → envía a revisión manual o rechaza
 * 
 * @module membership-payment-verification
 */

import { analyzePaymentReceipt } from '../servicios-ia/openai.js';
import db from '../database/postgres-adapter.js';
import { sendPaymentReceipt, prepareReceiptData } from './payment-receipt-email.js';
import { markAlunaProspectConverted } from '../database/alunaRepository.js';
import { blockMembershipCalendar } from './google-calendar.js';
import { sendAlunaWelcomeEmail } from './aluna-welcome-email.js';
import { generateMembershipWifiCode } from './wifi-codes-service.js';

// Constantes de validación
const CUENTA_COWORKIA = '20059783069';
const TOLERANCE_AMOUNT = 1.00; // $1.00 USD
const MAX_DAYS_OLD = 30; // Comprobantes de últimos 30 días
const MIN_CONFIDENCE = 70; // Confianza mínima para auto-aprobar

// Keywords para detectar autorización de Diego para pagos compuestos
const DIEGO_AUTH_KEYWORDS = [
  'diego villota autorizó',
  'diego villota autorizo',
  'diego villota aprobó',
  'diego villota aprobo',
  'diego me autorizó',
  'diego autorizo',
  'diego me autorizo',
  'diego aprobó',
  'diego aprobo',
  'autorización de diego',
  'autorizacion de diego',
  'autorización de diego villota',
  'autorizacion de diego villota'
];

/**
 * 📋 Información de membresías disponibles
 */
const MEMBERSHIP_TYPES = {
  'Plan 10': { 
    price: 180, 
    priceWithIVA: 201.60,
    benefits: '11 días/mes todo el día + Sala reuniones 1x/sem (3 pers) + 1 invitado/sem (2h)',
    description: '11 días completos desde apertura hasta cierre'
  },
  'Plan 20': { 
    price: 250,
    priceWithIVA: 280,
    benefits: '22 días/mes todo el día + Sala reuniones 2x/sem (4 pers) + 2 invitados/sem (2h)',
    description: '22 días completos desde apertura hasta cierre'
  },
  'Oficina Virtual': { 
    price: 365,
    priceWithIVA: 365, // Sin IVA según negociación
    benefits: 'Cumplimiento entes rectores + Recepción docs/paquetes (1kg max) + Sala reuniones 1x/mes (3 pers)',
    description: 'Dirección comercial legal 365 días/año'
  }
};

/**
 * 🔍 Valida monto del pago vs. monto esperado
 */
function validateAmount(paymentAmount, expectedAmount) {
  const difference = Math.abs(paymentAmount - expectedAmount);
  
  return {
    valid: difference <= TOLERANCE_AMOUNT,
    difference,
    message: difference <= TOLERANCE_AMOUNT 
      ? `Monto correcto: $${paymentAmount}` 
      : `Diferencia de $${difference.toFixed(2)} (esperado: $${expectedAmount}, recibido: $${paymentAmount})`
  };
}

/**
 * 📅 Valida fecha de transacción
 */
function validateDate(transactionDate) {
  const paymentDate = new Date(transactionDate);
  const now = new Date();
  const daysDiff = (now - paymentDate) / (1000 * 60 * 60 * 24);
  
  if (daysDiff < 0) {
    return {
      valid: false,
      warning: true,
      message: 'Fecha futura - comprobante inválido',
      daysDiff: Math.abs(daysDiff)
    };
  }
  
  if (daysDiff > MAX_DAYS_OLD) {
    return {
      valid: false,
      warning: true,
      message: `Comprobante muy antiguo (${Math.floor(daysDiff)} días)`,
      daysDiff
    };
  }
  
  return {
    valid: true,
    warning: daysDiff > 7, // Alerta si > 7 días
    message: daysDiff > 7 
      ? `Comprobante de hace ${Math.floor(daysDiff)} días` 
      : 'Fecha válida',
    daysDiff
  };
}

/**
 * 🏦 Valida cuenta destino (seguridad crítica)
 */
function validateDestinationAccount(accountNumber) {
  if (!accountNumber) {
    return {
      valid: null, // Desconocido, no rechazar
      warning: true,
      message: 'No se detectó cuenta destino en el comprobante'
    };
  }
  
  // Limpiar formato
  const cleaned = accountNumber.replace(/[-\s]/g, '');
  
  if (cleaned === CUENTA_COWORKIA) {
    return {
      valid: true,
      warning: false,
      message: '✅ Cuenta destino verificada (Produbanco 20059783069)'
    };
  }
  
  return {
    valid: false,
    warning: false,
    message: `❌ Cuenta incorrecta: ${cleaned} (debe ser ${CUENTA_COWORKIA})`
  };
}

/**
 * 🚫 Verifica si el número de transacción ya fue procesado (anti-duplicados)
 */
async function checkDuplicate(transactionNumber) {
  try {
    const query = `
      SELECT id, membership_lead_id, amount, transaction_date, status
      FROM membership_payments 
      WHERE transaction_number = $1
      LIMIT 1
    `;
    
    const result = await db.get(query, [transactionNumber]);
    
    if (result) {
      return {
        isDuplicate: true,
        existingPayment: result,
        message: `Ya existe pago con transacción ${transactionNumber} (${result.status})`
      };
    }
    
    return {
      isDuplicate: false,
      message: 'Número de transacción único ✅'
    };
    
  } catch (error) {
    console.error('[PAYMENT-VERIFICATION] Error checking duplicates:', error);
    return {
      isDuplicate: false,
      error: true,
      message: 'No se pudo verificar duplicados (proceder con precaución)'
    };
  }
}

/**
 * 🤝 Detecta si el usuario menciona autorización de Diego para pago compuesto
 */
function detectDiegoAuthorization(userMessage = '') {
  if (!userMessage) return false;
  
  const lowerMessage = userMessage.toLowerCase();
  return DIEGO_AUTH_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
}

/**
 * 💰 Extrae información de pago compuesto del mensaje del usuario
 * Formato esperado: "$100 efectivo" + "$150 canje servicio producción videos"
 */
function parseCompositePayment(userMessage) {
  const cashMatch = userMessage.match(/\$?(\d+(?:\.\d{2})?)\s*(?:en\s+)?efectivo/i);
  const canjeMatch = userMessage.match(/\$?(\d+(?:\.\d{2})?)\s*(?:en\s+)?canje/i);
  
  const cashAmount = cashMatch ? parseFloat(cashMatch[1]) : 0;
  const canjeAmount = canjeMatch ? parseFloat(canjeMatch[1]) : 0;
  
  // Extraer descripción del canje
  const canjeDescMatch = userMessage.match(/canje\s+([^$\n]+?)(?:\$|\n|mensualmente|$)/i);
  const canjeDescription = canjeDescMatch ? canjeDescMatch[1].trim() : '';
  
  return {
    isComposite: cashAmount > 0 && canjeAmount > 0,
    cashAmount,
    canjeAmount,
    totalAmount: cashAmount + canjeAmount,
    canjeDescription,
    rawMessage: userMessage
  };
}

/**
 * 🎯 Decide si un pago debe aprobarse automáticamente
 */
function shouldAutoApprove(validations, confidence) {
  // Criterios para auto-aprobación:
  // 1. Confianza >= 70%
  // 2. Monto válido
  // 3. Fecha válida
  // 4. No es duplicado
  // 5. Estado "approved"
  // 6. Cuenta destino correcta (o desconocida pero con alta confianza)
  
  if (confidence < MIN_CONFIDENCE) {
    return {
      autoApprove: false,
      reason: `Confianza baja (${confidence}% < ${MIN_CONFIDENCE}%)`,
      action: 'manual_review'
    };
  }
  
  if (!validations.amount.valid) {
    return {
      autoApprove: false,
      reason: validations.amount.message,
      action: 'reject'
    };
  }
  
  if (!validations.date.valid) {
    return {
      autoApprove: false,
      reason: validations.date.message,
      action: 'reject'
    };
  }
  
  if (validations.duplicate.isDuplicate) {
    return {
      autoApprove: false,
      reason: validations.duplicate.message,
      action: 'reject'
    };
  }
  
  if (validations.account.valid === false) {
    return {
      autoApprove: false,
      reason: validations.account.message,
      action: 'reject'
    };
  }
  
  // Si cuenta es desconocida pero confidence >= 90, aprobar
  if (validations.account.valid === null && confidence >= 90) {
    return {
      autoApprove: true,
      reason: 'Auto-aprobado (alta confianza)',
      action: 'notify_staff'
    };
  }
  
  // Cuenta verificada + todas las validaciones OK
  if (validations.account.valid === true) {
    return {
      autoApprove: true,
      reason: 'Todas las validaciones pasadas',
      action: confidence >= 90 ? 'auto' : 'notify_staff'
    };
  }
  
  // Caso por defecto: revisión manual
  return {
    autoApprove: false,
    reason: 'Requiere verificación manual',
    action: 'manual_review'
  };
}

/**
 * 💾 Guarda el pago en la base de datos
 */
async function savePayment(lead, paymentData, validations, imageUrl) {
  const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const query = `
      INSERT INTO membership_payments (
        id, membership_lead_id, user_phone,
        amount, transaction_date, transaction_time, transaction_number, payment_method,
        bank_sender, bank_receiver, account_number_destination, account_number_source,
        account_holder_source, authorization_number, receipt_number,
        currency, transaction_description, transaction_status, payment_channel,
        card_type, card_last_four, transaction_fee,
        confidence_score, image_url, raw_vision_data, validation_warnings,
        status, verification_method, verified_at, processed_at,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22,
        $23, $24, $25, $26,
        $27, $28, $29, $30,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
    
    const validationWarnings = {
      amount: validations.amount,
      date: validations.date,
      account: validations.account,
      duplicate: validations.duplicate,
      compositePayment: validations.compositePayment || null
    };
    
    const values = [
      paymentId,
      lead.id,
      lead.user_phone,
      paymentData.amount,
      paymentData.transactionDate,
      paymentData.transactionTime || null,
      paymentData.transactionNumber,
      paymentData.paymentMethod,
      paymentData.bankSender,
      paymentData.bankReceiver,
      paymentData.accountNumberDestination,
      paymentData.accountNumberSource,
      paymentData.accountHolderSource,
      paymentData.authorizationNumber,
      paymentData.receiptNumber,
      paymentData.currency || 'USD',
      paymentData.transactionDescription,
      paymentData.transactionStatus,
      paymentData.paymentChannel,
      paymentData.cardType,
      paymentData.cardLastFour,
      paymentData.transactionFee || 0,
      paymentData.confidence,
      imageUrl,
      JSON.stringify(paymentData),
      JSON.stringify(validationWarnings),
      validations.shouldAutoApprove ? 'verified' : 'manual_review',
      'vision_ai',
      new Date().toISOString(),
      new Date().toISOString()
    ];
    
    const result = await db.run(query, values);
    
    console.log('[PAYMENT-VERIFICATION] ✅ Pago guardado:', paymentId);
    
    return {
      success: true,
      paymentId,
      payment: result
    };
    
  } catch (error) {
    console.error('[PAYMENT-VERIFICATION] ❌ Error guardando pago:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * � Genera recibo de pago profesional
 */
function generateReceiptMessage(lead, paymentData, compositePayment = null) {
  const receiptNumber = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  const today = new Date().toLocaleDateString('es-EC', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const membershipInfo = MEMBERSHIP_TYPES[lead.membership_type] || {};
  
  return `
📄 *RECIBO DE PAGO OFICIAL*
━━━━━━━━━━━━━━━━━━━━━━━━━━

🧾 *Número:* ${receiptNumber}
📅 *Fecha emisión:* ${today}

👤 *DATOS DEL CLIENTE*
• Nombre: ${lead.full_name}
• Email: ${lead.email}
• Teléfono: ${lead.user_phone}

💼 *MEMBRESÍA CONTRATADA*
• Plan: *${lead.membership_type}*
• Beneficios: ${membershipInfo.benefits || 'Ver detalles del plan'}
• Inicio: ${lead.start_date || 'Inmediato'}

💰 *DETALLE DE PAGO*
${compositePayment ? `
• Efectivo: $${compositePayment.cashAmount.toFixed(2)} USD ✅
• Canje servicios: $${compositePayment.canjeAmount.toFixed(2)} USD/mes
  └─ Descripción: ${compositePayment.canjeDescription}
━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *TOTAL MENSUAL:* $${compositePayment.totalAmount.toFixed(2)} USD

⚠️ *ENTREGAS MENSUALES*
📦 ${compositePayment.canjeDescription}
💵 Valor: $${compositePayment.canjeAmount.toFixed(2)} USD
📅 Frecuencia: Mensual
⏰ *Gabi* te recordará 3 días antes de cada entrega.
` : `
• Monto pagado: $${paymentData.amount.toFixed(2)} USD ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 *TOTAL:* $${paymentData.amount.toFixed(2)} USD
`}

📋 *COMPROBANTE BANCARIO*
• Banco: ${paymentData.bankSender || 'No especificado'}
• Fecha transacción: ${paymentData.transactionDate}
• Número transacción: ${paymentData.transactionNumber || 'N/A'}
• Autorización: ${paymentData.authorizationNumber || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *PAGO VERIFICADO AUTOMÁTICAMENTE*

🏢 *Coworkia Business Center*
📍 Whymper 403, Edificio Finistere, Quito
📞 +593 99 483 7117
📧 secretaria.coworkia@gmail.com
🌐 www.coworkia.com

━━━━━━━━━━━━━━━━━━━━━━━━━━

${lead.membership_type !== 'Oficina Virtual' ? `🎯 *PRÓXIMO PASO:*
Te contactaremos en las próximas horas para agendar tu tour del espacio y entregarte tu acceso.

` : ''}¡Bienvenido/a a nuestra comunidad! 🎉
Gracias por confiar en Coworkia 💙
  `.trim();
}

/**
 * �📧 Actualiza lead a estado 'accepted' y envía emails
 */
async function approveLead(lead, payment, compositePayment = null) {
  try {
    // Actualizar lead
    await db.run(
      `UPDATE membership_leads 
       SET status = 'accepted', 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [lead.id]
    );
    
    // ── 1. GABI: Recibo financiero por email ─────────────────────────────────
    console.log('[PAYMENT-VERIFICATION] 💚 Gabi enviando recibo por email...');
    const receiptData = prepareReceiptData(lead, payment, compositePayment);
    const emailResult = await sendPaymentReceipt(receiptData);
    if (emailResult.success) {
      console.log('[PAYMENT-VERIFICATION] ✅ Recibo Gabi enviado:', receiptData.receiptNumber);
    } else {
      console.error('[PAYMENT-VERIFICATION] ⚠️ Recibo Gabi falló:', emailResult.error);
    }

    // ── 2. ALUNA: Email de bienvenida con beneficios + WiFi + contrato ────────
    console.log('[PAYMENT-VERIFICATION] 🌙 Aluna enviando email de bienvenida...');

    // Generar código WiFi real para la membresía (excepto Oficina Virtual)
    let wifiCode = null;
    if (lead.membership_type !== 'Oficina Virtual') {
      const wifiResult = await generateMembershipWifiCode({
        membershipCode: lead.membership_code,
        userPhone:      lead.user_phone,
        membershipType: lead.membership_type,
        startDate:      lead.start_date
      }).catch(err => {
        console.error('[PAYMENT-VERIFICATION] ⚠️ WiFi code generation falló:', err.message);
        return null;
      });
      if (wifiResult?.success) {
        wifiCode = wifiResult.code;
        console.log(`[PAYMENT-VERIFICATION] 📡 Código WiFi generado: ${wifiCode}`);
      }
    }

    sendAlunaWelcomeEmail(lead, payment, compositePayment, wifiCode).catch(err =>
      console.error('[PAYMENT-VERIFICATION] ⚠️ Welcome email falló:', err.message)
    );

    // ── 3. CALENDAR: Bloquear hot desk L-V 8:30-19:00 desde mañana ───────────
    if (lead.membership_type !== 'Oficina Virtual') {
      console.log('[PAYMENT-VERIFICATION] 📅 Bloqueando hot desk en Google Calendar...');
      const membershipStart = lead.start_date
        ? new Date(lead.start_date)
        : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();

      blockMembershipCalendar({
        clientName:     lead.client_name || lead.full_name,
        membershipType: lead.membership_type,
        startDate:      membershipStart.toISOString(),
        membershipCode: lead.membership_code
      }).then(r => {
        console.log(`[PAYMENT-VERIFICATION] 📅 Calendar bloqueado: ${r.created}/${r.total} días — ${lead.membership_code}`);
      }).catch(err => {
        console.error('[PAYMENT-VERIFICATION] ⚠️ Calendar blocking falló:', err.message);
      });
    }

    // ── 4. PERMANENT DESK: Asignar hot desk permanente al miembro ────────────
    if (lead.membership_type !== 'Oficina Virtual') {
      try {
        const reservationRepository = (await import('../database/reservationRepository.js')).default;
        const today = new Date().toISOString().split('T')[0];
        
        // Asignar el primer desk disponible
        const deskNumber = await reservationRepository.assignHotDeskNumber(today, '08:00', '19:00');
        if (deskNumber) {
          await reservationRepository.createPermanentDesk({
            userPhone: lead.user_phone,
            clientName: lead.client_name || 'Sin nombre',
            hotDeskNumber: deskNumber,
            membershipLeadId: lead.id,
            startDate: today,
            endDate: null, // Indefinido hasta cancelación
            notes: `Auto-asignado al aprobar membresía ${lead.membership_type} — ${lead.membership_code}`
          });
          console.log(`[PAYMENT-VERIFICATION] 🔒 Desk permanente #${deskNumber} asignado a ${lead.client_name}`);
        }
      } catch (deskErr) {
        console.error('[PAYMENT-VERIFICATION] ⚠️ Desk permanente falló (no crítico):', deskErr.message);
      }
    }

    // ── 5. PIPELINE: Marcar prospecto como convertido ─────────────────────────
    markAlunaProspectConverted(lead.user_phone).catch(() => {});

    console.log('[PAYMENT-VERIFICATION] ✅ Lead aprobado:', lead.id);

    return { 
      success: true, 
      receiptNumber: receiptData.receiptNumber,
      receiptSent: emailResult.success 
    };
    
  } catch (error) {
    console.error('[PAYMENT-VERIFICATION] ❌ Error aprobando lead:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 💳 FUNCIÓN PRINCIPAL: Procesa comprobante de pago de membresía
 * @param {Object} messageData - Datos del mensaje con imagen
 * @param {Object} userProfile - Perfil del usuario
 * @param {String} userMessage - Mensaje opcional del usuario (para detectar pagos compuestos)
 */
export async function processMembershipPayment(messageData, userProfile, userMessage = '') {
  console.log('[MEMBERSHIP-PAYMENT] 🔍 Procesando comprobante...');
  
  const userId = userProfile.userId;
  const imageUrl = messageData.media?.url;
  
  try {
    // Validar que haya imagen
    if (!messageData?.media?.url) {
      return {
        success: false,
        message: '📸 No pude analizar el comprobante.\n\nPor favor envía una foto clara de tu comprobante de pago.'
      };
    }
    
    // DETECTAR PAGO COMPUESTO (Diego autorizado)
    const hasDiegoAuth = detectDiegoAuthorization(userMessage);
    const compositePayment = hasDiegoAuth ? parseCompositePayment(userMessage) : null;
    
    if (hasDiegoAuth && compositePayment?.isComposite) {
      console.log('[MEMBERSHIP-PAYMENT] 🤝 Pago compuesto detectado:', {
        cash: compositePayment.cashAmount,
        canje: compositePayment.canjeAmount,
        total: compositePayment.totalAmount
      });
    }
    
    // PASO 1: Analizar imagen con VisionAI (20 parámetros)
    console.log('[MEMBERSHIP-PAYMENT] 🤖 Analizando con VisionAI...');
    const analysisResult = await analyzePaymentReceipt(imageUrl);
    
    if (!analysisResult.success) {
      return {
        success: false,
        message: `⚠️ No pude analizar el comprobante automáticamente.

Por favor, escribe estos datos:
1️⃣ Monto: $____
2️⃣ Fecha: dd/mm/aaaa  
3️⃣ Número de transacción: ____

O si prefieres, reenvía la foto más clara 📸`
      };
    }
    
    const paymentData = analysisResult.data;
    
    // PASO 2: Buscar lead pendiente de pago
    const pendingLead = await db.get(
      `SELECT * FROM membership_leads 
       WHERE user_phone = $1 
       AND status = 'pending_payment'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );
    
    if (!pendingLead) {
      return {
        success: false,
        message: `📊 *Comprobante recibido*

💵 Monto: $${paymentData.amount || '?'}
📅 Fecha: ${paymentData.transactionDate || 'No detectada'}
💳 Método: ${paymentData.paymentMethod || 'No especificado'}

⚠️ No encuentro solicitudes de membresía pendientes de pago.

¿Necesitas información sobre nuestros planes? Escribe "planes" 😊`
      };
    }
    
    // PASO 3: Validar todos los parámetros
    const membershipInfo = MEMBERSHIP_TYPES[pendingLead.membership_type];
    // Renovación con oferta de recuperación (Aluna D+5): el lead trae su % de descuento
    const renewalDiscountPct = Number(pendingLead.renewal_discount_pct) || 0;
    const expectedAmount = renewalDiscountPct > 0
      ? Math.round(membershipInfo.price * (1 - renewalDiscountPct / 100) * 100) / 100
      : membershipInfo.price;
    
    // Para pagos compuestos, validar contra el total compuesto
    let actualAmount = paymentData.amount;
    let isCompositePayment = false;
    
    if (compositePayment?.isComposite) {
      // Verificar que el monto del comprobante coincida con el efectivo declarado
      if (Math.abs(paymentData.amount - compositePayment.cashAmount) <= TOLERANCE_AMOUNT) {
        actualAmount = compositePayment.totalAmount; // Usar total para validación
        isCompositePayment = true;
        console.log('[MEMBERSHIP-PAYMENT] ✅ Pago compuesto validado:', {
          comprobanteEfectivo: paymentData.amount,
          declaradoEfectivo: compositePayment.cashAmount,
          canje: compositePayment.canjeAmount,
          totalValidar: actualAmount
        });
      } else {
        console.warn('[MEMBERSHIP-PAYMENT] ⚠️ Monto en comprobante no coincide con efectivo declarado');
      }
    }
    
    const validations = {
      amount: validateAmount(actualAmount, expectedAmount),
      date: validateDate(paymentData.transactionDate),
      account: validateDestinationAccount(paymentData.accountNumberDestination),
      duplicate: await checkDuplicate(paymentData.transactionNumber),
      compositePayment: isCompositePayment ? compositePayment : null
    };
    
    // PASO 4: Decidir si auto-aprobar
    const approvalDecision = shouldAutoApprove(validations, paymentData.confidence);
    validations.shouldAutoApprove = approvalDecision.autoApprove;
    validations.approvalReason = approvalDecision.reason;
    
    // PASO 5: Guardar pago en BD
    const saveResult = await savePayment(pendingLead, paymentData, validations, imageUrl);
    
    if (!saveResult.success) {
      return {
        success: false,
        message: `⚠️ Error guardando información del pago.

Por favor contacta a nuestro equipo:
📞 +593 99 483 7117
📧 secretaria.coworkia@gmail.com`
      };
    }
    
    // PASO 6: Responder según decisión
    
    // 🟢 CASO 1: AUTO-APROBADO
    if (approvalDecision.autoApprove) {
      await approveLead(pendingLead, paymentData, compositePayment);
      
      // 📄 Generar recibo profesional por WhatsApp también
      const receiptMessage = generateReceiptMessage(
        pendingLead, 
        paymentData, 
        validations.compositePayment
      );
      
      console.log('[PAYMENT-VERIFICATION] 📄 Recibo generado para:', pendingLead.full_name);
      console.log('[PAYMENT-VERIFICATION] 💚 Gabi también envió recibo por email');
      
      return {
        success: true,
        autoApproved: true,
        message: receiptMessage
      };
    }
    
    // 🔴 CASO 2: RECHAZADO
    if (approvalDecision.action === 'reject') {
      let rejectionMessage = `⚠️ *PROBLEMA CON EL COMPROBANTE*

📊 *Datos detectados:*
💰 Monto: $${paymentData.amount || '?'}
📅 Fecha: ${paymentData.transactionDate || 'No detectada'}
💳 Método: ${paymentData.paymentMethod || '?'}

❌ *Motivo:* ${approvalDecision.reason}

`;
      
      // Mensajes específicos según el problema
      if (!validations.amount.valid) {
        rejectionMessage += `📋 *Tu membresía:* ${pendingLead.membership_type}
💵 *Monto correcto:* $${expectedAmount} USD
💳 *Monto detectado:* $${paymentData.amount} USD
❌ *Diferencia:* $${validations.amount.difference.toFixed(2)}

Por favor:
• Verifica que pagaste $${expectedAmount}
• Si pagaste menos, completa la diferencia
• Envía el comprobante correcto`;
      } else if (validations.duplicate.isDuplicate) {
        rejectionMessage += `Este comprobante ya fue procesado anteriormente.

Si necesitas ayuda, contáctanos:
📞 +593 99 483 7117`;
      } else if (validations.account.valid === false) {
        rejectionMessage += `La cuenta destino no coincide con Coworkia.

🏦 *Cuenta correcta:*
• Banco: Produbanco
• Cuenta: ${CUENTA_COWORKIA}
• Titular: Gonzalo Villota Izurieta

Por favor realiza el pago a esta cuenta y envía el nuevo comprobante.`;
      }
      
      return {
        success: false,
        rejected: true,
        message: rejectionMessage
      };
    }
    
    // 🟡 CASO 3: REVISIÓN MANUAL
    return {
      success: true,
      manualReview: true,
      message: `📊 *COMPROBANTE RECIBIDO*

💰 Monto: $${paymentData.amount} USD
📅 Fecha: ${paymentData.transactionDate}
💳 Método: ${paymentData.paymentMethod}
${paymentData.authorizationNumber ? `🔢 Autorización: ${paymentData.authorizationNumber}` : ''}

⏳ *En revisión...*

Tu comprobante requiere verificación manual. Nuestro equipo lo revisará y te confirmará en los próximos minutos.

Recibirás notificación tan pronto esté aprobado 😊`
    };
    
  } catch (error) {
    console.error('[MEMBERSHIP-PAYMENT] 🚨 ERROR:', error);
    return {
      success: false,
      message: `⚠️ Error procesando tu comprobante.

Por favor contacta a nuestro equipo:
📞 +593 99 483 7117
📧 secretaria.coworkia@gmail.com

Te ayudaremos a verificar tu pago manualmente 😊`
    };
  }
}

/**
 * 🔍 Busca lead pendiente por teléfono
 */
export async function findPendingMembershipLead(userId) {
  try {
    const lead = await db.get(
      `SELECT * FROM membership_leads 
       WHERE user_phone = $1 
       AND status = 'pending_payment'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );
    
    return lead || null;
  } catch (error) {
    console.error('[MEMBERSHIP-PAYMENT] Error finding lead:', error);
    return null;
  }
}

export { approveLead };

export default {
  processMembershipPayment,
  findPendingMembershipLead,
  approveLead
};
