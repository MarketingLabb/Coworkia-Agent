/**
 * 🛡️ adriana-document-analyzer.js
 * 
 * Servicio especializado para análisis multi-documento con Vision AI.
 * Soporta 3 tipos de documentos ecuatorianos:
 * - Cédula de identidad (10 dígitos)
 * - Matrícula vehicular (placa + datos técnicos)
 * - Licencia de conducir (tipo, categoría, vigencia)
 * 
 * Arquitectura:
 * 1. detectDocumentType() → clasificador rápido
 * 2. extract{Cedula|Matricula|Licencia}() → extractores especializados
 * 3. analyzeDocument() → orquestador principal
 */

import { analyzeMedia } from '../servicios-ia/openai.js';
import { loggers } from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// PROMPTS ESPECIALIZADOS VISION AI
// ═══════════════════════════════════════════════════════════════════════════

const PROMPT_DETECT_TYPE = `Eres un clasificador de documentos ecuatorianos. Analiza este documento (foto o PDF) y determina QUÉ TIPO de documento es.

Responde SOLO con UNA palabra:

"cedula" si es cédula de identidad ecuatoriana (documento azul/verde con foto y 10 dígitos)
"matricula" si es matrícula vehicular o certificado de matrícula (documento con placa, marca/modelo de vehículo)
"licencia" si es licencia de conducir (documento con categorías A/B/C/D/E)
"otro" si no reconoces el documento

Responde SOLO la palabra, sin explicaciones.`;

const PROMPT_CEDULA = `Eres un sistema de extracción de datos de cédulas ecuatorianas.

Analiza esta cédula y extrae EXACTAMENTE estos datos en formato JSON:

{
  "nombres": "nombre completo del titular",
  "cedula": "número de cédula (10 dígitos)",
  "edad": número entero,
  "provincia": "provincia de residencia",
  "fechaNacimiento": "YYYY-MM-DD"
}

IMPORTANTE:
- Si algún dato no es visible o legible, usa null
- La cédula debe tener exactamente 10 dígitos
- La edad debe calcularse a partir de la fecha de nacimiento
- Responde SOLO con el JSON, sin texto adicional`;

const PROMPT_MATRICULA = `Eres un sistema de extracción de matrículas vehiculares ecuatorianas.

Analiza esta matrícula y extrae EXACTAMENTE estos datos en formato JSON:

{
  "placa": "AAA-1234",
  "marca": "TOYOTA",
  "modelo": "COROLLA",
  "anio": 2020,
  "motor": "número de motor",
  "chasis": "número de chasis",
  "cilindraje": 1800,
  "tipo": "LIVIANO",
  "clase": "AUTOMOVIL",
  "servicio": "PARTICULAR",
  "propietario": "nombre si aparece",
  "valorComercial": número o null
}

IMPORTANTE:
- Si algún dato no es visible, usa null
- Marca y modelo en MAYÚSCULAS
- Placa formato ecuatoriano (3 letras + 4 números o similar)
- Tipo: "LIVIANO" para autos/camionetas, "PESADO" para camiones/buses
- Responde SOLO con el JSON, sin texto adicional`;

const PROMPT_LICENCIA = `Eres un sistema de extracción de licencias de conducir ecuatorianas.

Analiza esta licencia y extrae EXACTAMENTE estos datos en formato JSON:

{
  "nombres": "nombre completo del titular",
  "cedula": "número de cédula (10 dígitos)",
  "tipoLicencia": "B",
  "categoria": "descripción de categoría",
  "vigenciaDesde": "YYYY-MM-DD",
  "vigenciaHasta": "YYYY-MM-DD",
  "restricciones": "restricciones si aparecen o null",
  "donante": true/false,
  "vencida": false
}

IMPORTANTE:
- Tipo común: A (motos), B (autos livianos), C (vehículos pesados), D (transporte), E (maquinaria)
- vencida: true si vigenciaHasta < fecha actual
- Si algún dato no es visible, usa null
- Responde SOLO con el JSON, sin texto adicional`;

// ═══════════════════════════════════════════════════════════════════════════
// DETECTORES DE TIPO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detecta qué tipo de documento es mediante pre-análisis rápido
 * @param {string} imageUrl - Base64 data URL o URL pública
 * @returns {Promise<'cedula'|'matricula'|'licencia'|'otro'>}
 */
export async function detectDocumentType(imageUrl) {
  try {
    loggers.adriana.info('Detectando tipo de documento...');

    const response = await analyzeMedia(imageUrl, PROMPT_DETECT_TYPE, {
      model: 'gpt-4o',
      max_tokens: 10,
      temperature: 0.1,
      detail: 'low'
    });
    if (!response.success) throw new Error(response.error || 'Vision AI no respondió');

    // Antes leía response.choices[...] pero analyzeImage devuelve { content }: fallaba SIEMPRE
    const detectedType = String(response.content || '').trim().toLowerCase().replace(/[^a-záéíóú]/g, '').replace('cédula', 'cedula').replace('matrícula', 'matricula');

    if (!['cedula', 'matricula', 'licencia', 'otro'].includes(detectedType)) {
      loggers.adriana.warn('Tipo detectado no reconocido', { detectedType });
      return 'otro';
    }

    loggers.adriana.info('Tipo detectado', { type: detectedType });
    return detectedType;
  } catch (error) {
    loggers.adriana.error('Error detectando tipo de documento', {}, error);
    throw new Error(`No se pudo detectar el tipo de documento: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTORES ESPECIALIZADOS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrae datos de cédula ecuatoriana
 * @param {string} imageUrl
 * @returns {Promise<{nombres, cedula, edad, provincia, fechaNacimiento}>}
 */
export async function extractCedula(imageUrl) {
  try {
    loggers.adriana.info('Extrayendo datos de cédula...');

    const response = await analyzeMedia(imageUrl, PROMPT_CEDULA, {
      model: 'gpt-4o',
      max_tokens: 300,
      temperature: 0.1,
      json: true
    });

    const data = parseVisionResponse(response);

    // Validaciones cédula
    const validations = validateCedula(data);
    if (!validations.valid) {
      throw new Error(validations.errors.join(', '));
    }

    loggers.adriana.info('Cédula extraída exitosamente', {
      cedula: data.cedula,
      provincia: data.provincia
    });

    return data;
  } catch (error) {
    loggers.adriana.error('Error extrayendo cédula', {}, error);
    throw new Error(`No se pudo extraer la cédula: ${error.message}`);
  }
}

/**
 * Extrae datos de matrícula vehicular
 * @param {string} imageUrl
 * @returns {Promise<{placa, marca, modelo, anio, motor, chasis, cilindraje, tipo, clase, servicio, propietario, valorComercial}>}
 */
export async function extractMatricula(imageUrl) {
  try {
    loggers.adriana.info('Extrayendo datos de matrícula...');

    const response = await analyzeMedia(imageUrl, PROMPT_MATRICULA, {
      model: 'gpt-4o',
      max_tokens: 500,
      temperature: 0.1,
      json: true
    });

    const data = parseVisionResponse(response);

    // Validaciones matrícula
    const validations = validateMatricula(data);
    if (!validations.valid) {
      throw new Error(validations.errors.join(', '));
    }

    loggers.adriana.info('Matrícula extraída exitosamente', {
      placa: data.placa,
      vehiculo: `${data.marca} ${data.modelo} ${data.anio}`
    });

    return data;
  } catch (error) {
    loggers.adriana.error('Error extrayendo matrícula', {}, error);
    throw new Error(`No se pudo extraer la matrícula: ${error.message}`);
  }
}

/**
 * Extrae datos de licencia de conducir
 * @param {string} imageUrl
 * @returns {Promise<{nombres, cedula, tipoLicencia, categoria, vigenciaDesde, vigenciaHasta, restricciones, donante, vencida}>}
 */
export async function extractLicencia(imageUrl) {
  try {
    loggers.adriana.info('Extrayendo datos de licencia...');

    const response = await analyzeMedia(imageUrl, PROMPT_LICENCIA, {
      model: 'gpt-4o',
      max_tokens: 400,
      temperature: 0.1,
      json: true
    });

    const data = parseVisionResponse(response);

    // Calcular si está vencida
    if (data.vigenciaHasta) {
      const vigencia = new Date(data.vigenciaHasta);
      const ahora = new Date();
      data.vencida = vigencia < ahora;
    }

    // Validaciones licencia
    const validations = validateLicencia(data);
    if (!validations.valid) {
      // Para licencia, solo loggeamos warnings, no bloqueamos
      loggers.adriana.warn('Advertencias en licencia', { warnings: validations.errors });
    }

    loggers.adriana.info('Licencia extraída exitosamente', {
      cedula: data.cedula,
      tipo: data.tipoLicencia,
      vencida: data.vencida
    });

    return data;
  } catch (error) {
    loggers.adriana.error('Error extrayendo licencia', {}, error);
    throw new Error(`No se pudo extraer la licencia: ${error.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ORQUESTADOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analiza un documento automáticamente
 * @param {string} imageUrl - Base64 data URL o URL pública
 * @param {string} [expectedType] - Tipo esperado (opcional, para validación)
 * @returns {Promise<{success, documentType, data, confidence, validations}>}
 */
export async function analyzeDocument(imageUrl, expectedType = null) {
  try {
    // Paso 1: Detectar tipo de documento
    const detectedType = await detectDocumentType(imageUrl);

    if (detectedType === 'otro') {
      return {
        success: false,
        documentType: 'otro',
        data: null,
        confidence: 0,
        validations: {
          valid: false,
          errors: ['Documento no reconocido. Por favor, envía una cédula, matrícula o licencia de conducir ecuatoriana.']
        }
      };
    }

    // Paso 2: Si se especificó tipo esperado, validar coincidencia
    if (expectedType && expectedType !== detectedType) {
      loggers.adriana.warn('Tipo detectado no coincide con esperado', {
        expected: expectedType,
        detected: detectedType
      });
      // Continuamos con el tipo detectado (Vision AI tiene más contexto)
    }

   // Paso 3: Extraer datos según tipo
    let extractedData;
    let validations;

    switch (detectedType) {
      case 'cedula':
        extractedData = await extractCedula(imageUrl);
        validations = validateCedula(extractedData);
        break;

      case 'matricula':
        extractedData = await extractMatricula(imageUrl);
        validations = validateMatricula(extractedData);
        break;

      case 'licencia':
        extractedData = await extractLicencia(imageUrl);
        validations = validateLicencia(extractedData);
        break;

      default:
        throw new Error(`Tipo de documento no soportado: ${detectedType}`);
    }

    // Paso 4: Calcular confidence score (basado en completitud de datos)
    const confidence = calculateConfidence(extractedData, detectedType);

    return {
      success: true,
      documentType: detectedType,
      data: extractedData,
      confidence,
      validations
    };
  } catch (error) {
    loggers.adriana.error('Error analizando documento', {}, error);
    return {
      success: false,
      documentType: 'unknown',
      data: null,
      confidence: 0,
      validations: {
        valid: false,
        errors: [error.message]
      }
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES INTERNAS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parsea respuesta de Vision AI (extrae JSON limpio)
 */
function parseVisionResponse(response) {
  try {
    if (response && response.success === false) throw new Error(response.error || 'Vision AI no respondió');
    // analyzeMedia/analyzeImage devuelven { content }; se acepta también el formato crudo de OpenAI
    const content = response?.content ?? response?.choices?.[0]?.message?.content ?? '';
    
    // Extraer JSON si viene dentro de ```json ... ``` o ``` ... ```
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                     content.match(/```\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;
    
    return JSON.parse(jsonStr.trim());
  } catch (error) {
    throw new Error(`No se pudo parsear la respuesta de Vision AI: ${error.message}`);
  }
}

/**
 * Valida datos de cédula
 */
function validateCedula(data) {
  const errors = [];

  if (data.cedula) data.cedula = String(data.cedula).replace(/\D/g, '');
  if (!data.cedula || !/^\d{10}$/.test(data.cedula)) {
    errors.push('Cédula debe tener exactamente 10 dígitos');
  } else if (!isValidEcuadorianCedula(data.cedula)) {
    errors.push('El número de cédula no es válido (dígito verificador). Envía una foto más nítida');
  }

  if (!data.nombres || data.nombres.length < 3) {
    errors.push('Nombre no válido o no legible');
  }
  // La provincia no siempre aparece en la cédula nueva: no bloquea

  if (data.edad && (data.edad < 18 || data.edad > 100)) {
    errors.push('Edad fuera de rango válido (18-100)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida datos de matrícula
 */
function validateMatricula(data) {
  const errors = [];
  if (data.placa) data.placa = String(data.placa).toUpperCase().replace(/\s+/g, '').replace(/^([A-Z]{3})(\d{3,4})$/, '$1-$2');
  if (data.anio) data.anio = parseInt(data.anio, 10) || data.anio;

  if (!data.placa || data.placa.length < 6) {
    errors.push('Placa no válida o no legible');
  }

  if (!data.marca || data.marca.length < 2) {
    errors.push('Marca no detectada');
  }

  if (!data.modelo || data.modelo.length < 2) {
    errors.push('Modelo no detectado');
  }

  const currentYear = new Date().getFullYear();
  if (!data.anio || data.anio < 1990 || data.anio > currentYear + 1) {
    errors.push(`Año debe estar entre 1990 y ${currentYear + 1}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida datos de licencia (warnings, no bloqueantes)
 */
function validateLicencia(data) {
  const errors = [];

  if (!data.tipoLicencia || !['A', 'B', 'C', 'D', 'E'].includes(data.tipoLicencia)) {
    errors.push('Tipo de licencia no válido (debe ser A, B, C, D o E)');
  }

  if (data.vencida) {
    errors.push('La licencia está vencida, necesita renovación');
  }

  if (data.tipoLicencia === 'A') {
    errors.push('Licencia tipo A (motos) no es válida para seguros de vehículos livianos');
  }

  if (!data.cedula || !/^\d{10}$/.test(data.cedula)) {
    errors.push('Cédula en licencia no válida');
  }

  return {
    valid: errors.length === 0,
    errors,
    isWarning: true // Licencia siempre devuelve warnings, no bloquea
  };
}

/**
 * Calcula confidence score basado en completitud de datos
 */
function calculateConfidence(data, documentType) {
  if (!data) return 0;

  let score = 1.0;
  let requiredFields = [];
  let optionalFields = [];

  switch (documentType) {
    case 'cedula':
      requiredFields = ['nombres', 'cedula', 'edad', 'provincia'];
      optionalFields = ['fechaNacimiento'];
      break;

    case 'matricula':
      requiredFields = ['placa', 'marca', 'modelo', 'anio'];
      optionalFields = ['motor', 'chasis', 'cilindraje', 'tipo', 'clase', 'servicio', 'propietario', 'valorComercial'];
      break;

    case 'licencia':
      requiredFields = ['nombres', 'cedula', 'tipoLicencia', 'vigenciaHasta'];
      optionalFields = ['categoria', 'vigenciaDesde', 'restricciones', 'donante'];
      break;
  }

  // Penalizar por campos requeridos faltantes
  for (const field of requiredFields) {
    if (!data[field] || data[field] === null) {
      score -= 0.15;
    }
  }

  // Bonificar por campos opcionales presentes
  let optionalPresent = 0;
  for (const field of optionalFields) {
    if (data[field] && data[field] !== null) {
      optionalPresent++;
    }
  }
  score += (optionalPresent / optionalFields.length) * 0.1;

  return Math.max(0, Math.min(1, score)).toFixed(2);
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS LOGIC — RISK SCORING & VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎯 Calcula score de riesgo para cotización de seguros
 * 
 * Factores:
 * - Edad conductor: < 25 o > 60 = mayor riesgo
 * - Antigüedad vehículo: > 15 años = mayor riesgo
 * - Licencia vencida: riesgo crítico
 * - Licencia categoría insuficiente: riesgo alto
 * 
 * @param {Object} cedulaData - Datos de cédula (nombres, cedula, edad)
 * @param {Object} matriculaData - Datos de matrícula (marca, modelo, anio, placa)
 * @param {Object} [licenciaData] - Datos de licencia (opcional)
 * @returns {Object} { score (0-100), factors, alerts }
 */
export function calculateRiskScore(cedulaData, matriculaData, licenciaData = null) {
  let score = 100; // Empezar en 100 (mejor score) y restar por riesgos
  const factors = [];
  const alerts = [];
  
  // ═══════════════════════════════════════════════════════════════════════
  // FACTOR 1: Edad del conductor
  // ═══════════════════════════════════════════════════════════════════════
  if (cedulaData.edad) {
    if (cedulaData.edad < 25) {
      const penalty = 25 - cedulaData.edad; // Más joven = más penalización
      score -= penalty;
      factors.push(`Conductor joven (${cedulaData.edad} años): -${penalty} puntos`);
      alerts.push({
        type: 'warning',
        message: `Conductor menor de 25 años. Prima puede ser más alta.`,
        severity: 'medium'
      });
    } else if (cedulaData.edad > 60) {
      const penalty = Math.min(15, (cedulaData.edad - 60) * 2); // Max 15 puntos
      score -= penalty;
      factors.push(`Conductor senior (${cedulaData.edad} años): -${penalty} puntos`);
      alerts.push({
        type: 'info',
        message: `Conductor mayor de 60 años. Validar estado de salud.`,
        severity: 'low'
      });
    } else {
      factors.push(`Edad del conductor (${cedulaData.edad} años): OK ✅`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // FACTOR 2: Antigüedad del vehículo
  // ═══════════════════════════════════════════════════════════════════════
  if (matriculaData.anio) {
    const currentYear = new Date().getFullYear();
    const vehicleAge = currentYear - matriculaData.anio;
    
    if (vehicleAge > 15) {
      const penalty = Math.min(20, vehicleAge - 15); // Max 20 puntos
      score -= penalty;
      factors.push(`Vehículo antiguo (${vehicleAge} años): -${penalty} puntos`);
      alerts.push({
        type: 'warning',
        message: `Vehículo de ${vehicleAge} años. Coberturas limitadas disponibles.`,
        severity: 'medium'
      });
    } else if (vehicleAge > 10) {
      score -= 10;
      factors.push(`Vehículo seminuevo (${vehicleAge} años): -10 puntos`);
    } else {
      factors.push(`Antigüedad vehículo (${vehicleAge} años): OK ✅`);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // FACTOR 3: Licencia de conducir (si está presente)
  // ═══════════════════════════════════════════════════════════════════════
  if (licenciaData) {
    // 3.1 Licencia vencida
    if (licenciaData.vencida) {
      score -= 40; // Penalización crítica
      factors.push(`Licencia vencida: -40 puntos ⚠️`);
      alerts.push({
        type: 'error',
        message: `⛔ BLOQUEANTE: Licencia vencida. Debe renovarse antes de contratar seguro.`,
        severity: 'critical',
        blocking: true
      });
    } else {
      factors.push(`Licencia vigente: OK ✅`);
    }
    
    // 3.2 Tipo de licencia insuficiente
    if (licenciaData.tipoLicencia === 'A') {
      score -= 25;
      factors.push(`Licencia tipo A (motos): -25 puntos ⚠️`);
      alerts.push({
        type: 'error',
        message: `⚠️ Licencia tipo A solo válida para motos. Para seguros de auto necesitas tipo B.`,
        severity: 'high',
        blocking: false
      });
    } else if (licenciaData.tipoLicencia === 'B') {
      factors.push(`Licencia tipo B (autos): OK ✅`);
    } else if (['C', 'D', 'E'].includes(licenciaData.tipoLicencia)) {
      factors.push(`Licencia tipo ${licenciaData.tipoLicencia} (profesional): Excelente ✅`);
      score  += 5; // Bonus por licencia profesional
    }
    
    // 3.3 Verificar concordancia cédula
    if (licenciaData.cedula !== cedulaData.cedula) {
      score -= 30;
      factors.push(`Cédulas no coinciden: -30 puntos ⚠️`);
      alerts.push({
        type: 'error',
        message: `⛔ Cédula en licencia (${licenciaData.cedula}) no coincide con cédula proporcionada (${cedulaData.cedula})`,
        severity: 'critical',
        blocking: true
      });
    }
  } else {
    // Sin licencia proporcionada
    factors.push(`Licencia no proporcionada: asumir tipo B estándar`);
    alerts.push({
      type: 'info',
      message: `Licencia no proporcionada. Se asume licencia tipo B vigente.`,
      severity: 'low'
    });
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // SCORE FINAL
  // ═══════════════════════════════════════════════════════════════════════
  score = Math.max(0, Math.min(100, score)); // Clamp entre 0-100
  
  // Clasificación por score
  let classification;
  let recommendedCoverage;
  
  if (score >= 80) {
    classification = 'EXCELENTE';
    recommendedCoverage = 'Todo Riesgo Premium';
  } else if (score >= 60) {
    classification = 'BUENO';
    recommendedCoverage = 'Todo Riesgo Elemental (7% deducible)';
  } else if (score >= 40) {
    classification = 'MODERADO';
    recommendedCoverage = 'Terceros + Robo';
  } else {
    classification = 'ALTO RIESGO';
    recommendedCoverage = 'Solo Terceros (obligatorio)';
  }
  
  return {
    score: Math.round(score),
    classification,
    recommendedCoverage,
    factors,
    alerts,
    hasBlockingIssues: alerts.some(a => a.blocking === true)
  };
}


// ═══════════════════════════════════════════════════════
// VALIDACIÓN DE CÉDULA ECUATORIANA (módulo 10)
// ═══════════════════════════════════════════════════════

/**
 * Valida una cédula ecuatoriana: provincia 01–24 (o 30 para extranjeros),
 * tercer dígito < 6 y dígito verificador por módulo 10.
 */
export function isValidEcuadorianCedula(cedula) {
  const c = String(cedula || '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(c)) return false;
  const prov = parseInt(c.slice(0, 2), 10);
  if (!((prov >= 1 && prov <= 24) || prov === 30)) return false;
  if (parseInt(c[2], 10) >= 6) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = parseInt(c[i], 10) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(c[9], 10);
}

// ═══════════════════════════════════════════════════════
// COTIZACIONES DE OTRAS ASEGURADORAS (foto o PDF)
// ═══════════════════════════════════════════════════════

const PROMPT_COMPETITOR = `Eres analista de seguros vehiculares en Ecuador. Este documento (foto o PDF) es una
cotización o póliza de seguro vehicular. Puede traer UNA o VARIAS ofertas (por ejemplo, un cuadro
comparativo de un bróker con varias aseguradoras o varios planes).

Devuelve SOLO un JSON con esta forma:
{
  "ofertas": [
    {
      "aseguradora": "nombre de la aseguradora (ej: Seguros Equinoccial, Sweaden, AIG, Zurich, Mapfre, Chubb, Generali, Latina, Aseguradora del Sur)",
      "plan": "nombre del plan o null",
      "prima_total_anual": número en USD con impuestos (lo que paga el cliente al año) o null,
      "prima_neta_anual": número en USD sin impuestos o null,
      "valor_asegurado": número en USD o null,
      "deducible": "texto tal como aparece (ej: '10% del siniestro, mínimo 1% del valor asegurado') o null",
      "asistencia_vial": true/false/null,
      "auto_sustituto": true/false/null,
      "coberturas_destacadas": ["máximo 5, textos cortos"],
      "vigencia_dias": número o null
    }
  ],
  "vehiculo": { "marca": null, "modelo": null, "anio": null, "placa": null },
  "es_cotizacion_de_seguro": true/false
}

REGLAS:
- No inventes valores: si no aparece, usa null.
- Los montos como números (sin $ ni comas). Si solo hay prima mensual, multiplica por 12 para la anual.
- No confundas valor asegurado, deducible o primas: la prima es lo que se paga por el seguro.
- Si el documento no es una cotización de seguro vehicular, "es_cotizacion_de_seguro": false y "ofertas": [].`;

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Normaliza la respuesta de la IA a ofertas comparables.
 * Exportada para tests.
 */
export function normalizeCompetitorOffers(parsed) {
  const offers = Array.isArray(parsed?.ofertas) ? parsed.ofertas : [];
  const seen = new Set();
  const result = [];
  for (const o of offers) {
    const annual = toNumber(o.prima_total_anual) ?? toNumber(o.prima_neta_anual);
    const name = String(o.aseguradora || '').trim();
    if (!name && !annual) continue;
    if (annual !== null && (annual < 50 || annual > 50000)) continue; // valor absurdo: probablemente leyó otra cifra
    const key = `${name.toLowerCase()}|${String(o.plan || '').toLowerCase()}|${annual}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      nombre: name || 'Otra aseguradora',
      plan: o.plan || 'Plan estándar',
      prima_anual_num: annual,
      prima_anual: annual !== null ? `$${annual.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'N/A',
      prima_mensual: annual !== null ? `$${Math.round(annual / 12)}/mes` : 'N/A',
      deducible: o.deducible || 'N/A',
      valor_asegurado: toNumber(o.valor_asegurado),
      asistencia: o.asistencia_vial === true ? '✅ 24/7' : o.asistencia_vial === false ? '❌' : '—',
      auto_sustituto: o.auto_sustituto ?? null,
      coberturas: Array.isArray(o.coberturas_destacadas) ? o.coberturas_destacadas.slice(0, 5) : [],
      fuente: 'documento_cliente',
    });
  }
  return result;
}

/**
 * Lee una cotización de otra aseguradora (foto o PDF) y devuelve las ofertas encontradas.
 * @param {string|string[]} mediaUrl
 * @returns {Promise<{success:boolean, offers:Array, vehicle:object|null, isInsuranceQuote:boolean, error?:string}>}
 */
export async function extractCompetitorQuotes(mediaUrl) {
  try {
    const response = await analyzeMedia(mediaUrl, PROMPT_COMPETITOR, {
      model: 'gpt-4o',
      max_tokens: 1500,
      temperature: 0,
      json: true
    });
    const parsed = parseVisionResponse(response);
    const offers = normalizeCompetitorOffers(parsed);
    loggers.adriana.info('Cotización de competencia leída', { ofertas: offers.length });
    return {
      success: true,
      offers,
      vehicle: parsed?.vehiculo || null,
      isInsuranceQuote: parsed?.es_cotizacion_de_seguro !== false,
    };
  } catch (error) {
    loggers.adriana.error('Error leyendo cotización de competencia', {}, error);
    return { success: false, offers: [], vehicle: null, isInsuranceQuote: false, error: error.message };
  }
}
