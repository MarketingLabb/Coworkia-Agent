/**
 * 🎯 Prompts Prediseñados para Campañas Publicitarias
 * Mensajes específicos para Instagram/Facebook y otras campañas
 * 🌍 MULTIIDIOMA: Respeta preferredLanguage del usuario
 */

// 🚀 CAMPAÑA PRINCIPAL: 2 HORAS GRATIS
export const CAMPAIGN_PROMPTS = {
  
  // Mensaje 1: ¡Hola Coworkia! quiero probar el servicio ☕️
  PROBAR_SERVICIO: {
    trigger: "quiero probar|want to try|essayer|probar.*servicio|probar.*espacio|probar.*coworkia|try.*service|try.*space|try.*coworking",
    getResponse: (userLanguage = 'es') => ({
      es: `¡Hola {nombre}! 👋🏼 Soy Aurora, déjame coordinar tu espacio de inmediato.

¿Qué prefieres?

📍 Hot Desk (2 horas gratis en tu primera visita 🎁)
🏢 Sala de Reuniones (3-4 personas, $30 por 2h)

Dime cuál te interesa y agendamos 😊`,
      en: `Hello {nombre}! 👋🏼 I'm Aurora, let me coordinate your space right away.

What do you prefer?

📍 Hot Desk (2 free hours on your first visit 🎁)
🏢 Meeting Room (3-4 people, $30 for 2h)

Tell me which one interests you and we'll schedule it 😊`,
      fr: `Bonjour {nombre}! 👋🏼 Je suis Aurora, je coordonne votre espace immédiatement.

Que préférez-vous?

📍 Hot Desk (2 heures gratuites lors de votre première visite 🎁)
🏢 Salle de Réunion (3-4 personnes, $30 pour 2h)

Dites-moi ce qui vous intéresse et nous planifierons 😊`
    })
  },

  // Mensaje 2: ¡Hola coWorkia! Quiero un espacio privado, con locker propio y pago mensual
  ESPACIO_PRIVADO_MENSUAL: {
    trigger: "espacio privado.*locker.*mensual|private space.*locker.*monthly|espace privé.*casier.*mensuel",
    getResponse: (userLanguage = 'es') => ({
      es: `¡Hola {nombre}! Soy Aurora 👋🏼

Entiendo que buscas un espacio privado con locker y membresía mensual.

Para planes con todo incluido, te conecto con *Aluna* 📋, nuestra especialista en membresías.

O si prefieres, puedes conocer el espacio primero (tu primera visita es gratis 🎁).

¿Qué prefieres?
• Hablar con Aluna sobre planes mensuales
• Agendar una visita para conocer el espacio

Dime y coordinamos 😊`,
      en: `Hello {nombre}! I'm Aurora 👋🏼

I understand you're looking for a private space with a locker and monthly membership.

For all-inclusive plans, I'll connect you with *Aluna* 📋, our membership specialist.

Or if you prefer, you can visit the space first (your first visit is free 🎁).

What do you prefer?
• Talk to Aluna about monthly plans
• Schedule a visit to see the space

Let me know and we'll coordinate 😊`,
      fr: `Bonjour {nombre}! Je suis Aurora 👋🏼

Je comprends que vous cherchez un espace privé avec casier et abonnement mensuel.

Pour les plans tout compris, je vous connecte avec *Aluna* 📋, notre spécialiste des adhésions.

Ou si vous préférez, vous pouvez visiter l'espace d'abord (votre première visite est gratuite 🎁).

Que préférez-vous?
• Parler à Aluna des plans mensuels
• Planifier une visite pour voir l'espace

Dites-moi et nous coordonnerons 😊`
    })
  },

  // Mensaje 3: Aurora, ¿qué puede hacer un Agente Virtual como tú para mi empresa?
  VENTA_AGENTES_VIRTUALES: {
    trigger: "agente virtual|virtual agent|chatbot|sistema.*ia|crear agente|cotizar.*agente|cotizar.*sistema|capacidades.*agente|sistema como t[uú]|qu[eé] puede.*hacer|what can.*you do|what can.*do.*agent|bot como t[uú]",
    specialMode: 'virtualAgentSales', // Flag para usar prompt especial
    getResponse: (userLanguage = 'es') => ({
      es: `¡Hola {nombre}! 🤖✨ Excelente pregunta.

Soy Aurora de *OneMind* - El ecosistema de agentes virtuales de MarketingLab.

🎯 *LO QUE ESTÁS VIENDO AHORA ES EL SISTEMA:*
Conversación natural 24/7, multiidioma, con contexto e inteligencia real.

🤝 *NUESTRO ECOSISTEMA DE 8 AGENTES:*

🏢 @aurora - Coworking (Coworkia)
📊 @enzo - Marketing & Software (MarketingLab)
🏠 @aluna - Membresías Business
🏡 @paula - Bienes Raíces (PropElite)
🚗 @axel - Colisiones (PaintBull)
💚 @angela - Salud (MedBeneficios)
🛡️ @adriana - Seguros (SegPopular)
⚖️ @gabi - Legal/Finanzas (GR Consulting)

🔥 *PRUÉBALO AHORA:* Escribe @aluna o @paula + tu consulta

🌐 *CONOCE TODOS LOS AGENTES:*
https://coworkia-agent-e97d15dac56f.herokuapp.com/

💰 *DESARROLLO PERSONALIZADO:*
Desde $350/mes - Agente entrenado para TU negocio

🚀 *SIGUIENTE PASO:*
Habla con @enzo del MarketingLab para cotización y demo personalizada.

¿Qué tipo de negocio tienes? Te muestro un caso de uso específico 😊`,
      en: `Hello {nombre}! 🤖✨ Excellent question.

I'm Aurora from *OneMind* - MarketingLab's virtual agent ecosystem.

🎯 *WHAT YOU'RE SEEING NOW IS THE SYSTEM:*
Natural 24/7 conversation, multilingual, with context and real intelligence.

🤝 *OUR 8-AGENT ECOSYSTEM:*

🏢 @aurora - Coworking (Coworkia)
📊 @enzo - Marketing & Software (MarketingLab)
🏠 @aluna - Business Memberships
🏡 @paula - Real Estate (PropElite)
🚗 @axel - Collision Repair (PaintBull)
💚 @angela - Healthcare (MedBeneficios)
🛡️ @adriana - Insurance (SegPopular)
⚖️ @gabi - Legal/Finance (GR Consulting)

🔥 *TRY IT NOW:* Write @aluna or @paula + your question

🌐 *MEET ALL OUR AGENTS:*
https://coworkia-agent-e97d15dac56f.herokuapp.com/

💰 *CUSTOM DEVELOPMENT:*
From $350/month - Agent trained for YOUR business

🚀 *NEXT STEP:*
Talk to @enzo from MarketingLab for quote and personalized demo.

What kind of business do you have? I'll show you a specific use case 😊`,
      fr: `Bonjour {nombre}! 🤖✨ Excellente question.

Je suis Aurora de *OneMind* - L'écosystème d'agents virtuels de MarketingLab.

🎯 *CE QUE VOUS VOYEZ MAINTENANT EST LE SYSTÈME:*
Conversation naturelle 24/7, multilingue, avec contexte et vraie intelligence.

🤝 *NOTRE ÉCOSYSTÈME DE 8 AGENTS:*

🏢 @aurora - Coworking (Coworkia)
📊 @enzo - Marketing & Software (MarketingLab)
🏠 @aluna - Adhésions Business
🏡 @paula - Immobilier (PropElite)
🚗 @axel - Réparation Collision (PaintBull)
💚 @angela - Santé (MedBeneficios)
🛡️ @adriana - Assurances (SegPopular)
⚖️ @gabi - Juridique/Finance (GR Consulting)

🔥 *ESSAYEZ MAINTENANT:* Écrivez @aluna ou @paula + votre question

🌐 *DÉCOUVREZ TOUS NOS AGENTS:*
https://coworkia-agent-e97d15dac56f.herokuapp.com/

💰 *DÉVELOPPEMENT PERSONNALISÉ:*
Dès $350/mois - Agent formé pour VOTRE entreprise

🚀 *PROCHAINE ÉTAPE:*
Parlez à @enzo de MarketingLab pour devis et démo personnalisée.

Quel type d'entreprise avez-vous? Je vous montre un cas d'usage spécifique 😊`
    })
  },

  // Mensaje 4: ¡Hola Paula! Me interesa Casa Jardín (Campaña PropElite)
  CASA_JARDIN_PAULA: {
    trigger: "hola paula.*casa jard[ií]n|hello paula.*casa jard[ií]n",
    targetAgent: 'PAULA', // Activar Paula directamente
    getResponse: (userLanguage = 'es') => ({
      es: `¡Hola {nombre}! Soy Paula de PropElite Bienes Raíces 🏡

¡Excelente elección! *Casas Jardín* en El Morenal es uno de nuestros proyectos más exclusivos 💎

🏗️ Constructor premium: G.M.A. Arquitectos
📍 Urbanización privada exclusiva
✨ YA CONSTRUIDAS - Listas para habitar

Te envío la información de las 4 casas disponibles con sus fichas completas.

📋 ¿Prefieres que te envíe:
• Todas las fichas juntas para comparar
• Una por una con detalles específicos

Dime cómo prefieres y te las envío de inmediato 😊`,
      en: `Hello {nombre}! I'm Paula from PropElite Real Estate 🏡

Excellent choice! *Casas Jardín* in El Morenal is one of our most exclusive projects 💎

🏗️ Premium builder: G.M.A. Arquitectos
📍 Exclusive private urbanization
✨ ALREADY BUILT - Ready to move in

I'll send you information on the 4 available houses with complete details.

📋 Do you prefer that I send you:
• All files together to compare
• One by one with specific details

Let me know how you prefer and I'll send them right away 😊`
    })
  }
};

/**
 * 🎯 Detecta si un mensaje coincide con campaña publicitaria
 */
export function detectCampaignMessage(message) {
  const messageLower = message.toLowerCase();
  
  for (const [key, campaign] of Object.entries(CAMPAIGN_PROMPTS)) {
    const regex = new RegExp(campaign.trigger, 'i');
    if (regex.test(messageLower)) {
      return {
        detected: true,
        campaign: key,
        getTemplate: campaign.getResponse
      };
    }
  }
  
  return { detected: false };
}

/**
 * 🎨 Personaliza respuesta de campaña con nombre del usuario y respeta idioma
 * 🔍 Detecta si es cliente recurrente y ajusta mensaje (NO ofrece trial gratis si ya lo usó)
 * @param {Function} getTemplate - Función que retorna templates por idioma
 * @param {Object} userProfile - Perfil del usuario con preferredLanguage
 * @param {string} campaignKey - Clave de la campaña (PROBAR_SERVICIO, etc)
 */
export function personalizeCampaignResponse(getTemplate, userProfile, campaignKey = null) {
  const userName = userProfile?.name || '';
  const userLanguage = userProfile?.preferredLanguage || 'es';
  const freeTrialUsed = userProfile?.freeTrialUsed || false;
  
  // Obtener template en el idioma correcto
  const templates = getTemplate(userLanguage);
  let template = templates[userLanguage] || templates.es; // Fallback a español
  
  // FIX 3: Si campaña PROBAR_SERVICIO y ya usó trial, ajustar mensaje
  if (campaignKey === 'PROBAR_SERVICIO' && freeTrialUsed) {
    // Remover mención de "gratis" del template
    template = template.replace(/2 horas gratis.*🎁\)/g, '2 horas por $10)');
    template = template.replace(/2 free hours.*🎁\)/g, '2 hours for $10)');
    template = template.replace(/2 heures gratuites.*🎁\)/g, '2 heures pour $10)');
    console.log('[CAMPAIGN] ⚠️ freeTrialUsed=true, removido "gratis" del mensaje');
  }
  
  console.log('[CAMPAIGN] 🎯 Template personalizado:', { userName, userLanguage, freeTrialUsed, campaignKey });
  return template.replace(/{nombre}/g, userName);
}

/**
 * 🔍 Genera respuesta especial si ya usó el trial gratis
 * FLUJO PERSUASIVO: Reconocer → Informar → Cobrar → Validar → Agendar
 */
export function getTrialUsedResponse(userProfile) {
  const userName = userProfile?.name || '';
  const lastReservation = userProfile?.lastReservation;
  
  if (!lastReservation) {
    return null;
  }
  
  const fecha = lastReservation.date || 'fecha anterior';
  const hora = lastReservation.startTime || '';
  const email = userProfile.email || 'tu email';
  const serviceType = lastReservation.serviceType === 'hotDesk' ? 'Hot Desk' : 'Sala de Reuniones';
  const wasFree = lastReservation.wasFree;
  
  return `¡Hola${userName ? ' ' + userName : ''}, soy Aurora! 😊

Qué bueno verte de nuevo. Veo que el *${fecha}* a las *${hora}* disfrutaste tu *${serviceType}${wasFree ? ' GRATIS* 🎉' : '*'}

📋 *Para tu próxima visita:*

📍 *Hot Desk* → $10 por 2 horas
🏢 *Sala de Reuniones* → $30 por 2 horas (3-4 personas)

¿Cuál prefieres? te agendo de inmediato 😊`;
}

/**
 * 💳 Detecta si usuario recurrente eligió espacio y debe recibir link de pago
 */
export function shouldSendPaymentLink(message, profile) {
  // Solo para usuarios recurrentes que ya usaron trial
  const hasHistory = profile?.reservationHistory?.length > 0;
  const usedTrial = profile?.freeTrialUsed || hasHistory;
  
  if (!usedTrial) return null;

  const msgLower = message.toLowerCase().trim();
  
  // Patrones de elección de Hot Desk
  const hotDeskPatterns = [
    'hot desk',
    'hotdesk',
    'escritorio',
    'hot-desk',
    'el hot',
    'prefiero hot',
    'quiero hot'
  ];
  
  // Patrones de elección de Sala
  const meetingRoomPatterns = [
    'sala',
    'reunion',
    'reunión',
    'meeting',
    'la sala',
    'prefiero sala',
    'quiero sala'
  ];
  
  // Detectar elección de Hot Desk
  if (hotDeskPatterns.some(p => msgLower.includes(p))) {
    return {
      serviceType: 'hotDesk',
      price: 10,
      message: `¡Perfecto! 😊

📍 *Hot Desk* (2 horas) = *$10*

💳 *Paga aquí:*
https://ppls.me/hnMI9yMRxbQ6rgIVi6L2DA

Cuando hayas pagado, envíame la captura del comprobante 📸 y te agendo de inmediato`
    };
  }
  
  // Detectar elección de Sala
  if (meetingRoomPatterns.some(p => msgLower.includes(p))) {
    return {
      serviceType: 'meetingRoom',
      price: 30,
      message: `¡Perfecto! 😊

🏢 *Sala de Reuniones* (2 horas, 3-4 personas) = *$30*

💳 *Paga aquí:*
https://ppls.me/hnMI9yMRxbQ6rgIVi6L2DA

Cuando hayas pagado, envíame la captura del comprobante 📸 y te agendo de inmediato`
    };
  }
  
  return null;
}

/**
 * 🎫 Genera ticket consolidado para múltiples reservas
 */
export function generateConsolidatedTicket(reservations) {
  if (!reservations || reservations.length === 0) return null;
  
  let ticket = `📋 *RESUMEN DE TUS RESERVAS:*\n\n`;
  let total = 0;
  let hasFreeReservation = false;
  
  reservations.forEach((res, index) => {
    const num = index + 1;
    const emoji = num === 1 ? '1️⃣' : num === 2 ? '2️⃣' : num === 3 ? '3️⃣' : `${num}️⃣`;
    
    // Formatear fecha
    const fecha = res.date || 'Fecha pendiente';
    const hora = res.time || res.startTime || 'Hora pendiente';
    
    // Determinar tipo de espacio
    const espacio = res.serviceType === 'hotDesk' ? 'Hot Desk' :
                    res.serviceType === 'meetingRoom' ? 'Sala de Reuniones' :
                    res.spaceType === 'hotDesk' ? 'Hot Desk' :
                    res.spaceType === 'meetingRoom' ? 'Sala de Reuniones' : 'Hot Desk';
    
    // Determinar número de personas
    const personas = res.numPeople || res.guestCount || 1;
    const personasTexto = personas === 1 ? 'solo tú' : `${personas} personas`;
    
    // Calcular precio
    let precio;
    if (res.wasFree || res.isFree) {
      precio = 'GRATIS 🎉';
      hasFreeReservation = true;
    } else {
      // Lógica de precios
      if (espacio === 'Hot Desk') {
        // Hot Desk se cobra por persona
        const hotDeskPrice = personas * 10;
        precio = `$${hotDeskPrice}`;
        total += hotDeskPrice;
      } else if (espacio === 'Sala de Reuniones') {
        precio = '$30';
        total += 30;
      } else {
        precio = res.price ? `$${res.price}` : 'Precio pendiente';
        if (res.price) total += res.price;
      }
    }
    
    ticket += `${emoji} ${fecha} ${hora} - ${espacio} (${personasTexto}) = ${precio}\n`;
  });
  
  // Agregar total
  if (total > 0) {
    const formatBase = (amount) => Number.isInteger(amount) ? amount.toString() : amount.toFixed(2);
    const totalConTarjeta = total * 1.05;

    ticket += `\n💰 *TOTAL A PAGAR: $${formatBase(total)}*\n\n`;
    ticket += `💳 *FORMAS DE PAGO:*\n`;
    ticket += `• Transferencia/Efectivo: *$${total.toFixed(2)}*\n`;
    ticket += `• Tarjeta débito/crédito: *$${totalConTarjeta.toFixed(2)}* (incluye comisión 5%)\n\n`;

    ticket += `📸 Envíame el comprobante cuando hayas pagado`;
  } else if (hasFreeReservation && reservations.length === 1) {
    ticket += `\n🎉 ¡Tu primera visita es totalmente gratis!\n`;
    ticket += `Solo necesito confirmar tu email y estarás listo`;
  }
  
  return ticket;
}

/**
 * 📊 Calcula precio individual de una reserva
 */
export function calculateReservationPrice(serviceType, numPeople = 1, wasFree = false) {
  if (wasFree) return 0;
  
  if (serviceType === 'hotDesk') {
    // Hot Desk es INDIVIDUAL - solo 1 persona, precio fijo $10
    return 10;
  } else if (serviceType === 'meetingRoom') {
    return 30; // $30 fijo por sala
  }
  
  return 0;
}