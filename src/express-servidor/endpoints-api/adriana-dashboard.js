/**
 * 📊 API Endpoints — Adriana Seguros Dashboard
 * Rutas para métricas y tabla de insurance_leads
 */

import express from 'express';
import databaseService from '../../database/database.js';
import { enviarWhatsApp } from './wassenger.js';
import { buildEmailTemplate } from '../../servicios/email-template-system.js';
import { sendEmail, AGENT_FROM_NAMES, DEFAULT_FROM_EMAIL } from '../../servicios/email.js';

const router = express.Router();

// ── GET /api/adriana/leads ────────────────────────────────────────────────────
router.get('/leads', async (req, res) => {
  try {
    await databaseService.initialize();
    const { status, insuranceType, search, limit = 200, offset = 0 } = req.query;

    let query = `SELECT id, quote_code, insurance_type, client_name, email, phone,
                        vehicle_brand, vehicle_model, vehicle_year,
                        city, quoted_premium, status,
                        kyc_cedula, kyc_matricula, competitor_quote_amount, competitor_insurer,
                        quote_sent_at, created_at
                 FROM insurance_leads WHERE 1=1`;
    const params = [];
    let i = 1;

    if (status)       { query += ` AND status = $${i++}`;          params.push(status); }
    if (insuranceType){ query += ` AND insurance_type ILIKE $${i++}`; params.push(`%${insuranceType}%`); }
    if (search) {
      query += ` AND (client_name ILIKE $${i} OR email ILIKE $${i} OR phone ILIKE $${i} OR quote_code ILIKE $${i} OR vehicle_model ILIKE $${i})`;
      params.push(`%${search}%`); i++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`;
    params.push(parseInt(limit), parseInt(offset));

    const leads = await databaseService.all(query, params);
    return res.json({ ok: true, data: leads || [] });
  } catch (err) {
    console.error('[ADRIANA-DASHBOARD] Error loading leads:', err);
    return res.status(500).json({ ok: false, error: 'No se pudieron cargar los leads de Adriana' });
  }
});

// ── GET /api/adriana/leads-stats ──────────────────────────────────────────────
router.get('/leads-stats', async (req, res) => {
  try {
    await databaseService.initialize();

    const [total, thisMonth, thisWeek, byStatus, premiumRow] = await Promise.all([
      databaseService.get(`SELECT COUNT(*) as total FROM insurance_leads`),
      databaseService.get(`SELECT COUNT(*) as count FROM insurance_leads WHERE TO_CHAR(created_at,'YYYY-MM') = TO_CHAR(NOW(),'YYYY-MM')`),
      databaseService.get(`SELECT COUNT(*) as count FROM insurance_leads WHERE created_at >= NOW() - INTERVAL '7 days'`),
      databaseService.all(`SELECT status, COUNT(*) as count FROM insurance_leads GROUP BY status ORDER BY count DESC`),
      databaseService.get(`SELECT AVG(quoted_premium) as avg_premium, SUM(quoted_premium) as total_premium FROM insurance_leads WHERE status IN ('accepted') AND quoted_premium IS NOT NULL`),
    ]);

    return res.json({
      ok: true,
      data: {
        total:        total?.total || 0,
        thisMonth:    thisMonth?.count || 0,
        thisWeek:     thisWeek?.count || 0,
        byStatus:     byStatus || [],
        avgPremium:   parseFloat(premiumRow?.avg_premium || 0),
        totalPremium: parseFloat(premiumRow?.total_premium || 0),
      },
    });
  } catch (err) {
    console.error('[ADRIANA-DASHBOARD] Error loading stats:', err);
    return res.status(500).json({ ok: false, error: 'No se pudieron cargar las métricas de Adriana' });
  }
});

// ── PATCH /api/adriana/leads/:code/status ────────────────────────────────────
router.patch('/leads/:code/status', async (req, res) => {
  try {
    await databaseService.initialize();
    const { code } = req.params;
    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ ok: false, error: 'status requerido' });

    let query = `UPDATE insurance_leads SET status = $1, updated_at = CURRENT_TIMESTAMP`;
    const params = [status, code];
    if (notes) { query += `, notes = $3`; params.push(notes); }
    query += ` WHERE quote_code = $2`;

    await databaseService.run(query, params);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[ADRIANA-API] Error patch:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/adriana/leads/:code/send-wa ────────────────────────────────────
router.post('/leads/:code/send-wa', async (req, res) => {
  try {
    await databaseService.initialize();
    const l = await databaseService.get(
      `SELECT quote_code, client_name, phone, insurance_type, vehicle_brand, vehicle_model, vehicle_year, quoted_premium
       FROM insurance_leads WHERE quote_code = $1`,
      [req.params.code]
    );
    if (!l || !l.phone) return res.status(404).json({ ok: false, error: 'Lead no encontrado o sin teléfono' });

    const _adminNorm = (process.env.ADMIN_PHONE || '').replace(/\D/g, '');
    if (_adminNorm && l.phone.replace(/\D/g, '') === _adminNorm) {
      return res.status(403).json({ ok: false, error: 'TEST_LEAD', message: 'No se envían mensajes del dashboard al teléfono de administrador' });
    }

    const name    = (l.client_name || 'Hola').split(' ')[0];
    const vehicle = [l.vehicle_brand, l.vehicle_model, l.vehicle_year].filter(Boolean).join(' ') || 'tu vehículo';
    const tipo    = l.insurance_type || 'seguro';
    const premium = l.quoted_premium ? ` La cotización por *$${parseFloat(l.quoted_premium).toFixed(2)}* sigue vigente.` : '';
    const msg     = `@adriana\nHola ${name} 👋\n\nTe escribo de SegPopular sobre el ${tipo.toLowerCase()} para *${vehicle}*.${premium}\n\n¿Puedo ayudarte con algo más o aclarar alguna duda? 📋`;

    await enviarWhatsApp(l.phone, msg);
    await databaseService.run(
      `UPDATE insurance_leads SET updated_at = CURRENT_TIMESTAMP WHERE quote_code = $1`,
      [req.params.code]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('[ADRIANA-API] Error send-wa:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /api/adriana/leads/:code — Borrado LOPDP (derecho al olvido) ──────
router.delete('/leads/:code', async (req, res) => {
  const { code } = req.params;
  try {
    await databaseService.initialize();
    const existing = await databaseService.get(
      'SELECT id, client_name FROM insurance_leads WHERE id = $1',
      [code]
    );
    if (!existing) return res.status(404).json({ ok: false, error: 'Lead no encontrado' });
    await databaseService.run('DELETE FROM insurance_leads WHERE id = $1', [code]);
    console.log(`[ADRIANA-ARCO] 🗑️ Lead ${code} (${existing.client_name}) eliminado por solicitud ARCO`);
    return res.json({ ok: true, deleted: code, name: existing.client_name });
  } catch (err) {
    console.error('[ADRIANA-API] Error delete lead:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/adriana/seed-demo ────────────────────────────────────────────────
router.get('/seed-demo', async (req, res) => {
  try {
    await databaseService.initialize();
    console.log('🎭 [ADRIANA] Iniciando seed de leads demo...');

    const DEMO_LEADS = [
      { id: 'INS-DEMO-001', code: 'ADR-DEMO-001', phone: '+593981001001', name: 'Fernanda Gavilanez',  email: 'fernanda.gavilanez@gmail.com',  brand: 'Toyota',    model: 'Corolla',   year: 2020, value: 18000, premium: 380.00, type: 'Seguro para Vehículos livianos', status: 'quoted',    daysAgo: 3  },
      { id: 'INS-DEMO-002', code: 'ADR-DEMO-002', phone: '+593981001002', name: 'Paul Gavilanez',      email: 'paul.gavilanez@gmail.com',       brand: 'Chevrolet', model: 'Aveo',      year: 2019, value: 12000, premium: 260.00, type: 'Seguro para Vehículos livianos', status: 'pending',   daysAgo: 1  },
      { id: 'INS-DEMO-003', code: 'ADR-DEMO-003', phone: '+593981001003', name: 'Carolina Vega',       email: 'carolina.vega@hotmail.com',      brand: 'Hyundai',   model: 'Tucson',    year: 2021, value: 25000, premium: 520.00, type: 'Seguro para Vehículos livianos', status: 'accepted',  daysAgo: 15 },
      { id: 'INS-DEMO-004', code: 'ADR-DEMO-004', phone: '+593981001004', name: 'Marco Espinoza',      email: 'marco.espinoza@outlook.com',     brand: 'Kia',       model: 'Sportage',  year: 2022, value: 28000, premium: 580.00, type: 'Seguro para Vehículos livianos', status: 'quoted',    daysAgo: 5  },
      { id: 'INS-DEMO-005', code: 'ADR-DEMO-005', phone: '+593981001005', name: 'Daniela Proaño',      email: 'daniela.proano@yahoo.com',       brand: 'Volkswagen',model: 'Jetta',     year: 2018, value: 14000, premium: 295.00, type: 'Seguro para Vehículos livianos', status: 'accepted',  daysAgo: 20 },
      { id: 'INS-DEMO-006', code: 'ADR-DEMO-006', phone: '+593981001006', name: 'Luis Andrade',        email: 'luis.andrade@live.com',          brand: 'Mazda',     model: 'CX-5',      year: 2020, value: 22000, premium: 460.00, type: 'Seguro para Vehículos livianos', status: 'quoted',    daysAgo: 7  },
      { id: 'INS-DEMO-007', code: 'ADR-DEMO-007', phone: '+593981001007', name: 'Verónica Morales',    email: 'veronica.morales@gmail.com',     brand: 'Suzuki',    model: 'Vitara',    year: 2021, value: 20000, premium: 415.00, type: 'Seguro para Vehículos livianos', status: 'pending',   daysAgo: 2  },
      { id: 'INS-DEMO-008', code: 'ADR-DEMO-008', phone: '+593981001008', name: 'Patricio Lema',       email: 'patricio.lema@icloud.com',       brand: 'Ford',      model: 'Escape',    year: 2019, value: 16000, premium: 335.00, type: 'Seguro para Vehículos livianos', status: 'rejected',  daysAgo: 25 },
      { id: 'INS-DEMO-009', code: 'ADR-DEMO-009', phone: '+593981001009', name: 'Natalia Flores',      email: 'natalia.flores@gmail.com',       brand: 'Renault',   model: 'Duster',    year: 2020, value: 15000, premium: 315.00, type: 'Seguro para Vehículos livianos', status: 'accepted',  daysAgo: 10 },
      { id: 'INS-DEMO-010', code: 'ADR-DEMO-010', phone: '+593981001010', name: 'Esteban Chiriboga',   email: 'esteban.chiriboga@hotmail.com',  brand: 'Nissan',    model: 'X-Trail',   year: 2023, value: 30000, premium: 620.00, type: 'Seguro para Vehículos livianos', status: 'quoted',    daysAgo: 4  },
      { id: 'INS-DEMO-011', code: 'ADR-DEMO-011', phone: '+593981001011', name: 'Javier Andrade',        email: 'jota@nube.ec',                    brand: 'Hyundai',   model: 'Creta',     year: 2022, value: 16000, premium: 830.00,  type: 'Seguro para Vehículos livianos', status: 'quoted',   daysAgo: 1  },
    ];

    let inserted = 0;
    for (const l of DEMO_LEADS) {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - l.daysAgo);

      // FK: ensure user exists
      await databaseService.run(
        `INSERT INTO users (phone_number, name, email, first_visit, free_trial_used)
         VALUES ($1, $2, $3, false, false)
         ON CONFLICT (phone_number) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email`,
        [l.phone, l.name, l.email]
      );

      const result = await databaseService.run(
        `INSERT INTO insurance_leads
           (id, quote_code, user_phone, client_name, email, phone, insurance_type,
            vehicle_brand, vehicle_model, vehicle_year, commercial_value, quoted_premium,
            status, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (quote_code) DO NOTHING`,
        [l.id, l.code, l.phone, l.name, l.email, l.phone, l.type,
         l.brand, l.model, l.year, l.value, l.premium,
         l.status, 'DEMO SEED', createdAt.toISOString()]
      );
      if (result?.rowCount > 0 || result?.changes > 0) inserted++;
    }

    console.log(`✅ [ADRIANA] ${inserted} leads demo insertados`);
    return res.json({ ok: true, inserted, total: DEMO_LEADS.length });
  } catch (err) {
    console.error('[ADRIANA-API] Error seed-demo:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /api/adriana/leads/:code/send-comparison ────────────────────────────
router.post('/leads/:code/send-comparison', async (req, res) => {
  try {
    await databaseService.initialize();
    const l = await databaseService.get(
      `SELECT quote_code, client_name, email, phone, insurance_type,
              vehicle_brand, vehicle_model, vehicle_year, commercial_value,
              quoted_premium, competitor_quotes, city
       FROM insurance_leads WHERE quote_code = $1`,
      [req.params.code]
    );
    if (!l) return res.status(404).json({ ok: false, error: 'Lead no encontrado' });
    if (!l.email) return res.status(400).json({ ok: false, error: 'Lead sin correo electrónico' });

    const primaAnual  = l.quoted_premium ? parseFloat(l.quoted_premium) : 0;
    const primaMensual = primaAnual ? Math.round(primaAnual / 12) : 0;
    let competitors = [];
    try { competitors = l.competitor_quotes ? JSON.parse(l.competitor_quotes) : []; } catch {}

    const html = buildEmailTemplate('adriana', 'COMPARISON_V2', {
      nombre:          l.client_name || 'Cliente',
      marca:           l.vehicle_brand || '',
      modelo:          l.vehicle_model || '',
      anio:            l.vehicle_year || '',
      placa:           '-',
      valor_asegurado: l.commercial_value ? `$${parseFloat(l.commercial_value).toLocaleString('es-EC')}` : '-',
      vaz_prima_anual:   `$${primaAnual.toLocaleString('es-EC')}`,
      vaz_prima_mensual: `$${primaMensual}`,
      vaz_deducible:   '7%',
      analisis_broker: `Hola ${(l.client_name || 'estimado cliente').split(' ')[0]}, analizé el mercado ecuatoriano para tu ${l.vehicle_brand || 'vehículo'} ${l.vehicle_model || ''} y encontré la mejor relación precio-cobertura. El Plan Elemental de VAZ Seguros cubre tu vehículo con asistencia 24/7 y taller propio en Quito. Tu prima anual es de $${primaAnual.toLocaleString('es-EC')}, pagable en hasta 12 cuotas cómodas.`,
      competitors:     competitors,
      fecha_cotizacion: new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' }),
      bot_phone:       (process.env.BOT_PHONE || '593994837117').replace('+', ''),
      adriana_email:   process.env.COWORKIA_ADMIN_EMAIL || 'adriana@segpopular.com.ec',
      adriana_phone:   process.env.ADRIANA_PHONE || process.env.BOT_PHONE || '',
    });

    const vehicle  = [l.vehicle_brand, l.vehicle_model, l.vehicle_year].filter(Boolean).join(' ');
    const subject  = `🛡️ Tu cotización de seguro · ${vehicle} · ${l.quote_code}`;
    const adminCC  = process.env.COWORKIA_ADMIN_EMAIL || '';

    await sendEmail({
      to: l.email,
      cc: adminCC || undefined,
      subject,
      html,
      from: { name: AGENT_FROM_NAMES.adriana || 'Adriana · SegPopular', address: DEFAULT_FROM_EMAIL },
    });

    await databaseService.run(
      `UPDATE insurance_leads SET status = CASE WHEN status = 'pending' THEN 'quoted' ELSE status END,
       quote_sent_at = COALESCE(quote_sent_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
       WHERE quote_code = $1`,
      [req.params.code]
    );

    console.log(`[ADRIANA-API] 📧 Comparación enviada → ${l.email} (${req.params.code})`);
    return res.json({ ok: true, email: l.email });
  } catch (err) {
    console.error('[ADRIANA-API] Error send-comparison:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
