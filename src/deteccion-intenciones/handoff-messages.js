/**
 * 💬 MENSAJES DE HANDOFF CENTRALIZADOS
 * 
 * Reemplaza los getHandover() duplicados en cada agente individual.
 * Sistema V2: Mensajes centralizados, fáciles de mantener y consistentes.
 * 
 * REGLA: Solo el nuevo agente habla (silent handoff del agente saliente)
 * 
 * @date 30 Ene 2026
 */

/**
 * Nombres y contextos de cada agente
 */
const AGENT_INFO = {
  AURORA: {
    name: 'Aurora',
    context: 'reservas y coordinación de Coworkia',
    emoji: '✨'
  },
  ALUNA: {
    name: 'Aluna',
    context: 'membresías y planes mensuales',
    emoji: '🌙'
  },
  ADRIANA: {
    name: 'Adriana',
    context: 'seguros y coberturas',
    emoji: '🛡️'
  },
  ENZO: {
    name: 'Enzo',
    context: 'marketing e IA para negocios',
    emoji: '🚀'
  },
  ANGELA: {
    name: 'Ángela',
    context: 'salud y bienestar',
    emoji: '👩‍⚕️'
  },
  AXEL: {
    name: 'Axel',
    context: 'colisiones y reparación vehicular',
    emoji: '🔧'
  },
  GABI: {
    name: 'Gabi',
    context: 'legal y finanzas',
    emoji: '⚖️'
  },
  PAULA: {
    name: 'Paula',
    context: 'bienes raíces',
    emoji: '🏡'
  }
};

/**
 * Plantillas de mensajes de entrada por idioma
 * {fromAgent} = agente anterior
 * {toAgent} = nuevo agente (quien habla)
 * {userName} = nombre del usuario
 */
const ENTRY_TEMPLATES = {
  // Usuario nuevo llega al agente (sin historial previo)
  FIRST_TIME: {
    es: '¡Hola {userName}! {emoji} Soy {toAgent}.\n\nTe ayudo con {context}. ¿Qué necesitas hoy?',
    en: 'Hi {userName}! {emoji} I\'m {toAgent}, {context}.\n\nHow can I help you?',
    fr: 'Bonjour {userName}! {emoji} Je suis {toAgent}, {context}.\n\nComment puis-je vous aider?',
    it: 'Ciao {userName}! {emoji} Sono {toAgent}, {context}.\n\nCome posso aiutarti?',
    pt: 'Olá {userName}! {emoji} Sou {toAgent}, {context}.\n\nComo posso ajudá-lo?',
    qu: 'Allinllachu {userName}! {emoji} Ñuqaqa {toAgent} kani, {context}.\n\nImaynatataq yanapasqayki?'
  },
  
  // Usuario regresa al agente (ya estuvo antes)
  RETURNING: {
    es: '¡Hola de nuevo {userName}! {emoji} Soy {toAgent}.\n\nRetomemos donde quedamos. ¿En qué te ayudo ahora con {context}?',
    en: 'Hello again {userName}! {emoji} I\'m {toAgent}, we meet again.\n\nI remember our last conversation. How else can I help you now?',
    fr: 'Rebonjour {userName}! {emoji} Je suis {toAgent}, nous nous retrouvons.\n\nJe me souviens de notre dernière conversation. Comment puis-je encore vous aider?',
    it: 'Ciao di nuovo {userName}! {emoji} Sono {toAgent}, ci ritroviamo.\n\nRicordo la nostra ultima conversazione. Come posso aiutarti adesso?',
    pt: 'Olá novamente {userName}! {emoji} Sou {toAgent}, nos encontramos novamente.\n\nLembro da nossa última conversa. Como posso ajudá-lo agora?',
    qu: 'Allinllachu wakmanta {userName}! {emoji} Ñuqaqa {toAgent} kani, wakmanta tupanakunchis.\n\nYuyarini ñawpaq rimanakuyninchista. Kunantaq imaynatataq yanapasqayki?'
  },
  
  // Handoff desde otro agente (transición activa)
  HANDOFF: {
    es: '¡Hola {userName}! {emoji} Soy {toAgent}.\n\n{contextLine}Te ayudo con {context}. ¿Qué necesitas?\n\nCuando termines, escribe @aurora ✨',
    en: 'Hi {userName}! {emoji} I\'m {toAgent}, taking over from here.\n\nI\'m available right where you left off when you call me with @{toAgentHandle}.\n\nHow can I help you today with {context}?',
    fr: 'Bonjour {userName}! {emoji} Je suis {toAgent}, je prends le relais maintenant.\n\nJe suis disponible là où vous vous êtes arrêté quand vous m\'appelez avec @{toAgentHandle}.\n\nComment puis-je vous aider aujourd\'hui avec {context}?',
    it: 'Ciao {userName}! {emoji} Sono {toAgent}, prendo il controllo da qui.\n\nSono disponibile da dove sei rimasto quando mi chiami con @{toAgentHandle}.\n\nCome posso aiutarti oggi con {context}?',
    pt: 'Olá {userName}! {emoji} Sou {toAgent}, assumo daqui.\n\nEstou disponível de onde você parou quando me chama com @{toAgentHandle}.\n\nComo posso ajudá-lo hoje com {context}?',
    qu: 'Allinllachu {userName}! {emoji} Ñuqaqa {toAgent} kani, kaypi qallarikuni.\n\nKaypi kani maypi qhiparqanki, @{toAgentHandle}wan waqyamuptiki.\n\nImaynata yanapayki kunan {context}manta?'
  }
};

/**
 * Genera el mensaje de despedida de Aurora cuando pasa a un especialista
 */
export function getAuroraExitMessage(toAgent, userName, userLanguage = 'es', userContext = null) {
  const info = AGENT_INFO[toAgent] || {};
  const name = info.name || toAgent;
  const emoji = info.emoji || '✨';
  // Ignorar @menciones puras como contexto — no aportan información real
  const isRealContext = userContext && !/^@\w+\s*$/.test(userContext.trim());
  const contextRef = isRealContext
    ? `sobre *"${userContext.substring(0, 60)}"*`
    : `con ${info.context || 'tu consulta'}`;

  const templates = {
    es: `¡Paso! ${emoji} Te conecto con *${name}*, nuestra especialista ${contextRef}.\n\nEstoy aquí cuando escribas @aurora + tu consulta ✨`,
    en: `Connecting you now! ${emoji} *${name}* will help you ${contextRef}.\n\nI'm here when you write @aurora + your question ✨`,
    fr: `Je vous passe maintenant! ${emoji} *${name}* vous aide ${contextRef}.\n\nJe suis là quand vous écrivez @aurora + votre question ✨`,
    it: `Passo ora! ${emoji} *${name}* ti aiuterà ${contextRef}.\n\nSono qui quando scrivi @aurora + la tua domanda ✨`,
    pt: `Passando agora! ${emoji} *${name}* vai te ajudar ${contextRef}.\n\nEstou aqui quando escrever @aurora + sua consulta ✨`,
    qu: `Pasachkani kunan! ${emoji} *${name}* yanapasunki ${contextRef}.\n\nKaypi kani @aurora nispa + tapuyniyki qillqaspayki ✨`
  };
  return templates[userLanguage] || templates.es;
}

/**
 * Genera mensaje de entrada del nuevo agente
 * @param {string} toAgent - Agente que toma el control
 * @param {string} fromAgent - Agente anterior (null si es primera vez)
 * @param {string} userName - Nombre del usuario
 * @param {string} userLanguage - Idioma ('es', 'en', 'fr', 'it', 'pt', 'qu')
 * @param {boolean} isReturning - Si el usuario ya habló con este agente antes
 * @param {string|null} userContext - Último mensaje del usuario (para personalizar)
 * @returns {string} Mensaje de entrada
 */
export function getEntryMessage(toAgent, fromAgent, userName = '', userLanguage = 'es', isReturning = false, userContext = null) {
  const info = AGENT_INFO[toAgent] || AGENT_INFO.AURORA;
  const lang = userLanguage || 'es';
  
  // Decidir plantilla según contexto
  let template;
  if (!fromAgent || fromAgent === toAgent) {
    // Primera vez o mismo agente (mantiene)
    template = isReturning ? ENTRY_TEMPLATES.RETURNING : ENTRY_TEMPLATES.FIRST_TIME;
  } else {
    // Handoff desde otro agente
    template = ENTRY_TEMPLATES.HANDOFF;
  }
  
  const text = template[lang] || template.es;
  
  // Variables para reemplazar
  const fromInfo = fromAgent ? AGENT_INFO[fromAgent] : null;
  // Línea de contexto: si hay mensaje del usuario con contenido real, personalizamos el saludo
  // Si userContext es solo una @mención pura (sin texto adicional), se ignora para evitar saludos ridículos
  const isRealContext = userContext && !/^@\w+\s*$/.test(userContext.trim());
  const contextLine = (fromAgent && fromAgent !== toAgent && isRealContext)
    ? (({
        es: (q) => `Vi que preguntas por *"${q}"* — `,
        en: (q) => `I see you asked about *"${q}"* — `,
        fr: (q) => `J'ai vu que vous demandez *"${q}"* — `,
        it: (q) => `Ho visto che chiedi di *"${q}"* — `,
        pt: (q) => `Vi que você perguntou sobre *"${q}"* — `,
      })[lang] || ((q) => `Vi que preguntas por *"${q}"* — `))(userContext.substring(0, 60))
    : '';
  const replacements = {
    '{emoji}': info.emoji,
    '{toAgent}': info.name,
    '{toAgentHandle}': toAgent?.toLowerCase() || '',
    '{context}': info.context,
    '{fromAgentName}': fromInfo?.name || fromAgent,
    '{fromAgentHandle}': fromAgent?.toLowerCase() || '',
    '{contextLine}': contextLine
  };
  
  // Aplicar reemplazos: nombre primero (manejo especial para nombre vacío)
  let message = text.replace(/ \{userName\}|\{userName\}/g, userName ? ` ${userName}` : '');
  for (const [key, value] of Object.entries(replacements)) {
    message = message.replace(new RegExp(key, 'g'), value);
  }
  
  return message;
}

/**
 * Aurora: Mensajes especiales cuando regresa desde otro agente
 * Aurora es el hub central, tiene contexto de todos los especialistas
 */
export function getAuroraReturnMessage(fromAgent, userName, userLanguage = 'es', userContext = null) {
  const fromInfo = AGENT_INFO[fromAgent];
  const fromName = fromInfo?.name || fromAgent;
  const fromHandle = fromAgent.toLowerCase();

  // Extraer consulta real (strip @aurora si viene en el texto)
  const cleanContext = userContext
    ? userContext.replace(/^@aurora\s*/i, '').trim()
    : '';
  const hasContext = cleanContext.length > 3;

  // Línea de contexto sobre qué estabas discutiendo con el especialista
  const topicLine = hasContext
    ? {
        es: `Vi que con ${fromName} estabas en: *"${cleanContext.substring(0, 80)}"*`,
        en: `I see you were discussing with ${fromName}: *"${cleanContext.substring(0, 80)}"*`,
        fr: `Je vois que tu discutais avec ${fromName} de: *"${cleanContext.substring(0, 80)}"*`,
        it: `Vedo che stavi discutendo con ${fromName}: *"${cleanContext.substring(0, 80)}"*`,
        pt: `Vejo que estava falando com ${fromName} sobre: *"${cleanContext.substring(0, 80)}"*`,
        qu: `Rikusqaymi ${fromName}-wan rimasqayki karqa: *"${cleanContext.substring(0, 80)}"*`
      }
    : {
        es: `Venías hablando con ${fromName} sobre ${fromInfo?.context || 'una consulta'}.`,
        en: `You were with ${fromName} about ${fromInfo?.context || 'a query'}.`,
        fr: `Vous parliez avec ${fromName} de ${fromInfo?.context || 'une question'}.`,
        it: `Stavi parlando con ${fromName} di ${fromInfo?.context || 'una consulta'}.`,
        pt: `Você estava falando com ${fromName} sobre ${fromInfo?.context || 'uma consulta'}.`,
        qu: `${fromName}-wan rimasqayki karqa ${fromInfo?.context || 'tapuy'} haqay.`
      };

  const topic = topicLine[userLanguage] || topicLine.es;

  const templates = {
    es: `¡Bienvenido de vuelta${userName ? `, ${userName}` : ''}! ✨ Soy Aurora.\n\n${topic}\n\n¿Continuamos con eso o te ayudo con algo más?`,
    en: `Welcome back${userName ? `, ${userName}` : ''}! ✨ I'm Aurora.\n\n${topic}\n\nShall we continue with that, or can I help you with something else?`,
    fr: `Bon retour${userName ? `, ${userName}` : ''}! ✨ Je suis Aurora.\n\n${topic}\n\nContinuons avec ça, ou puis-je vous aider avec autre chose?`,
    it: `Bentornato${userName ? `, ${userName}` : ''}! ✨ Sono Aurora.\n\n${topic}\n\nContinuiamo con quello, o posso aiutarti con qualcos'altro?`,
    pt: `Bem-vindo de volta${userName ? `, ${userName}` : ''}! ✨ Sou Aurora.\n\n${topic}\n\nContinuamos com isso, ou posso te ajudar com mais alguma coisa?`,
    qu: `Allinllachu kutimuwarqanki${userName ? `, ${userName}` : ''}! ✨ Ñuqa kani Aurora.\n\n${topic}\n\nChaywanchu katisun, utaq huk imapichus yanapasqayki?`
  };

  return templates[userLanguage] || templates.es;
}

// getExitMessage() eliminada — V2 usa silent handoff, el agente saliente no habla

/**
 * API unificada para handoffs
 * @param {string} fromAgent - Agente que entrega
 * @param {string} toAgent - Agente que recibe
 * @param {string} userName - Nombre del usuario
 * @param {string} userLanguage - Idioma
 * @param {boolean} isReturning - Si usuario ya estuvo con toAgent antes
 * @returns {{ despedida: null, entrada: string }} Mensajes de handoff
 */
export function getHandoffMessages(fromAgent, toAgent, userName = '', userLanguage = 'es', isReturning = false, userContext = null) {
  let entryMessage;
  let exitMessage = null;
  
  // Caso especial: Aurora regresa desde especialista
  if (toAgent === 'AURORA' && fromAgent !== 'AURORA') {
    entryMessage = getAuroraReturnMessage(fromAgent, userName, userLanguage, userContext);
  } else {
    entryMessage = getEntryMessage(toAgent, fromAgent, userName, userLanguage, isReturning, userContext);
  }

  // Aurora dice adiós cuando pasa a un especialista (mensajes humanos, no silent)
  if (fromAgent === 'AURORA' && toAgent !== 'AURORA') {
    exitMessage = getAuroraExitMessage(toAgent, userName, userLanguage, userContext);
  }
  
  return {
    despedida: exitMessage,
    entrada: entryMessage
  };
}
