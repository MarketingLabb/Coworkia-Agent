// 🔍 Sistema de Consulta y Reenvío de Recibos - Aurora
// Aurora puede consultar recibos existentes y reenviarlos por email

import { receiptCopy } from '../utils/receipt-messages.js';
import db from '../database/postgres-adapter.js';
import { sendPaymentReceipt } from './payment-receipt-email.js';

/**
 * 🔎 Busca los últimos recibos de pago de un usuario
 * @param {String} userPhone - Teléfono del usuario (formato: +593999999999)
 * @param {Number} limit - Cantidad máxima de recibos a devolver
 * @returns {Array} Lista de recibos encontrados
 */
export async function getUserReceipts(userPhone, limit = 5) {
  console.log('[RECEIPT-LOOKUP] 🔍 Buscando recibos para:', userPhone);
  
  try {
    // Buscar en membership_payments
    const membershipResult = await db.query(
      `SELECT 
        mp.id as payment_id,
        mp.receipt_number,
        mp.amount,
        mp.transaction_date,
        mp.transaction_number,
        mp.payment_method,
        mp.bank_sender,
        mp.created_at,
        ml.full_name,
        ml.email,
        ml.membership_type,
        ml.total_amount as membership_total,
        ml.canje_amount,
        ml.canje_description,
        'membership' as payment_type
      FROM membership_payments mp
      JOIN membership_leads ml ON mp.membership_lead_id = ml.id
      WHERE mp.user_phone = $1
        AND mp.status = 'verified'
        AND mp.receipt_number IS NOT NULL
      ORDER BY mp.created_at DESC
      LIMIT $2`,
      [userPhone, limit]
    );

    // Buscar en reservation_payments (Hot Desk / Salas de reuniones)
    const reservationResult = await db.query(
      `SELECT 
        rp.id as payment_id,
        rp.receipt_number,
        rp.amount,
        rp.transaction_date,
        rp.transaction_number,
        rp.payment_method,
        rp.bank_sender,
        rp.created_at,
        r.user_name as full_name,
        u.email,
        r.reservation_type as membership_type,
        rp.amount as membership_total,
        0 as canje_amount,
        '' as canje_description,
        'reservation' as payment_type
      FROM reservation_payments rp
      JOIN reservations r ON rp.reservation_id = r.id
      JOIN users u ON rp.user_phone = u.phone_number
      WHERE rp.user_phone = $1
        AND rp.status = 'verified'
        AND rp.receipt_number IS NOT NULL
      ORDER BY rp.created_at DESC
      LIMIT $2`,
      [userPhone, limit]
    );

    // Combinar y ordenar por fecha
    const allReceipts = [
      ...membershipResult.rows,
      ...reservationResult.rows
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
     .slice(0, limit);

    console.log(`[RECEIPT-LOOKUP] ✅ Encontrados ${allReceipts.length} recibos`);
    return allReceipts;

  } catch (error) {
    console.error('[RECEIPT-LOOKUP] ❌ Error buscando recibos:', error);
    return [];
  }
}

/**
 * 📧 Reenvía un recibo existente por email
 * @param {String} receiptNumber - Número de recibo a reenviar
 * @param {String} userPhone - Teléfono del usuario (para validar propiedad)
 * @returns {Object} Resultado del reenvío
 */
export async function resendReceipt(receiptNumber, userPhone) {
  console.log('[RECEIPT-LOOKUP] 📧 Reenviando recibo:', receiptNumber);
  
  try {
    // Buscar el recibo en membership_payments
    const membershipResult = await db.query(
      `SELECT 
        mp.receipt_number,
        mp.amount as payment_amount,
        mp.transaction_date,
        mp.transaction_number,
        mp.bank_sender,
        ml.full_name,
        ml.email,
        ml.membership_type,
        ml.total_amount,
        ml.canje_amount,
        ml.canje_description,
        ml.diego_authorized
      FROM membership_payments mp
      JOIN membership_leads ml ON mp.membership_lead_id = ml.id
      WHERE mp.receipt_number = $1
        AND mp.user_phone = $2
        AND mp.status = 'verified'`,
      [receiptNumber, userPhone]
    );

    // Si no está en membresías, buscar en reservas
    if (membershipResult.rows.length === 0) {
      const reservationResult = await db.query(
        `SELECT 
          rp.receipt_number,
          rp.amount as payment_amount,
          rp.transaction_date,
          rp.transaction_number,
          rp.bank_sender,
          r.user_name as full_name,
          u.email,
          r.reservation_type as membership_type,
          rp.amount as total_amount,
          0 as canje_amount,
          '' as canje_description,
          false as diego_authorized
        FROM reservation_payments rp
        JOIN reservations r ON rp.reservation_id = r.id
        JOIN users u ON rp.user_phone = u.phone_number
        WHERE rp.receipt_number = $1
          AND rp.user_phone = $2
          AND rp.status = 'verified'`,
        [receiptNumber, userPhone]
      );

      if (reservationResult.rows.length === 0) {
        console.log('[RECEIPT-LOOKUP] ⚠️ Recibo no encontrado o no pertenece al usuario');
        return { 
          success: false, 
          error: 'Recibo no encontrado',
          notFound: true
        };
      }

      // Reenviar recibo de reserva
      const receipt = reservationResult.rows[0];
      return await sendExistingReceipt(receipt);
    }

    // Reenviar recibo de membresía
    const receipt = membershipResult.rows[0];
    return await sendExistingReceipt(receipt);

  } catch (error) {
    console.error('[RECEIPT-LOOKUP] ❌ Error reenviando recibo:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * 📤 Envía un recibo existente usando los datos de BD
 */
async function sendExistingReceipt(receiptData) {
  const paymentData = {
    receiptNumber: receiptData.receipt_number,
    memberName: receiptData.full_name,
    memberEmail: receiptData.email,
    membershipType: receiptData.membership_type,
    totalAmount: parseFloat(receiptData.total_amount || receiptData.payment_amount || 0),
    cashAmount: receiptData.canje_amount > 0 
      ? parseFloat(receiptData.payment_amount || 0)
      : parseFloat(receiptData.total_amount || receiptData.payment_amount || 0),
    canjeAmount: parseFloat(receiptData.canje_amount || 0),
    canjeDescription: receiptData.canje_description || '',
    paymentDate: receiptData.transaction_date,
    bankName: receiptData.bank_sender || 'Banco',
    transactionReference: receiptData.transaction_number || '',
    diegoAuthorized: receiptData.diego_authorized || false
  };

  console.log('[RECEIPT-LOOKUP] 📧 Reenviando recibo a:', paymentData.memberEmail);
  const result = await sendPaymentReceipt(paymentData);
  
  if (result.success) {
    console.log('[RECEIPT-LOOKUP] ✅ Recibo reenviado exitosamente');
  }
  
  return result;
}

/**
 * 📋 Formatea lista de recibos para mostrar a usuario
 * @param {Array} receipts - Lista de recibos
 * @param {String} language - Idioma del usuario
 * @returns {String} Texto formateado con la lista
 */
export function formatReceiptsList(receipts, language = 'es') {
  const t = receiptCopy(language);
  if (!receipts || receipts.length === 0) {
    return t.emptyList;
  }

  const receiptsList = receipts.map((receipt, index) => {
    const date = new Date(receipt.transaction_date).toLocaleDateString(t.locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const typeEmoji = receipt.payment_type === 'membership' ? '🏢' : '🪑';
    const type = receipt.membership_type || t.serviceFallback;

    return `${index + 1}. ${typeEmoji} *${type}*
   💵 $${parseFloat(receipt.amount).toFixed(2)} USD
   📅 ${date}
   🧾 \`${receipt.receipt_number}\``;
  }).join('\n\n');

  return t.header + receiptsList + t.footer;
}
