import 'dotenv/config';
import OpenAI from 'openai';
import { openaiBreaker } from '../utils/circuit-breaker.js';
import { loggers } from '../utils/logger.js';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  const errorMsg = '[OpenAI] CRÍTICO: Falta OPENAI_API_KEY en .env';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

export const client = new OpenAI({ apiKey });

export async function complete(prompt, opts = {}) {
  const {
    system = null,
    temperature = 0.6,
    max_tokens = 400,
    model = MODEL,
    timeout = 55000, // 🔥 FIX: Timeout de 55s (antes de H12 de Heroku a 30s, dejamos margen)
  } = opts;

  const messages = system
    ? [{ role: 'system', content: system }, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }];
  
  // Debug logs solo en modo desarrollo
  if (process.env.DEBUG_MODE === 'true' && system && system.includes('Aurora')) {
    console.log('[DEBUG] ===== SYSTEM PROMPT =====');
    console.log(system.substring(0, 300));
    console.log('[DEBUG] ===== USER CONTEXT =====');
    console.log(prompt.substring(0, 500));
    console.log('[DEBUG] ========================');
  }

  const startTime = Date.now();

  // 🛡️ Proteger con circuit breaker + timeout
  const fallback = () => {
    loggers.openai.warn('Using fallback response', { action: 'complete', model });
    return 'Lo siento, estoy experimentando dificultades técnicas en este momento. Por favor, intenta de nuevo en unos momentos o contacta directamente a nuestro equipo.';
  };

  return await openaiBreaker.execute(async () => {
    // 🕐 Implementar timeout manual
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('OpenAI timeout')), timeout)
    );
    
    const apiPromise = client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
    });

    // Race entre API call y timeout
    const res = await Promise.race([apiPromise, timeoutPromise]);
    const duration = Date.now() - startTime;
    
    loggers.openai.timing('OpenAI completion', duration, { model, tokens: max_tokens });

    return res.choices?.[0]?.message?.content?.trim() || '';
  }, fallback);
}

/**
 * 👁️ Analiza imagen(es) usando OpenAI Vision API
 * Soporta 1 o múltiples imágenes en una sola llamada
 * @param {string|string[]} imageUrl - URL única o array de URLs
 */
export async function analyzeImage(imageUrl, prompt, opts = {}) {
  const {
    temperature = 0.2,
    max_tokens = 500,
    model = 'gpt-4o', // Modelo con capacidades de visión
    detail = 'high'
  } = opts;

  // 🛡️ Proteger con circuit breaker
  const fallback = () => {
    loggers.openai.warn('Vision API fallback used', { action: 'analyzeImage' });
    return {
      success: false,
      error: 'Servicio temporalmente no disponible. Por favor, intenta de nuevo.',
      content: null
    };
  };

  try {
    const startTime = Date.now();
    
    // Convertir a array si es string único
    const imageUrls = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
    
    // Construir content array con texto + todas las imágenes
    const contentArray = [
      {
        type: "text",
        text: prompt
      }
    ];
    
    // Agregar cada imagen
    for (const url of imageUrls) {
      contentArray.push({
        type: "image_url",
        image_url: {
          url: url,
          detail: detail
        }
      });
    }
    
    return await openaiBreaker.execute(async () => {
      // 🕐 Timeout de 45s para evitar colgar el sistema
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            {
              role: "user",
              content: contentArray
            }
          ],
          temperature,
          max_tokens,
        }, { signal: controller.signal });
        
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Vision API timeout (45s) - intenta con menos fotos');
        }
        throw error;
      }
    }).then(response => {

      const duration = Date.now() - startTime;
      loggers.openai.timing('Vision API analysis', duration, { 
        model, 
        detail, 
        imageCount: imageUrls.length 
      });

      return {
        success: true,
        content: response.choices[0]?.message?.content?.trim() || '',
        usage: response.usage
      };
    });

  } catch (error) {
    loggers.openai.error('Vision API error', { action: 'analyzeImage' }, error);
    return {
      success: false,
      error: error.message,
      content: null
    };
  }
}

/**
 * 📎 Analiza imágenes y/o PDFs (descargados y enviados en base64).
 * A diferencia de analyzeImage, acepta PDFs y no expone la URL/token de Wassenger.
 * @param {string|string[]} urls - URLs (o data URLs) de imágenes o PDFs
 * @param {string} prompt
 * @param {object} opts - { model, max_tokens, temperature, detail, json }
 * @returns {Promise<{success:boolean, content:string|null, kinds?:string[], error?:string}>}
 */
export async function analyzeMedia(urls, prompt, opts = {}) {
  const {
    temperature = 0.1,
    max_tokens = 800,
    model = 'gpt-4o',
    detail = 'high',
    json = false,
  } = opts;

  try {
    const { loadMedia, toOpenAIContentPart } = await import('./media-input.js');
    const list = Array.isArray(urls) ? urls : [urls];
    const medias = await Promise.all(list.map(u => loadMedia(u)));
    const content = [{ type: 'text', text: prompt }, ...medias.map((m, i) => toOpenAIContentPart(m, { detail, filename: `documento-${i + 1}.pdf` }))];

    return await openaiBreaker.execute(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content }],
          temperature,
          max_tokens,
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        }, { signal: controller.signal });
        return {
          success: true,
          content: response.choices[0]?.message?.content?.trim() || '',
          kinds: medias.map(m => m.kind),
          usage: response.usage,
        };
      } catch (error) {
        if (error.name === 'AbortError') throw new Error('Vision API timeout (60s)');
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    });
  } catch (error) {
    loggers.openai.error('Vision API error', { action: 'analyzeMedia' }, error);
    return { success: false, error: error.message, content: null };
  }
}

/**
 * 💳 Analiza comprobante de pago (SISTEMA COMPLETO - 20 PARÁMETROS)
 * 
 * Extrae datos críticos, importantes y adicionales de cualquier comprobante:
 * - Payphone (Ecuador)
 * - Transferencias bancarias
 * - Tarjetas de crédito/débito
 * - PayPal
 * 
 * @param {string} imageUrl - URL de la imagen del comprobante
 * @returns {Promise<Object>} Objeto con success, data (20 parámetros), rawResponse, usage
 */
// 🆕 v522: Sistema completo con 20 parámetros de extracción
export async function analyzePaymentReceipt(imageUrl) {
  const prompt = `Analiza este comprobante de pago y extrae TODOS los parámetros posibles en formato JSON.

ESTRUCTURA JSON COMPLETA (devuelve TODOS los campos, usa null si no encuentras el dato):

{
  // === PARÁMETROS CRÍTICOS (OBLIGATORIOS) ===
  "transactionNumber": "número de transacción/referencia principal",
  "amount": número decimal (ej: 12.08),
  "currency": "USD" o moneda,
  "transactionDate": "YYYY-MM-DD",
  "transactionTime": "HH:MM:SS",
  "paymentMethod": "payphone|transferencia_interbancaria|transferencia_mismo_banco|deposito_efectivo|tarjeta_credito|tarjeta_debito|paypal|otro",
  "transactionStatus": "approved|pending|rejected|cancelled",
  
  // === PARÁMETROS IMPORTANTES ===
  "bankSender": "nombre del banco emisor",
  "bankReceiver": "nombre del banco receptor",
  "accountNumberDestination": "número de cuenta destino (limpio, sin guiones)",
  "accountNumberSource": "número de cuenta origen (puede estar parcial: ****1234)",
  "accountHolderSource": "nombre del pagador en MAYÚSCULAS",
  "authorizationNumber": "código de autorización (ej: W70613140 para Payphone)",
  "receiptNumber": "número de comprobante visible",
  
  // === PARÁMETROS ADICIONALES ===
  "transactionDescription": "concepto/descripción del pago",
  "paymentChannel": "web|mobile_app|physical_pos|atm|branch",
  "cardType": "visa|mastercard|diners|amex|alia|null",
  "cardLastFour": "últimos 4 dígitos de tarjeta o null",
  "transactionFee": número decimal de comisión o 0,
  
  // === VALIDACIÓN ===
  "isValid": true o false (si el pago está aprobado y completo),
  "confidence": número 0-100 (tu confianza en la extracción)
}

═══════════════════════════════════════════════════════════
FORMATOS DE COMPROBANTES RECONOCIDOS:
═══════════════════════════════════════════════════════════

1️⃣ PAYPHONE (Ecuador) - FORMATO OFICIAL ppls.me:
   CARACTERÍSTICAS: Logo "payphone", "Aprobada" verde, "PAGO APROBADO"
   EXTRAE: No. Transacción (8 dígitos), No. Autorización (W+número), Persona, Fecha DD/MM/YYYY
   PARÁMETROS: paymentMethod="payphone", bankSender="Payphone", transactionStatus="approved"

2️⃣ TRANSFERENCIAS BANCARIAS: 
   
   📱 BANCO PICHINCHA - App Móvil:
   TÍTULO: "¡Transferencia exitosa!" (checkmark verde)
   CAMPOS CLAVE:
   • "Monto": valor en dólares
   • "Comprobante": número de 8 dígitos (ej: 36481686)
   • "Cuenta origen": nombre + número (ej: Zapata Soria Francisco - 5068678700)
   • "Cuenta destino": nombre + número parcial (ej: Villota Izurieta Gonzalo - ****3069)
   • "Concepto": descripción (buscar "Garantía Coworkia", "Coworkia", "plan", "reserva")
   • "Email": email del pagador
   EXTRAE: transactionNumber=Comprobante, accountHolderSource=nombre origen
   PARÁMETROS: paymentMethod="transferencia_interbancaria", bankSender="Banco Pichincha"
   
   🏦 OTROS BANCOS: Guayaquil, Produbanco, Bolivariano, Pacífico
   EXTRAE: Cuentas origen/destino, referencia, banco emisor/receptor
   PARÁMETROS: paymentMethod="transferencia_interbancaria", bankSender y bankReceiver

3️⃣ TARJETAS: Visa, Mastercard, Diners, AmEx
   EXTRAE: Últimos 4 dígitos, código autorización, tipo tarjeta
   PARÁMETROS: paymentMethod="tarjeta_credito", cardType, cardLastFour

REGLAS: 
- Fechas a YYYY-MM-DD
- Limpiar números de cuenta (sin guiones)
- Nombres en MAYÚSCULAS
- null si no encuentras
- isValid=true solo si approved y monto visible

Responde SOLO con el JSON.`;

  const result = await analyzeImage(imageUrl, prompt, {
    temperature: 0.1,
    max_tokens: 600,
    detail: 'high'
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      data: null
    };
  }

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No se encontró JSON válido en la respuesta');
    }

    const paymentData = JSON.parse(jsonMatch[0]);
    
    // Normalizar datos
    const normalizedData = {
      transactionNumber: paymentData.transactionNumber,
      amount: parseFloat(paymentData.amount) || null,
      currency: paymentData.currency || 'USD',
      transactionDate: paymentData.transactionDate,
      transactionTime: paymentData.transactionTime,
      paymentMethod: paymentData.paymentMethod,
      transactionStatus: paymentData.transactionStatus,
      bankSender: paymentData.bankSender,
      bankReceiver: paymentData.bankReceiver,
      accountNumberDestination: paymentData.accountNumberDestination,
      accountNumberSource: paymentData.accountNumberSource,
      accountHolderSource: paymentData.accountHolderSource,
      authorizationNumber: paymentData.authorizationNumber,
      receiptNumber: paymentData.receiptNumber,
      transactionDescription: paymentData.transactionDescription,
      paymentChannel: paymentData.paymentChannel,
      cardType: paymentData.cardType,
      cardLastFour: paymentData.cardLastFour,
      transactionFee: parseFloat(paymentData.transactionFee) || 0,
      isValid: paymentData.isValid || false,
      confidence: parseInt(paymentData.confidence) || 0,
      // Legacy compatibility
      date: paymentData.transactionDate,
      time: paymentData.transactionTime,
      bank: paymentData.bankSender
    };
    
    return {
      success: true,
      data: normalizedData,
      rawResponse: result.content,
      usage: result.usage
    };

  } catch (parseError) {
    console.error('[OpenAI Vision] Error parsing JSON:', parseError);
    return {
      success: false,
      error: `Error parsing response: ${parseError.message}`,
      data: null,
      rawResponse: result.content
    };
  }
}

/**
 * 🎤 Transcribe audio usando Whisper (MULTIIDIOMA)
 * @param {string} audioUrl - URL del archivo de audio
 * @param {Object} options - Opciones de transcripción
 * @param {string} options.language - Código ISO de idioma (es, en, fr, it, pt, qu)
 * @param {string} options.agentName - Nombre del agente para contexto
 * @param {string} options.userName - Nombre del usuario
 * @returns {Promise<{success: boolean, text: string, language?: string, error?: string}>}
 */
export async function transcribeAudio(audioUrl, options = {}) {
  const {
    language = 'es',
    agentName = 'desconocido',
    userName = 'usuario'
  } = options;

  try {
    console.log('[Whisper] 🎤 Transcribiendo audio...');
    console.log('[Whisper] URL:', audioUrl);
    console.log('[Whisper] Idioma:', language);
    console.log('[Whisper] Agente:', agentName);
    console.log('[Whisper] Usuario:', userName);

    // Quechua no tiene soporte nativo en Whisper — null = auto-detect nativo (mejor precisión)
    const supportedLanguages = ['es', 'en', 'fr', 'it', 'pt']; // 'qu' excluido intencionalmente
    const whisperLanguage = supportedLanguages.includes(language) ? language : null;
    
    if (!whisperLanguage) {
      console.warn(`[Whisper] ⚠️ Idioma '${language}' no soportado en Whisper — usando auto-detect nativo`);
    }

    // Descargar audio con retry y timeout (Wassenger puede tardar)
    console.log('[Whisper] 🌐 Descargando audio desde Wassenger...');
    
    const headers = {
      'User-Agent': 'coworkia-agent/1.0',
      'Accept': 'audio/*,*/*'
    };
    
    if (audioUrl.includes('api.wassenger.com')) {
      const wassengerApiKey = process.env.WASSENGER_API_KEY;
      if (wassengerApiKey) {
        headers['Authorization'] = `Bearer ${wassengerApiKey}`;
        console.log('[Whisper] 🔐 Token de autorización agregado');
      } else {
        console.warn('[Whisper] ⚠️ WASSENGER_API_KEY no configurado');
      }
      
      // Dar tiempo a Wassenger para cachear archivo desde WhatsApp
      console.log('[Whisper] ⏳ Esperando 3s para que Wassenger procese el archivo...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Un solo intento con timeout corto (Wassenger o funciona rápido, o falla)
    let response;
    let lastError;
    
    try {
      console.log('[Whisper] 📥 Descargando audio (timeout: 45s)');
      
      // Timeout de 45 segundos - archivos grandes en Wassenger CDN pueden tardar
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      
      response = await fetch(audioUrl, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Sin detalles');
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        console.warn('[Whisper] ⚠️ Descarga falló:', {
          status: response.status,
          body: errorBody.substring(0, 200)
        });
      } else {
        console.log('[Whisper] ✅ Audio descargado exitosamente');
      }
      
    } catch (error) {
      lastError = error;
      console.warn('[Whisper] ⚠️ Error en descarga:', error.message);
    }
    
    // Si falló, activar fallback inmediatamente
    if (!response || !response.ok) {
      console.error('[Whisper] ❌ Descarga falló - activando fallback');
      throw lastError || new Error('Download failed');
    }
    
    // Obtener el buffer del audio
    const audioBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(audioBuffer);
    
    const audioSizeKB = (buffer.byteLength / 1024).toFixed(2);
    console.log('[Whisper] Tamaño del audio:', audioSizeKB, 'KB');

    // Crear File object con nombre (requerido por OpenAI SDK en Node.js)
    const audioFile = await OpenAI.toFile(buffer, 'audio.ogg', {
      type: 'audio/ogg'
    });

    // Transcribir con Whisper (multiidioma)
    // Si whisperLanguage es null (ej: 'qu'), omitir language → Whisper auto-detect
    const transcribeParams = { file: audioFile, model: 'whisper-1', response_format: 'text' };
    if (whisperLanguage) transcribeParams.language = whisperLanguage;
    const transcription = await client.audio.transcriptions.create(transcribeParams);

    const preview = transcription.length > 100 
      ? transcription.substring(0, 100) + '...' 
      : transcription;
    
    console.log('[Whisper] ✅ Transcripción exitosa:', preview);
    console.log('[Whisper] Idioma usado:', whisperLanguage || `auto-detect (pedido: ${language})`);

    return {
      success: true,
      text: transcription,
      language: whisperLanguage || language
    };

  } catch (error) {
    console.error('[Whisper] ❌ Error transcribiendo:', error);
    console.error('[Whisper] Usuario:', userName);
    console.error('[Whisper] Agente:', agentName);
    console.error('[Whisper] Idioma:', language);
    
    return {
      success: false,
      text: '',
      error: error.message,
      language
    };
  }
}

/**
 * 🚗 Analiza imagen de vehículo dañado para cotización de enderezada/pintura
 * Identifica daños visibles, evalúa calidad de imagen y genera estructura para cotización
 */
export async function analyzeVehicleDamage(imageUrl, opts = {}) {
  const {
    temperature = 0.2,
    max_tokens = 800,
    model = 'gpt-4o'
  } = opts;

  const prompt = `Eres un experto técnico en análisis de daños automotrices con 15 años de experiencia en enderezada y pintura.

Analiza esta imagen de vehículo y proporciona un análisis técnico estructurado en formato JSON:

{
  "imageQuality": {
    "isAcceptable": true/false,
    "score": 0-10,
    "issues": ["lista de problemas: borrosa, oscura, ángulo malo, muy lejana, etc"],
    "recommendation": "qué mejorar si la calidad es mala"
  },
  "vehicleInfo": {
    "type": "tipo de vehículo (sedán, SUV, camioneta, etc)",
    "color": "color aproximado",
    "visibleParts": ["partes visibles en la foto"]
  },
  "damageAnalysis": {
    "visibleDamages": [
      {
        "part": "nombre de pieza (puerta, capó, parachoques, etc)",
        "damageType": "tipo (abolladura, rayón, rotura, deformación)",
        "severity": "leve/moderada/severa",
        "approximateArea": "área afectada en cm o descripción",
        "description": "descripción técnica detallada del daño",
        "paintAffected": true/false
      }
    ],
    "hiddenDamageRisks": [
      {
        "area": "zona donde puede haber daño oculto",
        "risk": "tipo de daño potencial",
        "reason": "por qué existe este riesgo"
      }
    ]
  },
  "estimationFactors": {
    "complexity": "simple/moderada/compleja",
    "requiresDisassembly": true/false,
    "structuralConcerns": true/false,
    "electricalRisk": true/false,
    "specialPaintType": "estándar/metalizado/perlado/mate"
  },
  "recommendations": {
    "needsPhysicalInspection": true/false,
    "additionalPhotosNeeded": ["qué fotos adicionales se necesitan"],
    "urgencyLevel": "bajo/medio/alto"
  },
  "technicalNotes": "observaciones técnicas adicionales importantes"
}

REGLAS CRÍTICAS:
1. Si la imagen es borrosa, oscura o de mala calidad: marca imageQuality.isAcceptable = false
2. Solo identifica daños CLARAMENTE VISIBLES en la foto
3. Para daños cerca de estructura/motor/chasis: marcar structuralConcerns = true
4. Si no puedes ver bien el alcance del daño: incluir en hiddenDamageRisks
5. Sé conservador en el análisis - mejor subestimar que sobreestimar
6. Si la foto no muestra un vehículo dañado: indicarlo claramente

Analiza la imagen ahora:`;

  try {
    const result = await analyzeImage(imageUrl, prompt, { temperature, max_tokens, model, detail: 'high' });
    
    if (!result.success) {
      return {
        success: false,
        error: result.error,
        analysis: null
      };
    }

    // Intentar parsear el JSON de la respuesta
    let analysis = null;
    try {
      // Extraer JSON de la respuesta (puede venir con texto adicional)
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        // Si no hay JSON, devolver el contenido como texto
        analysis = { rawResponse: result.content };
      }
    } catch (parseError) {
      console.warn('[Vehicle Analysis] No se pudo parsear JSON, usando respuesta raw');
      analysis = { rawResponse: result.content };
    }

    return {
      success: true,
      analysis,
      rawContent: result.content,
      usage: result.usage
    };

  } catch (error) {
    console.error('[Vehicle Analysis] Error:', error);
    return {
      success: false,
      error: error.message,
      analysis: null
    };
  }
}

/**
 * 🔊 Genera audio speech desde texto usando OpenAI TTS
 * @param {string} text - Texto a convertir en audio
 * @param {object} opts - Opciones { voice, language, speed, format }
 * @returns {Promise<{success: boolean, buffer?: Buffer, error?: string, metadata?: object}>}
 */
export async function generateSpeech(text, opts = {}) {
  const {
    language = 'es',
    speed = 1.0,
    format = 'mp3',
    model = 'tts-1' // tts-1 o tts-1-hd (más calidad)
  } = opts;

  // 🎤 Mapeo idioma → voz OpenAI
  const VOICE_MAP = {
    es: 'alloy',   // Neutral, clara, profesional
    en: 'nova',    // Femenina, cálida, amable
    fr: 'shimmer', // Cálida, expresiva
    it: 'alloy',   // Neutral para italiano
    pt: 'alloy',   // Neutral para portugués
    qu: 'alloy'    // Neutral para quechua
  };

  const voice = opts.voice || VOICE_MAP[language] || 'alloy';

  // ⚠️ Validaciones
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: 'Texto vacío o inválido'
    };
  }

  if (text.length > 4096) {
    loggers.openai.warn('Text too long for TTS, truncating', { length: text.length });
    text = text.substring(0, 4096);
  }

  console.log(`[TTS] 🔊 Generando audio...`);
  console.log(`[TTS] Texto:`, text.substring(0, 100));
  console.log(`[TTS] Idioma: ${language}, Voz: ${voice}`);

  const startTime = Date.now();

  // 🛡️ Protección con circuit breaker
  const fallback = () => {
    loggers.openai.warn('TTS fallback triggered', { action: 'generateSpeech', language, voice });
    return { success: false, error: 'TTS service unavailable' };
  };

  try {
    return await openaiBreaker.execute(async () => {
      // 🕐 Timeout (TTS puede tardar en textos largos)
      const timeoutMs = 30000; // 30 segundos
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TTS timeout')), timeoutMs)
      );

      const ttsPromise = client.audio.speech.create({
        model,
        voice,
        input: text,
        speed,
        response_format: format
      });

      const response = await Promise.race([ttsPromise, timeoutPromise]);

      // Convertir stream a buffer
      const buffer = Buffer.from(await response.arrayBuffer());

      const duration = Date.now() - startTime;
      console.log(`[TTS] ✅ Audio generado en ${duration}ms (${buffer.length} bytes)`);

      loggers.openai.info('TTS generated successfully', {
        action: 'generateSpeech',
        language,
        voice,
        textLength: text.length,
        audioSize: buffer.length,
        duration
      });

      return {
        success: true,
        buffer,
        metadata: {
          voice,
          language,
          model,
          format,
          textLength: text.length,
          audioSize: buffer.length,
          duration
        }
      };
    }, fallback);

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[TTS] ❌ Error generando audio (${duration}ms):`, error.message);

    loggers.openai.error('TTS generation failed', {
      action: 'generateSpeech',
      language,
      voice,
      textLength: text.length,
      duration
    }, error);

    return {
      success: false,
      error: error.message
    };
  }
}

