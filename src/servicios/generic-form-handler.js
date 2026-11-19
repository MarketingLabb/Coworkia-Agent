/**
 * 🧠 Sistema Universal de Formularios Inteligentes
 * 
 * Basado en partial-reservation-form.js de Aurora, pero adaptado para
 * funcionar con CUALQUIER agente (Adriana, Axel, Enzo, Paula, Aluna).
 * 
 * Permite a los agentes "recordar" datos entre mensajes y completar
 * progresivamente la información sin obligar al usuario a seguir orden estricto.
 * 
 * Ejemplo de uso:
 * 
 * ADRIANA (Seguros):
 * - Usuario: "quiero seguro de auto para un Honda Civic"
 * - Agente detecta: tipo=auto, vehiculo=Honda Civic
 * - Pregunta siguiente: "¿Tu cédula?"
 * 
 * AXEL (Colisiones):
 * - Usuario: "tengo rayones en mi auto, es un Toyota Corolla 2019"
 * - Agente detecta: tipo=rayones, vehiculo=Toyota Corolla, año=2019
 * - Pregunta siguiente: "¿Tu email para enviarte la cotización?"
 */

import { getPendingConfirmation, setPendingConfirmation, clearPendingConfirmation } from './reservation-state.js';

// TTL del formulario: 2 horas (igual que Aurora)
const FORM_TTL_SECONDS = 2 * 60 * 60;

/**
 * 🎯 Clase Universal de Formulario
 * 
 * Cada agente define sus propios campos requeridos y opcionales.
 */
export class GenericForm {
  /**
   * @param {string} userId - ID del usuario (+593999...)
   * @param {string} agentName - Nombre del agente (ADRIANA, AXEL, ENZO, PAULA, ALUNA)
   * @param {Object} schema - Esquema de campos {required: [], optional: [], defaults: {}}
   * @param {Object} existingData - Datos previos si existen
   */
  constructor(userId, agentName, schema, existingData = {}) {
    this.userId = userId;
    this.agentName = agentName;
    this.schema = schema;
    this.data = { ...schema.defaults, ...existingData };
    this.updatedAt = new Date();
    
    console.log(`[GENERIC-FORM] ✨ Nuevo formulario ${agentName} para ${userId}`);
    console.log(`[GENERIC-FORM] 📋 Campos requeridos:`, schema.required);
  }

  /**
   * 📝 Actualiza un campo
   */
  updateField(field, value) {
    this.data[field] = value;
    this.updatedAt = new Date();
    console.log(`[GENERIC-FORM] 📝 ${this.agentName} - Campo actualizado: ${field} = ${value}`);
  }

  /**
   * 📊 Actualiza múltiples campos a la vez
   */
  updateFields(updates) {
    Object.keys(updates).forEach(key => {
      if (updates[key] !== null && updates[key] !== undefined) {
        this.data[key] = updates[key];
      }
    });
    this.updatedAt = new Date();
    console.log(`[GENERIC-FORM] 📝 ${this.agentName} - Campos actualizados:`, Object.keys(updates));
  }

  /**
   * ❓ Lista de campos faltantes
   */
  getMissingFields() {
    const missing = [];
    
    this.schema.required.forEach(field => {
      if (!this.data[field]) {
        missing.push(field);
      }
    });
    
    return missing;
  }

  /**
   * ✅ Verifica si está completo
   */
  isComplete() {
    return this.getMissingFields().length === 0;
  }

  /**
   * 📋 Genera resumen de datos actuales
   */
  getSummary() {
    const parts = [];
    
    Object.keys(this.data).forEach(key => {
      const value = this.data[key];
      if (value && this.schema.labels && this.schema.labels[key]) {
        parts.push(`${this.schema.labels[key]}: ${value}`);
      }
    });
    
    return parts.join('\n');
  }

  /**
   * 🎯 Genera pregunta inteligente para el siguiente campo faltante
   */
  getNextQuestion() {
    const missing = this.getMissingFields();
    
    if (missing.length === 0) {
      return null; // Formulario completo
    }

    const field = missing[0];
    
    // Si el schema tiene preguntas personalizadas, usarlas
    if (this.schema.questions && this.schema.questions[field]) {
      return this.schema.questions[field];
    }
    
    // Pregunta genérica
    const label = this.schema.labels?.[field] || field;
    return `¿Cuál es tu ${label}?`;
  }

  /**
   * 💾 Serializar a JSON
   */
  toJSON() {
    return {
      userId: this.userId,
      agentName: this.agentName,
      schema: this.schema,
      data: this.data,
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * 📂 Cargar desde JSON
   */
  static fromJSON(json) {
    const form = new GenericForm(json.userId, json.agentName, json.schema, json.data);
    form.updatedAt = new Date(json.updatedAt);
    return form;
  }
}

/**
 * 🔧 ESQUEMAS DE FORMULARIOS POR AGENTE
 */

export const FORM_SCHEMAS = {
  ADRIANA: {
    required: ['city', 'commercialValue', 'matriculaImages', 'licenciaImages', 'plate', 'vehicleBrand', 'vehicleModel', 'vehicleYear', 'motor', 'chasis', 'originCountry', 'licenseType', 'licenseExpiry', 'fullName', 'cedula', 'phone'],
    optional: ['email', 'quotedPremium'],
    defaults: {
      insuranceType: 'Seguro para Vehículos livianos',
      matriculaImages: [],
      licenciaImages: [],
      status: 'pending'
    },
    labels: {
      city: '🏙️ Ciudad',
      commercialValue: '💰 Valor comercial',
      matriculaImages: '📄 Matrícula',
      licenciaImages: '🪪 Licencia',
      plate: '🔢 Placa',
      vehicleBrand: '🚗 Marca',
      vehicleModel: '📦 Modelo',
      vehicleYear: '📅 Año',
      motor: '🔧 Motor',
      chasis: '🏗️ Chasis',
      originCountry: '🌍 País origen',
      licenseType: '📝 Tipo licencia',
      licenseExpiry: '⏰ Vigencia licencia',
      fullName: '👤 Nombre',
      cedula: '🆔 Cédula',
      phone: '📱 Teléfono',
      email: '📧 Email',
      quotedPremium: '💵 Prima cotizada'
    },
    questions: {
      city: '¿En qué ciudad se encuentra tu vehículo?',
      commercialValue: '¿Cuál es el valor comercial aproximado de tu vehículo? (avalúo actual)',
      matriculaImages: 'Por favor envía la matrícula de tu vehículo (ambos lados)',
      licenciaImages: 'Ahora necesito tu licencia de conducir (ambos lados)',
      fullName: '¿Cuál es tu nombre completo?',
      cedula: '¿Tu número de cédula?',
      phone: '¿Tu número de teléfono?',
      email: '¿Tu correo electrónico para enviarte la cotización?'
    }
  },

  // AXEL: Usa sistema especializado en axel-quote-form.js (no generic-form-handler)

  ENZO: {
    required: ['projectType', 'companyName', 'fullName', 'email', 'phone', 'budget', 'urgency'],
    optional: ['description', 'currentSituation'],
    defaults: {},
    labels: {
      projectType: '🎯 Tipo de proyecto',
      companyName: '🏢 Empresa',
      fullName: '👤 Nombre',
      email: '📧 Email',
      phone: '📱 Teléfono',
      budget: '💰 Presupuesto',
      urgency: '⏰ Urgencia',
      description: '📝 Descripción',
      currentSituation: '📊 Situación actual'
    },
    questions: {
      projectType: '¿Qué tipo de proyecto necesitas? (campaña digital, automatización IA, software, estrategia)',
      companyName: '¿Nombre de tu empresa?',
      fullName: '¿Tu nombre completo?',
      email: '¿Tu correo?',
      phone: '¿Un número de contacto?',
      budget: '¿Tienes un presupuesto aproximado? (ej: $500, $2000, $5000+)',
      urgency: '¿Qué tan urgente es? (ASAP, 1 semana, 1 mes, flexible)'
    }
  },

  PAULA: {
    required: ['operationType', 'propertyType', 'zone', 'budgetRange', 'fullName', 'email', 'phone'],
    optional: ['bedrooms', 'amenities', 'squareMeters'],
    defaults: {},
    labels: {
      operationType: '🏘️ Operación',
      propertyType: '🏠 Tipo propiedad',
      zone: '📍 Zona',
      budgetRange: '💰 Presupuesto',
      fullName: '👤 Nombre',
      email: '📧 Email',
      phone: '📱 Teléfono',
      bedrooms: '🛏️ Dormitorios',
      amenities: '✨ Amenidades',
      squareMeters: '📐 m²'
    },
    questions: {
      operationType: '¿Buscas comprar, vender o arrendar?',
      propertyType: '¿Qué tipo de propiedad? (departamento, casa, local, terreno)',
      zone: '¿En qué zona o sector? (ej: Cumbayá, La Carolina, Norte)',
      budgetRange: '¿Cuál es tu rango de presupuesto?',
      fullName: '¿Tu nombre completo?',
      email: '¿Tu correo?',
      phone: '¿Un número de contacto?'
    }
  },

  ALUNA: {
    required: ['membershipType', 'fullName', 'email'],
    optional: ['phone', 'startDate', 'specialRequirements', 'companyName'],
    defaults: {
      // ✅ FIX: NO defaults para startDate - Usuario debe especificar o se asume "cuanto antes"
      // proformaSent: se usa internamente para evitar reenvíos; no tiene pregunta en el schema
    },
    labels: {
      membershipType: '🎫 Tipo de membresía',
      startDate: '📅 Fecha inicio',
      fullName: '👤 Nombre',
      email: '📧 Email',
      phone: '📱 Teléfono',
      specialRequirements: '📝 Requisitos especiales',
      companyName: '🏢 Empresa'
    },
    questions: {
      membershipType: '¿Qué plan te interesa? (Plan 10 [$67], Plan 20 [$99], Oficina Virtual [$365/año], Sala Reuniones [$30])',
      fullName: '¡Genial! 🎉 Para preparar tu membresía, ¿cuál es tu nombre completo? 👤',
      email: 'Perfecto. ¿A qué email te envío la proforma con todos los detalles? 📧',
      phone: 'Y si quieres que te contactemos también por llamada, ¿cuál es tu número? 📱 (opcional)'
    }
  },

  GABI: {
    required: ['consultationType', 'fullName', 'email', 'phone', 'description', 'urgency'],
    optional: ['companyName', 'ruc'],
    defaults: {
      urgency: 'Normal'
    },
    labels: {
      consultationType: '⚖️ Tipo consulta',
      companyName: '🏢 Empresa',
      ruc: '🆔 RUC',
      fullName: '👤 Nombre',
      email: '📧 Email',
      phone: '📱 Teléfono',
      description: '📝 Descripción',
      urgency: '⏰ Urgencia'
    },
    questions: {
      consultationType: '¿Qué tipo de consultoría necesitas? (Contabilidad, Legal, RRHH, Fiscal, Otro)',
      companyName: '¿Nombre de tu empresa? (Si eres persona natural escribe "Persona Natural")',
      ruc: '¿Tienes RUC? Si no, escribe "No tengo"',
      fullName: '¿Tu nombre completo?',
      email: '¿Tu correo?',
      phone: '¿Un número de contacto?',
      description: 'Cuéntame brevemente sobre tu consulta o situación',
      urgency: '¿Qué tan urgente es? (Urgente: 24h / Normal: 72h / Planificación: más de 1 semana)'
    }
  }
};

/**
 * 📂 Obtener o crear formulario
 */
export async function getOrCreateGenericForm(userId, agentName, existingData = {}) {
  try {
    const existing = await getPendingConfirmation(userId);
    
    // Si ya existe formulario para este agente, cargarlo
    if (existing && existing._type === 'generic_form' && existing._agentName === agentName) {
      console.log(`[GENERIC-FORM] 📂 Formulario ${agentName} existente cargado`);
      return GenericForm.fromJSON(existing._formData);
    }
    
    // Crear nuevo formulario
    console.log(`[GENERIC-FORM] ✨ Nuevo formulario ${agentName} creado`);
    const schema = FORM_SCHEMAS[agentName];
    return new GenericForm(userId, agentName, schema, existingData);
  } catch (error) {
    console.error(`[GENERIC-FORM] ❌ Error obteniendo formulario ${agentName}:`, error);
    const schema = FORM_SCHEMAS[agentName];
    return new GenericForm(userId, agentName, schema, existingData);
  }
}

/**
 * 💾 Guardar formulario en BD
 */
export async function saveGenericForm(form) {
  try {
    await setPendingConfirmation(form.userId, {
      formData: form.toJSON(),
      type: 'generic_form',
      agentName: form.agentName
    }, FORM_TTL_SECONDS / 60); // Convertir a minutos
    
    console.log(`[GENERIC-FORM] 💾 Formulario ${form.agentName} guardado`);
    return true;
  } catch (error) {
    console.error(`[GENERIC-FORM] ❌ Error guardando formulario:`, error);
    return false;
  }
}

/**
 * 🗑️ Limpiar formulario
 */
export async function clearGenericForm(userId) {
  try {
    await clearPendingConfirmation(userId);
    console.log(`[GENERIC-FORM] 🗑️ Formulario limpiado para:`, userId);
    return true;
  } catch (error) {
    console.error(`[GENERIC-FORM] ❌ Error limpiando formulario:`, error);
    return false;
  }
}

/**
 * 🎯 Extrae datos del mensaje según el agente
 * 
 * Cada agente tiene sus propios patrones de detección
 */
export async function extractDataFromMessage(message, agentName, currentForm) {
  console.log(`[GENERIC-FORM] 🚀 Extrayendo datos para ${agentName}`);
  
  const updates = {};
  const lowerMsg = message.toLowerCase();
  
  // Guardar el mensaje original en el formulario para patrones complejos
  currentForm.data._lastMessage = message;

  // 📧 Email (universal para todos)
  if (!currentForm.data.email) {
    const emailMatch = message.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      updates.email = emailMatch[1];
      console.log(`[GENERIC-FORM] 📧 Email detectado:`, updates.email);
    }
  }

  // 📱 Teléfono (universal) - MEJORADO
  if (!currentForm.data.phone) {
    // Detectar teléfonos ecuatorianos
    const phonePatterns = [
      /\b(09\d{8})\b/, // 09XXXXXXXX
      /\b(\+?593\s?9\d{8})\b/, // +593 9XXXXXXXX
      /\b(9\d{8})\b/ // 9XXXXXXXX
    ];
    
    for (const pattern of phonePatterns) {
      const phoneMatch = message.match(pattern);
      if (phoneMatch && phoneMatch[1]) {
        let phone = phoneMatch[1].replace(/\s/g, '');
        
        // Normalizar
        if (phone.startsWith('09')) {
          phone = `+593${phone.slice(1)}`;
        } else if (phone.startsWith('9') && phone.length === 9) {
          phone = `+593${phone}`;
        } else if (phone.startsWith('593') && !phone.startsWith('+')) {
          phone = `+${phone}`;
        }
        
        updates.phone = phone;
        console.log(`[GENERIC-FORM] 📱 Teléfono detectado:`, updates.phone);
        break;
      }
    }
  }
  
  // 👤 Nombre completo (universal) - MEJORADO
  if (!currentForm.data.fullName) {
    const namePatterns = [
      /(?:mi nombre es|me llamo|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/i,
      /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)$/i
    ];
    
    for (const pattern of namePatterns) {
      const nameMatch = message.match(pattern);
      if (nameMatch && nameMatch[1]) {
        updates.fullName = nameMatch[1].trim();
        console.log(`[GENERIC-FORM] 👤 Nombre detectado:`, updates.fullName);
        break;
      }
    }
  }

  // 🎯 Detección específica por agente
  switch (agentName) {
    case 'ADRIANA':
      extractAdrianaData(lowerMsg, currentForm, updates);
      break;
    // AXEL: Usa axel-quote-form.js con extracción OpenAI (más precisa)
    case 'ENZO':
      extractEnzoData(lowerMsg, currentForm, updates);
      break;
    case 'PAULA':
      extractPaulaData(lowerMsg, currentForm, updates);
      break;
    case 'ALUNA':
      extractAlunaData(lowerMsg, currentForm, updates);
      break;
    case 'GABI':
      await extractGabiData(lowerMsg, currentForm, updates);
      break;
  }

  return updates;
}

/**
 * 🛡️ ADRIANA - Detectar datos de seguros
 */
function extractAdrianaData(lowerMsg, currentForm, updates) {
  // Ciudad (detectar ciudades de la Sierra)
  if (!currentForm.data.city) {
    const sierraCities = [
      'quito', 'ibarra', 'cayambe', 'tulcán', 'tulcan', 'tabacundo', 'cotacachi', 'pedro moncayo',
      'latacunga', 'ambato', 'riobamba', 'guaranda', 'baños', 'banos', 'saquisilí', 'saquisili', 'pujilí', 'pujili', 'pelileo', 'guano', 'alausí', 'alausi',
      'cuenca', 'loja', 'azogues', 'cariamanga', 'catamayo', 'gualaceo', 'paute'
    ];
    for (const city of sierraCities) {
      if (lowerMsg.includes(city)) {
        updates.city = city.charAt(0).toUpperCase() + city.slice(1);
        break;
      }
    }
  }

  // Valor comercial (detectar montos en dólares)
  if (!currentForm.data.commercialValue) {
    // Detectar $42,000 o 42000 o $42000 o 42.000
    const valueMatch = lowerMsg.match(/\$?\s?(\d{1,3}[,.]?\d{3,})/); 
    if (valueMatch) {
      const cleanValue = valueMatch[1].replace(/[,.](?=\d{3})/g, ''); // Remover separadores
      const value = parseFloat(cleanValue);
      if (value >= 1000) { // Mínimo razonable para un vehículo
        updates.commercialValue = value;
      }
    }
  }

  // Cédula
  if (!currentForm.data.cedula) {
    const cedulaMatch = lowerMsg.match(/\b(\d{10}|\d{13})\b/);
    if (cedulaMatch) {
      updates.cedula = cedulaMatch[1];
    }
  }

  // Placa
  if (!currentForm.data.plate) {
    const plateMatch = lowerMsg.match(/\b([A-Z]{3}-\d{3,4})\b/i);
    if (plateMatch) {
      updates.plate = plateMatch[1].toUpperCase();
    }
  }
}

// AXEL: Sistema especializado en src/servicios/axel-quote-form.js
// Usa OpenAI para extracción más precisa (ej: "corolla 2015" → marca:Toyota, modelo:Corolla, año:2015)

/**
 * 🎯 ENZO - Detectar datos de marketing
 */
function extractEnzoData(lowerMsg, currentForm, updates) {
  // Tipo de proyecto
  if (!currentForm.data.projectType) {
    if (lowerMsg.includes('campaña') || lowerMsg.includes('publicidad') || lowerMsg.includes('ads')) {
      updates.projectType = 'campaña digital';
    } else if (lowerMsg.includes('automatización') || lowerMsg.includes('ia') || lowerMsg.includes('agente')) {
      updates.projectType = 'automatización IA';
    } else if (lowerMsg.includes('software') || lowerMsg.includes('sistema') || lowerMsg.includes('app')) {
      updates.projectType = 'software';
    } else if (lowerMsg.includes('estrategia') || lowerMsg.includes('consultoría')) {
      updates.projectType = 'estrategia';
    }
  }

  // Urgencia
  if (!currentForm.data.urgency) {
    if (lowerMsg.includes('urgente') || lowerMsg.includes('asap') || lowerMsg.includes('ya')) {
      updates.urgency = 'ASAP';
    } else if (lowerMsg.includes('semana')) {
      updates.urgency = '1 semana';
    } else if (lowerMsg.includes('mes')) {
      updates.urgency = '1 mes';
    } else if (lowerMsg.includes('flexible')) {
      updates.urgency = 'flexible';
    }
  }
}

/**
 * 🏘️ PAULA - Detectar datos de real estate
 */
function extractPaulaData(lowerMsg, currentForm, updates) {
  // Tipo de operación
  if (!currentForm.data.operationType) {
    if (lowerMsg.includes('comprar') || lowerMsg.includes('compra')) {
      updates.operationType = 'compra';
    } else if (lowerMsg.includes('vender') || lowerMsg.includes('venta')) {
      updates.operationType = 'venta';
    } else if (lowerMsg.includes('arrendar') || lowerMsg.includes('alquil') || lowerMsg.includes('rent')) {
      updates.operationType = 'arriendo';
    }
  }

  // Tipo de propiedad
  if (!currentForm.data.propertyType) {
    if (lowerMsg.includes('departamento') || lowerMsg.includes('depa')) {
      updates.propertyType = 'departamento';
    } else if (lowerMsg.includes('casa')) {
      updates.propertyType = 'casa';
    } else if (lowerMsg.includes('local')) {
      updates.propertyType = 'local';
    } else if (lowerMsg.includes('terreno')) {
      updates.propertyType = 'terreno';
    }
  }

  // Zona
  const zonas = ['cumbayá', 'tumbaco', 'carolina', 'gonzález suárez', 'floresta', 'pradera', 'chillos'];
  if (!currentForm.data.zone) {
    for (const zona of zonas) {
      if (lowerMsg.includes(zona)) {
        updates.zone = zona.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }
  }
}

/**
 * 🎫 ALUNA - Detectar datos de membresías
 */
function extractAlunaData(lowerMsg, currentForm, updates) {
  // 🔒 Guardar último mensaje para análisis contextual
  updates._lastMessage = currentForm.data._lastMessage || '';
  
  // Tipo de membresía - DETECTAR TODOS LOS FORMATOS
  // 🚨 FIX: Solo detectar si NO existe ya para evitar resetear formulario
  if (!currentForm.data.membershipType) {
    // Detectar "Plan 10", "Plan 20", etc.
    if (lowerMsg.includes('plan 10') || lowerMsg.includes('plan10')) {
      updates.membershipType = 'Plan 10';
      console.log('[ALUNA] 📦 Detectado: Plan 10');
    } else if (lowerMsg.includes('plan 20') || lowerMsg.includes('plan20')) {
      updates.membershipType = 'Plan 20';
      console.log('[ALUNA] 📦 Detectado: Plan 20');
    } else if (lowerMsg.includes('hot desk')) {
      updates.membershipType = 'Hot Desk mensual';
      console.log('[ALUNA] 📦 Detectado: Hot Desk mensual');
    } else if (lowerMsg.includes('sala') && (lowerMsg.includes('reunion') || lowerMsg.includes('reunión'))) {
      updates.membershipType = 'Sala Reuniones';
      console.log('[ALUNA] 📦 Detectado: Sala Reuniones');
    } else if (lowerMsg.includes('oficina virtual') || lowerMsg.includes('virtual office')) {
      updates.membershipType = 'Oficina Virtual';
      console.log('[ALUNA] 📦 Detectado: Oficina Virtual');
    }
  } else {
    console.log('[ALUNA] ℹ️ membershipType ya existe:', currentForm.data.membershipType, '- NO sobrescribir');
  }
  
  // 📅 Fecha de inicio - SOLO detectar si usuario menciona explícitamente
  // ✅ FIX: Eliminado default que causaba loop - No asumir "hoy" automáticamente
  if (!currentForm.data.startDate) {
    const today = new Date();
    
    if (lowerMsg.includes('hoy') || lowerMsg.includes('ya') || lowerMsg.includes('inmediatamente') || lowerMsg.includes('ahora')) {
      updates.startDate = today.toISOString().split('T')[0];
      console.log('[ALUNA] 📅 Fecha inicio: HOY', updates.startDate);
    } else if (lowerMsg.includes('mañana') || lowerMsg.includes('manana')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      updates.startDate = tomorrow.toISOString().split('T')[0];
      console.log('[ALUNA] 📅 Fecha inicio: MAÑANA', updates.startDate);
    }
    // ✅ NO asignar startDate si no se menciona - Evita loop infinito
  }
  
  // 👤 Nombre completo - Detección inteligente y flexible
  // ✅ FIX: Aceptar 1-4 palabras capitalizadas, contexto conversacional mejorado
  if (!currentForm.data.fullName) {
    const originalMessage = currentForm.data._lastMessage || '';
    
    // Patrones de detección (en orden de prioridad):
    const namePatterns = [
      // 1. Presentación explícita: "mi nombre es Juan Pérez", "me llamo María", "soy Carlos Gómez"
      /(?:mi nombre es|me llamo|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/i,
      
      // 2. Respuesta directa: "Juan Pérez" o "María González Sánchez" (1-4 palabras capitalizadas)
      /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})$/,
      
      // 3. En medio de frase: "Sí, soy Juan Pérez", "Claro, me llamo María"
      /(?:sí|si|claro|ok|dale|perfecto)[,\s]+(?:soy|me llamo|mi nombre es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/i
    ];
    
    for (const pattern of namePatterns) {
      const match = originalMessage.match(pattern);
      if (match && match[1]) {
        const detectedName = match[1].trim();
        
        // Validar que no sea una palabra común (evitar falsos positivos)
        const commonWords = ['si', 'sí', 'no', 'ok', 'claro', 'perfecto', 'gracias', 'hola', 'buenas'];
        if (!commonWords.includes(detectedName.toLowerCase())) {
          updates.fullName = detectedName;
          console.log('[ALUNA] 👤 Nombre detectado:', updates.fullName);
          break;
        }
      }
    }
  }
  
  // 📱 Teléfono - Detección mejorada con validación
  // ✅ FIX: Solo detectar cuando mensaje contiene SOLO el teléfono (evitar detectar en conversación)
  if (!currentForm.data.phone) {
    const originalMessage = currentForm.data._lastMessage || '';
    
    // Detectar teléfonos ecuatorianos
    const phonePatterns = [
      /\b(09\d{8})\b/, // 09XXXXXXXX
      /\b(\+?593\s?9\d{8})\b/, // +593 9XXXXXXXX
      /\b(9\d{8})\b/ // 9XXXXXXXX
    ];
    
    for (const pattern of phonePatterns) {
      const match = originalMessage.match(pattern);
      if (match && match[1]) {
        let phone = match[1].replace(/\s/g, '');
        
        // Normalizar a formato +593
        if (phone.startsWith('09')) {
          phone = `+593${phone.slice(1)}`;
        } else if (phone.startsWith('9') && phone.length === 9) {
          phone = `+593${phone}`;
        } else if (phone.startsWith('593') && !phone.startsWith('+')) {
          phone = `+${phone}`;
        }
        
        updates.phone = phone;
        console.log('[ALUNA] 📱 Teléfono detectado:', updates.phone);
        break;
      }
    }
  }
}

/**
 * ⚖️ GABI - Detectar datos de consultoría legal/contable
 */
async function extractGabiData(lowerMsg, currentForm, updates) {
  // 🔒 Guardar último mensaje para análisis contextual
  updates._lastMessage = currentForm.data._lastMessage || '';
  
  // Tipo de consultoría
  if (!currentForm.data.consultationType) {
    if (lowerMsg.includes('contab')) {
      updates.consultationType = 'Contabilidad';
      console.log('[GABI] ⚖️ Detectado: Contabilidad');
    } else if (lowerMsg.includes('legal') || lowerMsg.includes('abogado') || lowerMsg.includes('contrato')) {
      updates.consultationType = 'Legal';
      console.log('[GABI] ⚖️ Detectado: Legal');
    } else if (lowerMsg.includes('rrhh') || lowerMsg.includes('recursos humanos') || lowerMsg.includes('nomina') || lowerMsg.includes('nómina') || lowerMsg.includes('empleado')) {
      updates.consultationType = 'RRHH';
      console.log('[GABI] ⚖️ Detectado: RRHH');
    } else if (lowerMsg.includes('fiscal') || lowerMsg.includes('sri') || lowerMsg.includes('impuesto') || lowerMsg.includes('tributar')) {
      updates.consultationType = 'Fiscal';
      console.log('[GABI] ⚖️ Detectado: Fiscal');
    } else if (lowerMsg.includes('otro') || lowerMsg.includes('consulta general')) {
      updates.consultationType = 'Otro';
      console.log('[GABI] ⚖️ Detectado: Otro');
    }
  }
  
  // Empresa (opcional)
  if (!currentForm.data.companyName) {
    const originalMessage = currentForm.data._lastMessage || '';
    
    // Detectar "persona natural" explícitamente
    if (lowerMsg.includes('persona natural') || lowerMsg.includes('no tengo empresa') || lowerMsg.includes('particular')) {
      updates.companyName = 'Persona Natural';
      console.log('[GABI] 🏢 Detectado: Persona Natural');
    } else {
      // Detectar nombre de empresa (capitalizado, 1-5 palabras)
      const companyMatch = originalMessage.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s&.,-]{2,50})$/);
      if (companyMatch && !lowerMsg.includes('@') && !lowerMsg.includes('.com')) {
        updates.companyName = companyMatch[1].trim();
        console.log('[GABI] 🏢 Empresa detectada:', updates.companyName);
      }
    }
  }
  
  // RUC (opcional con validación SRI)
  if (!currentForm.data.ruc) {
    const originalMessage = currentForm.data._lastMessage || '';
    
    // Detectar "no tengo RUC"
    if (lowerMsg.includes('no tengo') || lowerMsg.includes('sin ruc') || lowerMsg.includes('no') && lowerMsg.length < 5) {
      updates.ruc = 'No tiene';
      updates._rucValidated = true;
      console.log('[GABI] 🆔 RUC: No tiene');
    } else {
      // Detectar RUC ecuatoriano (10 o 13 dígitos)
      const rucMatch = originalMessage.match(/\b(\d{10}|\d{13})\b/);
      if (rucMatch) {
        const detectedRuc = rucMatch[1];
        updates.ruc = detectedRuc;
        console.log('[GABI] 🆔 RUC detectado:', detectedRuc);
        
        // Validar RUC con SRI en tiempo real
        try {
          const { validateRuc } = await import('./sri-validator.js');
          const validation = await validateRuc(detectedRuc);
          
          if (validation.valid && validation.sriValid) {
            updates._rucValidated = true;
            updates._rucData = {
              razonSocial: validation.razonSocial,
              estado: validation.estado,
              tipoContribuyente: validation.tipoContribuyente
            };
            
            // Si empresa no fue proporcionada, usar razón social del SRI
            if (!currentForm.data.companyName && validation.razonSocial && validation.razonSocial !== 'No disponible') {
              updates.companyName = validation.razonSocial;
              console.log('[GABI] 🏢 Razón Social obtenida del SRI:', validation.razonSocial);
            }
            
            console.log('[GABI] ✅ RUC validado en SRI:', validation.estado);
          } else {
            updates._rucValidated = false;
            updates._rucError = validation.message || 'RUC no válido';
            console.log('[GABI] ⚠️ RUC inválido:', validation.message);
          }
        } catch (error) {
          console.error('[GABI] ❌ Error validando RUC:', error.message);
          // Continuar sin validación SRI
          updates._rucValidated = 'error';
        }
      }
    }
  }
  
  // Nombre completo
  if (!currentForm.data.fullName) {
    const originalMessage = currentForm.data._lastMessage || '';
    
    const namePatterns = [
      /(?:mi nombre es|me llamo|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/i,
      /^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})$/,
      /(?:sí|si|claro|ok)[,\s]+(?:soy|me llamo)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/i
    ];
    
    for (const pattern of namePatterns) {
      const match = originalMessage.match(pattern);
      if (match && match[1]) {
        const detectedName = match[1].trim();
        const commonWords = ['si', 'sí', 'no', 'ok', 'claro', 'gracias', 'hola'];
        if (!commonWords.includes(detectedName.toLowerCase())) {
          updates.fullName = detectedName;
          console.log('[GABI] 👤 Nombre detectado:', updates.fullName);
          break;
        }
      }
    }
  }
  
  // Teléfono
  if (!currentForm.data.phone) {
    const originalMessage = currentForm.data._lastMessage || '';
    
    const phonePatterns = [
      /\b(09\d{8})\b/,
      /\b(\+?593\s?9\d{8})\b/,
      /\b(9\d{8})\b/
    ];
    
    for (const pattern of phonePatterns) {
      const match = originalMessage.match(pattern);
      if (match && match[1]) {
        let phone = match[1].replace(/\s/g, '');
        
        if (phone.startsWith('09')) {
          phone = `+593${phone.slice(1)}`;
        } else if (phone.startsWith('9') && phone.length === 9) {
          phone = `+593${phone}`;
        } else if (phone.startsWith('593') && !phone.startsWith('+')) {
          phone = `+${phone}`;
        }
        
        updates.phone = phone;
        console.log('[GABI] 📱 Teléfono detectado:', updates.phone);
        break;
      }
    }
  }
  
  // Descripción (texto libre > 20 caracteres que no sea otro campo)
  if (!currentForm.data.description && currentForm.data._lastMessage) {
    const msg = currentForm.data._lastMessage.trim();
    
    // Si es un mensaje largo y no coincide con otros campos, es descripción
    if (msg.length > 20 && 
        !msg.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+){1,3}[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/) && // No es nombre
        !msg.match(/\b(\d{10}|\d{13})\b/) && // No es RUC
        !msg.match(/@/) && // No es email
        !msg.match(/\d{9}/)) { // No es teléfono
      updates.description = msg;
      console.log('[GABI] 📝 Descripción detectada:', updates.description.substring(0, 50) + '...');
    }
  }
  
  // Urgencia
  if (!currentForm.data.urgency) {
    if (lowerMsg.includes('urgent') || lowerMsg.includes('rapido') || lowerMsg.includes('rápido') || lowerMsg.includes('ya') || lowerMsg.includes('asap') || lowerMsg.includes('24 hor')) {
      updates.urgency = 'Urgente';
      console.log('[GABI] ⏰ Urgencia: Urgente');
    } else if (lowerMsg.includes('planific') || lowerMsg.includes('semana') || lowerMsg.includes('mes') || lowerMsg.includes('despues') || lowerMsg.includes('después') || lowerMsg.includes('flexible')) {
      updates.urgency = 'Planificación';
      console.log('[GABI] ⏰ Urgencia: Planificación');
    } else if (lowerMsg.includes('normal') || lowerMsg.includes('regular') || lowerMsg.includes('estándar') || lowerMsg.includes('estandar')) {
      updates.urgency = 'Normal';
      console.log('[GABI] ⏰ Urgencia: Normal');
    }
  }
}

/**
 * 🚀 Procesar mensaje con formulario genérico
 * 
 * Similar a processMessageWithForm de Aurora pero universal
 */
export async function processGenericFormMessage(userId, message, agentName) {
  try {
    // 1. Obtener o crear formulario
    const form = await getOrCreateGenericForm(userId, agentName);
    
    // 2. Extraer datos del mensaje
    const updates = await extractDataFromMessage(message, agentName, form);
    
    // 3. Actualizar formulario
    if (Object.keys(updates).length > 0) {
      form.updateFields(updates);
      await saveGenericForm(form);
    }
    
    // 4. Verificar si está completo
    const isComplete = form.isComplete();
    const nextQuestion = form.getNextQuestion();
    
    return {
      form,
      updates,
      isComplete,
      needsMoreInfo: !isComplete,
      nextQuestion,
      summary: form.getSummary(),
      data: form.data // Datos completos para usar en confirmación
    };
  } catch (error) {
    console.error(`[GENERIC-FORM] ❌ Error procesando mensaje ${agentName}:`, error);
    throw error;
  }
}

export default {
  GenericForm,
  FORM_SCHEMAS,
  getOrCreateGenericForm,
  saveGenericForm,
  clearGenericForm,
  extractDataFromMessage,
  processGenericFormMessage
};
