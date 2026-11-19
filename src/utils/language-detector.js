/**
 * 🌍 Sistema de Detección Automática de Idioma
 * Detecta el idioma del mensaje del usuario usando patrones nativos
 * Soporta: Español, English, Français, Italiano, Português, Runasimi (Quechua)
 */

import { scoreLanguages } from './language-lexicon.js';

// Códigos ISO 639-1 para idiomas soportados
// Alineado con handoff-messages.js: es, en, fr, it, pt, qu
export const SUPPORTED_LANGUAGES = {
  SPANISH: 'es',
  ENGLISH: 'en',
  FRENCH: 'fr',
  ITALIAN: 'it',
  PORTUGUESE: 'pt',
  QUECHUA: 'qu'
};

// Nombres legibles de idiomas
export const LANGUAGE_NAMES = {
  es: 'Español',
  en: 'English',
  fr: 'Français',
  it: 'Italiano',
  pt: 'Português',
  qu: 'Quechua (Runasimi)'
};

/**
 * 🎯 Detecta el idioma de un mensaje (por palabras completas, ver language-lexicon.js)
 * @param {string} message - Mensaje a analizar
 * @param {string} preferredLanguage - Idioma preferido del usuario (opcional)
 * @returns {object} { language, confidence, name, reason, strong, scores }
 *   strong = la evidencia alcanza para CAMBIAR el idioma de la conversación
 */
export function detectLanguage(message, preferredLanguage = null) {
  if (!message || typeof message !== 'string') {
    return { language: SUPPORTED_LANGUAGES.SPANISH, confidence: 1.0, name: LANGUAGE_NAMES.es, reason: 'default', strong: false };
  }

  const normalizedMessage = message.toLowerCase().trim();

  // Si el mensaje es muy corto (< 3 caracteres), usar idioma preferido
  if (normalizedMessage.length < 3) {
    const lang = preferredLanguage || SUPPORTED_LANGUAGES.SPANISH;
    return { language: lang, confidence: 0.6, name: LANGUAGE_NAMES[lang], reason: 'short_message_using_preference', strong: false };
  }

  const { ranked, scores } = scoreLanguages(normalizedMessage, preferredLanguage);
  const [topLang, top] = ranked[0];
  const second = ranked[1][1].score;

  if (top.score === 0) {
    const fallbackLang = preferredLanguage || SUPPORTED_LANGUAGES.SPANISH;
    return { language: fallbackLang, confidence: 0.5, name: LANGUAGE_NAMES[fallbackLang], reason: 'fallback_to_preference_or_default', strong: false, scores };
  }

  const margin = top.score - second;
  // Confianza: cuánta evidencia hay y cuánto le gana al segundo idioma
  const confidence = Math.round(Math.min(1, top.score / 4) * Math.min(1, 0.4 + margin / Math.max(top.score, 1)) * 100) / 100;
  // Para CAMBIAR el idioma de la conversación pedimos evidencia clara:
  // ≥2 palabras/indicios, puntaje ≥3 y ventaja ≥2 sobre el segundo idioma.
  const strong = top.matchCount >= 2 && top.score >= 3 && margin >= 2;

  return { language: topLang, confidence, name: LANGUAGE_NAMES[topLang], reason: 'pattern_matching', strong, matchCount: top.matchCount, scores };
}

/**
 * 🔍 Detecta comandos explícitos de cambio de idioma
 * ⚡ MODO: Una sola palabra activa el idioma
 * Ejemplos: "english", "español", "français"
 * @param {string} message - Mensaje del usuario
 * @returns {string|null} Código de idioma o null si no hay comando
 */
export function detectLanguageCommand(message) {
  if (!message || typeof message !== 'string') {
    return null;
  }

  const normalized = message.toLowerCase().trim();

  // ⚡ UNA PALABRA ACTIVA EL IDIOMA - Comandos simples
  const singleWordCommands = {
    'english': SUPPORTED_LANGUAGES.ENGLISH,
    'inglés': SUPPORTED_LANGUAGES.ENGLISH,
    'ingles': SUPPORTED_LANGUAGES.ENGLISH,
    'español': SUPPORTED_LANGUAGES.SPANISH,
    'espanol': SUPPORTED_LANGUAGES.SPANISH,
    'spanish': SUPPORTED_LANGUAGES.SPANISH,
    'français': SUPPORTED_LANGUAGES.FRENCH,
    'francais': SUPPORTED_LANGUAGES.FRENCH,
    'french': SUPPORTED_LANGUAGES.FRENCH,
    'italiano': SUPPORTED_LANGUAGES.ITALIAN,
    'italian': SUPPORTED_LANGUAGES.ITALIAN,
    'português': SUPPORTED_LANGUAGES.PORTUGUESE,
    'portugues': SUPPORTED_LANGUAGES.PORTUGUESE,
    'portuguese': SUPPORTED_LANGUAGES.PORTUGUESE,
    'quechua': SUPPORTED_LANGUAGES.QUECHUA,
    'runasimi': SUPPORTED_LANGUAGES.QUECHUA
  };

  // Si el mensaje es EXACTAMENTE una palabra de idioma
  if (singleWordCommands[normalized]) {
    return singleWordCommands[normalized];
  }

  // Comandos con barra diagonal
  const slashCommands = {
    '/spanish': SUPPORTED_LANGUAGES.SPANISH,
    '/español': SUPPORTED_LANGUAGES.SPANISH,
    '/espanol': SUPPORTED_LANGUAGES.SPANISH,
    '/english': SUPPORTED_LANGUAGES.ENGLISH,
    '/inglés': SUPPORTED_LANGUAGES.ENGLISH,
    '/ingles': SUPPORTED_LANGUAGES.ENGLISH,
    '/français': SUPPORTED_LANGUAGES.FRENCH,
    '/francais': SUPPORTED_LANGUAGES.FRENCH,
    '/french': SUPPORTED_LANGUAGES.FRENCH,
    '/italiano': SUPPORTED_LANGUAGES.ITALIAN,
    '/italian': SUPPORTED_LANGUAGES.ITALIAN,
    '/português': SUPPORTED_LANGUAGES.PORTUGUESE,
    '/portugues': SUPPORTED_LANGUAGES.PORTUGUESE,
    '/portuguese': SUPPORTED_LANGUAGES.PORTUGUESE,
    '/quechua': SUPPORTED_LANGUAGES.QUECHUA,
    '/runasimi': SUPPORTED_LANGUAGES.QUECHUA
  };

  // Buscar comandos con barra
  for (const [cmd, lang] of Object.entries(slashCommands)) {
    if (normalized.startsWith(cmd)) {
      return lang;
    }
  }

  // Frases naturales de cambio de idioma
  const naturalCommands = [
    { patterns: [
        /cambiar?\s+(a|al)?\s*inglés/i, 
        /habla(r)?\s+inglés/i, 
        /switch\s+to\s+english/i,
        /do\s+you\s+speak\s+english/i,
        /can\s+you\s+speak\s+english/i,
        /hablas\s+inglés/i,
        /hablas\s+ingles/i,
        /english\s+please/i
      ], lang: SUPPORTED_LANGUAGES.ENGLISH },
    { patterns: [
        /cambiar?\s+(a|al)?\s*español/i, 
        /habla(r)?\s+español/i, 
        /switch\s+to\s+spanish/i,
        /do\s+you\s+speak\s+spanish/i,
        /can\s+you\s+speak\s+spanish/i,
        /hablas\s+español/i
      ], lang: SUPPORTED_LANGUAGES.SPANISH },
    { patterns: [
        /cambiar?\s+(a|al)?\s*francés/i,
        /habla(r)?\s+francés/i,
        /french\s+please/i,
        /parlez\s+vous\s+français/i
      ], lang: SUPPORTED_LANGUAGES.FRENCH },
    { patterns: [
        /cambiar?\s+(a|al)?\s*italiano/i,
        /habla(r)?\s+italiano/i,
        /italian\s+please/i,
        /parli\s+italiano/i
      ], lang: SUPPORTED_LANGUAGES.ITALIAN },
    { patterns: [
        /cambiar?\s+(a|al)?\s*portugués/i,
        /habla(r)?\s+portugués/i,
        /portuguese\s+please/i,
        /fala\s+português/i,
        /você\s+fala\s+português/i
      ], lang: SUPPORTED_LANGUAGES.PORTUGUESE },
    { patterns: [
        /cambiar?\s+(a|al)?\s*quechua/i,
        /habla(r)?\s+quechua/i,
        /habla(r)?\s+runasimi/i,
        /quechua\s+please/i,
        /runasimi/i
      ], lang: SUPPORTED_LANGUAGES.QUECHUA }
  ];

  for (const { patterns, lang } of naturalCommands) {
    if (patterns.some(pattern => pattern.test(message))) {
      return lang;
    }
  }

  return null;
}

/**
 * 🌐 Obtiene el idioma del usuario considerando:
 * 1. Comando explícito de cambio
 * 2. Idioma preferido guardado
 * 3. Detección automática del mensaje
 * @param {string} message - Mensaje actual
 * @param {string} preferredLanguage - Idioma preferido guardado
 * @returns {object} { language, confidence, name, source }
 */
export function getUserLanguage(message, preferredLanguage = null) {
  // 1. Prioridad máxima: Comando explícito
  const commandLang = detectLanguageCommand(message);
  if (commandLang) {
    return {
      language: commandLang,
      confidence: 1.0,
      name: LANGUAGE_NAMES[commandLang],
      source: 'explicit_command'
    };
  }

  // 2. Detectar idioma del mensaje actual
  const detected = detectLanguage(message, preferredLanguage);

  // 2.1 Cambiar de idioma solo con evidencia clara (varias palabras del otro idioma).
  //     Un "thanks" o "ok" suelto no cambia la conversación.
  const isLanguageSwitch = preferredLanguage && detected.language !== preferredLanguage;
  if (isLanguageSwitch && detected.strong) {
    return {
      ...detected,
      confidence: Math.max(detected.confidence, 0.8),
      source: 'auto_detected_language_switch'
    };
  }

  // 3. Si la confianza es alta (>0.7), usar idioma detectado
  if (detected.confidence > 0.7) {
    return {
      ...detected,
      source: 'auto_detected_high_confidence'
    };
  }

  // 4. Si hay idioma preferido y confianza media, usar preferido
  if (preferredLanguage && detected.confidence < 0.7) {
    return {
      language: preferredLanguage,
      confidence: 0.8,
      name: LANGUAGE_NAMES[preferredLanguage],
      source: 'user_preference'
    };
  }

  // 5. Fallback a detección con confianza baja
  return {
    ...detected,
    source: 'auto_detected_low_confidence'
  };
}

/**
 * 🌐 Traduce un mensaje al idioma solicitado usando OpenAI
 * @param {string} message - Mensaje a traducir
 * @param {string} targetLanguage - Idioma destino ('es', 'en', 'fr', 'it', 'pt')
 * @returns {Promise<string>} Mensaje traducido
 */
export async function translateMessage(message, targetLanguage) {
  try {
    // Antes usaba la API v3 de openai (Configuration/OpenAIApi), que ya no existe
    // en openai v6: fallaba siempre y reenviaba el mensaje sin traducir.
    const { complete } = await import('../servicios-ia/openai.js');

    const languageNames = {
      es: 'Spanish',
      en: 'English',
      fr: 'French',
      it: 'Italian',
      pt: 'Portuguese',
      qu: 'Quechua (Runasimi, Southern Quechua)'
    };

    const targetName = languageNames[targetLanguage] || 'English';

    const translated = await complete(message, {
      system: `You are a professional translator. Translate the following message to ${targetName}. Maintain the tone, emojis, and formatting (including WhatsApp *bold* and line breaks). Keep names, prices, links, codes and phone numbers unchanged. Only return the translation, nothing else.`,
      temperature: 0.3,
      max_tokens: 800
    });

    // complete() devuelve un aviso fijo en español si OpenAI no responde: en ese caso, mensaje original
    if (typeof translated !== 'string' || !translated.trim() || translated.startsWith('Lo siento, estoy experimentando dificultades técnicas')) {
      return message;
    }
    return translated.trim();
  } catch (error) {
    console.error('[TRANSLATE] Error:', error);
    return message; // Si falla, devolver original
  }
}

/**
 * 📝 Genera mensaje de confirmación de cambio de idioma
 * @param {string} newLanguage - Nuevo idioma
 * @returns {string} Mensaje de confirmación en el nuevo idioma
 */
export function getLanguageChangeConfirmation(newLanguage) {
  const confirmations = {
    es: '✅ Perfecto! Ahora te responderé en español 🇪🇸',
    en: '✅ Perfect! I will now respond in English 🇺🇸',
    fr: '✅ Parfait! Je vais maintenant répondre en français 🇫🇷',
    it: '✅ Perfetto! Adesso risponderò in italiano 🇮🇹',
    pt: '✅ Perfeito! Agora vou responder em português 🇵🇹',
    qu: '✅ Allinmi! Kunanqa Runasimillapi kutichisqayki 🇵🇪'
  };

  return confirmations[newLanguage] || confirmations.es;
}

/**
 * 🧪 Función de prueba para verificar detección
 */
export function testLanguageDetection() {
  const testMessages = [
    'Hola, ¿cómo estás?',
    'Hello, how are you?',
    'Allinllachu, imaynallan kashanki?',
    'Quiero hacer una reserva',
    'I want to make a booking',
    'Necesito ayuda',
    'I need help'
  ];

  console.log('🧪 Testing Language Detection:\n');
  
  for (const msg of testMessages) {
    const result = detectLanguage(msg);
    console.log(`Message: "${msg}"`);
    console.log(`Detected: ${result.name} (${result.language}) - Confidence: ${result.confidence}`);
    console.log('---');
  }
}

/**
 * 🗣️ Detecta si el usuario está preguntando qué idiomas habla el agente.
 * Reconoce la pregunta en los 6 idiomas soportados.
 * @param {string} message
 * @returns {boolean}
 */
export function detectLanguageListQuery(message) {
  if (!message || typeof message !== 'string') return false;
  const patterns = [
    // Español
    /qu[eé]\s+idiomas?\s+(puedes?|sabes?|hablas?|manejas?|dominas?)/i,
    /en\s+qu[eé]\s+idiomas?\s+(\w+\s+)?(puedes?|atiendes?|respondes?|hablas?)/i,
    /cu[aá]les?\s+idiomas?\s+(hablas?|manejas?|dominas?|sabes?)/i,
    /hablas?\s+otros?\s+idiomas?/i,
    /qu[eé]\s+lenguas?\s+(hablas?|dominas?|manejas?)/i,
    // English
    /what\s+languages?\s+(do\s+you\s+speak|can\s+you\s+speak|do\s+you\s+know|do\s+you\s+support)/i,
    /which\s+languages?\s+(do\s+you\s+speak|can\s+you\s+speak|do\s+you\s+know)/i,
    /what\s+languages?\s+(are\s+you\s+available|you\s+speak)/i,
    /do\s+you\s+speak\s+other\s+languages?/i,
    /languages?\s+(you\s+speak|available)/i,
    // Français
    /quelles?\s+langues?\s+(parles?-?tu|pouvez-?vous|vous\s+parlez|tu\s+parles)/i,
    /quelles?\s+langues?\s+(sont\s+disponibles?|tu\s+ma[iî]trises?)/i,
    /tu\s+parles?\s+quelles?\s+langues?/i,
    // Italiano
    /quali?\s+lingue\s+(parli|puoi\s+parlare|conosci|hai\s+disponibili)/i,
    /che\s+lingue\s+(parli|conosci|puoi\s+usare)/i,
    /parli\s+altre\s+lingue/i,
    // Português
    /qu(ais|al)\s+(s[ãa]o\s+os\s+)?idiomas?\s+(voc[eê]\s+fala|disponíveis?|suportados?)/i,
    /que\s+idiomas?\s+(voc[eê]\s+fala|você\s+conhece|estão\s+disponíveis?)/i,
    /voc[eê]\s+fala\s+(quais?|outros?)\s+idiomas?/i,
    // Quechua / Runasimi
    /ima\s+simikuna/i,
    /ima\s+rimayta\s+yach/i
  ];
  return patterns.some(p => p.test(message));
}

/**
 * 🌐 Genera la respuesta de lista de idiomas adaptada al idioma actual.
 * @param {string} lang - Idioma actual del usuario (es|en|fr|it|pt|qu)
 * @returns {string}
 */
export function getLanguageListResponse(lang = 'es', agentId = null) {
  // Intro genérico por idioma (fallback si no hay agente)
  const genericIntro = {
    es: '¡Claro! Puedo atenderte en:',
    en: 'Of course! I can assist you in:',
    fr: 'Bien sûr! Je peux vous répondre en:',
    it: 'Certo! Posso assisterti in:',
    pt: 'Claro! Posso atendê-lo(a) em:',
    qu: 'Ariy! Kay simikuanapi rimani:'
  };

  // Intro personalizado por agente — refleja el contexto único de cada uno
  const agentIntros = {
    AURORA: {
      es: '¡Soy el corazón de Coworkia! ✨ Te conecto con todo en:',
      en: "I'm the heart of Coworkia! ✨ I connect you with everything in:",
      fr: "Je suis le cœur de Coworkia! ✨ Je vous connecte avec tout en:",
      it: "Sono il cuore di Coworkia! ✨ Ti connetto con tutto in:",
      pt: "Sou o coração da Coworkia! ✨ Me conecto com tudo em:",
      qu: "Ñuqa kani Coworkia sunqun! ✨ Tukuyta tupachini:"
    },
    ALUNA: {
      es: '¡Cierro membresías sin fronteras! 💼 Me adapto a ti en:',
      en: "I close memberships across borders! 💼 I adapt to you in:",
      fr: "Je conclus des adhésions sans frontières! 💼 Je m'adapte à toi en:",
      it: "Chiudo abbonamenti senza confini! 💼 Mi adatto a te in:",
      pt: "Fecho membresías sem fronteiras! 💼 Me adapto a você em:",
      qu: "Tukuy suyupi miembro ruwaytas wanchini! 💼 Qamwan rimayta atini:"
    },
    ADRIANA: {
      es: 'Corredora con 33 licencias en Latinoamérica 🛡️ Proceso tus pólizas en:',
      en: "Broker with 33 licenses across Latin America 🛡️ I process your policies in:",
      fr: "Courtière avec 33 licences en Amérique Latine 🛡️ Je traite vos polices en:",
      it: "Broker con 33 licenze in America Latina 🛡️ Gestisco le tue polizze in:",
      pt: "Corretora com 33 licenças na América Latina 🛡️ Processo suas apólices em:",
      qu: "33 licenciayuq corredora Latinoamérica-pi 🛡️ Seguroykita kamachikuní:"
    },
    ENZO: {
      es: '¡Llevo proyectos a todo el mundo! 🚀 MarketingLab opera en:',
      en: "I take projects worldwide! 🚀 MarketingLab operates in:",
      fr: "Je porte des projets partout dans le monde! 🚀 MarketingLab opère en:",
      it: "Porto progetti in tutto il mondo! 🚀 MarketingLab opera in:",
      pt: "Levo projetos para o mundo inteiro! 🚀 MarketingLab opera em:",
      qu: "Tukuy pachaman proyectota apani! 🚀 MarketingLab kay simikuanapi:"
    },
    ANGELA: {
      es: 'MedBeneficios está en 19 países 💚 Cuido tu salud en:',
      en: "MedBeneficios is in 19 countries 💚 I take care of your health in:",
      fr: "MedBeneficios est dans 19 pays 💚 Je prends soin de votre santé en:",
      it: "MedBeneficios è in 19 paesi 💚 Mi prendo cura della tua salute in:",
      pt: "MedBeneficios está em 19 países 💚 Cuido da sua saúde em:",
      qu: "MedBeneficios 19 suyupi kashan 💚 Qhali kayniykita qhaway:"
    },
    AXEL: {
      es: '¡Soy experto en reparación de colisiones! 🔧 PaintBull trabaja contigo en:',
      en: "I'm a collision repair expert! 🔧 PaintBull works with you in:",
      fr: "Je suis expert en réparation de carrosserie! 🔧 PaintBull travaille avec vous en:",
      it: "Sono esperto in riparazione di carrozzeria! 🔧 PaintBull lavora con te in:",
      pt: "Sou especialista em reparação de colisões! 🔧 PaintBull trabalha com você em:",
      qu: "Ñuqa kani choque allichaypi yachaqsapa! 🔧 PaintBull qamwan llamkani:"
    },
    GABI: {
      es: '¡El mundo financiero no tiene fronteras! ⚖️ Asesoro tus consultas en:',
      en: "The financial world has no borders! ⚖️ I advise your queries in:",
      fr: "Le monde financier n'a pas de frontières! ⚖️ Je conseille en:",
      it: "Il mondo finanziario non ha frontiere! ⚖️ Consiglio in:",
      pt: "O mundo financeiro não tem fronteiras! ⚖️ Assessoro em:",
      qu: "Financiero pacha mana sayaqchu! ⚖️ Tapuyniykipi yanapani:"
    },
    PAULA: {
      es: '¡Las propiedades no tienen fronteras! 🏡 Asesoro en bienes raíces en:',
      en: "Properties have no borders! 🏡 I advise on real estate in:",
      fr: "L'immobilier n'a pas de frontières! 🏡 Je conseille en immobilier en:",
      it: "Gli immobili non hanno frontiere! 🏡 Consiglio in immobiliare in:",
      pt: "Os imóveis não têm fronteiras! 🏡 Assessoro em imóveis em:",
      qu: "Causay wasikunaqa mana sayaqchu! 🏡 Wasi allinchanaykipi yanapani:"
    }
  };

  const agentIntro = agentId && agentIntros[agentId];
  const header = (agentIntro && agentIntro[lang]) || (agentIntro && agentIntro.es) || genericIntro[lang] || genericIntro.es;
  return `${header}\n\n🇪🇸 Español\n🇬🇧 English\n🇫🇷 Français\n🇮🇹 Italiano\n🇧🇷 Português\n⛰️ Quechua`;
}

export default {
  detectLanguage,
  detectLanguageCommand,
  detectLanguageListQuery,
  getLanguageListResponse,
  getUserLanguage,
  getLanguageChangeConfirmation,
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  testLanguageDetection
};
