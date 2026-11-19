/**
 * 💼 ALUNA - Coworkia Membership Confirmation Handler
 * 
 * Maneja la confirmación SI del usuario y completa el proceso de venta:
 * 1. Guarda el lead en la base de datos (membership_leads)
 * 2. Envía email a admin de Coworkia con datos del prospecto
 * 3. Agenda tour del espacio en Google Calendar
 * 4. Envía email al cliente confirmando visita
 * 5. Retorna mensaje de éxito con link de pago y próximos pasos
 */

import { getPendingConfirmation, clearPendingConfirmation } from './reservation-state.js';
import databaseService from '../database/database.js';
import { saveMembershipLead } from '../database/alunaRepository.js';
import { generateEmailForAgent } from './generic-email-templates.js';
import { PLAN_DATA, normalizePlanKey } from './aluna-proforma-email.js';
import { sendEmail, AGENT_FROM_NAMES, DEFAULT_FROM_EMAIL } from './email.js';
import { createCalendarEvent } from './google-calendar.js';
import { generateSequentialCode } from '../utils/code-generator.js';

/**
 *  Obtiene precio y beneficios por tipo de membresía
 */
function getMembershipDetails(membershipType) {
  const plans = {
    'plan10': {
      name: 'Plan 10',
      price: '$67 USD/mes',
      days: '10+1 días gratis = 11 días completos',
      hours: 'Día completo por visita',
      benefits: [
        'Locker O cajonera privada',
        '2 invitados gratis/mes',
        '2 usos sala reuniones/mes',
        'WiFi + café incluido',
        'Secretaria Virtual IA (9+ meses)'
      ]
    },
    'plan20': {
      name: 'Plan 20',
      price: '$99 USD/mes',
      days: '20+2 días gratis = 22 días completos',
      hours: 'Día completo por visita',
      benefits: [
        'Locker O cajonera privada',
        '4 invitados gratis/mes',
        '4 usos sala reuniones/mes',
        'WiFi + café incluido',
        'Secretaria Virtual IA (9+ meses)'
      ]
    },
    'oficinavirtual': {
      name: 'Oficina Virtual',
      price: '$365 USD/año',
      days: 'Solo dirección comercial',
      hours: 'Sala reuniones incluida (una vez por mes por 2 horas)',
      benefits: [
        'Dirección comercial oficial',
        'Recepción y notificación de correspondencia',
        'Cumplimiento legal con SRI',
        'Ideal para empresas remotas',
        'Sala reuniones incluida sin adicional (una vez por mes por 2 horas)'
      ]
    },
    'salareuniones': {
      name: 'Sala de Reuniones',
      price: '$39 USD/sesión',
      days: 'Reserva por sesión',
      hours: '2 horas - capacidad 3-4 personas',
      benefits: [
        'WiFi de alta velocidad',
        'Pantalla para presentaciones',
        'Espacio profesional',
        'Reserva previa necesaria'
      ]
    }
  };

  const normalizedType = membershipType.toLowerCase().replace(/[\s-]/g, '');
  return plans[normalizedType] || plans['plan10'];
}

/**
 * ✅ Procesa confirmación SI de Aluna
 */
export async function confirmMembershipLead(userId, userProfile) {
  console.log('[MEMBERSHIP-CONFIRM] 💼 Procesando confirmación de membresía...');

  // Obtener datos pendientes
  const pendingData = await getPendingConfirmation(userId);
  
  if (!pendingData || pendingData.agentName !== 'ALUNA') {
    console.log('[MEMBERSHIP-CONFIRM] ⚠️ No hay datos pendientes de ALUNA');
    return {
      success: false,
      message: 'No encontré datos pendientes de membresía. Por favor inicia el proceso nuevamente con @aluna.'
    };
  }

  const formData = pendingData.formData;

  try {
    // ==========================================
    // 1️⃣ GUARDAR EN BASE DE DATOS usando alunaRepository
    // ==========================================
    
    const membershipCode = await generateSequentialCode('ALU', 'membership_leads', 'membership_code', 4);
    const membershipDetails = getMembershipDetails(formData.membershipType);
    
    const leadData = {
      id: `MB-${Date.now()}_${userId.replace(/\+/g, '')}`,
      membershipCode: membershipCode,
      userId: userId,
      membershipType: membershipDetails.name,
      startDate: formData.startDate || null,
      clientName: formData.fullName,
      email: formData.email || null,
      phone: formData.phone,
      companyName: null,
      specialRequirements: formData.specialRequirements || null,
      monthlyFee: membershipDetails.price
    };
    
    const { id: leadId } = await saveMembershipLead(leadData);
    console.log(`[MEMBERSHIP-CONFIRM] ✅ Lead guardado: ${leadId}`);

    // ==========================================
    // 2️⃣ ENVIAR EMAIL A ADMIN COWORKIA
    // ==========================================
    
    const adminEmail = process.env.COWORKIA_ADMIN_EMAIL || 'admin@coworkia.com';
    
    const emailToAdmin = await generateEmailForAgent('ALUNA', 'admin', {
      leadId,
      membershipType: membershipDetails.name,
      price: membershipDetails.price,
      clientName: formData.fullName,
      email: formData.email || 'No proporcionado',
      phone: formData.phone,
      startDate: formData.startDate || 'Flexible',
      specialRequirements: formData.specialRequirements || 'Ninguno',
      whatsappLink: `https://wa.me/${userId.replace('+', '')}`,
      userLanguage: userProfile?.preferredLanguage || 'es'
    });

    await sendEmail(adminEmail, emailToAdmin.subject, emailToAdmin.html);
    console.log('[MEMBERSHIP-CONFIRM] 📧 Email enviado a admin');

    // ==========================================
    // 3️⃣ AGENDAR TOUR EN GOOGLE CALENDAR
    // ==========================================
    
    let calendarEventLink = null;
    
    try {
      // Calcular fecha del tour (mañana a las 10am o fecha preferida)
      const tourDate = formData.startDate 
        ? new Date(formData.startDate)
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // Mañana
      
      tourDate.setHours(10, 0, 0, 0); // 10:00 AM

      const calendarEvent = await createCalendarEvent({
        summary: `Tour Coworkia - ${formData.fullName} (${membershipDetails.name})`,
        description: `Tour del espacio con prospecto de ${membershipDetails.name}\n\nCliente: ${formData.fullName}\nTeléfono: ${formData.phone}\nEmail: ${formData.email || 'No proporcionado'}\n\nLead ID: ${leadId}\nWhatsApp: https://wa.me/${userId.replace('+', '')}`,
        start: tourDate.toISOString(),
        durationMinutes: 60,
        attendees: formData.email ? [formData.email] : []
      });

      calendarEventLink = calendarEvent?.link || null;
      console.log('[MEMBERSHIP-CONFIRM] 📅 Tour agendado en calendario');
    } catch (calError) {
      console.error('[MEMBERSHIP-CONFIRM] ⚠️ Error al agendar tour:', calError.message);
      // Continuar sin calendario
    }

    // ==========================================
    // 4️⃣ ENVIAR EMAIL AL CLIENTE
    // ==========================================
    
    if (formData.email) {
      // ✅ Email de confirmación: invita al cliente a reservar su primera visita gratuita
      const emailToClient = generateEmailForAgent('ALUNA', 'client', {
        userName: formData.fullName,
        membershipType: formData.membershipType,
        startDate: formData.startDate || null,
        email: formData.email,
        phone: formData.phone,
        companyName: null,
        leadId: membershipCode,
        userLanguage: userProfile?.preferredLanguage || 'es'
      });

      await sendEmail({
        to: formData.email,
        cc: 'coworkia.ec@gmail.com',
        subject: `✅ Tu membresía Coworkia está lista — reserva tu visita gratuita`,
        html: emailToClient.html,
        from: { name: AGENT_FROM_NAMES.aluna, address: DEFAULT_FROM_EMAIL }
      });
      console.log('[MEMBERSHIP-CONFIRM] 📧 Email confirmación + visita gratuita enviado al cliente');
    }

    // ==========================================
    // 5️⃣ LIMPIAR DATOS PENDIENTES
    // ==========================================
    
    await clearPendingConfirmation(userId);

    // ==========================================
    // 6️⃣ GENERAR RESPUESTA DE ÉXITO
    // ==========================================
    
    const nextStep = formData.startDate 
      ? `visitarnos el ${new Date(formData.startDate).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}`
      : 'coordinar tu visita';

    return {
      success: true,
      message: `¡Excelente ${formData.fullName}! 🎉

Tu solicitud de **${membershipDetails.name}** ha sido confirmada.

📋 **Resumen:**
• Plan: ${membershipDetails.name}
• Precio: ${membershipDetails.price}
• Días: ${membershipDetails.days}
• Horario: ${membershipDetails.hours}

✨ **Beneficios incluidos:**
${membershipDetails.benefits.map(b => `• ${b}`).join('\n')}

📞 **Próximos pasos:**
1. Te contacto en las próximas 4-8 horas para ${nextStep}
2. Haremos un tour del espacio (30-45 min)
3. Responderé todas tus preguntas en persona
4. Si todo está bien, procesamos el pago y ¡empiezas!

💳 **Link de pago:** https://pay.payphoneapp.com/coworkia
🏦 **Transferencia:** Produbanco · Cta Ahorros 20059783069 · Coworkia

💡 **Recuerda:** 
• Garantía devolución dinero primeros 15 días
• Tu precio se congela mientras seas miembro
• Sin compromiso de permanencia (cancelas cuando quieras)

🏢 **Ubicación:** Coworkia Business Center, [dirección exacta en el tour]

¿Hay algo más que quieras saber antes del tour?`
    };

  } catch (error) {
    console.error('[MEMBERSHIP-CONFIRM] ❌ Error:', error);
    return {
      success: false,
      message: `Hubo un error al procesar tu solicitud: ${error.message}. Por favor intenta de nuevo o contáctanos directamente.`
    };
  }
}

export default {
  confirmMembershipLead
};
