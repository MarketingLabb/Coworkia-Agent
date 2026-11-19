/**
 * 📋 Aluna - Análisis de Documentos de Contratos y Membresías
 * 
 * Sistema especializado para analizar documentos relacionados con:
 * - Contratos de membresía
 * - Acuerdos comerciales
 * - Términos y condiciones
 * - Facturas y comprobantes
 * - Propuestas comerciales
 * - Políticas internas
 * - Reportes e informes
 * 
 * Usa GPT-4 Vision para análisis profesional de PDFs e imágenes.
 * 
 * @author Agente Copilot
 * @date 2026-01-11
 */

import { analyzeImage } from '../servicios-ia/openai.js';

// Tipos de documentos soportados
export const DOCUMENT_TYPES = {
  MEMBERSHIP: 'membership',         // Contratos de membresía/afiliación
  AGREEMENT: 'agreement',           // Acuerdos comerciales generales
  TERMS: 'terms',                   // Términos y condiciones
  INVOICE: 'invoice',               // Facturas/comprobantes
  PROPOSAL: 'proposal',             // Propuestas comerciales
  POLICY: 'policy',                 // Políticas internas
  REPORT: 'report',                 // Reportes/informes
  GENERAL: 'general'                // Análisis adaptativo
};

/**
 * Detecta automáticamente el tipo de documento basándose en el contexto del usuario
 * @param {string} userMessage - Mensaje del usuario que acompaña al documento
 * @param {string} fileType - Tipo de archivo (document, image)
 * @returns {string} Tipo de documento detectado
 */
export function detectDocumentType(userMessage = '', fileType = '') {
  const messageLower = userMessage.toLowerCase();
  
  // Keywords por tipo de documento
  const keywords = {
    membership: ['membresía', 'afiliación', 'contrato de membresía', 'membresía de', 'plan mensual', 'plan 10', 'plan 20', 'oficina virtual', 'sala reuniones'],
    agreement: ['acuerdo', 'convenio', 'contrato', 'agreement', 'contrato de servicios', 'acuerdo comercial'],
    terms: ['términos', 'condiciones', 'terms and conditions', 'términos de uso', 'política de privacidad', 'aviso legal'],
    invoice: ['factura', 'comprobante', 'invoice', 'recibo', 'pago', 'cobro', 'estado de cuenta'],
    proposal: ['propuesta', 'cotización', 'presupuesto', 'proposal', 'oferta comercial', 'propuesta de servicios'],
    policy: ['política', 'normativa', 'reglamento', 'policy', 'política interna', 'procedimiento'],
    report: ['reporte', 'informe', 'report', 'análisis', 'estadísticas', 'métricas', 'dashboard']
  };
  
  // Detectar tipo basado en keywords
  for (const [type, words] of Object.entries(keywords)) {
    if (words.some(keyword => messageLower.includes(keyword))) {
      return type;
    }
  }
  
  // Default: análisis general
  return 'general';
}

/**
 * Construye el prompt especializado según el tipo de documento
 * @param {string} documentType - Tipo de documento
 * @param {string} userContext - Contexto adicional del usuario
 * @returns {string} Prompt optimizado para el tipo de documento
 */
export function buildContractPrompt(documentType, userContext = '') {
  const baseContext = `Eres Aluna, especialista en membresías y contratos de Coworkia con 6 años de experiencia en espacios de coworking. Analiza este documento de forma profesional y consultiva.`;
  
  const prompts = {
    membership: `${baseContext}

**ANÁLISIS DE CONTRATO DE MEMBRESÍA**

Este es un contrato de membresía o afiliación. Realiza un análisis profesional siguiendo esta estructura:

1. **Información del Contrato**
   - Tipo de membresía (Plan 10 [$67], Plan 20 [$99], Oficina Virtual [$365/año], Sala Reuniones [$30], u otro)
   - Duración del contrato (mensual, trimestral, anual)
   - Precio/inversión acordada
   - Fecha de inicio y vigencia
   - Condiciones de renovación

2. **Beneficios y Servicios Incluidos**
   - Días/horas de acceso
   - Espacios disponibles (Hot Desk, oficina privada, sala de reuniones)
   - Servicios adicionales (locker, cajonera, secretaria virtual IA, etc.)
   - Invitados permitidos
   - Tecnología incluida (IA, WiFi, impresión)

3. **Obligaciones y Responsabilidades**
   - Forma de pago (anticipado, mensual, etc.)
   - Políticas de cancelación
   - Reglas de uso del espacio
   - Sanciones por incumplimiento

4. **Análisis Profesional**
   - Ventajas competitivas del plan
   - Relación precio/beneficio
   - Puntos a destacar positivamente
   - Aspectos que requieren aclaración

5. **Recomendaciones**
   - ¿El plan se ajusta a las necesidades mencionadas?
   - Oportunidades de upgrade o downgrade
   - Próximos pasos sugeridos

Contexto del usuario: ${userContext || 'Evaluando membresía para Coworkia'}

Responde en 300-450 palabras, formato WhatsApp (bullets, emojis sutiles), tono consultivo y profesional de closer moderna.`,

    agreement: `${baseContext}

**ANÁLISIS DE ACUERDO COMERCIAL**

Este es un acuerdo o convenio comercial. Analiza los siguientes puntos:

1. **Identificación del Acuerdo**
   - Partes involucradas (cliente, Coworkia, terceros)
   - Objeto del acuerdo
   - Duración y vigencia
   - Monto económico (si aplica)

2. **Obligaciones de las Partes**
   - Compromisos de Coworkia
   - Compromisos del cliente/usuario
   - Entregables o servicios específicos
   - Plazos y fechas clave

3. **Términos Económicos**
   - Precio/tarifa acordada
   - Forma y frecuencia de pago
   - Depósitos o garantías
   - Penalidades por incumplimiento

4. **Cláusulas Importantes**
   - Confidencialidad
   - Resolución de conflictos
   - Causas de terminación
   - Renovación automática

5. **Evaluación Profesional**
   - Puntos favorables del acuerdo
   - Áreas de posible negociación
   - Riesgos o alertas
   - Comparación con estándares del mercado

Contexto del usuario: ${userContext || 'Revisión de acuerdo comercial'}

Responde en 300-400 palabras, formato WhatsApp, tono consultivo y estratégico.`,

    terms: `${baseContext}

**ANÁLISIS DE TÉRMINOS Y CONDICIONES**

Este documento contiene términos, condiciones o políticas. Analiza:

1. **Alcance del Documento**
   - Tipo de documento (términos de servicio, política de privacidad, etc.)
   - Ámbito de aplicación
   - Usuarios/clientes a los que aplica
   - Vigencia y actualizaciones

2. **Derechos del Usuario**
   - Servicios/beneficios garantizados
   - Protecciones legales
   - Canales de reclamo o soporte
   - Privacidad y datos personales

3. **Obligaciones del Usuario**
   - Conductas permitidas
   - Restricciones y prohibiciones
   - Responsabilidades legales
   - Consecuencias de incumplimiento

4. **Aspectos Legales Clave**
   - Jurisdicción aplicable
   - Propiedad intelectual
   - Limitaciones de responsabilidad
   - Procedimiento de modificaciones

5. **Resumen para Decisión**
   - Puntos críticos a considerar
   - Comparación con estándares del sector
   - Recomendación: aceptar, negociar o rechazar
   - Próximos pasos

Contexto del usuario: ${userContext || 'Evaluación de términos y condiciones'}

Responde en 280-380 palabras, formato claro para WhatsApp, tono informativo y protector.`,

    invoice: `${baseContext}

**ANÁLISIS DE FACTURA/COMPROBANTE**

Este es un documento de facturación o comprobante de pago. Revisa:

1. **Datos de la Factura**
   - Número de factura/comprobante
   - Fecha de emisión
   - Emisor (Coworkia u otro)
   - Receptor (cliente)
   - Método de pago

2. **Detalle de Servicios/Productos**
   - Concepto(s) facturado(s)
   - Cantidad y descripción
   - Precio unitario
   - Subtotal por ítem

3. **Cálculo Financiero**
   - Subtotal
   - Impuestos (IVA, retenciones, etc.)
   - Descuentos o recargos
   - Total a pagar

4. **Validación y Cumplimiento**
   - ¿Cumple requisitos legales ecuatorianos?
   - ¿Números de RUC/cédula correctos?
   - ¿Autorización SRI vigente?
   - ¿Formato válido?

5. **Recomendaciones**
   - Validez del documento para contabilidad
   - Acciones requeridas (pago, archivo, reclamo)
   - Comparación con servicios contratados
   - Alertas de discrepancias

Contexto del usuario: ${userContext || 'Revisión de factura'}

Responde en 250-350 palabras, formato estructurado para WhatsApp, tono objetivo y financiero.`,

    proposal: `${baseContext}

**ANÁLISIS DE PROPUESTA COMERCIAL**

Esta es una propuesta de servicios o cotización. Evalúa:

1. **Identificación de la Propuesta**
   - Proveedor/emisor
   - Cliente/destinatario
   - Fecha de emisión
   - Vigencia de la oferta

2. **Servicios/Productos Ofertados**
   - Descripción detallada de lo propuesto
   - Alcance y limitaciones
   - Duración o período de servicio
   - Entregables específicos

3. **Estructura de Precios**
   - Precio por ítem/servicio
   - Paquetes o descuentos
   - Formas de pago aceptadas
   - Condiciones financieras

4. **Comparativa de Valor**
   - Relación precio/calidad
   - Comparación con alternativas del mercado
   - Diferenciadores competitivos
   - ROI estimado

5. **Decisión Estratégica**
   - Ventajas de aceptar la propuesta
   - Puntos negociables
   - Riesgos o alertas
   - Recomendación: aceptar, negociar o rechazar
   - Próximos pasos sugeridos

Contexto del usuario: ${userContext || 'Evaluación de propuesta comercial'}

Responde en 320-420 palabras, formato consultivo para WhatsApp, tono estratégico de closer.`,

    policy: `${baseContext}

**ANÁLISIS DE POLÍTICA O NORMATIVA INTERNA**

Este documento establece políticas o reglamentos internos. Analiza:

1. **Alcance de la Política**
   - Título y objetivo de la política
   - Área o departamento aplicable
   - Personal o usuarios afectados
   - Fecha de vigencia

2. **Reglas y Procedimientos**
   - Normas establecidas
   - Procedimientos a seguir
   - Excepciones permitidas
   - Autoridades responsables

3. **Derechos y Garantías**
   - Protecciones para usuarios/empleados
   - Canales de apelación
   - Transparencia en procesos
   - Privacidad y confidencialidad

4. **Obligaciones y Sanciones**
   - Conductas obligatorias
   - Prohibiciones explícitas
   - Sanciones por incumplimiento
   - Proceso disciplinario

5. **Evaluación Profesional**
   - Claridad y aplicabilidad
   - Alineación con mejores prácticas
   - Puntos controversiales o ambiguos
   - Recomendaciones de mejora

Contexto del usuario: ${userContext || 'Revisión de política interna'}

Responde en 280-380 palabras, formato estructurado para WhatsApp, tono profesional y objetivo.`,

    report: `${baseContext}

**ANÁLISIS DE REPORTE O INFORME**

Este es un reporte, informe o análisis de datos. Examina:

1. **Identificación del Reporte**
   - Título y objetivo del informe
   - Período analizado
   - Área o departamento emisor
   - Fecha de emisión

2. **Métricas y Datos Clave**
   - KPIs principales presentados
   - Tendencias identificadas
   - Comparativas (mes vs mes, año vs año, etc.)
   - Datos financieros u operativos

3. **Análisis de Resultados**
   - Logros destacados
   - Áreas de oportunidad
   - Desviaciones respecto a objetivos
   - Factores causales identificados

4. **Insights Estratégicos**
   - Patrones relevantes detectados
   - Correlaciones importantes
   - Proyecciones o forecasts
   - Benchmarking con sector

5. **Recomendaciones Ejecutivas**
   - Acciones prioritarias sugeridas
   - Recursos necesarios
   - Plazos estimados de implementación
   - Impacto esperado

Contexto del usuario: ${userContext || 'Análisis de reporte'}

Responde en 300-400 palabras, formato ejecutivo para WhatsApp, tono analítico y estratégico.`,

    general: `${baseContext}

**ANÁLISIS GENERAL DE DOCUMENTO**

Documento no clasificado en categoría específica. Realiza un análisis adaptativo:

1. **Identificación del Contenido**
   - Tipo de documento detectado
   - Emisor y receptor
   - Fecha y contexto
   - Propósito aparente

2. **Información Relevante**
   - Datos clave encontrados
   - Cifras o fechas importantes
   - Partes involucradas
   - Obligaciones o compromisos mencionados

3. **Análisis de Contenido**
   - Mensaje principal del documento
   - Puntos críticos a considerar
   - Aspectos legales o financieros detectados
   - Implicaciones para el usuario

4. **Evaluación Profesional**
   - Validez y completitud del documento
   - Alertas o precauciones
   - Oportunidades identificadas
   - Comparación con estándares

5. **Próximos Pasos**
   - Acciones recomendadas
   - Información adicional necesaria
   - Consultas sugeridas
   - Recursos de apoyo

Contexto del usuario: ${userContext || 'Revisión de documento'}

Responde en 280-380 palabras, formato adaptativo para WhatsApp, tono consultivo y servicial.`
  };
  
  return prompts[documentType] || prompts.general;
}

/**
 * Analiza un documento de contrato/membresía con GPT-4 Vision
 * @param {string} documentUrl - URL del documento (PDF o imagen)
 * @param {string} userMessage - Mensaje del usuario para contexto
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} Resultado del análisis
 */
export async function analyzeContractDocument(documentUrl, userMessage = '', options = {}) {
  console.log('[CONTRACT-DOC] 📋 Iniciando análisis...');
  console.log('[CONTRACT-DOC] 📄 Documento:', documentUrl);
  console.log('[CONTRACT-DOC] 💬 Contexto:', userMessage.substring(0, 100) + '...');
  
  try {
    // Detectar tipo de documento
    const documentType = options.documentType || detectDocumentType(userMessage, options.fileType);
    console.log('[CONTRACT-DOC] 🔍 Tipo detectado:', documentType);
    
    // Construir prompt especializado
    const prompt = buildContractPrompt(documentType, userMessage);
    
    // Analizar con GPT-4 Vision (alta precisión para documentos legales/comerciales)
    const analysisResult = await analyzeImage(documentUrl, prompt, {
      max_tokens: 1000,      // Respuestas completas y detalladas
      temperature: 0.1       // Baja creatividad = alta precisión para documentos
    });
    
    if (!analysisResult || !analysisResult.content) {
      console.error('[CONTRACT-DOC] ❌ Error: No se pudo analizar el documento');
      return {
        success: false,
        error: 'No se pudo analizar el documento',
        documentType,
        timestamp: Date.now()
      };
    }
    
    const analysis = analysisResult.content;
    console.log('[CONTRACT-DOC] ✅ Análisis completado');
    console.log('[CONTRACT-DOC] 📊 Longitud:', analysis.length, 'caracteres');
    
    return {
      success: true,
      documentType,
      analysis,
      timestamp: Date.now(),
      metadata: {
        promptType: documentType,
        analysisLength: analysis.length,
        userContext: userMessage.substring(0, 200)
      }
    };
    
  } catch (error) {
    console.error('[CONTRACT-DOC] ❌ Error en análisis:', error.message);
    return {
      success: false,
      error: error.message,
      documentType: options.documentType || 'unknown',
      timestamp: Date.now()
    };
  }
}

/**
 * Extrae datos estructurados de un contrato de membresía
 * @param {string} analysis - Texto del análisis generado
 * @returns {Object} Datos estructurados extraídos
 */
export function extractMembershipData(analysis) {
  const data = {
    membershipType: null,
    duration: null,
    price: null,
    startDate: null,
    benefits: []
  };
  
  // Extraer tipo de membresía
  const membershipMatch = analysis.match(/(?:Plan 10|Plan 20|Oficina Virtual|Sala Reuniones)/i);
  if (membershipMatch) data.membershipType = membershipMatch[0];
  
  // Extraer duración
  const durationMatch = analysis.match(/Duración[:\s]+([^\n]+)/i);
  if (durationMatch) data.duration = durationMatch[1].trim();
  
  // Extraer precio
  const priceMatch = analysis.match(/(?:Precio|Inversión|Total)[:\s]+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
  if (priceMatch) data.price = '$' + priceMatch[1];
  
  // Extraer fecha de inicio
  const dateMatch = analysis.match(/(?:Inicio|Vigencia)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (dateMatch) data.startDate = dateMatch[1];
  
  // Extraer beneficios (líneas que empiezan con bullet o guión)
  const benefitMatches = analysis.match(/^[\s]*[-•*]\s*(.+)$/gm);
  if (benefitMatches) {
    data.benefits = benefitMatches
      .map(b => b.replace(/^[\s]*[-•*]\s*/, '').trim())
      .filter(b => b.length > 10); // Solo beneficios con contenido significativo
  }
  
  return data;
}

/**
 * Extrae datos estructurados de una factura
 * @param {string} analysis - Texto del análisis generado
 * @returns {Object} Datos estructurados extraídos
 */
export function extractInvoiceData(analysis) {
  const data = {
    invoiceNumber: null,
    issueDate: null,
    issuer: null,
    totalAmount: null,
    taxAmount: null
  };
  
  // Extraer número de factura
  const invoiceMatch = analysis.match(/(?:Número|N°|#)[:\s]*(\d{3}-\d{3}-\d{9}|\d+)/i);
  if (invoiceMatch) data.invoiceNumber = invoiceMatch[1];
  
  // Extraer fecha
  const dateMatch = analysis.match(/(?:Fecha)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (dateMatch) data.issueDate = dateMatch[1];
  
  // Extraer emisor
  const issuerMatch = analysis.match(/(?:Emisor|De|Razón Social)[:\s]+([^\n]+)/i);
  if (issuerMatch) data.issuer = issuerMatch[1].trim();
  
  // Extraer total
  const totalMatch = analysis.match(/(?:Total|Monto)[:\s]*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
  if (totalMatch) data.totalAmount = '$' + totalMatch[1];
  
  // Extraer IVA
  const taxMatch = analysis.match(/(?:IVA|Impuesto|Tax)[:\s]*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i);
  if (taxMatch) data.taxAmount = '$' + taxMatch[1];
  
  return data;
}

/**
 * Calcula un score de calidad del análisis (0-100)
 * @param {string} analysis - Texto del análisis generado
 * @returns {number} Score de calidad (0-100)
 */
export function calculateDocumentQualityScore(analysis) {
  if (!analysis || analysis.length < 100) return 0;
  
  let score = 50; // Base
  
  // Longitud adecuada (200-500 palabras)
  const wordCount = analysis.split(/\s+/).length;
  if (wordCount >= 200 && wordCount <= 500) score += 10;
  else if (wordCount > 100) score += 5;
  
  // Estructura (bullets, números, secciones)
  if (analysis.includes('•') || analysis.includes('-')) score += 10;
  if (analysis.match(/\d\./g)?.length >= 3) score += 10;
  
  // Datos específicos (fechas, montos, nombres)
  if (analysis.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)) score += 5; // Fechas
  if (analysis.match(/\$\d+/)) score += 5; // Montos
  
  // Vocabulario profesional
  const professionalWords = ['análisis', 'evaluación', 'recomendación', 'obligaciones', 'beneficios', 'términos'];
  const foundWords = professionalWords.filter(word => analysis.toLowerCase().includes(word)).length;
  score += foundWords * 2;
  
  // Penalizar si es muy corto o muy largo
  if (wordCount < 150) score -= 10;
  if (wordCount > 600) score -= 5;
  
  // Penalizar palabras negativas (error, imposible, no se puede)
  const negativeWords = ['error', 'imposible', 'no se puede', 'inválido'];
  negativeWords.forEach(word => {
    if (analysis.toLowerCase().includes(word)) score = Math.max(0, score - 5);
  });
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

// Export default con todas las funciones
export default {
  analyzeContractDocument,
  detectDocumentType,
  buildContractPrompt,
  extractMembershipData,
  extractInvoiceData,
  calculateDocumentQualityScore,
  DOCUMENT_TYPES
};
