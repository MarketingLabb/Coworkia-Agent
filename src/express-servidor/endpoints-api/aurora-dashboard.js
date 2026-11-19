/**
 * 📊 API Endpoints - Aurora Reservations Dashboard
 * 
 * Endpoints para visualizar historial de reservas gestionadas por Aurora
 * 
 * @author Aurora Core
 * @date 2026-03-09
 */

import { localizeOutgoing } from '../../utils/outbound-localizer.js';
import express from 'express';
import databaseService from '../../database/database.js';
import { sendOneHourFollowup, sendRebookingReminder } from '../../servicios/aurora-followup-service.js';
import { sendEmail } from '../../servicios/email.js';
import { buildEmailTemplate } from '../../servicios/email-template-system.js';
import { calculateReservationCost } from '../../servicios/payment-calculator.js';
import { generateWifiCode, getWifiCodeForReservation } from '../../servicios/wifi-codes-service.js';
import { COWORKIA_ADDRESS, COWORKIA_MAPS_URL } from '../../utils/constants.js';
import { getServiceLabel } from '../../utils/service-labels.js';
import { enviarWhatsApp } from './wassenger.js';

const router = express.Router();

const WASSENGER_TOKEN     = process.env.WASSENGER_TOKEN || process.env.WASSENGER_API_KEY;
const WASSENGER_DEVICE_ID = process.env.WASSENGER_DEVICE_ID;

// ============================================================================
// RESERVAS
// ============================================================================

/**
 * GET /api/aurora/reservations
 * Obtiene lista completa de reservas
 * 
 * Query params:
 * - status: Filtrar por estado (confirmed, pending, cancelled, etc.)
 * - serviceType: Filtrar por tipo (hotDesk, meetingRoom)
 * - date: Filtrar por fecha específica
 * - limit: Número de resultados (default: 100)
 * - offset: Para paginación (default: 0)
 */
router.get('/reservations', async (req, res) => {
  try {
    await databaseService.initialize();
    
    const { status, serviceType, date, limit = 100, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        r.id,
        r.user_phone,
        u.name as user_name,
        r.service_type,
        r.date,
        r.start_time,
        r.end_time,
        r.duration_hours,
        r.guest_count,
        r.desks_quantity,
        r.total_price,
        r.was_free,
        r.status,
        r.payment_status,
        r.payment_method,
        r.hot_desk_number,
        r.hot_desk_numbers,
        r.created_at,
        r.confirmed_at,
        r.followup_1h_sent_at,
        r.rebook_reminder_sent_at,
        r.attended,
        wc.code AS wifi_code,
        wc.status AS wifi_status
      FROM reservations r
      LEFT JOIN users u ON r.user_phone = u.phone_number
      LEFT JOIN wifi_codes wc ON wc.reservation_id = r.id
        AND wc.status NOT IN ('cancelled', 'expired')
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (serviceType) {
      query += ` AND r.service_type = $${paramIndex}`;
      params.push(serviceType);
      paramIndex++;
    }
    
    if (date) {
      query += ` AND r.date = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }
    
    query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const reservations = await databaseService.all(query, params);
    
    // Total count para paginación
    let countQuery = 'SELECT COUNT(*) as total FROM reservations WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;
    
    if (status) {
      countQuery += ` AND status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }
    
    if (serviceType) {
      countQuery += ` AND service_type = $${countParamIndex}`;
      countParams.push(serviceType);
      countParamIndex++;
    }
    
    if (date) {
      countQuery += ` AND date = $${countParamIndex}`;
      countParams.push(date);
    }
    
    const countResult = await databaseService.get(countQuery, countParams);

    // Enriquecer cada reserva con precio de referencia calculado
    const enriched = reservations.map(r => {
      let reference_price = null;
      if (!r.was_free && r.service_type && r.duration_hours) {
        const billingUnits = r.service_type === 'hotDesk' ? (r.desks_quantity || 1) : 1;
        const calc = calculateReservationCost(r.service_type, r.duration_hours, billingUnits, 'transferencia');
        if (!calc.error) reference_price = calc.basePrice;
      }
      return { ...r, reference_price };
    });

    return res.json({
      ok: true,
      data: enriched,
      total: countResult?.total || 0,
      showing: reservations.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('[AURORA-API] Error en reservations:', error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/aurora/stats
 * Obtiene estadísticas generales de reservas
 */
router.get('/stats', async (req, res) => {
  try {
    await databaseService.initialize();
    
    // Total reservas
    const totalResult = await databaseService.get(
      `SELECT COUNT(*) as total FROM reservations`
    );
    
    // Por estado
    const byStatus = await databaseService.all(
      `SELECT status, COUNT(*) as count 
       FROM reservations 
       GROUP BY status 
       ORDER BY count DESC`
    );
    
    // Por tipo de servicio
    const byType = await databaseService.all(
      `SELECT service_type, COUNT(*) as count 
       FROM reservations 
       GROUP BY service_type 
       ORDER BY count DESC`
    );
    
    // Revenue — solo reservas efectivamente pagadas
    const revenueResult = await databaseService.get(
      `SELECT 
        SUM(total_price) as total,
        AVG(total_price) as average,
        SUM(CASE WHEN was_free = true THEN 1 ELSE 0 END) as free_count,
        SUM(CASE WHEN was_free = false THEN 1 ELSE 0 END) as paid_count
       FROM reservations 
       WHERE payment_status = 'paid' AND total_price > 0`
    );
    
    // Reservas recientes (últimos 7 días)
    const recentResult = await databaseService.get(
      `SELECT COUNT(*) as count 
       FROM reservations 
       WHERE created_at >= NOW() - INTERVAL '7 days'`
    );
    
    // Reservas este mes
    const thisMonthResult = await databaseService.get(
      `SELECT COUNT(*) as count 
       FROM reservations 
       WHERE TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')`
    );
    
    // Próximas reservas confirmadas
    const upcomingResult = await databaseService.get(
      `SELECT COUNT(*) as count 
       FROM reservations 
       WHERE status = 'confirmed' 
       AND date >= CURRENT_DATE`
    );
    
    return res.json({
      ok: true,
      data: {
        total: totalResult?.total || '0',
        byStatus: byStatus || [],
        byType: byType || [],
        revenue: {
          total: parseFloat(revenueResult?.total || 0),
          average: parseFloat(revenueResult?.average || 0),
          freeCount: parseInt(revenueResult?.free_count || 0),
          paidCount: parseInt(revenueResult?.paid_count || 0)
        },
        recent: {
          last7Days: recentResult?.count || '0',
          thisMonth: thisMonthResult?.count || '0',
          upcoming: upcomingResult?.count || '0'
        }
      }
    });
    
  } catch (error) {
    console.error('[AURORA-API] Error en stats:', error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/aurora/stats/weekly
 * Métricas semanales: reservas + revenue de las últimas 8 semanas
 */
router.get('/stats/weekly', async (req, res) => {
  try {
    await databaseService.initialize();

    // Reservas + revenue por semana (últimas 8 semanas)
    const weeklyRows = await databaseService.all(`
      SELECT
        TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD') AS week_start,
        COUNT(*)::int                                           AS total,
        SUM(CASE WHEN status IN ('confirmed','completed') THEN 1 ELSE 0 END)::int AS confirmed,
        SUM(CASE WHEN was_free = false AND status IN ('confirmed','completed')
                 THEN COALESCE(total_price, 0) ELSE 0 END)::numeric          AS revenue
      FROM reservations
      WHERE created_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY DATE_TRUNC('week', created_at) ASC
    `);

    // Por tipo de servicio en las últimas 4 semanas
    const byTypeRows = await databaseService.all(`
      SELECT
        service_type,
        COUNT(*)::int AS count
      FROM reservations
      WHERE created_at >= NOW() - INTERVAL '4 weeks'
        AND status IN ('confirmed','completed')
      GROUP BY service_type
      ORDER BY count DESC
    `);

    // Tasa de conversión total (confirmed+completed / total)
    const convRate = await databaseService.get(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('confirmed','completed') THEN 1 ELSE 0 END) AS converted
      FROM reservations
      WHERE created_at >= NOW() - INTERVAL '8 weeks'
    `);

    const totalN = parseInt(convRate?.total || 0);
    const convN  = parseInt(convRate?.converted || 0);
    const conversionRate = totalN > 0 ? Math.round((convN / totalN) * 100) : 0;

    return res.json({
      ok: true,
      data: {
        weeks: weeklyRows.map(r => ({
          weekStart: r.week_start,
          total: r.total,
          confirmed: r.confirmed,
          revenue: parseFloat(r.revenue || 0)
        })),
        byType: byTypeRows,
        conversionRate,
      }
    });

  } catch (error) {
    console.error('[AURORA-API] Error en stats/weekly:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/aurora/prospects/abandoned
 * Usuarios que interactuaron con Aurora pero nunca concretaron una reserva.
 * Ordenados por cantidad de mensajes (más interacción = mayor prioridad de seguimiento).
 */
router.get('/prospects/abandoned', async (req, res) => {
  try {
    await databaseService.initialize();

    const prospects = await databaseService.all(`
      SELECT
        i.user_phone,
        u.name                                                            AS user_name,
        COUNT(i.id)::int                                                  AS interaction_count,
        MAX(i.timestamp)                                                  AS last_interaction,
        MIN(i.timestamp)                                                  AS first_interaction,
        EXTRACT(DAY FROM NOW() - MAX(i.timestamp))::int                   AS days_since_last,
        CASE
          WHEN COUNT(i.id) >= 5 THEN 'hot'
          WHEN COUNT(i.id) >= 3 THEN 'warm'
          ELSE 'cold'
        END                                                               AS engagement,
        array_agg(DISTINCT i.intent_reason)
          FILTER (WHERE i.intent_reason IS NOT NULL
            AND i.intent_reason NOT IN ('conversation','greeting',''))    AS topics,
        (COUNT(i.id)::int * 3)
          - LEAST(EXTRACT(DAY FROM NOW() - MAX(i.timestamp))::int, 30)   AS priority_score
      FROM interactions i
      LEFT JOIN users u ON u.phone_number = i.user_phone
      WHERE i.agent = 'AURORA'
        AND i.user_phone NOT IN (
          SELECT DISTINCT user_phone FROM reservations
          WHERE status IN ('confirmed', 'completed', 'active')
        )
      GROUP BY i.user_phone, u.name
      HAVING COUNT(i.id) >= 1
      ORDER BY priority_score DESC, interaction_count DESC
      LIMIT 100
    `);

    const total   = prospects.length;
    const hot     = prospects.filter(p => p.engagement === 'hot').length;
    const warm    = prospects.filter(p => p.engagement === 'warm').length;
    const cold    = prospects.filter(p => p.engagement === 'cold').length;
    // Urgente = hot + lleva 2+ días sin contestar
    const urgent  = prospects.filter(p => p.engagement === 'hot' && p.days_since_last >= 2).length;

    return res.json({ ok: true, data: prospects, stats: { total, hot, warm, cold, urgent } });
  } catch (error) {
    console.error('[AURORA-API] Error en abandoned prospects:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/aurora/reservations/:reservationId
 * Obtiene detalle de una reserva específica
 */
router.get('/reservations/:reservationId', async (req, res) => {
  try {
    await databaseService.initialize();
    
    const { reservationId } = req.params;
    
    const reservation = await databaseService.get(
      `SELECT r.*, u.name as user_name, u.email as user_email,
              wc.code AS wifi_code, wc.status AS wifi_status
       FROM reservations r
       LEFT JOIN users u ON r.user_phone = u.phone_number
       LEFT JOIN wifi_codes wc ON wc.reservation_id = r.id
         AND wc.status NOT IN ('cancelled', 'expired')
       WHERE r.id = $1`,
      [reservationId]
    );
    
    if (!reservation) {
      return res.status(404).json({
        ok: false,
        error: 'Reserva no encontrada'
      });
    }
    
    return res.json({
      ok: true,
      data: reservation
    });
    
  } catch (error) {
    console.error('[AURORA-API] Error en reservation detail:', error);
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/aurora/conversations
 * Retorna resumen de conversaciones agrupadas por usuario.
 * Con ?phone=XXXXXX retorna el hilo completo de mensajes de ese usuario.
 */
router.get('/conversations', async (req, res) => {
  try {
    await databaseService.initialize();

    const { phone, limit = 200 } = req.query;

    // Hilo completo de un usuario específico
    if (phone) {
      const messages = await databaseService.all(
        `SELECT
           CASE WHEN input IS NOT NULL AND input <> '' THEN 'user' ELSE 'assistant' END AS role,
           CASE WHEN input IS NOT NULL AND input <> '' THEN input ELSE output END AS content,
           agent_name AS agent,
           intent_reason,
           timestamp
         FROM interactions
         WHERE user_phone = $1
         ORDER BY timestamp ASC`,
        [phone]
      );
      return res.json({ ok: true, data: messages });
    }

    // Resumen por usuario con datos de conversión (multi-agente)
    const rows = await databaseService.all(
      `SELECT
         i.user_phone,
         u.name                               AS user_name,
         COUNT(i.id)                          AS message_count,
         MAX(i.timestamp)                     AS last_message,
         MIN(i.timestamp)                     AS first_message,
         array_agg(DISTINCT i.agent_name) FILTER (WHERE i.agent_name IS NOT NULL) AS agents,
         array_agg(DISTINCT i.intent_reason)  FILTER (WHERE i.intent_reason IS NOT NULL AND i.intent_reason <> 'conversation') AS topics,
         MAX(CASE WHEN i.output IS NOT NULL AND i.output <> '' THEN i.output END) AS last_agent_reply,
         COALESCE(
           (SELECT json_build_object('status', status, 'code', membership_code, 'agent', 'ALUNA', 'type', membership_type)
              FROM membership_leads WHERE user_phone = i.user_phone ORDER BY created_at DESC LIMIT 1),
           (SELECT json_build_object('status', status, 'code', consultation_code, 'agent', 'GABI', 'type', consultation_type)
              FROM legal_leads WHERE user_phone = i.user_phone ORDER BY created_at DESC LIMIT 1),
           (SELECT json_build_object('status', status, 'code', project_code, 'agent', 'ENZO', 'type', project_type)
              FROM marketing_leads WHERE user_phone = i.user_phone ORDER BY created_at DESC LIMIT 1),
           (SELECT json_build_object('status', status, 'code', id::text, 'agent', 'PAULA', 'type', property_type)
              FROM real_estate_leads WHERE user_phone = i.user_phone ORDER BY created_at DESC LIMIT 1),
           (SELECT json_build_object('status', status, 'code', quote_code, 'agent', 'AXEL', 'type', damage_type)
              FROM collision_quotes WHERE user_phone = i.user_phone ORDER BY created_at DESC LIMIT 1),
           (SELECT json_build_object('status', status, 'code', quote_code, 'agent', 'ADRIANA', 'type', insurance_type)
              FROM insurance_leads WHERE user_phone = i.user_phone ORDER BY created_at DESC LIMIT 1)
         ) AS crm_data
       FROM interactions i
       LEFT JOIN users u ON u.phone_number = i.user_phone
       GROUP BY i.user_phone, u.name
       ORDER BY last_message DESC
       LIMIT $1`,
      [parseInt(limit)]
    );

    const summaries = rows.map(r => {
      const crm = r.crm_data || null;
      return {
        ...r,
        crm_status:      crm?.status      || null,
        crm_agent:       crm?.agent       || null,
        crm_type:        crm?.type        || null,
        proforma_code:   crm?.code        || null,
        membership_type: crm?.agent === 'ALUNA' ? crm?.type : null,
        crm_data:        undefined,
      };
    });

    return res.json({ ok: true, data: summaries, total: summaries.length });
  } catch (error) {
    console.error('[AURORA-API] Error en conversations:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// FOLLOW-UP MANUALES (desde dashboard)
// ============================================================================

/**
 * POST /api/aurora/reservations/:id/send-followup-1h
 * Trigger manual: envía WhatsApp de confirmación +1h a una reserva específica
 */
router.post('/reservations/:id/send-followup-1h', async (req, res) => {
  try {
    await databaseService.initialize();
    const reservation = await databaseService.get(
      `SELECT id, user_phone, service_type, date, start_time, end_time, total_price, status
       FROM reservations WHERE id = $1`,
      [req.params.id]
    );
    if (!reservation) {
      return res.status(404).json({ ok: false, error: 'Reserva no encontrada' });
    }
    await sendOneHourFollowup(reservation);
    return res.json({ ok: true, message: 'Follow-up +1h enviado' });
  } catch (error) {
    console.error('[AURORA-API] Error send-followup-1h:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/aurora/reservations/:id/send-rebooking
 * Trigger manual: envía WhatsApp de re-booking D+7 a una reserva específica
 */
router.post('/reservations/:id/send-rebooking', async (req, res) => {
  try {
    await databaseService.initialize();
    const reservation = await databaseService.get(
      `SELECT id, user_phone, service_type, date, start_time, end_time, total_price, status
       FROM reservations WHERE id = $1`,
      [req.params.id]
    );
    if (!reservation) {
      return res.status(404).json({ ok: false, error: 'Reserva no encontrada' });
    }
    await sendRebookingReminder(reservation);
    return res.json({ ok: true, message: 'Recordatorio re-booking enviado' });
  } catch (error) {
    console.error('[AURORA-API] Error send-rebooking:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/aurora/interested-groups
 * Tres grupos de personas interesadas que no siguieron adelante.
 * Usados para campañas de retención desde el dashboard.
 */
router.get('/interested-groups', async (req, res) => {
  try {
    await databaseService.initialize();

    // Grupo 1: Se fueron a la mitad (empezaron a reservar, nunca confirmaron)
    const partial = await databaseService.all(`
      SELECT
        apr.user_phone,
        u.name AS user_name,
        apr.service_type,
        apr.date AS wanted_date,
        apr.form_progress,
        apr.cancelled_at AS last_seen,
        EXTRACT(DAY FROM NOW() - COALESCE(apr.cancelled_at, apr.created_at))::int AS days_ago
      FROM aurora_partial_reservations apr
      LEFT JOIN users u ON u.phone_number = apr.user_phone
      ORDER BY COALESCE(apr.cancelled_at, apr.created_at) DESC
      LIMIT 50
    `);

    // Grupo 2: Reservaron pero no volvieron (última reserva hace más de 30 días)
    const inactive = await databaseService.all(`
      SELECT
        r.user_phone,
        u.name AS user_name,
        (array_agg(r.service_type ORDER BY r.created_at DESC))[1] AS last_service_type,
        MAX(r.created_at) AS last_reservation,
        EXTRACT(DAY FROM NOW() - MAX(r.created_at))::int AS days_since
      FROM reservations r
      LEFT JOIN users u ON u.phone_number = r.user_phone
      WHERE r.status IN ('confirmed', 'completed')
      GROUP BY r.user_phone, u.name
      HAVING MAX(r.created_at) < NOW() - INTERVAL '30 days'
      ORDER BY last_reservation DESC
      LIMIT 50
    `);

    // Grupo 3: Cancelaron su reserva
    const cancelled = await databaseService.all(`
      SELECT
        r.user_phone,
        u.name AS user_name,
        r.service_type,
        r.date AS reservation_date,
        r.created_at,
        EXTRACT(DAY FROM NOW() - r.created_at)::int AS days_ago
      FROM reservations r
      LEFT JOIN users u ON u.phone_number = r.user_phone
      WHERE r.status = 'cancelled'
      ORDER BY r.created_at DESC
      LIMIT 50
    `);

    return res.json({
      ok: true,
      data: { partial, inactive, cancelled },
      counts: {
        partial: partial.length,
        inactive: inactive.length,
        cancelled: cancelled.length,
        total: partial.length + inactive.length + cancelled.length
      }
    });

  } catch (error) {
    console.error('[AURORA-API] Error en interested-groups:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * POST /api/aurora/send-campaign
 * Envía un mensaje WhatsApp a una lista de teléfonos (campaña manual).
 * Body: { phones: string[], message: string, group: string }
 */
router.post('/send-campaign', async (req, res) => {
  try {
    const { phones, message, group } = req.body;

    if (!phones?.length || !message?.trim()) {
      return res.status(400).json({ ok: false, error: 'Se requiere phones[] y message' });
    }
    if (!WASSENGER_TOKEN) {
      return res.status(503).json({ ok: false, error: 'WASSENGER_TOKEN no configurado en este entorno' });
    }

    let sent = 0, failed = 0, errors = [];

    for (const phone of phones) {
      try {
        const localized = await localizeOutgoing(phone, message); // 🌍 idioma del cliente
        const auroraMsg = localized.startsWith('@aurora') ? localized : `@aurora\n${localized}`;
        const body = JSON.stringify({ phone, message: auroraMsg, device: WASSENGER_DEVICE_ID });
        const waRes = await fetch('https://api.wassenger.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Token': WASSENGER_TOKEN },
          body
        });
        const json = await waRes.json();
        if (json.id) { sent++; } else { failed++; errors.push({ phone, error: json.message }); }
      } catch (e) {
        failed++;
        errors.push({ phone, error: e.message });
      }
      // Pequeña pausa para no saturar Wassenger
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`[AURORA-CAMPAIGN] Grupo "${group}" → ${sent} enviados, ${failed} fallidos`);
    return res.json({ ok: true, sent, failed, total: phones.length, errors });

  } catch (error) {
    console.error('[AURORA-API] Error en send-campaign:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// RESERVA MANUAL (BOSS COMMAND)
// ============================================================================

/**
 * POST /api/aurora/reservations/manual
 * Crea una reserva manual desde el dashboard del admin.
 * Body: { clientName, clientPhone, serviceType, date, startTime, endTime, amount, paymentType, notes }
 */
router.post('/reservations/manual', async (req, res) => {
  try {
    await databaseService.initialize();
    const { clientName, clientPhone, serviceType, date, startTime, endTime, amount, paymentType, notes } = req.body;

    if (!clientName || !clientPhone || !serviceType || !date || !startTime || !endTime) {
      return res.status(400).json({ ok: false, error: 'Campos requeridos: clientName, clientPhone, serviceType, date, startTime, endTime' });
    }

    // Generar ID único
    const id = `MAN-${Date.now().toString(36).toUpperCase()}`;

    // Calcular duración
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const durationHours = Math.max(1, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60));

    const parsedAmount = parseFloat(amount) || 0;
    const isFree = paymentType === 'gratis';
    const paymentStatus = isFree ? 'free' : (parsedAmount > 0 ? 'paid' : 'pending');
    const paymentMethod = isFree ? null : (paymentType || 'efectivo');

    // Asegurar que el usuario existe
    await databaseService.run(`
      INSERT INTO users (phone_number, name, registered_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (phone_number) DO UPDATE SET name = COALESCE(NULLIF($2, ''), users.name)
    `, [clientPhone, clientName]);

    // Insertar reserva
    await databaseService.run(`
      INSERT INTO reservations (id, user_phone, service_type, date, start_time, end_time, duration_hours,
        total_price, was_free, status, payment_status, payment_method, created_at, confirmed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'confirmed', $10, $11, NOW(), NOW())
    `, [id, clientPhone, serviceType, date, startTime, endTime, durationHours,
        parsedAmount, isFree, paymentStatus, paymentMethod]);

    // Si hay notas, guardarlas como interacción
    if (notes?.trim()) {
      await databaseService.run(`
        INSERT INTO interactions (user_phone, agent, agent_name, intent_reason, input, output, timestamp)
        VALUES ($1, 'ADMIN', 'Dashboard', 'manual_reservation', $2, $3, NOW())
      `, [clientPhone, notes.trim(), `Reserva manual ${id} creada desde dashboard`]).catch(() => {});
    }

    // 🔑 Generar código WiFi automático para la reserva
    let wifiCode = null;
    try {
      const wifiResult = await generateWifiCode({
        reservationId: id,
        userPhone: clientPhone,
        durationHours,
        validForDate: date
      });
      if (wifiResult.success) {
        wifiCode = wifiResult.code;
        console.log(`[AURORA-API] 🔑 WiFi generado para reserva manual: ${wifiCode}`);
      }
    } catch (wifiErr) {
      console.warn('[AURORA-API] ⚠️ No se pudo generar WiFi (no bloquea):', wifiErr.message);
    }

    console.log(`[AURORA-API] Reserva manual creada: ${id} → ${clientName} (${clientPhone})`);
    return res.json({ ok: true, id, wifiCode });

  } catch (error) {
    console.error('[AURORA-API] Error creando reserva manual:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// REGISTRO DE PAGO MANUAL (EFECTIVO)
// ============================================================================

/**
 * PATCH /api/aurora/reservations/:id/register-payment
 * Registra pago manual en efectivo: actualiza total_price, payment_status y
 * envía WA de confirmación al cliente (flujo Gabi).
 * Body: { amount: number }
 */
router.patch('/reservations/:id/register-payment', async (req, res) => {
  try {
    await databaseService.initialize();
    const { id } = req.params;
    const parsedAmount = parseFloat(req.body?.amount);

    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ ok: false, error: 'Monto inválido' });
    }

    // Obtener reserva + datos del usuario
    const reservation = await databaseService.get(`
      SELECT r.*, u.name AS user_name, u.email AS user_email
      FROM reservations r
      LEFT JOIN users u ON u.phone_number = r.user_phone
      WHERE r.id = $1
    `, [id]);

    if (!reservation) {
      return res.status(404).json({ ok: false, error: 'Reserva no encontrada' });
    }
    if (reservation.payment_status === 'paid') {
      return res.status(409).json({ ok: false, error: 'Esta reserva ya fue marcada como pagada' });
    }

    // Actualizar pago en DB
    await databaseService.run(`
      UPDATE reservations
      SET payment_status = 'paid',
          total_price    = $1,
          payment_method = 'efectivo'
      WHERE id = $2
    `, [parsedAmount, id]);

    // 🔑 Generar código WiFi para la reserva pagada
    let wifiCode = null;
    try {
      const durationHours = parseFloat(reservation.duration_hours) || 2;
      const wifiResult = await generateWifiCode({
        reservationId: id,
        userPhone: reservation.user_phone,
        durationHours,
        validForDate: reservation.date
      });
      if (wifiResult.success) {
        wifiCode = wifiResult.code;
        console.log(`[AURORA-API] 🔑 WiFi generado para pago registrado: ${wifiCode}`);
      }
    } catch (wifiErr) {
      console.warn('[AURORA-API] ⚠️ No se pudo generar WiFi (no bloquea):', wifiErr.message);
    }

    // Enviar WA de confirmación al cliente
    let waSent = false;
    if (WASSENGER_TOKEN && reservation.user_phone) {
      try {
        const svcName = getServiceLabel(reservation.service_type);
        const firstName = reservation.user_name ? reservation.user_name.split(' ')[0] : '';
        const wifiLine = wifiCode
          ? `\n🔑 Tu código WiFi: *${wifiCode}*\n⏱️ Válido por ${parseFloat(reservation.duration_hours) || 2}h desde que te conectes`
          : '\n🔑 WiFi: *CoworkiaWiFi* / Clave: *coworkia2024*';
        const waMsg = `✅ ¡Hola${firstName ? ` ${firstName}` : ''}! Registramos tu pago de *$${parsedAmount.toFixed(2)}* por tu reserva de *${svcName}* el ${reservation.date}.\n\n📍 *Datos de acceso — Coworkia Quito*\n${COWORKIA_ADDRESS}\n🏙️ Zona segura — acceso directo en planta baja\n📍 ${COWORKIA_MAPS_URL}${wifiLine}\n☕ Café de cortesía en recepción\n\n¡Gracias por preferirnos! 🏢 — Coworkia`;
        const waRes = await fetch('https://api.wassenger.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Token': WASSENGER_TOKEN },
          body: JSON.stringify({ phone: reservation.user_phone, message: await localizeOutgoing(reservation.user_phone, waMsg), device: WASSENGER_DEVICE_ID })
        });
        const waJson = await waRes.json();
        waSent = !!waJson.id;
      } catch (e) {
        console.warn('[AURORA-API] WA confirmación pago failed:', e.message);
      }
    }

    // 📧 Email recibo de pago al cliente
    let emailSent = false;
    const clientEmail = reservation.user_email || reservation.email;
    if (clientEmail) {
      try {
        const svcName = getServiceLabel(reservation.service_type);
        const fechaFmt = new Date(reservation.date + 'T12:00:00').toLocaleDateString('es-EC', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const horaFmt = reservation.time ? reservation.time.slice(0, 5) : '';
        const html = buildEmailTemplate('AURORA', 'AURORA_CONFIRMATION', {
          nombre: reservation.user_name || '',
          servicio: svcName,
          dia: fechaFmt,
          hora: horaFmt,
          precio: `$${parsedAmount.toFixed(2)}`,
        });
        await sendEmail({
          to: clientEmail,
          subject: `✅ Recibo de reserva — ${svcName} | Coworkia`,
          html,
        });
        emailSent = true;
        console.log(`[AURORA-API] 📧 Recibo enviado a ${clientEmail}`);
      } catch (e) {
        console.warn('[AURORA-API] Email recibo failed:', e.message);
      }
    }

    console.log(`[AURORA-API] 💰 Pago registrado: reserva #${id} → $${parsedAmount} efectivo | WA: ${waSent} | Email: ${emailSent}`);

    // 🚨 ALERTA SÁBADO: si la reserva cae en sábado, avisar urgente a Diego
    if (reservation.date) {
      const reservationDay = new Date(reservation.date + 'T12:00:00').getDay();
      if (reservationDay === 6 && process.env.DIEGO_PERSONAL_PHONE) {
        const svcName = getServiceLabel(reservation.service_type);
        const clientName = reservation.user_name || 'Sin nombre';
        const saturdayAlert = `🚨🚨🚨 ALERTA SÁBADO 🚨🚨🚨\n\n💰 CLIENTE PAGADO — ABRIR COWORKIA\n\n👤 Cliente: ${clientName}\n📅 Sábado ${reservation.date}\n⏰ Horario: ${reservation.start_time || '?'} - ${reservation.end_time || '?'}\n🏢 Servicio: ${svcName}\n💵 Monto: $${parsedAmount.toFixed(2)}\n\n⚡ Este cliente YA PAGÓ. Confirma apertura del local.`;
        enviarWhatsApp(process.env.DIEGO_PERSONAL_PHONE, saturdayAlert).catch(err =>
          console.error('[AURORA-API] ⚠️ Alerta sábado falló:', err.message)
        );
        console.log(`[AURORA-API] 🚨 Alerta sábado enviada a Diego — reserva #${id}`);
      }
    }

    return res.json({ ok: true, message: 'Pago registrado', waSent, emailSent, amount: parsedAmount });

  } catch (error) {
    console.error('[AURORA-API] Error en register-payment:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// MARCAR ASISTENCIA
// ============================================================================

/**
 * PATCH /api/aurora/reservations/:id/attended
 * Marca si el cliente asistió (true) o no asistió (false).
 * No asistió → cambia status a 'cancelled'.
 * Body: { attended: boolean }
 */
router.patch('/reservations/:id/attended', async (req, res) => {
  try {
    await databaseService.initialize();
    const { id } = req.params;
    const { attended } = req.body;

    if (typeof attended !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'attended debe ser boolean' });
    }

    const reservation = await databaseService.get(
      'SELECT id, status FROM reservations WHERE id = $1', [id]
    );
    if (!reservation) {
      return res.status(404).json({ ok: false, error: 'Reserva no encontrada' });
    }

    if (attended) {
      await databaseService.run(
        'UPDATE reservations SET attended = TRUE WHERE id = $1', [id]
      );
    } else {
      // No asistió → cancelar y marcar
      await databaseService.run(
        `UPDATE reservations SET attended = FALSE, status = 'cancelled' WHERE id = $1`, [id]
      );
    }

    console.log(`[AURORA-API] 👤 Asistencia reserva #${id}: ${attended ? 'Sí asistió' : 'No asistió'}`);
    return res.json({ ok: true, attended });

  } catch (error) {
    console.error('[AURORA-API] Error en attended:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// AUTOMATIONS STATS
// ============================================================================

/**
 * GET /api/aurora/automations/stats
 * Devuelve estadísticas de cada automatización (hoy, semana, total, último envío)
 */
router.get('/automations/stats', async (req, res) => {
  try {
    await databaseService.initialize();

    const fields = [
      { key: 'followup_1h',  col: 'followup_1h_sent_at' },
      { key: 'followup_d1',  col: 'followup_d1_sent_at' },
      { key: 'followup_d3',  col: 'followup_d3_sent_at' },
      { key: 'reminder_24h', col: 'reminder_24h_sent_at' },
      { key: 'reminder_2h',  col: 'reminder_2h_sent_at' },
      { key: 'no_show',      col: 'no_show_detected_at' },
      { key: 'rebook_d7',    col: 'rebook_reminder_sent_at' },
      { key: 'payment',      col: 'payment_reminder_sent_at' },
      { key: 'upsell',       col: 'upsell_aluna_sent_at' }
    ];

    const stats = {};

    for (const f of fields) {
      const row = await databaseService.get(`
        SELECT
          COUNT(*) FILTER (WHERE ${f.col} >= CURRENT_DATE) AS today,
          COUNT(*) FILTER (WHERE ${f.col} >= CURRENT_DATE - INTERVAL '7 days') AS week,
          COUNT(*) FILTER (WHERE ${f.col} IS NOT NULL) AS total,
          MAX(${f.col}) AS last_sent
        FROM reservations
      `);
      stats[f.key] = {
        today:    parseInt(row?.today || 0),
        week:     parseInt(row?.week || 0),
        total:    parseInt(row?.total || 0),
        lastSent: row?.last_sent || null
      };
    }

    return res.json({ ok: true, stats });
  } catch (error) {
    console.error('[AURORA-API] Error en automations/stats:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// ============================================================================
// OCUPACIÓN HOT DESKS — Permanentes + Disponibilidad
// ============================================================================

/**
 * GET /api/aurora/occupancy
 * Retorna estado de ocupación total: 6 desks, N permanentes, N disponibles
 */
router.get('/occupancy', async (req, res) => {
  try {
    await databaseService.initialize();
    const reservationRepository = (await import('../../database/reservationRepository.js')).default;

    const permanentDesks = await reservationRepository.getActivePermanentDesks();
    const permanentNumbers = permanentDesks.map(d => d.hot_desk_number);

    const totalDesks = 6;
    const available = totalDesks - permanentDesks.length;

    return res.json({
      ok: true,
      totalDesks,
      permanentCount: permanentDesks.length,
      availableForBooking: available,
      permanentDesks: permanentDesks.map(d => ({
        deskNumber: d.hot_desk_number,
        clientName: d.client_name,
        since: d.start_date,
        until: d.end_date
      })),
      availableNumbers: Array.from({ length: 6 }, (_, i) => i + 1)
        .filter(n => !permanentNumbers.includes(n))
    });
  } catch (error) {
    console.error('[AURORA-API] Error en occupancy:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
