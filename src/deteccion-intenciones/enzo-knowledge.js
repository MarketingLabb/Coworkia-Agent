// 📚 Base de conocimiento de Enzo
// Extraído de enzo.js para mejor mantenibilidad
// Última actualización: 2026-02-12

import { MEMBERSHIP_PLANS, HOURS } from '../utils/coworkia-facts.js';

export const conocimientoEnzo = {
  marketing: {
    canales: ['Meta Ads', 'Google Ads', 'TikTok', 'WhatsApp Business', 'Email'],
    estrategias: ['Inbound', 'Outbound', 'Content Marketing', 'Community'],
    kpis: ['CAC', 'LTV', 'ROAS', 'Tasa de conversión', 'Engagement']
  },
  
  ia: {
    herramientas: ['ChatGPT', 'Claude', 'Midjourney', 'Make.com', 'Zapier'],
    casos: ['Automatización atención cliente', 'Generación contenido', 'Análisis datos', 'Chatbots'],
    implementacion: 'Enfoque práctico, ROI rápido'
  },

  software: {
    crm: ['HubSpot', 'Pipedrive', 'Zoho (Ecuador)'],
    automatizacion: ['Make', 'Zapier', 'n8n'],
    ecommerce: ['Shopify', 'WooCommerce', 'Tiendanube'],
    pagos: ['Payphone', 'Kushki', 'PlaceToPay (Ecuador)']
  },

  mercadoEcuador: {
    peculiaridades: [
      'WhatsApp como canal principal',
      'Desconfianza en pagos online (generar confianza)',
      'Preferencia por contenido video corto',
      'Payphone como método de pago dominante',
      'Informalidad alta (educar en procesos)'
    ],
    oportunidades: [
      'Baja competencia en IA aplicada',
      'Necesidad de digitalización pymes',
      'Growth en ecommerce post-pandemia'
    ]
  },

  agentesIA: {
    precios: {
      ecuador: {
        desarrollo: {
          basico: 3500,      // Agente básico (FAQ, derivación)
          intermedio: 6500,  // Agente con IA + formularios
          avanzado: 12000    // Agente con Vision AI + integraciones
        },
        mantenimiento: {
          mensual: 250,      // Entrenamiento + ajustes
          trimestral: 650    // 3 meses (ahorro 13%)
        }
      },
      republicaDominicana: {
        desarrollo: {
          basico: 4000,
          intermedio: 7500,
          avanzado: 14000
        },
        mantenimiento: {
          mensual: 300,
          trimestral: 800
        }
      }
    },
    
    descuentoIntroduccion: 0.25, // 25% descuento
    
    incluyeDesarrollo: [
      'Análisis y diseño de personalidad del agente',
      'Integración con WhatsApp Business',
      'Entrenamiento inicial con casos de uso',
      'Pruebas y ajustes (2 semanas)',
      'Documentación técnica',
      'Capacitación al equipo (2 horas)'
    ],
    
    incluyeMantenimiento: [
      'Reentrenamiento mensual con conversaciones reales',
      'Ajustes de prompts y flujos',
      'Monitoreo de errores',
      'Actualizaciones de modelo IA',
      'Soporte técnico prioritario'
    ],
    
    noIncluye: [
      'Integraciones con sistemas externos (CRM, ERP)',
      'Diseño gráfico o branding',
      'Infraestructura de servidores',
      'Traducción a más de 2 idiomas',
      'Vision AI para análisis de imágenes (costo adicional)',
      'Migración de datos históricos'
    ],
    
    entregables: [
      'Agente IA funcional en producción',
      'Acceso al panel de administración',
      'Documentación de uso',
      'Reporte de conversaciones (primeros 30 días)',
      'Garantía 15 días devolución si no cumple expectativas'
    ],
    
    tiempoDesarrollo: '3-4 semanas desde aprobación',
    vigenciaOferta: '30 días calendario',
    
    disclaimers: {
      legal: 'La cotización es referencial y está sujeta a evaluación final del proyecto. Precios en USD.',
      alcance: 'Cualquier funcionalidad fuera del alcance inicial será cotizada por separado.',
      mantenimiento: 'Primer mes de mantenimiento GRATIS como bonificación. Mantenimiento posterior opcional pero recomendado.',
      resultados: 'Los resultados de conversión dependen de múltiples factores (producto, mercado, competencia). OneMind/MarketingLab no garantiza métricas específicas.',
      vigencia: 'Oferta válida por 30 días. Después de este plazo, precios sujetos a revisión.',
      pago: 'Modalidad: 50% inicio + 50% entrega. Mantenimiento mensual adelantado.'
    }
  },

  // 🎯 ECOSISTEMA COWORKIA - PERFILES COMPLETOS DE AGENTES
  ecosistemaCoworkia: {
    AURORA: {
      nombre: 'Aurora',
      empresa: 'Coworkia Business Center',
      rol: 'Coordinadora Central y Recepcionista IA',
      
      personalidad: {
        descripcion: 'Torre de control del ecosistema. Como una recepcionista de hotel 5 estrellas combinada con un sistema de gestión empresarial. Cálida pero precisa, actúa como la mente central que coordina todas las operaciones.',
        tono: 'Profesional pero cercana, eficiente sin ser fría',
        energia: 'Activa, siempre disponible, facilita procesos',
        comparacion: 'Recepcionista de hotel 5 estrellas que nunca duerme y puede gestionar 100 clientes simultáneamente sin perder la cordialidad'
      },
      
      destrezasUnicas: [
        '🎯 Orquestación de agentes: Deriva al especialista correcto según necesidad',
        '📅 Gestión de reservas en tiempo real (Hot Desk, Salas de Reuniones)',
        '📸 Vision AI para constancias de pago con cálculo automático de impuestos y comisiones',
        '💰 Procesamiento de pagos unitarios ($10-$69 por reserva)',
        '🕐 Disponibilidad 24/7 sin intervención humana',
        '🌍 Multi-idioma: ES, EN, FR, IT, PT (detección automática)'
      ],
      
      capacidadesTecnicas: {
        visionAI: true,
        visionAIDescripcion: 'Lee constancias de pago, calcula automáticamente impuestos y comisiones según tipo de pago, extrae monto, fecha, referencia',
        formularios: true,
        formulariosDescripcion: 'Recopila datos de reserva paso a paso (nombre, email, fecha, hora, método de pago)',
        integraciones: ['PostgreSQL', 'Wassenger WhatsApp', 'Payphone', 'Email SMTP'],
        tiempoRespuesta: '1-2 segundos promedio'
      },
      
      modeloNegocio: {
        tipo: 'Pago por uso (transaccional)',
        precios: {
          hotDesk: '$10 por 2 horas (primera visita GRATIS)',
          salaReuniones: '$30 por 2 horas (máximo 4 personas)'
        },
        volumenActual: '50-100 reservas/mes procesadas automáticamente',
        roiCliente: 'Elimina necesidad de recepcionista física = ahorro $600-800/mes'
      },
      
      casosDeUsoReales: [
        {
          titulo: 'Usuario nuevo quiere probar coworking',
          escenario: 'Usuario escribe: "quiero hot desk mañana 10am"',
          flujo: 'Aurora: Recopila nombre, email, confirma disponibilidad, reserva espacio',
          resultado: 'Reserva confirmada en 2 minutos sin intervención humana'
        },
        {
          titulo: 'Usuario envía comprobante de pago',
          escenario: 'Usuario envía foto de recibo de Payphone',
          flujo: 'Aurora con Vision AI: Lee el monto, calcula automáticamente impuesto y comisión según tipo de pago, extrae fecha y número de referencia, valida que coincida con la reserva, confirma automáticamente',
          resultado: 'Procesamiento y validación de pago en 5 segundos'
        },
        {
          titulo: 'Usuario necesita marketing',
          escenario: 'Usuario: "necesito ayuda con marketing digital"',
          flujo: 'Aurora: "Perfecto, te conecto con @enzo de MarketingLab, nuestro experto" → Handoff automático con contexto',
          resultado: 'Derivación inteligente al especialista correcto'
        }
      ],
      
      aplicableA: [
        'Coworkings, hoteles, spas (gestión de reservas)',
        'Restaurantes (pedidos + confirmación de pagos por WhatsApp)',
        'Clínicas médicas (agendamiento de citas + pagos)',
        'Centros educativos (reserva de aulas, laboratorios)',
        'Centros deportivos (reserva de canchas, clases de gimnasio)'
      ],
      
      ejemploVentaEnzo: `Mira, Aurora es como tener una recepcionista 5 estrellas que nunca duerme 🎯

Procesa más de 50 reservas al mes automáticamente, lee comprobantes de pago con Vision AI (calculando impuestos y comisiones automáticamente), y deriva clientes a otros especialistas según su necesidad.

Para tu [tipo de negocio], Aurora podría:
• Gestionar reservas/citas 24/7 sin intervención humana
• Procesar pagos con Vision AI (lee recibos, valida montos)
• Derivar clientes al especialista correcto automáticamente

Inversión: Desde $3,500 desarrollo + $400/mes mantenimiento

ROI: Ahorras 1 recepcionista = $600-800/mes + disponibilidad 24/7

¿Quieres ver cómo funcionaría? Prueba: @aurora quiero hot desk mañana 10am`
    },

    ALUNA: {
      nombre: 'Aluna',
      empresa: 'Coworkia Business Center',
      rol: 'Closer de Ventas y Especialista en Membresías',
      
      personalidad: {
        descripcion: 'Vendedora consultiva de alto nivel 🎯 No es agresiva ni insistente, asesora con valor genuino 💎 Como una consultora de negocios que entiende las necesidades del cliente y presenta soluciones personalizadas. Convierte usuarios gratuitos en miembros recurrentes mediante beneficios claros y ROI demostrable 📊',
        tono: 'Entusiasta pero consultiva 😊, orientada a beneficios no a presión 🚫',
        energia: 'Motivadora 🚀, empática 💙, celebra decisiones del cliente 🎉',
        comparacion: 'Como un asesor financiero que te ayuda a ver el ahorro a largo plazo, no como un vendedor de autos usados'
      },
      
      destrezasUnicas: [
        '🎯 Cierre consultivo: Convierte usuarios gratuitos mostrando ahorro real. Ejemplo: "10 visitas = $100 💸, Plan 10 = $67 por 11 días 📅. Ahorras $33/mes 💰"',
        '📸 Vision AI para validación de pagos: Lee constancias de pago de membresías mensuales',
        '🛡️ Manejo de objeciones: Respuestas preparadas para "muy caro", "no vengo seguido", "necesito pensarlo". No presiona, educa 📚',
        '⬆️ Upselling estratégico: Basado en comportamiento real del usuario (2-3 visitas/semana → Plan 10)',
        '📞 Seguimiento personalizado: Después de período de prueba hace seguimiento suave sin presión',
        '🧮 Cálculo automático de ROI: "Con tu frecuencia actual, ahorrarías $X al mes 💵"'
      ],
      
      capacidadesTecnicas: {
        visionAI: true,
        visionAIDescripcion: 'Lee constancias de pago de membresías mensuales y valida montos',
        formularios: true,
        formulariosDescripcion: 'Recopila datos para contratos de membresía (nombre completo, cédula, email, dirección de facturación)',
        integraciones: ['PostgreSQL', 'Wassenger WhatsApp', 'Payphone', 'Email SMTP (contratos digitales)'],
        tiempoRespuesta: '1-2 segundos promedio'
      },
      
      modeloNegocio: {
        tipo: 'Membresías recurrentes (ingreso predecible)',
        // Precios/horario derivados de la fuente única de verdad (coworkia-facts.js)
        planesQueVende: {
          plan10: `${MEMBERSHIP_PLANS.plan10.priceDisplay} (11 días Hot Desk, entrada libre todo el día, ${HOURS.display})`,
          plan20: `${MEMBERSHIP_PLANS.plan20.priceDisplay} (22 días Hot Desk, entrada libre todo el día)`,
          oficinaVirtual: `${MEMBERSHIP_PLANS.oficinavirtual.priceDisplay} (dirección comercial + gestión de correo)`,
          salaReuniones: `${MEMBERSHIP_PLANS.salareuniones.priceDisplay} 2h para miembros`
        },
        tasaConversion: '20% de usuarios gratuitos → miembros',
        roiCoworkia: 'Cada miembro Plan 10 = $1,680/año vs $10-30 por visita única',
        roiCliente: 'Ahorro de 30-40% vs pagar visitas sueltas + flexibilidad horaria total'
      },
      
      casosDeUsoReales: [
        {
          titulo: 'Usuario frecuente sin membresía',
          escenario: 'Usuario ha visitado 3 veces pagando $10 cada vez (2 horas por visita) 💳',
          flujo: `Aluna: "Hola Diego! 👋 Vi que has venido 3 veces este mes pagando $10 por 2 horas ⏰\n\n¿Sabías que con el Plan 10 pagas $67 por 11 días pero con ENTRADA LIBRE TODO EL DÍA? 🎯🔓\n\nEn lugar de 2 horas, puedes estar dentro del horario ${HOURS.display} cuando quieras ☀️🌙\n\nSi sigues viniendo 3 veces/mes pero quedándote todo el día = trabajas 24-30 horas vs 6 horas actuales 📈 ROI: 4x más productividad por solo $37 adicionales 💪"`,
          resultado: 'Usuario ve el ahorro claro, convierte a Plan 10 ✅'
        },
        {
          titulo: 'Usuario envía comprobante de pago de membresía',
          escenario: 'Usuario contrata Plan 10 y envía foto de transferencia de $67 📸',
          flujo: 'Aluna con Vision AI: Lee monto ($67 💵), fecha 📅, referencia #️⃣, valida que coincida con Plan 10, activa membresía automáticamente ⚡, envía contrato digital 📄',
          resultado: 'Activación de membresía en 10 segundos sin intervención humana ⏱️✅'
        },
        {
          titulo: 'Manejo de objeción "muy caro"',
          escenario: 'Usuario: "El Plan 10 me parece caro, prefiero pagar por visita" 💸',
          flujo: `Aluna: "Te entiendo perfectamente! 😊 Déjame mostrarte la diferencia real:\n\n**VISITA SUELTA:** 🎫\n• $10 por 2 horas ⏰\n• 10 visitas de 2h = $100/mes (20 horas totales) 📊\n\n**PLAN 10:** 🎟️\n• $67/mes por 11 días 📅\n• ENTRADA LIBRE TODO EL DÍA (${HOURS.display}) 🔓☀️\n• Si vienes 1 día completo = 8-9 horas vs 2 horas ⏳\n• Puedes trabajar 80-100 horas/mes vs 20 horas 🚀\n\nLa diferencia no es solo el precio, es FLEXIBILIDAD TOTAL: 💎\n✅ Entras y sales cuando quieras 🚪\n✅ No estás limitado a 2 horas ⏰\n✅ Sin reservas (ya tienes tu día garantizado) 📅\n\n¿Cuánto vale poder trabajar todo el día sin estrés vs estar corriendo contra el reloj de 2 horas? 🤔💡"`,
          resultado: 'Usuario ve el valor más allá del precio 💯'
        }
      ],
      
      roiDetallado: {
        visitasSueltas: '$10 por 2h = $5/hora 💸',
        plan10: '$67 por 11 días completos (88-99h potenciales) = $0.68-0.76/hora 💰',
        ahorroReal: '85% en costo por hora de trabajo 📉✅'
      },
      
      aplicableA: [
        'Gimnasios (venta de membresías vs clases sueltas)',
        'Centros de yoga/pilates (planes mensuales vs drop-in)',
        'Coworkings (membresías vs hot desk diario)',
        'Spas (paquetes mensuales vs sesiones individuales)',
        'Clínicas estéticas (planes de tratamiento vs consultas sueltas)',
        'Centros de idiomas (cursos completos vs clases sueltas)',
        'Cualquier negocio con modelo de suscripción/membresía'
      ],
      
      ejemploVentaEnzo: `Aluna es tu closer de ventas 24/7 que convierte usuarios de visitas sueltas en miembros recurrentes 🎯💼

No vende precio, vende LIBERTAD 🔓:
• 'Con visita suelta pagas $10 por 2 horas ⏰ Con Plan 10 pagas $67 pero entras TODO EL DÍA cuando quieras 🌞'
• Maneja objeciones mostrando costo por hora real: $5/h 💸 vs $0.70/h 💰
• Vision AI valida pagos de membresías automáticamente 📸⚡

Caso real de Coworkia: Convierte 20% de usuarios gratuitos en miembros recurrentes 📊✅

Para tu [gimnasio/coworking/spa], Aluna podría:
• Identificar usuarios frecuentes que pagan por sesión 🔍
• Mostrar valor de acceso ilimitado vs sesiones limitadas 🔓
• Cerrar ventas educando sobre libertad y flexibilidad 💡
• Procesar pagos con Vision AI 📸💳

Inversión: Desde $3,500 desarrollo + $400/mes mantenimiento 💵

ROI: 10 miembros nuevos = $1,400/mes recurrente 💰 vs $300-500 en visitas ocasionales 📈

¿Quieres ver cómo cierra? Escribe: @aluna cuéntame de planes mensuales 🚀`
    },

    ANGELA: {
      nombre: 'Angela',
      rol: 'Asistencia Médica Popular 🏥❤️',
      empresa: 'MedBeneficios',
      mision: 'Democratizar acceso a salud para familias ecuatorianas sin IESS',
      personalidad: {
        descripcion: `Angela es una enfermera digital con vocación social profunda. 
Habla con empatía y cercanía, como una trabajadora social de barrio que conoce 
las dificultades de acceso a salud en Ecuador. Usa lenguaje simple y familiar.`,
        tono: 'Cálido, maternal, solidario, accesible',
        valores: ['Dignidad humana', 'Acceso universal', 'Empatía', 'Servicio social'],
        emojis: '🏥❤️👨‍👩‍👧‍👦💉🩺'
      },
      
      capacidadesTecnicas: {
        visionAI: {
          descripcion: 'Analiza heridas, piel, ojos y documentos médicos con GPT-4o',
          casos: [
            '📸 Foto de herida → evaluación preliminar + recomendación urgencia',
            '📸 Foto de piel → detección posible dermatitis, hongos, alergias',
            '📸 Foto de ojos → identificación conjuntivitis, inflamación',
            '📸 Receta médica → interpretación y explicación en lenguaje simple',
            '📸 Resultado de laboratorio → traducción a términos comprensibles'
          ],
          precision: 'Pre-diagnóstico orientativo, NO reemplaza doctor pero guía acción'
        },
        
        triaje: {
          descripcion: 'Clasifica urgencia y deriva casos según gravedad',
          niveles: [
            '🟢 BAJA: Angela resuelve con recomendaciones generales',
            '🟡 MEDIA: Angela deriva a doctor virtual en 15 minutos',
            '🔴 ALTA: Angela activa protocolo urgencia inmediata'
          ]
        },
        
        escalabilidad: {
          autonoma: '70% de consultas resueltas por Angela (resfriados, dolores comunes, consejos)',
          conDoctor: '30% requieren médico humano (casos complejos, recetas, diagnósticos)'
        },
        
        disponibilidad: '24/7/365 por WhatsApp',
        idiomas: ['ES', 'Kichwa básico']
      },
      
      modeloNegocio: {
        precio: '$3 USD/mes por familia completa 👨‍👩‍👧‍👦',
        beneficios: [
          'Consultas médicas ILIMITADAS (sin límite mensual) ♾️',
          'Cobertura para TODA la familia (padres, hijos, abuelos) 👨‍👩‍👧‍👦',
          'Acceso 24/7 a Angela + médicos virtuales 🕐',
          'Pre-diagnósticos con Vision AI 📸',
          'Recetas digitales cuando aplica 💊',
          'Seguimiento de tratamientos 📋',
          'Recordatorios de medicinas ⏰'
        ],
        
        propuestaValor: {
          vs_consultaPrivada: 'Consulta privada = $25-50 | MedBeneficios = $3/mes ilimitado',
          vs_iess: 'Sin filas, sin trámites, sin burocracia',
          vs_nada: 'Pasar de NO tener acceso a salud → tenerlo por $3/mes'
        },
        
        mercadoObjetivo: {
          primario: [
            '🏪 Tenderos y comerciantes informales',
            '🤝 Miembros de cooperativas populares',
            '👨‍🔧 Microempresarios sin afiliación IESS',
            '👨‍👩‍👧 Familias de bajos ingresos sin seguro'
          ],
          geografico: 'Ecuador: Guayaquil, Quito, Cuenca, ciudades medianas',
          psicografico: 'Responsables familiares que priorizan salud pero no tienen recursos para seguro tradicional'
        }
      },
      
      casosUsoReales: {
        1: {
          situacion: '🤒 Madre con hijo con fiebre a las 2am',
          flujo: [
            '1. Mamá envía mensaje a Angela: "Mi hijo tiene 39°C de fiebre"',
            '2. Angela pregunta edad, síntomas adicionales, tiempo con fiebre',
            '3. Angela da recomendaciones inmediatas (baño tibio, acetaminofén)',
            '4. Angela programa seguimiento en 2 horas',
            '5. Si no mejora, deriva a doctor virtual'
          ],
          resultado: 'Tranquilidad familiar + atención inmediata sin salir de casa a emergencia ($50-80)'
        },
        
        2: {
          situacion: '📸 Tendero con herida infectada en mano',
          flujo: [
            '1. Tendero envía foto de herida a Angela',
            '2. Vision AI analiza: posible infección leve, no requiere urgencia',
            '3. Angela recomienda: limpieza con agua/jabón, desinfectante, vendaje',
            '4. Angela deriva a doctor para receta de antibiótico tópico',
            '5. Doctor emite receta digital en 10 minutos'
          ],
          resultado: 'Atención profesional sin cerrar tienda (vs ir a centro médico 3-4 horas)'
        },
        
        3: {
          situacion: '👁️ Cooperativista con ojo rojo',
          flujo: [
            '1. Usuario envía foto de ojo rojo a Angela',
            '2. Vision AI detecta posible conjuntivitis',
            '3. Angela pregunta: ardor, lagañas, cuántos días',
            '4. Angela deriva a doctor virtual',
            '5. Doctor confirma conjuntivitis, emite receta gotas oftálmicas'
          ],
          resultado: 'Diagnóstico + receta en 20 minutos vs $30-40 consulta + 2 horas traslado'
        }
      },
      
      industriasAplicables: [
        {
          sector: '🏪 COMERCIO INFORMAL',
          problema: 'Tenderos no pueden cerrar para ir a doctor',
          solucion: 'Angela atiende mientras atienden su negocio',
          roi: '$3/mes vs perder $30-50 por cerrar + $25-50 consulta'
        },
        {
          sector: '🤝 COOPERATIVAS',
          problema: 'Miembros sin acceso a salud ni recursos para seguro privado',
          solucion: 'Cooperativa paga $3/mes por cada socio como beneficio social',
          roi: 'Cooperativa de 100 socios = $300/mes para dar acceso salud completo'
        },
        {
          sector: '🏗️ MICROEMPRESAS',
          problema: 'No tienen presupuesto para afiliar a empleados a IESS o seguro privado',
          solucion: 'Dar MedBeneficios como prestación social ($3/empleado)',
          roi: 'Empleados saludables, menos ausentismo, beneficio percibido alto'
        },
        {
          sector: '🚕 TRANSPORTE (taxistas, Uber)',
          problema: 'Horarios irregulares imposibilitan ir a centros médicos',
          solucion: 'Consulta desde el auto mientras esperan pasajeros',
          roi: 'No pierden carreras por ir a doctor'
        }
      ],
      
      ventaConsultiva: {
        preguntasPoderosas: [
          '¿Cuántas veces has necesitado un doctor y no pudiste ir por el costo? 💸',
          '¿Qué harías si tu hijo tiene fiebre a las 3am? 🤒',
          '¿Cuánto gastas al año en consultas médicas privadas? 💰',
          '¿Tu familia tiene acceso a salud o esperan que "se pase solo"? 🏥',
          '¿Sabías que $3/mes te da consultas ilimitadas para TODA tu familia? 👨‍👩‍👧‍👦'
        ],
        
        objeciones: {
          'Es muy barato, debe ser malo': '¡Exacto! Es barato porque es un proyecto social, no con fines de lucro. La tecnología AI nos permite atender miles de familias con costos bajos. ❤️',
          'Prefiero ir a un doctor de verdad': 'Angela tiene médicos reales disponibles 24/7. La diferencia es que Angela hace el primer filtro para que el doctor atienda casos importantes. ¡Igual hablas con un doctor! 👨‍⚕️',
          'No confío en diagnósticos por foto': 'Angela NO diagnostica, solo orienta. Los médicos humanos dan el diagnóstico final. La foto ayuda a que el doctor vea el caso antes de hablar contigo. 📸',
          'No uso WhatsApp mucho': 'Solo necesitas enviar un mensaje. Angela responde en segundos. ¡Más fácil que llamar a un centro médico! 💬'
        },
        
        cierreEmocional: `Imagina esto: son las 2am, tu hijo tiene fiebre alta, no sabes si llevarlo 
a emergencias ($80-100) o esperar a mañana. Con MedBeneficios, abres WhatsApp, 
Angela te atiende en 30 segundos, te dice qué hacer, y si es necesario, 
un doctor te llama en 15 minutos. Todo por $3/mes. ¿Cuánto vale esa tranquilidad? ❤️`
      }
    },

    ADRIANA: {
      nombre: 'Adriana',
      rol: 'Superagente Cotizadora de Seguros Vehiculares 24/7 🛡️🚗',
      empresa: 'SegPopular',
      mision: 'Cotizar y procesar seguros vehiculares con 0% error, ahorrando tiempo y papelería',
      
      propuestaValor: {
        equivalencia: '1 Adriana AI = 1 vendedor senior trabajando 24/7 sin descanso',
        ventajas: [
          '🤖 Disponibilidad 24/7 (vs 8h/día vendedor)',
          '📋 Formularios conversacionales UAFE (vs papelería física)',
          '🎯 Cálculo automático con 0% error',
          '⚡ Cotización 3 aseguradoras en 2 minutos',
          '💰 Sin costo extra para cliente (comisión aseguradora)'
        ]
      },
      
      roiOperativo: {
        vendedorSenior: {
          costoMensual: '$1,200 salario + $300 beneficios + $200 oficina = $1,700/mes',
          disponibilidad: '160 horas/mes (8h x 20 días)',
          capacidad: '40-50 cotizaciones/mes',
          errorHumano: '5-10% errores en cálculos manuales'
        },
        
        adrianaAI: {
          costoMensual: '$300-400 desarrollo + mantenimiento OneMind',
          disponibilidad: '720 horas/mes (24/7)',
          capacidad: 'Ilimitadas cotizaciones simultáneas',
          errorHumano: '0% - cálculo automático preciso'
        },
        
        ahorro: {
          mensual: '$1,300/mes ($1,700 - $400)',
          anual: '$15,600/año',
          adicional: 'Adriana atiende fines de semana, feriados, madrugadas SIN costo extra'
        }
      },
      
      personalidad: {
        descripcion: `Adriana es una asesora experta en seguros vehiculares con 17 años de experiencia.
Directa, eficiente, sin presiones. Educa sobre coberturas mientras cotiza.
Domina formularios UAFE conversacionales, convirtiendo burocracia en chat fluido.`,
        tono: 'Profesional, precisa, consultiva, eficiente',
        valores: ['Transparencia', 'Precisión matemática', 'Agilidad', 'Educación financiera'],
        emojis: '🛡️🚗💰📋✅'
      },
      
      capacidadesTecnicas: {
        cotizacionAutomatica: {
          aseguradoras: ['Mapfre', 'VAZ Seguros', 'Seguros Unidos'],
          cobertura: 'Todo Riesgo vehicular Ecuador',
          tiempoRespuesta: '2 minutos cotización completa'
        },
        
        calculoAutomatico: {
          descripcion: 'Fórmulas precisas según avalúo comercial del vehículo',
          tasasEcuador: [
            {
              rango: '$15,000 - $30,000',
              tasa: '4.5%',
              formula: 'avalúo × 4.5% + emisión + impuestos',
              ejemplo: '$25,000 × 4.5% = $1,125 + $50 + $75 = $1,250/año ($104/mes)'
            },
            {
              rango: '$30,001 - $50,000',
              tasa: '3.6%',
              formula: 'avalúo × 3.6% + emisión + impuestos',
              ejemplo: '$45,000 × 3.6% = $1,620 + $50 + $100 = $1,770/año ($147/mes)'
            },
            {
              rango: '$50,001 - $100,000',
              tasa: '2.7%',
              formula: 'avalúo × 2.7% + emisión + impuestos',
              ejemplo: '$80,000 × 2.7% = $2,160 + $50 + $150 = $2,360/año ($197/mes)'
            }
          ],
          precision: '0% error - cálculo matemático automático'
        },
        
        formulariosUAFE: {
          descripcion: 'Procesa formularios obligatorios de manera conversacional por WhatsApp',
          documentos: [
            '📋 Formulario de Vinculación',
            '🔍 Conozca su Cliente (KYC)',
            '📄 Documentación UAFE requerida',
            '✅ Verificación identidad'
          ],
          ventaja: 'Sin papelería física, sin ir a oficina, todo conversacional'
        },
        
        procesamientoPolizas: {
          flujo: [
            '1. Cliente: "Quiero asegurar mi auto"',
            '2. Adriana pregunta: marca, modelo, año, avalúo',
            '3. Adriana calcula automáticamente según tasa',
            '4. Adriana inicia formularios UAFE conversacionales',
            '5. Adriana cotiza con 3 aseguradoras',
            '6. Cliente elige, paga, póliza digital 24-48h'
          ],
          tiempoTotal: '15-20 minutos proceso completo'
        },
        
        disponibilidad: '24/7/365 - Sin días libres, sin vacaciones',
        idiomas: ['ES', 'EN']
      },
      
      modeloNegocio: {
        comision: 'Adriana cobra comisión de aseguradora (cliente NO paga más)',
        ventajaCliente: 'Mismo precio que ir directo + servicio 24/7 + 3 cotizaciones',
        zonasCobertura: 'Sierra Ecuador: Quito, Cuenca, Ambato, Riobamba, Loja, Ibarra',
        vehiculos: 'Livianos (autos, camionetas, SUVs) - NO camiones pesados ni buses'
      },
      
      casosUsoReales: {
        1: {
          situacion: '🚗 Conductor compró auto usado $35,000',
          flujo: [
            '1. Cliente: "Necesito seguro para mi auto"',
            '2. Adriana: "¿Marca, modelo, año, avalúo comercial?"',
            '3. Cliente: "Mazda CX-5 2019, $35,000"',
            '4. Adriana calcula: $35,000 × 3.6% = $1,260 + $50 + $85 = $1,395/año',
            '5. Adriana: "Tu póliza $1,395/año ($116/mes). Inicio formularios?"',
            '6. Adriana procesa KYC conversacional (5 min)',
            '7. Adriana cotiza Mapfre/VAZ/Unidos',
            '8. Cliente elige, póliza digital 24h'
          ],
          resultado: 'Proceso completo en 20 min vs 3 días con vendedor tradicional'
        },
        
        2: {
          situacion: '🚕 Flota 5 vehículos empresa delivery (Quito)',
          flujo: [
            '1. Gerente: "Tengo 5 camionetas, necesito seguros"',
            '2. Adriana: "¿Avalúo de cada una?"',
            '3. Gerente: "3 de $28k y 2 de $42k"',
            '4. Adriana calcula:',
            '   - 3 × ($28,000 × 4.5% + $125) = $4,155',
            '   - 2 × ($42,000 × 3.6% + $150) = $3,336',
            '   - Total: $7,491/año',
            '5. Adriana: "Descuento flota 12% = $6,592/año ($549/mes)"',
            '6. Procesa 5 KYC en 15 minutos',
            '7. Pólizas digitales 48h'
          ],
          resultado: '5 seguros procesados en 30 min vs 2 semanas con broker tradicional'
        },
        
        3: {
          situacion: '💰 Cliente calcula si le conviene todo riesgo',
          flujo: [
            '1. Cliente: "Tengo auto $22,000, ¿cuánto costaría?"',
            '2. Adriana: "$22,000 × 4.5% = $990 + $50 + $70 = $1,110/año"',
            '3. Adriana: "Son $92.50/mes para proteger $22,000"',
            '4. Adriana educa: "Si chocas sin seguro, pagas TODO. $92/mes vs $22k de golpe"',
            '5. Cliente decide en 2 minutos con información clara'
          ],
          resultado: 'Cálculo instantáneo + educación = decisión informada'
        }
      },
      
      industriasAplicables: [
        {
          sector: '🚗 CONDUCTORES PARTICULARES',
          problema: 'No saben cuánto cuesta seguro hasta ir a oficina',
          solucion: 'Adriana calcula en 30 segundos por WhatsApp',
          roi: 'Ahorra 3h de visitas a brokers + decisión inmediata'
        },
        {
          sector: '🚕 FLOTAS COMERCIALES',
          problema: 'Renovar 10+ vehículos consume semanas de gestión',
          solucion: 'Adriana procesa múltiples vehículos simultáneamente',
          roi: '10 seguros en 1 hora vs 2 semanas con vendedor'
        },
        {
          sector: '🏢 CONCESIONARIOS',
          problema: 'Cliente compra auto y necesita seguro inmediato',
          solucion: 'Adriana cotiza mientras firman papeles de compra',
          roi: 'Cliente sale con auto Y seguro el mismo día'
        },
        {
          sector: '🏦 FINANCIERAS/BANCOS',
          problema: 'Crédito vehicular requiere seguro obligatorio',
          solucion: 'Adriana procesa seguro como requisito pre-desembolso',
          roi: 'Acelera aprobación créditos, menos fricción'
        }
      ],
      
      ventaConsultiva: {
        preguntasPoderosas: [
          '¿Cuánto crees que cuesta proteger tu inversión de $40,000? Te sorprenderías: solo $127/mes 🛡️',
          '¿Sabías que un choque sin seguro puede costarte $15,000+ de tu bolsillo? 💰',
          '¿Prefieres pagar $100/mes o arriesgar $35,000 en un accidente? 🚗',
          '¿Cuánto tiempo tienes para visitar 3 brokers? Yo te cotizo 3 en 2 minutos ⚡'
        ],
        
        objeciones: {
          'Es muy caro': 'Entiendo. ¿Cuánto vale tu auto? $40k. El seguro es $144/mes = 0.36% mensual. ¿Arriesgarías $40k por ahorrar $144? 💡',
          'No tengo tiempo para papelería': '¡Perfecto! Por eso existo. Formularios conversacionales por WhatsApp en 10 min. Cero papeles físicos. 📋',
          'Prefiero ir a una oficina': 'Puedes. Pero gastarás 3h + transporte para obtener 1 cotización. Yo te doy 3 cotizaciones en 2 min desde tu celular. Tú eliges. ⏰',
          'Nunca he chocado': '¡Genial! Esa es la mejor razón para asegurarte HOY. Después del choque es tarde. El seguro se contrata cuando NO lo necesitas. 🛡️'
        },
        
        cierreEmocional: `Tu auto es tu herramienta de trabajo, tu inversión, tu libertad.
Un choque sin seguro puede arruinar meses de ahorro en 1 segundo.
¿Cuánto vale tu tranquilidad? $100/mes puede salvarte $40,000. 🛡️`
      }
    },

    AXEL: {
      nombre: 'Axel',
      rol: 'Evaluador de Colisiones con Vision AI 🔧🚗',
      empresa: 'PaintBull',
      mision: 'Evaluar daños vehiculares con IA y cotizar reparaciones al instante',
      
      personalidad: {
        descripcion: `Axel es un maestro latonero con ojo técnico experto.
Directo, práctico, honesto. Habla claro sobre daños y costos.
Explica lo técnico en lenguaje simple.`,
        tono: 'Técnico-amigable, directo, solucionador',
        valores: ['Honestidad técnica', 'Rapidez', 'Transparencia en costos'],
        emojis: '🔧🚗💥🎨📸'
      },
      
      capacidadesTecnicas: {
        visionAI: {
          descripcion: 'Analiza fotos de colisiones con GPT-4o',
          identifica: [
            '💥 Golpes y abolladuras',
            '✂️ Rayones (profundidad, longitud)',
            '🔩 Piezas dañadas (parachoques, faros, espejos)',
            '🎨 Áreas que requieren pintura',
            '⚙️ Daño estructural vs superficial'
          ]
        },
        
        evaluacionDaños: {
          niveles: [
            '🟢 LEVE: Solo pintura/latonería superficial',
            '🟡 MODERADO: Piezas a reemplazar (faros, parachoques)',
            '🔴 GRAVE: Daño estructural o múltiples piezas'
          ]
        },
        
        cotizacionAutomatica: {
          incluye: [
            'Latonería y desabollado',
            'Pintura por panel',
            'Repuestos según marca/modelo',
            'Mano de obra',
            'Tiempo estimado'
          ]
        },
        
        disponibilidad: '24/7 por WhatsApp',
        idiomas: ['ES', 'EN']
      },
      
      modeloNegocio: {
        cotizacion: 'GRATIS vía Vision AI',
        cobro: 'Cliente solo paga SI acepta reparación',
        transparencia: 'Sin costos ocultos - lo cotizado es lo que pagas',
        garantia: '1 año en reparación',
        
        preciosEcuador: {
          rayon: '$50-80',
          parachoques: '$150-300 (reparación) / $400-800 (reemplazo)',
          puertaCompleta: '$300-500 (latonería + pintura)',
          capo: '$250-400',
          guardabarros: '$200-350'
        },
        
        propuestaValor: {
          vs_talleres: 'Cotización en 10 min vs esperar días',
          vs_irFisicamente: 'Envías foto vs llevar auto (tiempo + traslado)',
          vs_sinCotizar: 'Sabes costo ANTES de comprometerte'
        },
        
        mercadoObjetivo: {
          primario: '🚗 Conductores de autos livianos privados (particulares)',
          excluidos: [
            '❌ Transporte público (buses, busetas)',
            '❌ Transporte privado masivo (buses escolares, empresariales)',
            '❌ Taxis o transporte comercial'
          ],
          geografico: 'Ecuador urbano: Quito, Guayaquil, Cuenca'
        }
      },
      
      casosUsoReales: {
        1: {
          situacion: '📸 Rayón en parking de mall',
          flujo: [
            '1. Usuario: "Rayaron mi puerta" + foto',
            '2. Axel Vision AI: "Rayón superficial 15cm en puerta trasera"',
            '3. Axel: "$65 pulida + retoque / $180 repintado completo"',
            '4. Usuario elige opción y agenda',
            '5. Reparación en 24h'
          ],
          resultado: 'Decisión informada en 5 min vs 4h visitando 3 talleres'
        },
        
        2: {
          situacion: '💥 Colisión leve - parachoques',
          flujo: [
            '1. Usuario: "Golpeé un poste" + foto',
            '2. Axel: "Parachoques fisurado + faro izquierdo quebrado"',
            '3. Axel: "$280 parachoques + $120 faro + $150 m.obra = $550"',
            '4. Axel ofrece: repuesto original vs genérico',
            '5. Usuario aprueba, 48h reparación'
          ],
          resultado: 'Cotización completa sin mover auto del garaje'
        },
        
        3: {
          situacion: '🛡️ Cross-selling con Adriana',
          flujo: [
            '1. Usuario: "Choqué, no tengo seguro"',
            '2. Axel analiza: $1,200 reparación',
            '3. Axel: "Con seguro hubieras pagado $0. Habla con @adriana"',
            '4. Genera lead caliente para SegPopular'
          ],
          resultado: 'Cross-selling natural, educación preventiva'
        }
      },
      
      industriasAplicables: [
        {
          sector: '🚗 CONDUCTORES PARTICULARES',
          problema: 'Colisiones menores, no saben cuánto costará reparar',
          solucion: 'Axel cotiza en minutos con foto',
          roi: 'Ahorra 4h visitando talleres + decisión informada'
        },
        {
          sector: '🏢 EMPRESAS CON FLOTAS PRIVADAS',
          problema: 'Múltiples vehículos con daños menores sin atender',
          solucion: 'Axel evalúa todos simultáneamente',
          roi: 'Planificación de mantenimiento vs paradas imprevistas'
        },
        {
          sector: '🛡️ CROSS-SELLING CON ADRIANA',
          problema: 'Cliente sin seguro enfrenta reparación cara',
          solucion: 'Axel deriva a Adriana para futuro',
          roi: 'Genera leads educados para seguros vehiculares'
        }
      ],
      
      ventaConsultiva: {
        preguntasPoderosas: [
          '¿Cuánto crees que cuesta reparar eso? Te sorprenderías... 🤔',
          '¿Sabías que un rayón no reparado se oxida y sale 3x más caro después? 🔧',
          '¿Tienes seguro? Esto podría cubrirse 100% 🛡️',
          '¿Cuánto tiempo tienes para visitar 3 talleres? Yo te cotizo en 2 min 📸'
        ],
        
        objeciones: {
          'Es muy caro': 'Entiendo. ¿Comparaste con otros talleres? Nuestra cotización incluye TODO. Otros dicen $200 y terminas pagando $400 con "imprevistos". 💰',
          'Puedo dejarlo así': 'Claro, es tu decisión. Solo ten en cuenta que un rayón profundo se oxida en 2-3 meses y el costo triplica. $80 hoy vs $250 después. ⏰',
          'No tengo tiempo': 'Por eso existo. Cotización en 10 min por foto. Dejás tu auto mañana, lo recogés al día siguiente. Garantía 1 año. 🔧',
          'Lo llevo con un compadre más barato': 'Perfecto, compara nuestra cotización. Si él cobra menos CON garantía escrita, genial. Solo asegúrate pintura original y garantía. ✅'
        },
        
        cierreEmocional: `Tu auto es tu inversión, tu movilidad, tu libertad.
Una reparación bien hecha mantiene su valor.
Una mal hecha lo devalúa $2,000+ al venderlo.
¿Ahorras $50 hoy o pierdes $2,000 mañana? 🚗`
      }
    },

    PAULA: {
      nombre: 'Paula',
      rol: 'Asesora Inmobiliaria AI 24/7 🏠💼',
      empresa: 'PropElite',
      mision: 'Calificar compradores con UAFE y conectar solo leads serios con agentes',
      
      propuestaValor: {
        equivalencia: '1 Paula AI = 1 agente inmobiliario trabajando 24/7 + filtrado UAFE automático',
        ventajas: [
          '🤖 Disponibilidad 24/7 (vs 8h/día agente)',
          '📋 Filtrado UAFE conversacional en 5 min',
          '✅ Solo entrega leads calificados a agentes humanos',
          '⚡ Agentes 3x más productivos (sin leads falsos)',
          '💰 Ahorro $600/mes vs agente tradicional'
        ]
      },
      
      roiOperativo: {
        agenteTradicional: {
          costoMensual: '$800 base + comisiones + $200 oficina = $1,000/mes fijos',
          disponibilidad: '160 horas/mes (8h x 20 días)',
          capacidad: '30-40 leads/mes',
          filtradoUAFE: '20-30 min manual por lead',
          desperdicio: '70% leads no calificados = 112 horas/mes perdidas'
        },
        
        paulaAI: {
          costoMensual: '$300-400 desarrollo + mantenimiento OneMind',
          disponibilidad: '720 horas/mes (24/7)',
          capacidad: 'Ilimitados leads simultáneos',
          filtradoUAFE: '5 min automático conversacional',
          eficiencia: '95% leads entregados YA calificados'
        },
        
        ahorro: {
          mensual: '$600/mes ($1,000 - $400)',
          anual: '$7,200/año',
          adicional: 'Agentes humanos 3x más productivos (solo atienden leads reales)',
          tiempoAhorrado: '112 horas/mes que agente ya NO pierde en leads falsos'
        }
      },
      
      personalidad: {
        descripcion: `Paula es una agente inmobiliaria experta y consultiva.
Amigable pero eficiente. Hace preguntas estratégicas para calificar compradores.
Domina requisitos UAFE de manera conversacional, sin que se sienta interrogatorio.`,
        tono: 'Profesional, consultiva, eficiente, amigable',
        valores: ['Eficiencia', 'Calificación rigurosa', 'Transparencia', 'Cumplimiento UAFE'],
        emojis: '🏠💼📋✅🔑'
      },
      
      capacidadesTecnicas: {
        catalogoAutomatico: {
          descripcion: 'Base de datos de propiedades EN VENTA',
          filtros: [
            '💰 Rango de precio',
            '📍 Ubicación/sector',
            '📏 Metros cuadrados',
            '🛏️ Número de dormitorios',
            '🚗 Parqueaderos',
            '🏢 Tipo (casa, depto, oficina)'
          ]
        },
        
        clasificacionUAFE: {
          descripcion: 'Determina requisitos UAFE mediante conversación natural',
          preguntasEstrategicas: [
            '¿Cuál es tu fuente de ingresos principal?',
            '¿Compras con financiamiento o efectivo?',
            '¿Tienes capacidad de pago verificable?',
            '¿Primera vivienda o inversión?',
            '¿Trabajas independiente o en relación de dependencia?'
          ],
          clasificacion: [
            '✅ CALIFICADO: Cumple UAFE + capacidad pago → Entrega a agente humano',
            '🟡 REVISAR: Requiere documentación adicional → Solicita docs',
            '❌ NO CALIFICADO: No cumple requisitos → Deriva opciones alternativas'
          ],
          tiempo: '5 minutos conversacional vs 20-30 min manual'
        },
        
        agendamientoVisitas: {
          descripcion: 'Coordina visitas automáticamente',
          flujo: [
            '1. Cliente calificado elige propiedad',
            '2. Paula verifica disponibilidad agente',
            '3. Paula agenda día/hora',
            '4. Confirma con cliente y agente',
            '5. Recordatorios automáticos 24h antes'
          ]
        },
        
        seguimiento: {
          descripcion: 'Mantiene contacto hasta cierre de venta',
          acciones: [
            'Seguimiento post-visita',
            'Recordatorios de documentación pendiente',
            'Actualización de nuevas propiedades que calzan perfil',
            'Notificación de reducciones de precio'
          ]
        },
        
        disponibilidad: '24/7/365 - Captura leads nocturnos y fines de semana',
        idiomas: ['ES', 'EN']
      },
      
      modeloNegocio: {
        comision: '2-3% sobre precio de venta',
        enfoque: 'Solo VENTA (NO arriendo)',
        ventajaCliente: 'Atención 24/7 sin costo extra',
        ventajaAgencia: 'Agentes solo atienden leads calificados = más cierres',
        
        mercadoObjetivo: {
          primario: [
            '🏠 Compradores de vivienda (primera o inversión)',
            '🏢 Inversionistas inmobiliarios',
            '🏗️ Desarrolladoras (venta de proyectos)',
            '💼 Profesionales buscando oficinas'
          ],
          geografico: 'Ecuador: Quito, Guayaquil, Cuenca',
          psicografico: 'Compradores serios con capacidad financiera verificable'
        }
      },
      
      casosUsoReales: {
        1: {
          situacion: '🏠 Comprador busca casa Quito $120k',
          flujo: [
            '1. Cliente: "Busco casa en Quito hasta $120,000"',
            '2. Paula: "Perfecto. Para calificarte, ¿cuál es tu fuente de ingresos?"',
            '3. Cliente: "Trabajo en relación de dependencia, $2,500/mes"',
            '4. Paula: "¿Financiamiento o pago contado?"',
            '5. Cliente: "Financiamiento con entrada $30k"',
            '6. Paula clasifica: ✅ CALIFICADO (ingresos suficientes, entrada 25%)',
            '7. Paula muestra 5 casas que calzan perfil',
            '8. Cliente elige 2, Paula agenda visitas con agente humano',
            '9. Agente humano solo invierte tiempo en lead REAL'
          ],
          resultado: 'Agente recibe lead precalificado, cierre en 15 días vs 45 días sin Paula'
        },
        
        2: {
          situacion: '❌ Filtrado de lead NO calificado',
          flujo: [
            '1. Usuario: "Quiero comprar depto $200k"',
            '2. Paula: "Genial. ¿Cuál es tu capacidad de pago mensual?"',
            '3. Usuario: "Gano $800/mes"',
            '4. Paula calcula: $800 = capacidad $60k (no $200k)',
            '5. Paula: "Con tus ingresos, calificas hasta $60-70k. ¿Quieres ver opciones?"',
            '6. Paula reorienta búsqueda o deriva a financiamiento',
            '7. Agente humano NO pierde tiempo en lead imposible'
          ],
          resultado: 'Ahorro 112h/mes que agentes perdían en leads sin capacidad de pago'
        },
        
        3: {
          situacion: '🏗️ Desarrolladora vende 20 deptos nuevos',
          flujo: [
            '1. Desarrolladora carga 20 unidades en catálogo Paula',
            '2. Paula atiende 50 leads/semana 24/7',
            '3. Paula filtra: 15 calificados + 35 no calificados',
            '4. Agentes humanos solo atienden 15 calificados',
            '5. Cierre: 8 ventas en 2 meses',
            '6. Sin Paula: agentes hubiesen atendido 50, cerrado 3 (desperdicio tiempo)'
          ],
          resultado: 'Desarrolladora: 8 ventas vs 3 = +166% conversión con mismo equipo'
        }
      },
      
      industriasAplicables: [
        {
          sector: '🏠 AGENCIAS INMOBILIARIAS',
          problema: 'Agentes pierden 70% tiempo con leads falsos/curiosos',
          solucion: 'Paula filtra y solo entrega leads calificados UAFE',
          roi: 'Agentes 3x más productivos, más ventas con mismo equipo'
        },
        {
          sector: '🏗️ DESARROLLADORAS',
          problema: 'Sala de ventas cara, horario limitado, leads sin calificar',
          solucion: 'Paula atiende 24/7, precalifica, agenda solo leads reales',
          roi: 'Ahorro sala de ventas física, +100% leads calificados'
        },
        {
          sector: '🏦 FINANCIERAS/BANCOS',
          problema: 'Solicitudes crédito sin precalificación = procesos inútiles',
          solucion: 'Paula precalifica capacidad de pago antes de aplicar',
          roi: 'Solo procesan solicitudes viables, menos rechazos'
        }
      ],
      
      ventaConsultiva: {
        preguntasPoderosas: [
          '¿Cuántas horas pierden tus agentes con leads que nunca cierran? 🕐',
          '¿Qué pasaría si solo atendieras compradores YA calificados? 💡',
          '¿Cuántos leads pierdes porque llaman a las 10pm y no hay nadie? 🌙',
          '¿Sabes cuánto cuesta un agente atendiendo 30 leads falsos/mes? 💰'
        ],
        
        objeciones: {
          'Los clientes prefieren hablar con humanos': 'Paula NO reemplaza agentes. Los LIBERA. Paula filtra, agentes cierran. Cliente habla con humano cuando YA está calificado. 🤝',
          'Es muy caro': 'Un agente cuesta $1,000/mes fijos. Paula $400/mes. Ahorro: $600/mes = $7,200/año. ¿Prefieres 3 agentes desperdiciando tiempo o 3 agentes cerrando ventas? 💰',
          'Prefiero contratar más agentes': 'Perfecto. ¿Contratas 3 agentes a $3,000/mes para atender leads falsos, o contratas Paula a $400 + tus 3 agentes solo cierran? Tu ROI: +200% ventas. 📈',
          'No sé si funciona': 'Prueba: Paula atiende 1 mes. Compara cuántos leads calificados entrega vs cuánto tiempo ahorran tus agentes. Si no funciona, cancelas. Sin compromiso. ✅'
        },
        
        cierreEmocional: `Tus agentes son CLOSERS, no filtros.
Cada hora que pierden con un lead falso es dinero que NO entra.
Paula trabaja 24/7 filtrando. Tus agentes cierran ventas.
¿Prefieres agentes frustrados con curiosos o agentes cerrando? 🏠`
      }
    },

    GABI: {
      nombre: 'Gabi',
      rol: 'Asistente Legal & Financiero AI 24/7 ⚖️💼',
      empresa: 'GR Consulting',
      mision: 'Resolver consultas legal/financiero/admin y derivar solo casos complejos',
      
      propuestaValor: {
        equivalencia: '1 Gabi AI = 1 asistente administrativo 24/7 resolviendo 80% consultas',
        ventajas: [
          '🤖 Disponibilidad 24/7 (vs 8h/día asistente)',
          '📚 Resuelve 80% consultas sin humano',
          '⚡ Respuestas instantáneas (vs esperar turno)',
          '💰 Ahorro $350-450/mes vs asistente tradicional',
          '🎯 Humanos solo atienden casos complejos (20%)'
        ]
      },
      
      roiOperativo: {
        asistenteTradicional: {
          costoMensual: '$600 base + $150 beneficios = $750/mes',
          disponibilidad: '160 horas/mes (8h x 20 días)',
          capacidad: '50-60 consultas/mes',
          consultasRepetitivas: '80% son las mismas preguntas (RUC, RISE, trámites)',
          desperdicio: '128 horas/mes respondiendo lo mismo'
        },
        
        gabiAI: {
          costoMensual: '$300-400 desarrollo + mantenimiento OneMind',
          disponibilidad: '720 horas/mes (24/7)',
          capacidad: 'Ilimitadas consultas simultáneas',
          resolucionAutonoma: '80% consultas resueltas sin intervención humana',
          eficiencia: 'Humanos solo casos complejos (20%)'
        },
        
        ahorro: {
          mensual: '$350-450/mes ($750 - $400)',
          anual: '$4,200-5,400/año',
          adicional: 'Abogados/contadores 5x más productivos (solo casos complejos)',
          tiempoAhorrado: '128 horas/mes que profesionales NO pierden en consultas repetitivas'
        }
      },
      
      personalidad: {
        descripcion: `Gabi es una asistente administrativa experta en legal, finanzas y trámites.
Clara, pedagógica, paciente. Explica lo complejo en lenguaje simple.
Sabe cuándo puede resolver y cuándo debe derivar a profesional humano.`,
        tono: 'Profesional, pedagógica, clara, accesible',
        valores: ['Claridad', 'Educación', 'Eficiencia', 'Cumplimiento legal'],
        emojis: '⚖️💼📋✅💰'
      },
      
      capacidadesTecnicas: {
        faqLegalFinanciero: {
          descripcion: 'Base de conocimiento de consultas frecuentes',
          temas: [
            '📋 Trámites SRI: RUC, RISE, facturas electrónicas',
            '💼 Constitución de empresas (Cía. Ltda, S.A., Unipersonal)',
            '⚖️ Contratos: laborales, arrendamiento, servicios',
            '💰 Consultas tributarias: declaraciones, retenciones',
            '🏢 IESS: afiliación, planillas, obligaciones patronales',
            '📄 Permisos de funcionamiento: bomberos, municipio, salud'
          ]
        },
        
        cotizacionServicios: {
          descripcion: 'Cotiza servicios legales y contables automáticamente',
          precios: {
            constitucionEmpresas: '$800-1,500 (según tipo)',
            contratos: '$200-500 (según complejidad)',
            auditorias: '$1,000-3,000 (según tamaño empresa)',
            consultoriaTributaria: '$300-800/mes',
            declaracionesImpuestos: '$80-150/mes',
            afiliacionIESS: '$50-100/empleado'
          }
        },
        
        clasificacionConsultas: {
          simple: '🟢 FAQ/trámites → Gabi resuelve con guía paso a paso',
          media: '🟡 Consulta específica → Gabi da orientación + sugiere agendar profesional',
          compleja: '🔴 Caso legal/financiero → Gabi deriva inmediatamente a abogado/contador',
          resolucionAutonoma: '80% resueltas por Gabi sin intervención humana'
        },
        
        agendamientoProfesionales: {
          descripcion: 'Coordina citas con abogados y contadores',
          flujo: [
            '1. Identifica consulta compleja',
            '2. Ofrece agendar con profesional',
            '3. Verifica disponibilidad',
            '4. Confirma cita',
            '5. Prepara resumen de caso para profesional'
          ]
        },
        
        seguimientoCasos: {
          descripcion: 'Mantiene seguimiento de trámites y casos',
          acciones: [
            'Recordatorios de fechas límite (declaraciones, renovaciones)',
            'Estado de trámites pendientes',
            'Documentación faltante',
            'Actualizaciones de casos en curso'
          ]
        },
        
        disponibilidad: '24/7/365 - Consultas fuera de horario laboral',
        idiomas: ['ES', 'EN']
      },
      
      modeloNegocio: {
        consultas: 'Básicas GRATIS (80% resueltas por Gabi)',
        servicios: 'Profesionales cobran solo casos complejos (20%)',
        ventajaCliente: 'Respuestas instantáneas 24/7 sin costo',
        ventajaEmpresa: 'Profesionales solo atienden casos que generan ingresos',
        
        mercadoObjetivo: {
          primario: [
            '💼 Emprendedores nuevos (necesitan orientación)',
            '🏪 PYMES (consultas tributarias frecuentes)',
            '🏢 Empresas establecidas (trámites recurrentes)',
            '🚀 Startups (constitución, contratos, compliance)'
          ],
          geografico: 'Ecuador: todo el territorio',
          psicografico: 'Empresarios que necesitan orientación legal/financiera accesible'
        }
      },
      
      casosUsoReales: {
        1: {
          situacion: '📋 Emprendedor nuevo: "¿Cómo saco RUC?"',
          flujo: [
            '1. Usuario: "Quiero abrir un negocio, ¿cómo saco RUC?"',
            '2. Gabi: "¡Perfecto! Te explico el proceso paso a paso:"',
            '3. Gabi lista: documentos, plataforma SRI, pasos, tiempo',
            '4. Gabi: "¿Necesitas ayuda profesional o puedes hacerlo solo?"',
            '5. Usuario: "Puedo solo"',
            '6. Gabi: "Genial, aquí tu checklist descargable"',
            '7. Usuario resuelve sin gastar en consultoría'
          ],
          resultado: 'Consulta resuelta en 5 min, 0 intervención humana, cliente satisfecho'
        },
        
        2: {
          situacion: '⚖️ Caso complejo: "Me demandan por incumplimiento contrato"',
          flujo: [
            '1. Usuario: "Me llegó una demanda por contrato"',
            '2. Gabi: "Esto requiere abogado URGENTE. ¿Puedes enviar la demanda?"',
            '3. Usuario envía documento',
            '4. Gabi: "Agendé cita con abogado mañana 10am. Prepara: contrato original, comunicaciones, pagos"',
            '5. Gabi prepara resumen para abogado',
            '6. Abogado llega a cita CON contexto, no pierde tiempo en resumen'
          ],
          resultado: 'Cliente derivado inmediato, abogado atiende caso preparado, cobra $500 consultoría'
        },
        
        3: {
          situacion: '💰 PYME: "¿Cuándo declaro impuestos?"',
          flujo: [
            '1. Usuario: "Tengo RUC hace 3 meses, ¿cuándo declaro?"',
            '2. Gabi: "Depende de tu 9° dígito. ¿Cuál es tu RUC?"',
            '3. Usuario: "1234567890001"',
            '4. Gabi: "Tu 9° dígito es 0. Declaras cada mes hasta el 10. Te envío calendario."',
            '5. Gabi: "¿Quieres servicio de declaraciones automáticas? $120/mes"',
            '6. Usuario contrata servicio'
          ],
          resultado: 'Consulta resuelta + venta de servicio recurrente $120/mes'
        },
        
        4: {
          situacion: '🏢 Empresa: "Necesito contratar empleados, ¿IESS?"',
          flujo: [
            '1. Usuario: "Voy a contratar 5 empleados, ¿qué hago con IESS?"',
            '2. Gabi: "Te explico: afiliación obligatoria desde día 1, aportes 21.6%..."',
            '3. Gabi: "¿Quieres que lo hagamos por ti? $50/empleado afiliación + $150/mes planillas"',
            '4. Usuario: "$50 x 5 = $250 + $150/mes"',
            '5. Usuario aprueba, Gabi agenda con contador',
            '6. Contador procesa afiliaciones, GR cobra $400 primer mes + $150/mes recurrente'
          ],
          resultado: 'Lead cualificado + servicio recurrente $150/mes'
        }
      },
      
      industriasAplicables: [
        {
          sector: '💼 EMPRENDEDORES NUEVOS',
          problema: 'No saben por dónde empezar, consultorías caras ($200-500)',
          solucion: 'Gabi orienta gratis, cobra solo si necesitan servicio',
          roi: 'Emprendedor ahorra $300 en consultas básicas'
        },
        {
          sector: '🏪 PYMES',
          problema: 'Consultas tributarias repetitivas consumen tiempo contador',
          solucion: 'Gabi resuelve 80%, contador solo casos complejos',
          roi: 'Contador 5x más productivo, atiende más clientes'
        },
        {
          sector: '🏢 EMPRESAS',
          problema: 'Asistente administrativo responde lo mismo 100 veces/mes',
          solucion: 'Gabi automatiza FAQ, asistente hace trabajo estratégico',
          roi: 'Ahorro $450/mes + asistente enfocado en tareas valiosas'
        },
        {
          sector: '⚖️ FIRMAS LEGALES',
          problema: 'Abogados pierden tiempo en consultas que no generan ingresos',
          solucion: 'Gabi filtra, solo llegan casos que sí cobran',
          roi: 'Abogados facturan 3x más con mismo horario'
        }
      ],
      
      ventaConsultiva: {
        preguntasPoderosas: [
          '¿Cuántas veces tu contador responde "¿cómo declaro?" por teléfono? 📞',
          '¿Cuánto tiempo pierden tus profesionales en consultas repetitivas? ⏰',
          '¿Sabías que 80% de consultas son FAQ que un AI resuelve? 🤖',
          '¿Prefieres que tu abogado cobre $150/hora o responda "¿cómo saco RUC?" gratis? 💰'
        ],
        
        objeciones: {
          'Los clientes quieren hablar con humanos': 'Gabi NO reemplaza profesionales. Los LIBERA. Consultas básicas → Gabi. Casos complejos → abogado/contador. Cliente satisfecho en ambos casos. ⚖️',
          'Las consultas gratis generan confianza': 'Exacto. Gabi da consultas gratis 24/7. Cuando necesitan servicio pago, YA confían en ti. Es marketing automatizado. 🎯',
          'Es muy caro': '$400/mes vs $750 asistente. Ahorro: $350/mes. Beneficio extra: profesionales facturan 3x más porque NO pierden tiempo en FAQ. ROI: +$2,000/mes. 💰',
          'No sé si funciona': 'Prueba 1 mes. Mide: cuántas consultas resuelve Gabi vs cuántas llegan a profesionales. Si no vale, cancelas. Sin compromiso. ✅'
        },
        
        cierreEmocional: `Tus profesionales son EXPERTOS, no FAQ bots.
Cada hora respondiendo "¿cómo saco RUC?" es dinero que NO entra.
Gabi trabaja 24/7 resolviendo consultas básicas.
Tus profesionales cierran casos que SÍ facturan.
¿Prefieres profesionales frustrados con FAQ o cerrando casos de $500-3,000? ⚖️`
      }
    }
  },

  // 💰 NUEVOS NIVELES DE PRECIO PARA ECUADOR
  nivelesPrecios: {
    nivel1: {
      nombre: 'SISTEMA BÁSICO',
      precioDesarrollo: 1500,
      precioMantenimiento: 250,
      descripcion: 'Agendamientos y reservas automáticas',
      incluye: [
        'Agendamientos y reservas automáticas (estilo Aurora básica)',
        'Respuestas FAQ automatizadas',
        'Horarios, ubicación, servicios',
        'Recopilación de datos básicos (nombre, email, teléfono)',
        'WhatsApp 24/7'
      ],
      ejemploPractico: 'Un spa que necesita agendar masajes y faciales por WhatsApp. El agente pregunta: ¿qué servicio? ¿qué día? ¿qué hora? y reserva automáticamente.',
      aplicableA: [
        'Spas, peluquerías, barberías',
        'Consultorios médicos pequeños (1-2 doctores)',
        'Talleres mecánicos (citas de mantenimiento)',
        'Instructores fitness, nutricionistas'
      ]
    },
    nivel2: {
      nombre: 'SISTEMA COMPLEJIDAD MEDIA',
      precioDesarrollo: 3500,
      precioMantenimiento: 400,
      descripcion: 'Vision AI + derivación inteligente',
      incluye: [
        'Todo lo del Nivel 1 +',
        'Vision AI para leer documentos/comprobantes (como Aurora)',
        'Formularios avanzados paso a paso',
        'Validación de pagos automática',
        'Integración con 1 sistema externo (CRM básico, calendario)',
        'Derivación inteligente entre 2-3 especialistas'
      ],
      ejemploPracticoEcosistema: `Un centro médico con 3 especialistas necesita:
• Agendar citas automáticamente
• Leer constancias de pago con Vision AI (como Aurora)
• Derivar pacientes según especialidad (pediatría → Dr. Juan, ginecología → Dra. María)
• Confirmar pagos y enviar recordatorios

Es como tener a Aurora + Angela trabajando juntas para tu clínica.`,
      otroEjemplo: `Un taller de colisiones que necesita:
• Recibir fotos del daño (Vision AI las analiza como Axel)
• Dar cotización preliminar
• Agendar ingreso del vehículo
• Validar anticipos de pago`,
      aplicableA: [
        'Clínicas médicas multi-especialidad',
        'Talleres de reparación vehicular',
        'Restaurantes (pedidos + pagos automatizados)',
        'Centros educativos (reservas + pagos)'
      ]
    },
    nivel3: {
      nombre: 'SISTEMA COMPLEJIDAD ALTA',
      precioDesarrollo: 6500,
      precioMantenimiento: 750,
      descripcion: 'Ecosistema completo multi-agente',
      incluye: [
        'Todo lo del Nivel 2 +',
        'Ecosistema completo multi-agente (como Coworkia)',
        'Vision AI avanzado para múltiples tipos de documentos',
        'Múltiples integraciones (CRM, ERP, pagos, email)',
        'Lógica de negocio compleja y personalizada',
        '5+ especialistas virtuales coordinados',
        'Multi-idioma completo (3+ idiomas)'
      ],
      ejemploEcosistemaCoworkia: `El sistema que tienes ahora mismo:
• Aurora: Recepción, reservas, pagos, coordinación central
• Aluna: Venta de membresías con Vision AI para pagos
• Enzo: Marketing y consultoría IA
• Angela: Salud y bienestar
• Adriana: Seguros
• Axel: Reparación vehicular con Vision AI
• Paula: Bienes raíces
• Gabi: Legal, finanzas, administración

8 agentes trabajando 24/7, derivando entre ellos, procesando pagos con Vision AI, todo coordinado desde Aurora como torre de control.`,
      otroEjemplo: `Un hospital completo:
• Recepcionista virtual (agendas, pagos)
• 5 especialistas virtuales (pediatría, ginecología, traumatología, etc.)
• Laboratorio (recibe resultados, los interpreta con Vision AI)
• Farmacia (procesa recetas)
• Administración (facturación, seguros médicos)

Todo funcionando como un ecosistema integrado.`,
      aplicableA: [
        'Hospitales, clínicas grandes',
        'Cadenas de restaurantes/hoteles',
        'Empresas con múltiples divisiones',
        'Inmobiliarias con múltiples proyectos',
        'Centros automotrices completos (venta + repuestos + taller + seguros)'
      ]
    }
  }
};
