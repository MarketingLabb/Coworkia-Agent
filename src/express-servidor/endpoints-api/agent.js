// src/express-servidor/endpoints-api/agent.js
import { Router } from 'express';
import { authAgentBuilder } from '../seguridad-auth/auth.js';
import { detectarIntencion } from '../../deteccion-intenciones/detectar-intencion.js';
import { complete } from '../../servicios-ia/openai.js';
import { loadProfile, saveProfile, saveInteraction } from '../../perfiles-interacciones/memoria-sqlite.js';

const router = Router();

// POST /agent/handle  (solo Agent Builder con Bearer token)
router.post('/agent/handle', authAgentBuilder, async (req, res) => {
  try {
    const { message = '', profile = {} } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ ok: false, error: 'message requerido' });
    }

    const userId = (profile.userId || '').toString().trim() || null;
    let persistedProfile = null;
    if (userId) {
      const current = await loadProfile(userId) || {};
      const firstVisit = current?.firstVisit === undefined ? true : current.firstVisit;
      const saved = await saveProfile(userId, {
        ...current,
        ...profile,
        userId,
        firstVisit,
        lastMessageAt: new Date().toISOString(),
      });
      if (saved) {
        persistedProfile = await loadProfile(userId);
      }
    }

    const intent = detectarIntencion(message);

    const SYSTEM = {
      AURORA:
        'Eres Aurora, agente de Coworkia. Informas servicios, gestionas reservas, cobras Hot Desk 1 y ayudas con pagos. Tono breve, claro y amable.',
      ALUNA:
        'Eres Aluna, closer de ventas de Coworkia. Especialista en planes mensuales (Plan 10 [$67], Plan 20 [$99], Oficina Virtual [$365/año], Sala Reuniones [$30]). Orientada a cerrar y enviar links de pago.',
      ADRIANA:
        'Eres Adriana, broker de seguros de Segpopular S.A. con 17 años de experiencia. Especialista en seguros de vida, vehículos e incendio. Comparas aseguradoras, cotizas y cierras ventas. Tono profesional y consultivo.',
      ENZO:
        'Eres Enzo, experto en marketing/IA/software/ventas para el mercado ecuatoriano. Respondes técnico y estratégico, claro y accionable.'
    };
    const system = SYSTEM[intent.agent] || SYSTEM.AURORA;

    const prompt = `
Usuario: ${message}
Perfil: ${persistedProfile ? JSON.stringify(persistedProfile) : JSON.stringify(profile)}
Rol activo: ${intent.agent}
Reglas:
- Responde en español, breve y claro.
- Si es primera vez y pide probar, menciona opción de día gratis (no agendes aún).
- Si pregunta por membresías/planes, guía al cierre (ALUNA).
- Si menciona @Enzo, responde como experto en marketing/IA/software local.
- Si menciona @Adriana, responde como broker de seguros de Segpopular S.A.
- No inventes links de pago ni reservas aún, solo describe el siguiente paso.
    `.trim();

    const reply = await complete(prompt, {
      temperature: 0.4,
      max_tokens: 280,
      system
    });

    const AGENT_NAMES = {
      AURORA: 'Aurora Core',
      ALUNA: 'Aluna Closer',
      ADRIANA: 'Adriana Segpopular',
      ENZO: 'Enzo MarketingLab',
      ANGELA: 'Angela Salud',
      AXEL: 'Axel Reparación',
      GABI: 'Gabi Legal',
      PAULA: 'Paula Inmobiliaria'
    };

    try {
      saveInteraction({
        userId: userId || 'anonymous',
        agent: intent.agent,
        agentName: AGENT_NAMES[intent.agent] || intent.agent,
        intentReason: intent.reason,
        input: message,
        output: reply,
        meta: { route: '/agent/handle', via: 'agent_builder' }
      });
    } catch (e) {
      console.warn('[MEMORY] No se pudo registrar interacción:', e?.message);
    }

    return res.json({
      ok: true,
      agent: intent.agent,
      reason: intent.reason,
      reply
    });
  } catch (err) {
    console.error('[AGENT BUILDER] Error:', err);
    return res.status(500).json({ ok: false, error: 'AGENT_FAILURE' });
  }
});

export default router;
