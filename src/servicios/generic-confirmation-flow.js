/**
 * 🔄 Sistema Universal de Confirmación SI/NO
 * 
 * Basado en confirmation-flow.js de Aurora, adaptado para funcionar
 * con cualquier agente del ecosistema.
 * 
 * Flujo:
 * 1. Usuario completa formulario
 * 2. Sistema genera mensaje de confirmación
 * 3. Usuario responde SI/NO
 * 4. SI → Guardar en DB + Email + Calendar
 * 5. NO → Cancelar y limpiar
 */

import { clearPendingConfirmation, getPendingConfirmation, setPendingConfirmation } from './reservation-state.js';
import { sendConfirmationEmail, createConfirmationCalendarEvent } from './notification-helper.js';
import databaseService from '../database/database.js';

/**
 * ✅ Detecta respuestas afirmativas (igual que Aurora)
 */
export function isPositiveResponse(message) {
  if (!message || typeof message !== 'string') return false;
  
  const text = message.toLowerCase().trim();
  
  const positivePatterns = [
    /^s[ií]$/,
    /^s[ií][,.\s]/,
    /^ok$/,
    /^okay$/,
    /^perfecto$/,
    /^correcto$/,
    /^confirmo$/,
    /^confirmado$/,
    /^acepto$/,
    /^aceptado$/,
    /^dale$/,
    /^listo$/,
    /^exacto$/,
    /^claro$/,
    /^por supuesto$/,
    /^obvio$/,
    /^s[ií]\s*(por favor|porfavor|please)?$/,
    /^(s[ií]\s*)?gracias$/,
    /^vamos$/,
    /^hagamos$/,
    /^adelante$/,
    /^continuar$/,
    /^continu[aá]mos$/,
    /^proceder$/,
    /^obvio que s[ií]$/,
    /👍/,
    /✅/,
    /👌/,
    /💯/,
    /🚀/
  ];
  
  return positivePatterns.some(pattern => pattern.test(text));
}

/**
 * ❌ Detecta respuestas negativas
 */
export function isNegativeResponse(message) {
  if (!message || typeof message !== 'string') return false;
  
  const text = message.toLowerCase().trim();
  
  const negativePatterns = [
    /^no$/,
    /^no[,.\s]/,
    /^nop$/,
    /^nope$/,
    /^nel$/,
    /^negative$/,
    /^negativo$/,
    /^cancel$/,
    /^cancelar$/,
    /^cancela$/,
    /^cancelo$/,
    /^rechazo$/,
    /^rechazar$/,
    /^no acepto$/,
    /^no confirmo$/,
    /^no quiero$/,
    /^mejor no$/,
    /^ahora no$/,
    /^otro d[ií]a$/,
    /^lo pienso$/,
    /^d[eé]jame pensar$/,
    /^mejor otro momento$/,
    /^no por ahora$/,
    /^paso$/,
    /olv[ií]dalo/,
    /olvidalo/,
    /ya no quiero/,
    /no me interesa/,
    /abandonar/,
    /eliminar/,
    /borrar/,
    /^no gracias$/,
    /^no, gracias$/,
    /^gracias pero no$/,
    /^ya no$/,
    // Correcciones — usuario indica que los datos están mal
    /^no,?\s*est[aá]\s*(mal|incorrecto|equivocado)/,
    /^no,?\s*eso/,
    /^no,?\s*los datos/,
    /^no,?\s*el horario/,
    /^no,?\s*la hora/,
    /^no,?\s*la fecha/,
    /^no,?\s*el espacio/,
    /est[aá]\s*(mal|incorrecto)/,
    /datos.*incorrectos/,
    /horario.*incorrecto/,
    /^no\s*est[aá]/,
    // Emojis de negación
    /❌/,
    /👎/,
    /🚫/,
    /😕/,
    /😐/
  ];
  
  return negativePatterns.some(pattern => pattern.test(text));
}

/**
 * 💡 Genera mensaje de confirmación según el agente
 */
export function generateGenericConfirmationMessage(agentName, formData, userName = '') {
  const userGreeting = userName ? `, ${userName}` : '';
  
  switch (agentName) {
    case 'ADRIANA':
      return `Perfecto${userGreeting}! 🛡️

📋 *CONFIRMA TUS DATOS:*

🛡️ *Tipo de seguro:* ${formData.insuranceType}
👤 *Nombre:* ${formData.fullName}
🆔 *Cédula:* ${formData.cedula}
📧 *Email:* ${formData.email}
📱 *Teléfono:* ${formData.phone}
${formData.vehicleBrand ? `🚗 *Vehículo:* ${formData.vehicleBrand} ${formData.vehicleModel || ''}` : ''}

¿*Confirmas estos datos?*

Responde *SI* para que te enviemos la cotización o *NO* para cancelar.`;

    case 'AXEL':
      return `Perfecto${userGreeting}! 🔨

📋 *CONFIRMA TUS DATOS:*

🔨 *Daño:* ${formData.damageType}
🚗 *Vehículo:* ${formData.vehicleBrand} ${formData.vehicleModel} ${formData.vehicleYear}
👤 *Nombre:* ${formData.fullName}
📧 *Email:* ${formData.email}
📱 *Teléfono:* ${formData.phone}
${formData.damageDescription ? `📝 *Descripción:* ${formData.damageDescription}` : ''}

¿*Confirmas estos datos?*

Responde *SI* para recibir tu cotización o *NO* para cancelar.`;

    case 'ENZO':
      return `Perfecto${userGreeting}! 🎯

📋 *CONFIRMA TU PROYECTO:*

🎯 *Tipo:* ${formData.projectType}
🏢 *Empresa:* ${formData.companyName}
👤 *Contacto:* ${formData.fullName}
📧 *Email:* ${formData.email}
📱 *Teléfono:* ${formData.phone}
💰 *Presupuesto:* ${formData.budget}
⏰ *Urgencia:* ${formData.urgency}

¿*Confirmas estos datos?*

Responde *SI* para agendar reunión o *NO* para cancelar.`;


    case 'ALUNA':
      return `Perfecto${userGreeting}! 🎫

📋 *CONFIRMA TU MEMBRESÍA:*

🎫 *Tipo:* ${formData.membershipType}
📅 *Inicio:* ${formData.startDate}
👤 *Nombre:* ${formData.fullName}
📧 *Email:* ${formData.email}
📱 *Teléfono:* ${formData.phone}
${formData.companyName ? `🏢 *Empresa:* ${formData.companyName}` : ''}

¿*Confirmas estos datos?*

Responde *SI* para agendar visita o *NO* para cancelar.`;

    case 'GABI':
      return `Perfecto${userGreeting}! ⚖️

📋 *CONFIRMA TU CONSULTORÍA:*

⚖️ *Tipo:* ${formData.consultationType}
${formData.companyName ? `🏢 *Empresa:* ${formData.companyName}` : ''}
${formData.ruc && formData.ruc !== 'No tiene' ? `🆔 *RUC:* ${formData.ruc}` : ''}
👤 *Nombre:* ${formData.fullName}
📧 *Email:* ${formData.email || formData.phone}
📱 *Teléfono:* ${formData.phone}
📝 *Consulta:* ${formData.description}
⏰ *Urgencia:* ${formData.urgency}

¿*Confirmas estos datos?*

Responde *SI* para agendar consulta GRATUITA o *NO* para cancelar.

💡 *Primera consultoría: 30 min GRATIS*`;

    default:
      return `¿Confirmas estos datos?\n\nResponde *SI* para continuar o *NO* para cancelar.`;
  }
}

/**
 * 🎯 Procesa confirmación positiva (SI)
 * 
 * 1. Guarda en DB (tabla específica del agente)
 * 2. Envía email al agente humano
 * 3. Envía email al cliente
 * 4. Crea evento en Google Calendar
 */
export async function processGenericPositiveConfirmation(userId, agentName, formData, userProfile) {
  try {
    console.log(`[Generic-Confirmation] 🚀 Procesando SI para ${agentName}`);
    console.log(`[Generic-Confirmation] 📊 Datos:`, formData);
    
    const userName = userProfile?.name || formData.fullName || 'Cliente';
    const userEmail = userProfile?.email || formData.email;
    
    // 1. Guardar en tabla específica del agente
    const leadId = await saveLeadToDatabase(agentName, userId, formData);
    
    if (!leadId) {
      throw new Error(`No se pudo guardar el lead de ${agentName}`);
    }
    
    console.log(`[Generic-Confirmation] ✅ Lead guardado con ID:`, leadId);
    
    // 2. Preparar datos para notificaciones
    const notificationData = {
      agentName,
      leadId,
      userName,
      userEmail,
      formData,
      userLanguage: userProfile?.preferredLanguage || 'es' // 🌍 email en el idioma del cliente
    };
    
    // 3. Enviar notificaciones (email + calendar) en paralelo
    const [emailResult, calendarResult] = await Promise.allSettled([
      sendGenericEmailNotification(notificationData),
      createGenericCalendarEvent(notificationData)
    ]);
    
    // 4. Procesar resultados
    const emailSuccess = emailResult.status === 'fulfilled' && emailResult.value?.success;
    const calendarSuccess = calendarResult.status === 'fulfilled' && calendarResult.value?.success;
    
    console.log(`[Generic-Confirmation] 📊 Resultados:`, {
      email: emailSuccess ? 'OK' : 'FAILED',
      calendar: calendarSuccess ? 'OK' : 'FAILED'
    });
    
    // 5. Limpiar pending data
    await clearPendingConfirmation(userId);
    
    // 6. Generar mensaje de éxito
    const successMessage = generateSuccessMessage(agentName, formData, emailSuccess, calendarSuccess);
    
    return {
      success: true,
      leadId,
      message: successMessage,
      notifications: {
        email: emailSuccess,
        calendar: calendarSuccess
      }
    };
    
  } catch (error) {
    console.error(`[Generic-Confirmation] ❌ Error procesando confirmación:`, error);
    return {
      success: false,
      error: error.message,
      message: `❌ Hubo un error procesando tu solicitud. Por favor intenta de nuevo.`
    };
  }
}

/**
 * 💾 Guarda lead en la tabla correspondiente del agente
 */
async function saveLeadToDatabase(agentName, userId, formData) {
  databaseService.ensureInitialized();
  
  const leadId = `${agentName.toLowerCase()}_${Date.now()}_${userId.replace(/\+/g, '')}`;
  const now = new Date().toISOString();
  
  let query, params;
  
  switch (agentName) {
    case 'ADRIANA':
      query = `
        INSERT INTO insurance_leads (
          id, user_phone, insurance_type, client_name, cedula, email, phone,
          specific_data, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `;
      params = [
        leadId,
        userId,
        formData.insuranceType,
        formData.fullName,
        formData.cedula,
        formData.email,
        formData.phone,
        JSON.stringify({
          vehicleBrand: formData.vehicleBrand,
          vehicleModel: formData.vehicleModel,
          age: formData.age,
          healthConditions: formData.healthConditions
        }),
        now
      ];
      break;
      
    case 'AXEL':
      query = `
        INSERT INTO collision_quotes (
          id, user_phone, damage_type, client_name, vehicle_brand, vehicle_model,
          vehicle_year, email, phone, damage_description, photo_urls, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `;
      params = [
        leadId,
        userId,
        formData.damageType,
        formData.fullName,
        formData.vehicleBrand,
        formData.vehicleModel,
        formData.vehicleYear,
        formData.email,
        formData.phone,
        formData.damageDescription || '',
        JSON.stringify(formData.photoUrls || []),
        now
      ];
      break;
      
    case 'ENZO':
      query = `
        INSERT INTO marketing_leads (
          id, user_phone, project_type, company, client_name, email, phone,
          budget_range, urgency, description, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `;
      params = [
        leadId,
        userId,
        formData.projectType,
        formData.companyName,
        formData.fullName,
        formData.email,
        formData.phone,
        formData.budget,
        formData.urgency,
        formData.description || '',
        now
      ];
      break;
      
    case 'ALUNA':
      query = `
        INSERT INTO membership_leads (
          id, user_phone, membership_type, start_date, client_name, email, phone,
          special_requirements, company_name, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `;
      params = [
        leadId,
        userId,
        formData.membershipType,
        formData.startDate,
        formData.fullName,
        formData.email,
        formData.phone,
        formData.specialRequirements || '',
        formData.companyName || '',
        now
      ];
      break;
      
    default:
      throw new Error(`Agente ${agentName} no soportado`);
  }
  
  await databaseService.run(query, params);
  console.log(`[Generic-Confirmation] 💾 Lead guardado en DB: ${leadId}`);
  
  return leadId;
}

/**
 * 📧 Envía email al agente humano y al cliente
 */
async function sendGenericEmailNotification(data) {
  const { agentName, userName, userEmail, formData, userLanguage = 'es' } = data;
  
  // Email al cliente confirmando recepción (en su idioma; las plantillas ya tienen es/en/fr/it/pt)
  const subjects = {
    es: 'Confirmación de solicitud',
    en: 'Request confirmation',
    fr: 'Confirmation de demande',
    it: 'Conferma della richiesta',
    pt: 'Confirmação de solicitação',
  };
  const clientEmailData = {
    email: userEmail,
    userName,
    subject: `${subjects[userLanguage] || subjects.es} - ${agentName}`,
    agentName,
    formData,
    userLanguage
  };
  
  return await sendConfirmationEmail(clientEmailData);
}

/**
 * 📅 Crea evento en Google Calendar para seguimiento
 */
async function createGenericCalendarEvent(data) {
  const { agentName, userName, userEmail, formData, leadId } = data;
  
  // Calcular fecha/hora para el evento (24h después para seguimiento)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0); // 10am del día siguiente
  
  const dateStr = tomorrow.toISOString().split('T')[0];
  const startTime = '10:00';
  const endTime = '10:30';
  
  const calendarData = {
    userName,
    email: userEmail,
    date: dateStr,
    startTime,
    endTime,
    serviceType: `${agentName} - Seguimiento`,
    duration: '30 minutos',
    price: 0,
    reservationId: leadId
  };
  
  return await createConfirmationCalendarEvent(calendarData);
}

/**
 * ✨ Genera mensaje de éxito según el agente
 */
function generateSuccessMessage(agentName, formData, emailSuccess, calendarSuccess) {
  const userName = formData.fullName.split(' ')[0]; // Solo primer nombre
  
  const baseMessages = {
    ADRIANA: `✅ ¡Listo ${userName}!

Tu solicitud de seguro de *${formData.insuranceType}* fue recibida.

📧 Te enviaremos la cotización a ${formData.email} en las próximas 24 horas.

Adriana de SegPopular te contactará pronto. 🛡️`,

    AXEL: `✅ ¡Perfecto ${userName}!

Tu solicitud de cotización para *${formData.damageType}* en tu ${formData.vehicleBrand} fue recibida.

📧 Te enviaremos la cotización a ${formData.email} dentro de 24 horas.

Axel de PaintBull te contactará para coordinar la inspección. 🔨`,

    ENZO: `✅ ¡Excelente ${userName}!

Tu proyecto de *${formData.projectType}* fue registrado.

📅 Te contactaremos a ${formData.email} para agendar una reunión y revisar tu proyecto.

Enzo de MarketingLab te contactará pronto. 🎯`,

    PAULA: `✅ ¡Perfecto ${userName}!

Tu búsqueda de *${formData.propertyType}* en ${formData.zone} fue registrada.

🏘️ Te enviaremos opciones a ${formData.email} dentro de 24 horas.

Paula de PropElite te contactará para coordinar visitas. 🏠`,

    ALUNA: `✅ ¡Listo ${userName}!

Tu interés en *${formData.membershipType}* fue registrado.

📅 Te contactaremos a ${formData.email} para agendar un tour de las instalaciones.

El equipo de Coworkia te contactará pronto. 🎫`,

    GABI: `✅ ¡Consulta registrada ${userName}!

Tu consultoría de *${formData.consultationType}* fue agendada.

📧 Te enviamos los detalles a ${formData.email || formData.phone}
📅 Reunión inicial en 48h (GRATUITA - 30 min)

El equipo de GR Consulting te contactará pronto. ⚖️`
  };
  
  let message = baseMessages[agentName] || '✅ Tu solicitud fue recibida correctamente.';
  
  // Agregar nota si alguna notificación falló
  if (!emailSuccess || !calendarSuccess) {
    message += `\n\n⚠️ Nota: Algunos sistemas de notificación tardaron más de lo esperado, pero tu solicitud está registrada.`;
  }
  
  return message;
}

/**
 * ❌ Procesa confirmación negativa (NO)
 */
export async function processGenericNegativeConfirmation(userId, agentName) {
  try {
    console.log(`[Generic-Confirmation] ❌ Procesando NO para ${agentName}`);
    
    // Limpiar pending data
    await clearPendingConfirmation(userId);
    
    const messages = {
      ADRIANA: 'Entendido. Si cambias de opinión, solo escribe @adriana cuando quieras. 🛡️',
      AXEL: 'Ok, sin problema. Cuando necesites una cotización, escribe @axel. 🔨',
      ENZO: 'Perfecto. Cuando estés listo para tu proyecto, escribe @enzo. 🎯',
      PAULA: 'Entendido. Cuando quieras buscar propiedades, escribe @paula. 🏘️',
      ALUNA: 'Ok. Cuando quieras conocer más sobre membresías, escribe @aluna. 🎫',
      GABI: 'Entendido. Cuando necesites consultoría legal/contable, escribe @gabi. ⚖️'
    };
    
    return {
      success: true,
      cancelled: true,
      message: messages[agentName] || 'Solicitud cancelada.'
    };
    
  } catch (error) {
    console.error(`[Generic-Confirmation] ❌ Error cancelando:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 🔄 Procesa respuesta de confirmación (punto de entrada principal)
 */
export async function processGenericConfirmationResponse(userId, message, agentName, userProfile) {
  try {
    // Verificar si hay pending confirmation
    const pending = await getPendingConfirmation(userId);
    
    if (!pending || pending._type !== 'generic_form' || pending._agentName !== agentName) {
      return {
        success: false,
        message: 'No tienes ninguna solicitud pendiente de confirmación.'
      };
    }
    
    const formData = pending._formData?.data;
    
    if (!formData) {
      return {
        success: false,
        message: 'No se encontraron datos para confirmar.'
      };
    }
    
    // Detectar SI o NO
    if (isPositiveResponse(message)) {
      return await processGenericPositiveConfirmation(userId, agentName, formData, userProfile);
    } else if (isNegativeResponse(message)) {
      return await processGenericNegativeConfirmation(userId, agentName);
    } else {
      // No es SI ni NO
      return {
        success: false,
        needsClarification: true,
        message: 'No entendí tu respuesta. Por favor responde *SI* para confirmar o *NO* para cancelar.'
      };
    }
    
  } catch (error) {
    console.error(`[Generic-Confirmation] ❌ Error:`, error);
    return {
      success: false,
      error: error.message,
      message: 'Hubo un error procesando tu respuesta. Por favor intenta de nuevo.'
    };
  }
}

export default {
  isPositiveResponse,
  isNegativeResponse,
  generateGenericConfirmationMessage,
  processGenericPositiveConfirmation,
  processGenericNegativeConfirmation,
  processGenericConfirmationResponse
};
