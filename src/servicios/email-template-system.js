/**
 * 📧 EMAIL TEMPLATE SYSTEM — Sistema centralizado de templates HTML
 *
 * Branding por agente + templates profesionales para todos los emails
 * del ecosistema Coworkia Agent.
 *
 * Uso:
 *   import { buildEmailTemplate, buildAlunaD1HTML, AGENT_BRANDING } from './email-template-system.js';
 *   const html = buildEmailTemplate('ALUNA', 'D1', { name, message });
 */

import { ecosistemaTable } from './email-ecosystem.js';
import { COWORKIA_ADDRESS_FULL } from '../utils/constants.js';
import { CONTACT, HOURS, LOCATION, WIFI } from '../utils/coworkia-facts.js';

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

// ─── BRANDING POR AGENTE ──────────────────────────────────────────────────────

export const AGENT_BRANDING = {
  AURORA: {
    name: 'Aurora',
    fullName: 'Aurora · Coworkia Reservas',
    primaryColor: '#4ECDC4',
    secondaryColor: '#44A08D',
    gradient: 'linear-gradient(135deg, #5DE5DB 0%, #3B9177 100%)',
    emoji: '🏢',
    companyName: 'Coworkia',
    tagline: 'Tu espacio de trabajo ideal en Quito',
  },
  ALUNA: {
    name: 'Aluna',
    fullName: 'Aluna · Coworkia Membresías',
    primaryColor: '#8B5CF6',
    secondaryColor: '#6D28D9',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    emoji: '🏢',
    companyName: 'Coworkia',
    tagline: 'Tu espacio de trabajo ideal en Quito',
  },
  ENZO: {
    name: 'Enzo',
    fullName: 'Enzo · MarketingLab',
    primaryColor: '#F97316',
    secondaryColor: '#EA580C',
    gradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
    emoji: '🎯',
    companyName: 'MarketingLab',
    tagline: 'Proyectos creativos con resultados reales',
  },
  ADRIANA: {
    name: 'Adriana',
    fullName: 'Adriana · SegPopular',
    primaryColor: '#1E3A8A',
    secondaryColor: '#1e40af',
    accentColor: '#FCD34D',
    gradient: 'linear-gradient(135deg, #1E3A8A 0%, #1e40af 100%)',
    emoji: '🛡️',
    companyName: 'SegPopular',
    tagline: 'Protegemos lo que más importa',
  },
  AXEL: {
    name: 'Axel',
    fullName: 'Axel · AutoService',
    primaryColor: '#2563EB',
    secondaryColor: '#1D4ED8',
    gradient: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
    emoji: '🔧',
    companyName: 'AutoService',
    tagline: 'Cotizaciones rápidas, servicio confiable',
  },
  GABI: {
    name: 'Gabi',
    fullName: 'Gabi · Asesoría Legal',
    primaryColor: '#D97706',
    secondaryColor: '#92400E',
    gradient: 'linear-gradient(135deg, #D97706 0%, #92400E 100%)',
    emoji: '⚖️',
    companyName: 'Asesoría Legal',
    tagline: 'Consultoría jurídica de confianza',
  },
  PAULA: {
    name: 'Paula',
    fullName: 'Paula · Propiedades',
    primaryColor: '#7C3AED',
    secondaryColor: '#5B21B6',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
    emoji: '🏠',
    companyName: 'Paula Propiedades',
    tagline: 'Encuentra el hogar perfecto',
  },
};

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

/**
 * CSS compartido para mobile responsiveness, accesibilidad y dark mode adaptativo.
 * 
 * @param {object} options
 * @param {boolean} options.xiaomiSafe - Si true, elimina @media dark mode (Xiaomi/MIUI no lo soporta)
 * @returns {string} CSS para inyectar en <style>
 * 
 * ESTRATEGIA v1150:
 * - xiaomiSafe=false (default): dark mode para clientes modernos (iPhone, Gmail)
 * - xiaomiSafe=true: solo light mode (Xiaomi/MIUI ignora @media queries)
 */
function getEmailStyles({ xiaomiSafe = false } = {}) {
  const baseStyles = `img{max-width:100%;height:auto;}`;
  
  const responsiveStyles = `
    @media screen and (max-width:600px){
      .em-wrap{border-radius:0 !important;width:100% !important;}
      .em-body{padding:20px 18px !important;}
      .em-container{width:100% !important;max-width:100% !important;}
    }
  `;
  
  // Solo para clientes que soportan @media (prefers-color-scheme)
  // Xiaomi/MIUI lo ignora → xiaomiSafe=true desactiva esto
  const darkModeStyles = xiaomiSafe ? '' : `
    @media (prefers-color-scheme:dark){
      body{background-color:#f3f4f6 !important;}
      .em-wrap{background-color:#ffffff !important;color:#1f2937 !important;}
    }
  `;
  
  return baseStyles + responsiveStyles + darkModeStyles;
}

/**
 * Reemplaza {{variable}} en un string template.
 * Soporta: {{nombre}}, {{plan}}, {{precio}}, {{empresa}}, etc.
 */
export function replaceVariables(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match;
  });
}

/** Footer estándar Coworkia */
function buildCoworkiaFooter(branding) {
  return `
    <div style="background:${branding.gradient};padding:32px 24px;text-align:center;border-radius:0 0 12px 12px;">
      <div style="color:rgba(255,255,255,0.85);font-size:11px;font-weight:700;letter-spacing:5px;text-transform:uppercase;margin-bottom:12px;">${branding.emoji} ${branding.companyName}</div>
      <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-bottom:8px;">${branding.tagline}</div>
      <div style="color:rgba(255,255,255,0.65);font-size:12px;">📍 ${COWORKIA_ADDRESS_FULL} · 📞 ${CONTACT.phoneDisplay}</div>
    </div>`;
}

// ─── TEMPLATE: ALUNA D+1 ─────────────────────────────────────────────────────

/**
 * 🏢 Email D+1 — Aluna Seguimiento de Membresía
 * Misma identidad visual que el template de proformas aprobado:
 * fondo verde #047857, "Coworkia / BUSINESS CENTER", card blanca con nombre.
 *
 * @param {string} name    — Nombre del prospecto
 * @param {string} message — Cuerpo del mensaje (texto del operador)
 * @param {string} [plan]  — Nombre del plan (default: Membresía Coworkia)
 * @param {object} options — { xiaomiSafe: boolean } para control de dark mode
 */
export function buildAlunaD1HTML({ name, message, plan = 'Membresía Coworkia' }, { xiaomiSafe = false } = {}) {
  const firstName = name ? name.trim().split(' ')[0] : null;
  const displayName = name || '';
  const safeFirstName = firstName ? escapeHtml(firstName) : null;
  const safeDisplayName = escapeHtml(displayName);
  const safeMessage = escapeHtml(message);
  const safePlan = escapeHtml(plan);
  const waText = encodeURIComponent(`¡Hola @aluna!, quiero agendar mi visita gratuita a Coworkia`);

  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:light !important;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light !important;}${getEmailStyles({ xiaomiSafe })}</style>
  <title>Tu membresía en Coworkia te espera</title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div class="em-container" style="width:100%;max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

  <!-- Header — idéntico al template de proformas aprobado -->
  <div style="background:linear-gradient(135deg,#047857 0%,#065F46 100%);text-align:center;padding:40px 20px 35px;">
    <div style="color:white;font-size:52px;font-weight:700;margin-bottom:6px;line-height:1;">Coworkia</div>
    <div style="color:rgba(255,255,255,0.9);font-size:11px;font-weight:600;letter-spacing:6px;text-transform:uppercase;margin-bottom:28px;">BUSINESS CENTER</div>

    <!-- Card blanca con nombre del cliente -->
    <div style="background:rgba(255,255,255,0.97);border-radius:16px;padding:22px 28px;display:inline-block;min-width:280px;text-align:left;box-shadow:0 4px 20px rgba(0,0,0,0.18);">
      <div style="color:#9CA3AF;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:12px;text-align:center;">· SEGUIMIENTO DE MEMBRESÍA ·</div>
      ${displayName ? `<div style="color:#111827;font-size:22px;font-weight:800;margin-bottom:12px;text-align:center;">${safeDisplayName}</div>` : ''}
      <div style="border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;padding:10px 0;margin-bottom:10px;text-align:center;">
        <span style="font-size:16px;vertical-align:middle;">🎫</span>&nbsp;&nbsp;<strong style="color:#111827;font-size:15px;font-weight:700;vertical-align:middle;">${safePlan}</strong>
      </div>
      <div style="color:#047857;font-size:12px;font-weight:600;text-align:center;">Aluna · Especialista en Membresías</div>
    </div>
  </div>

  <!-- Body -->
  <div style="padding:30px 30px 10px;">

    <!-- Saludo personalizado -->
    <div style="text-align:center;margin-bottom:24px;">
      <h2 style="color:#1f2937;font-size:20px;margin:0;">${safeFirstName ? `¡Hola ${safeFirstName}! 👋` : '¡Hola! 👋'}</h2>
      <p style="color:#6B7280;font-size:14px;margin:8px 0 0;">Te damos seguimiento a tu interés en Coworkia</p>
    </div>

    <!-- Mensaje del operador -->
    <div style="color:#374151;font-size:15px;line-height:1.8;white-space:pre-line;margin-bottom:28px;">${safeMessage}</div>

    <!-- Card de beneficios — misma paleta verde -->
    <div style="background:linear-gradient(135deg,rgba(4,120,87,0.08),rgba(6,95,70,0.12));border-left:4px solid #047857;border-radius:12px;padding:22px;margin-bottom:28px;">
      <div style="color:#047857;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">🌟 Lo que incluye tu membresía</div>
      <div style="margin:8px 0;"><span style="color:#059669;font-size:16px;margin-right:8px;">✦</span><span style="color:#374151;font-size:14px;">Espacio totalmente equipado</span></div>
      <div style="margin:8px 0;"><span style="color:#059669;font-size:16px;margin-right:8px;">✦</span><span style="color:#374151;font-size:14px;">Café y snacks ilimitados</span></div>
      <div style="margin:8px 0;"><span style="color:#059669;font-size:16px;margin-right:8px;">✦</span><span style="color:#374151;font-size:14px;">${WIFI.display}</span></div>
      <div style="margin:8px 0;"><span style="color:#059669;font-size:16px;margin-right:8px;">✦</span><span style="color:#374151;font-size:14px;">Salas de reuniones incluidas</span></div>
      <div style="margin:8px 0;"><span style="color:#059669;font-size:16px;margin-right:8px;">✦</span><span style="color:#374151;font-size:14px;">Acceso en horario de oficina</span></div>
      <div style="margin:10px 0 0;background:white;border-radius:8px;padding:10px 14px;border:1px solid rgba(4,120,87,0.2);">
        <span style="font-size:16px;">🎁</span>&nbsp;&nbsp;<strong style="color:#047857;font-size:14px;">Primera visita de prueba GRATIS</strong>
      </div>
    </div>

    <!-- CTA — mismo estilo que la proforma -->
    <div style="text-align:center;margin-bottom:28px;">
      <p style="color:#374151;font-size:14px;font-weight:600;margin:0 0 14px;">💬 Tu espacio ideal te está esperando</p>
      <a href="${CONTACT.whatsappUrl}?text=${waText}"
         style="background:linear-gradient(135deg,#047857,#065F46);color:white;padding:14px 32px;text-decoration:none;border-radius:25px;font-weight:700;display:inline-block;box-shadow:0 4px 12px rgba(4,120,87,0.35);font-size:15px;">
        🏢 Sí, quiero conocer Coworkia esta semana →
      </a>
      <p style="color:#9CA3AF;font-size:12px;margin:10px 0 0;">Respuesta en menos de 5 minutos · WhatsApp</p>
    </div>

  </div>

  <!-- ECOSISTEMA + FOOTER OSCURO — igual que proforma aprobada -->
  <div style="background:linear-gradient(180deg,#0C0F14 0%,#0A0D12 100%);padding:36px 32px;text-align:center;">
    <div style="color:#4ECDC4;font-size:20px;font-weight:800;margin-bottom:10px;line-height:1.3;">Un ecosistema completo de agentes IA</div>
    <div style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.7;max-width:480px;margin:0 auto 22px;">Coworkia es más que un espacio. Es un sistema inteligente que trabaja por ti.</div>
    <div style="margin-bottom:22px;">${ecosistemaTable({ aliados: ['aurora','adriana','angela','axel','aluna','gabi','paula','custom'], theme: 'dark' })}</div>
    <div style="margin-bottom:22px;padding:0 8px;">
      <p style="color:rgba(255,255,255,0.65);font-size:12px;line-height:1.8;margin:0;">Un solo ecosistema. Agentes especializados que se hablan entre sí.<br><strong style="color:rgba(255,255,255,0.75);">Haz clic en cualquier agente para hablar directamente por WhatsApp.</strong></p>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:24px;margin-top:8px;">
      <div style="color:#4ECDC4;font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;">Coworkia</div>
      <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">BUSINESS CENTER</div>
      <div style="color:rgba(255,255,255,0.60);font-size:11px;line-height:1.8;">
        © 2026 Coworkia Ecuador — Espacios que inspiran<br>
        ${COWORKIA_ADDRESS_FULL}<br>
        ${CONTACT.email} &nbsp;·&nbsp; ${CONTACT.phoneDisplay}
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ─── TEMPLATE: ALUNA D+3 (FOMO) ──────────────────────────────────────────────

/**
 * 🔥 Email D+3 — Aluna FOMO (urgencia)
 * Misma identidad verde Coworkia Business Center + badge rojo de urgencia.
 *
 * @param {string} name    — Nombre del prospecto
 * @param {string} message — Cuerpo del mensaje (texto del operador)
 * @param {object} options — { xiaomiSafe: boolean }
 */
export function buildAlunaD3HTML({ name, message }, { xiaomiSafe = false } = {}) {
  const firstName = name ? name.trim().split(' ')[0] : null;
  const displayName = name || '';
  const safeFirstName = firstName ? escapeHtml(firstName) : null;
  const safeDisplayName = escapeHtml(displayName);
  const safeMessage = escapeHtml(message);
  const waText = encodeURIComponent(`¡Hola @aluna!, quiero reservar mi espacio en Coworkia antes de que se agoten`);

  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:light !important;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light !important;}${getEmailStyles({ xiaomiSafe })}</style>
  <title>⚠️ Últimas disponibilidades — Coworkia</title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div class="em-container" style="width:100%;max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

  <!-- Header — fondo verde con badge de urgencia -->
  <div style="background:linear-gradient(135deg,#047857 0%,#065F46 100%);text-align:center;padding:40px 20px 35px;">
    <div style="color:white;font-size:52px;font-weight:700;margin-bottom:6px;line-height:1;">Coworkia</div>
    <div style="color:rgba(255,255,255,0.9);font-size:11px;font-weight:600;letter-spacing:6px;text-transform:uppercase;margin-bottom:28px;">BUSINESS CENTER</div>

    <!-- Card blanca con urgencia -->
    <div style="background:rgba(255,255,255,0.97);border-radius:16px;padding:22px 28px;display:inline-block;min-width:280px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.18);">
      <div style="background:#DC2626;color:white;display:inline-block;padding:4px 14px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">⚠️ ÚLTIMA OPORTUNIDAD</div>
      ${displayName ? `<div style="color:#111827;font-size:22px;font-weight:800;margin-bottom:10px;">${safeDisplayName}</div>` : ''}
      <div style="color:#DC2626;font-size:14px;font-weight:700;margin-bottom:8px;">Solo quedan 2–3 espacios este mes</div>
      <div style="color:#047857;font-size:12px;font-weight:600;">Aluna · Especialista en Membresías</div>
    </div>
  </div>

  <!-- Body -->
  <div style="padding:30px 30px 10px;">

    <!-- Saludo -->
    <div style="text-align:center;margin-bottom:24px;">
      <h2 style="color:#1f2937;font-size:20px;margin:0;">${safeFirstName ? `${safeFirstName}, ¡no dejes pasar esta oportunidad! 🔥` : '¡No dejes pasar esta oportunidad! 🔥'}</h2>
      <p style="color:#6B7280;font-size:14px;margin:8px 0 0;">📅 Esta oferta tiene fecha límite</p>
    </div>

    <!-- Mensaje del operador -->
    <div style="color:#374151;font-size:15px;line-height:1.8;white-space:pre-line;margin-bottom:24px;">${safeMessage}</div>

    <!-- Urgencia card -->
    <div style="background:#FFF5F5;border:1.5px solid #FECACA;border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="color:#DC2626;font-size:14px;font-weight:700;margin-bottom:12px;">🚨 ¿Por qué decidir hoy?</div>
      <div style="margin:8px 0;"><span style="color:#DC2626;font-size:16px;margin-right:8px;">⏰</span><span style="color:#374151;font-size:14px;">Solo quedan 2–3 espacios disponibles este mes</span></div>
      <div style="margin:8px 0;"><span style="color:#DC2626;font-size:16px;margin-right:8px;">📈</span><span style="color:#374151;font-size:14px;">Ya tenemos 3 interesados más esta semana</span></div>
      <div style="margin:8px 0;"><span style="color:#DC2626;font-size:16px;margin-right:8px;">🎁</span><span style="color:#374151;font-size:14px;">La primera visita gratis aplica solo este mes</span></div>
    </div>

    <!-- Testimonio — con border verde Coworkia -->
    <div style="background:#F0FDF4;border-left:4px solid #047857;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;color:#374151;font-size:14px;font-style:italic;line-height:1.7;">
        "Esperé demasiado y cuando quise reservar ya no había espacio. No cometas el mismo error."
      </p>
      <p style="margin:8px 0 0;color:#047857;font-size:13px;font-weight:700;">— Juan M., miembro desde 2025</p>
    </div>

    <!-- CTA urgente -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${CONTACT.whatsappUrl}?text=${waText}"
         style="background:linear-gradient(135deg,#DC2626,#9F1239);color:white;padding:16px 36px;text-decoration:none;border-radius:25px;font-weight:700;display:inline-block;box-shadow:0 4px 16px rgba(220,38,38,0.4);font-size:16px;">
        🔥 RESERVAR MI ESPACIO AHORA →
      </a>
      <p style="color:#9CA3AF;font-size:12px;margin:10px 0 0;">Respuesta garantizada en menos de 5 minutos</p>
    </div>

  </div>

  <!-- ECOSISTEMA + FOOTER OSCURO — igual que proforma aprobada -->
  <div style="background:linear-gradient(180deg,#0C0F14 0%,#0A0D12 100%);padding:36px 32px;text-align:center;">
    <div style="color:#4ECDC4;font-size:20px;font-weight:800;margin-bottom:10px;line-height:1.3;">Un ecosistema completo de agentes IA</div>
    <div style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.7;max-width:480px;margin:0 auto 22px;">Coworkia es más que un espacio. Es un sistema inteligente que trabaja por ti.</div>
    <div style="margin-bottom:22px;">${ecosistemaTable({ aliados: ['aurora','adriana','angela','axel','aluna','gabi','paula','custom'], theme: 'dark' })}</div>
    <div style="margin-bottom:22px;padding:0 8px;">
      <p style="color:rgba(255,255,255,0.65);font-size:12px;line-height:1.8;margin:0;">Un solo ecosistema. Agentes especializados que se hablan entre sí.<br><strong style="color:rgba(255,255,255,0.75);">Haz clic en cualquier agente para hablar directamente por WhatsApp.</strong></p>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:24px;margin-top:8px;">
      <div style="color:#4ECDC4;font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;">Coworkia</div>
      <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">BUSINESS CENTER</div>
      <div style="color:rgba(255,255,255,0.60);font-size:11px;line-height:1.8;">
        © 2026 Coworkia Ecuador — Espacios que inspiran<br>
        ${COWORKIA_ADDRESS_FULL}<br>
        ${CONTACT.email} &nbsp;·&nbsp; ${CONTACT.phoneDisplay}
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ─── TEMPLATE: ADRIANA COMPARATIVO ───────────────────────────────────────────

// ─── TEMPLATE: AURORA CONFIRMATION +1h ─────────────────────────────────────

/**
 * 🏢 Email de confirmación/agradecimiento +1h post-reserva (Aurora)
 * @param {string} nombre    — Nombre del cliente
 * @param {string} servicio  — Hot Desk / Sala de Reuniones
 * @param {string} dia       — Fecha de la reserva (ej: "lunes 24 de marzo")
 * @param {string} hora      — Hora de la reserva (ej: "10:00 AM")
 * @param {string} [precio]  — Precio si aplica
 */
export function buildAuroraConfirmationHTML({ nombre, servicio, dia, hora, precio = '' }, { xiaomiSafe = false } = {}) {
  const b = AGENT_BRANDING.AURORA;
  const firstName = nombre ? nombre.split(' ')[0] : 'amig@';
  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:light !important;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light !important;}${getEmailStyles({ xiaomiSafe })}</style>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div class="em-container" style="width:100%;max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:${b.gradient};padding:36px 32px;text-align:center;">
    <img src="https://coworkia-agent-e97d15dac56f.herokuapp.com/images/logos/coworkia.svg" alt="Coworkia" style="height:40px;margin-bottom:12px;filter:brightness(0) invert(1);" onerror="this.style.display='none'">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">¡Reserva Confirmada! 🎉</h1>
    <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px;">Tu espacio está listo en Coworkia</p>
  </div>

  <!-- Body -->
  <div style="padding:36px 32px;">
    <p style="font-size:16px;color:#1e293b;margin:0 0 20px;">Hola <strong>${firstName}</strong> 👋</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 24px;">
      Confirmamos tu reserva de <strong>${servicio}</strong> para el <strong>${dia}</strong> a las <strong>${hora}</strong>.
      Estamos felices de verte pronto en Coworkia.
    </p>

    <!-- Detalles Box -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${b.primaryColor};border-radius:8px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">📋 Detalles de tu Reserva</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-size:14px;color:#64748b;width:40%;">Servicio</td><td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:600;">${servicio}</td></tr>
        <tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Fecha</td><td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:600;">${dia}</td></tr>
        <tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Hora</td><td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:600;">${hora}</td></tr>
        ${precio ? `<tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Precio</td><td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:600;">${precio}</td></tr>` : ''}
      </table>
    </div>

    <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 24px;">
      ¿Necesitas algo para tu visita? Responde a este mensaje o escríbenos por WhatsApp y con gusto te ayudamos. ☕
    </p>

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0;">
      <a href="https://wa.me/${process.env.BOT_PHONE || '593994837117'}?text=%40aurora%0AHola%20Aurora%2C%20tengo%20una%20reserva%20para%20${encodeURIComponent(dia)}"
         style="display:inline-block;background:${b.primaryColor};color:#fff;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">
        💬 Contactar por WhatsApp
      </a>
    </div>
  </div>

  ${buildCoworkiaFooter(b)}
</div>
</body>
</html>`;
}

// ─── TEMPLATE: AURORA REBOOKING D+7 ─────────────────────────────────────────

/**
 * 🔁 Email D+7 re-booking (Aurora) — Invitar a volver
 * @param {string} nombre    — Nombre del cliente
 * @param {string} servicio  — Servicio que usó
 * @param {string} [descuento] — Código de descuento (opcional)
 */
export function buildAuroraRebookingHTML({ nombre, servicio, descuento = '' }, { xiaomiSafe = false } = {}) {
  const b = AGENT_BRANDING.AURORA;
  const firstName = nombre ? nombre.split(' ')[0] : 'amig@';
  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:light !important;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light !important;}${getEmailStyles({ xiaomiSafe })}</style>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div class="em-container" style="width:100%;max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:${b.gradient};padding:36px 32px;text-align:center;">
    <img src="https://coworkia-agent-e97d15dac56f.herokuapp.com/images/logos/coworkia.svg" alt="Coworkia" style="height:40px;margin-bottom:12px;filter:brightness(0) invert(1);" onerror="this.style.display='none'">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">¡Te extrañamos, ${firstName}! 👋</h1>
    <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px;">Han pasado 7 días desde tu última visita</p>
  </div>

  <!-- Body -->
  <div style="padding:36px 32px;">
    <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      Esperamos que hayas disfrutado tu ${servicio} en Coworkia. 
      Tu productividad es nuestra misión y nos encantaría que volvieras pronto. 🚀
    </p>

    ${descuento ? `
    <!-- Descuento especial -->
    <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:2px solid ${b.primaryColor};border-radius:10px;padding:20px 24px;text-align:center;margin-bottom:24px;">
      <div style="font-size:13px;color:#065f46;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🎁 Regalo de Regreso</div>
      <div style="font-size:28px;font-weight:800;color:#047857;margin:8px 0;">${descuento}</div>
      <div style="font-size:13px;color:#6b7280;">Usa este código en tu próxima reserva</div>
    </div>` : ''}

    <div style="background:#f8fafc;border-left:4px solid ${b.primaryColor};border-radius:8px;padding:18px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
        ✅ <strong>Hot Desk</strong> disponible todos los días<br>
        ✅ <strong>Salas de reuniones</strong> para 4-8 personas<br>
        ✅ WiFi de alta velocidad · Café incluido
      </p>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="https://wa.me/${process.env.BOT_PHONE || '593994837117'}?text=%40aurora%0AHola%20Aurora%2C%20quiero%20hacer%20una%20nueva%20reserva"
         style="display:inline-block;background:${b.primaryColor};color:#fff;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">
        📅 Reservar de Nuevo
      </a>
    </div>
  </div>

  ${buildCoworkiaFooter(b)}
</div>
</body>
</html>`;
}

// ─── TEMPLATE: AURORA D+1 FOLLOW-UP ─────────────────────────────────────────

/**
 * 📨 Email D+1 — Aurora post-visita (engagement + satisfacción)
 * @param {string} nombre      — Nombre del cliente
 * @param {string} servicio    — Servicio que usó (Hot Desk / Sala de Reuniones)
 * @param {string} dia         — Fecha de la reserva
 */
export function buildAuroraD1HTML({ nombre, servicio, dia }, { xiaomiSafe = false } = {}) {
  const b = AGENT_BRANDING.AURORA;
  const firstName = nombre ? nombre.split(' ')[0] : 'amig@';
  const serviceMsg = servicio?.toLowerCase().includes('sala')
    ? '¿Tu reunión fue un éxito? Nos encanta saber que nuestros espacios contribuyen a tus logros.'
    : 'Esperamos que hayas tenido un día super productivo. Nada como un buen espacio para concentrarse.';
  
  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:light !important;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light !important;}${getEmailStyles({ xiaomiSafe })}</style>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div class="em-container" style="width:100%;max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:${b.gradient};padding:36px 32px;text-align:center;">
    <img src="https://coworkia-agent-e97d15dac56f.herokuapp.com/images/logos/coworkia.svg" alt="Coworkia" style="height:40px;margin-bottom:12px;filter:brightness(0) invert(1);" onerror="this.style.display='none'">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">¿Cómo estuvo tu experiencia? 🌟</h1>
    <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px;">Tu opinión nos hace mejores</p>
  </div>

  <!-- Body -->
  <div style="padding:36px 32px;">
    <p style="font-size:16px;color:#1e293b;margin:0 0 20px;">Hola <strong>${firstName}</strong> 👋</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      Ayer disfrutaste de tu <strong>${servicio}</strong> en Coworkia. ${serviceMsg}
    </p>

    <!-- Feedback prompt -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 24px;text-align:center;margin-bottom:24px;">
      <div style="font-size:28px;margin-bottom:8px;">⭐⭐⭐⭐⭐</div>
      <p style="margin:0;font-size:14px;color:#166534;font-weight:600;">¿Qué calificación nos das?</p>
      <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Responde este email con un número del 1 al 5</p>
    </div>

    <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 24px;">
      Nos ayuda mucho tu feedback para seguir mejorando. Y si necesitas un espacio pronto, recuerda que puedes reservar al instante por WhatsApp. 😊
    </p>

    <!-- CTAs -->
    <div style="text-align:center;margin:28px 0;">
      <a href="https://wa.me/${process.env.BOT_PHONE || '593994837117'}?text=%40aurora%0AHola%20Aurora%2C%20quiero%20reservar%20de%20nuevo"
         style="display:inline-block;background:${b.primaryColor};color:#fff;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">
        📅 Reservar de Nuevo
      </a>
    </div>
  </div>

  ${buildCoworkiaFooter(b)}
</div>
</body>
</html>`;
}

// ─── TEMPLATE: AURORA D+3 FOLLOW-UP FOMO ────────────────────────────────────

/**
 * 🔥 Email D+3 — Aurora FOMO + upselling suave
 * @param {string} nombre       — Nombre del cliente
 * @param {string} servicio     — Servicio que usó
 * @param {boolean} [wasFree]   — Si fue visita gratis (primera vez)
 */
export function buildAuroraD3HTML({ nombre, servicio, wasFree = false }, { xiaomiSafe = false } = {}) {
  const b = AGENT_BRANDING.AURORA;
  const rawFirst = nombre ? nombre.trim().split(' ')[0] : '';
  const firstName = (rawFirst && rawFirst !== '.' && rawFirst.length > 1) ? rawFirst : '';

  const fomoMsg = wasFree
    ? 'Esperamos que hayas disfrutado tu primera visita. Aurora puede ayudarte a reservar nuevamente.'
    : servicio?.toLowerCase().includes('sala')
      ? '¿Tienes otra reunión pendiente? Salas disponibles esta semana con <strong>horarios flexibles</strong>.'
      : 'Si vienes con frecuencia, pregunta por nuestros planes de <strong>Membresía Coworkia</strong>.';

  const LOGO_URL = 'https://coworkia-agent-e97d15dac56f.herokuapp.com/images/logos/coworkia.svg';

  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:light !important;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light !important;}${getEmailStyles({ xiaomiSafe })}</style>
  <title>¿Cuándo vuelves a Coworkia?</title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div class="em-container" style="width:100%;max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:${b.gradient};padding:36px 32px;text-align:center;">
    <img src="${LOGO_URL}" alt="Coworkia" style="height:40px;margin-bottom:12px;filter:brightness(0) invert(1);" onerror="this.style.display='none'">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${firstName ? `¿Cuándo vuelves, ${firstName}?` : '¿Cuándo vuelves?'} 🚀</h1>
    <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px;">Han pasado 3 días desde tu visita</p>
  </div>

  <!-- Body -->
  <div style="padding:36px 32px;">
    <p style="font-size:16px;color:#1e293b;margin:0 0 20px;">${firstName ? `Hola <strong>${firstName}</strong> 👋` : 'Hola 👋'}</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 24px;">
      ${fomoMsg}
    </p>

    <!-- Información canónica de Coworkia -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${b.primaryColor};border-radius:8px;padding:18px 20px;margin-bottom:24px;">
      <div style="font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Coworkia Business Center</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:5px 0;font-size:14px;color:#374151;">✅ ${WIFI.display}</td></tr>
        <tr><td style="padding:5px 0;font-size:14px;color:#374151;">🕐 ${HOURS.display}</td></tr>
        <tr><td style="padding:5px 0;font-size:14px;color:#374151;">📍 ${LOCATION.addressFull}</td></tr>
        <tr><td style="padding:5px 0;font-size:14px;color:#374151;">📱 ${CONTACT.phoneDisplay}</td></tr>
      </table>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="https://wa.me/${process.env.BOT_PHONE || '593994837117'}?text=%40aurora%0AHola%20Aurora%2C%20quiero%20reservar%20para%20esta%20semana"
         style="display:inline-block;background:${b.primaryColor};color:#fff;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">
        📅 Agendar Ahora
      </a>
    </div>
  </div>

  ${buildCoworkiaFooter(b)}
</div>
</body>
</html>`;
}

// ─── TEMPLATE: AURORA REMINDER 24H ──────────────────────────────────────────

/**
 * 📅 Email recordatorio 24h antes — Aurora pre-reserva
 * @param {string} nombre    — Nombre del cliente
 * @param {string} servicio  — Servicio reservado
 * @param {string} dia       — Fecha de la reserva
 * @param {string} hora      — Hora de inicio
 */
export function buildAuroraReminder24hHTML({ nombre, servicio, dia, hora }, { xiaomiSafe = false } = {}) {
  const b = AGENT_BRANDING.AURORA;
  const firstName = nombre ? nombre.split(' ')[0] : 'amig@';
  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:light !important;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light !important;}${getEmailStyles({ xiaomiSafe })}</style>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div class="em-container" style="width:100%;max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:${b.gradient};padding:36px 32px;text-align:center;">
    <img src="https://coworkia-agent-e97d15dac56f.herokuapp.com/images/logos/coworkia.svg" alt="Coworkia" style="height:40px;margin-bottom:12px;filter:brightness(0) invert(1);" onerror="this.style.display='none'">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">¡Mañana te esperamos! 📅</h1>
    <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px;">Recordatorio de tu reserva</p>
  </div>

  <!-- Body -->
  <div style="padding:36px 32px;">
    <p style="font-size:16px;color:#1e293b;margin:0 0 20px;">Hola <strong>${firstName}</strong> 👋</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 24px;">
      Te recordamos que <strong>mañana ${dia}</strong> a las <strong>${hora}</strong> tienes tu reserva de <strong>${servicio}</strong> en Coworkia.
    </p>

    <!-- Detalles -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${b.primaryColor};border-radius:8px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">📋 Tu Reserva</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-size:14px;color:#64748b;width:40%;">Servicio</td><td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:600;">${servicio}</td></tr>
        <tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Fecha</td><td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:600;">${dia}</td></tr>
        <tr><td style="padding:6px 0;font-size:14px;color:#64748b;">Hora</td><td style="padding:6px 0;font-size:14px;color:#1e293b;font-weight:600;">${hora}</td></tr>
      </table>
    </div>

    <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#92400e;line-height:1.6;">
        📍 <strong>Dirección:</strong> ${COWORKIA_ADDRESS_FULL}<br>
        ☕ Café incluido · 🏙️ Zona segura, planta baja<br>
        📶 WiFi de alta velocidad
      </p>
    </div>

    <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 24px;">
      ¿Necesitas cancelar o cambiar la hora? No hay problema, escríbenos por WhatsApp.
    </p>

    <div style="text-align:center;margin:28px 0;">
      <a href="https://wa.me/${process.env.BOT_PHONE || '593994837117'}?text=%40aurora%0AHola%20Aurora%2C%20tengo%20una%20consulta%20sobre%20mi%20reserva%20de%20ma%C3%B1ana"
         style="display:inline-block;background:${b.primaryColor};color:#fff;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">
        💬 Contactar por WhatsApp
      </a>
    </div>
  </div>

  ${buildCoworkiaFooter(b)}
</div>
</body>
</html>`;
}

// ─── TEMPLATE: ENZO D+1 ─────────────────────────────────────────────────────

/**
 * 🎯 Email D+1 — Enzo seguimiento suave (sin descuento)
 * @param {string} nombre   — Nombre del prospecto
 * @param {string} proyecto — Tipo de proyecto / servicio cotizado
 * @param {string} message  — Mensaje personalizado
 */
export function buildEnzoD1HTML({ nombre, proyecto = 'tu proyecto', message = '' }, { xiaomiSafe = false } = {}) {
  const b = AGENT_BRANDING.ENZO;
  const firstName = nombre ? nombre.split(' ')[0] : '';
  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:light !important;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light !important;}${getEmailStyles({ xiaomiSafe })}</style>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#fff7ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div class="em-container" style="width:100%;max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:${b.gradient};padding:36px 32px;text-align:center;">
    <img src="/images/logos/enzo.svg" alt="MarketingLab" style="height:40px;margin-bottom:12px;filter:brightness(0) invert(1);" onerror="this.style.display='none'">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">¿Seguimos adelante? 🚀</h1>
    <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px;">MarketingLab — Proyectos que transforman negocios</p>
  </div>

  <!-- Body -->
  <div style="padding:36px 32px;">
    <p style="font-size:16px;color:#1e293b;margin:0 0 16px;">Hola ${firstName ? `<strong>${firstName}</strong>` : 'amig@'} 👋</p>
    <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      ${message || `¿Sigues pensando en avanzar con <strong>${proyecto}</strong>? 
      Nos encantaría ayudarte a materializar tu visión con una estrategia a medida.`}
    </p>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:13px;color:#9a3412;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">💡 Lo que podemos hacer por ti</div>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.8;">
        🎯 Estrategia de marketing personalizada<br>
        📱 Gestión de redes sociales profesional<br>
        🎨 Diseño creativo que convierte<br>
        📊 Reportes de resultados mensuales
      </p>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="https://wa.me/${process.env.BOT_PHONE || '593994837117'}?text=%40enzo%0AHola%20Enzo%2C%20quiero%20agendar%20una%20llamada"
         style="display:inline-block;background:${b.primaryColor};color:#fff;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">
        📞 Agendar Llamada Gratis
      </a>
    </div>
  </div>

  ${buildCoworkiaFooter(b)}
</div>
</body>
</html>`;
}

// ─── TEMPLATE: ENZO D+3 ─────────────────────────────────────────────────────

/**
 * 🎯 Email D+3 — Enzo FOMO + descuento "Solo hoy" 15% OFF
 * @param {string} nombre    — Nombre del prospecto
 * @param {string} proyecto  — Tipo de proyecto / servicio
 * @param {number} [descuento] — Porcentaje de descuento (default: 15)
 */
export function buildEnzoD3HTML({ nombre, proyecto = 'tu proyecto', descuento = 15 }, { xiaomiSafe = false } = {}) {
  const b = AGENT_BRANDING.ENZO;
  const firstName = nombre ? nombre.split(' ')[0] : '';
  const vence = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:light !important;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light !important;}${getEmailStyles({ xiaomiSafe })}</style>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#fff7ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div class="em-container" style="width:100%;max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Urgency banner -->
  <div style="background:#dc2626;padding:10px;text-align:center;">
    <span style="color:#fff;font-size:13px;font-weight:700;">⏰ OFERTA ESPECIAL · VENCE ${vence.toUpperCase()}</span>
  </div>

  <!-- Header -->
  <div style="background:${b.gradient};padding:32px 32px;text-align:center;">
    <img src="/images/logos/enzo.svg" alt="MarketingLab" style="height:40px;margin-bottom:12px;filter:brightness(0) invert(1);" onerror="this.style.display='none'">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">🎁 ${descuento}% OFF — Solo Hoy</h1>
    <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px;">Oferta exclusiva para ${firstName || 'ti'}</p>
  </div>

  <!-- Descuento destacado -->
  <div style="background:#fef3c7;border:2px solid #fbbf24;padding:28px 32px;text-align:center;">
    <div style="font-size:52px;font-weight:900;color:#d97706;line-height:1;">${descuento}<span style="font-size:28px;">%</span></div>
    <div style="font-size:16px;font-weight:700;color:#92400e;margin:8px 0 4px;">DESCUENTO EN TU PRIMER PROYECTO</div>
    <div style="font-size:13px;color:#6b7280;">Válido solo para contratar hoy · No acumulable con otras ofertas</div>
  </div>

  <!-- Body -->
  <div style="padding:28px 32px;">
    <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      ${firstName ? `<strong>${firstName}</strong>, t` : 'T'}odavía estamos guardando tu lugar para <strong>${proyecto}</strong>. 
      Este descuento es nuestra forma de decirte que creemos en tu proyecto y queremos ser parte de él.
    </p>

    <div style="background:#f8fafc;border-left:4px solid ${b.primaryColor};border-radius:8px;padding:16px 20px;margin-bottom:24px;font-size:14px;color:#374151;line-height:1.6;">
      ✅ Sin contrato de permanencia<br>
      ✅ Resultados medibles desde el primer mes<br>
      ✅ Equipo dedicado a tu proyecto
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="https://wa.me/${process.env.BOT_PHONE || '593994837117'}?text=%40enzo%0AHola%20Enzo%2C%20quiero%20aprovechar%20el%20${descuento}%25%20de%20descuento"
         style="display:inline-block;background:#dc2626;color:#fff;padding:16px 40px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;">
        🎁 Quiero Mi ${descuento}% OFF
      </a>
    </div>
    <p style="text-align:center;font-size:12px;color:#9ca3af;margin:8px 0 0;">Responde este email o escríbenos por WhatsApp antes de medianoche</p>
  </div>

  ${buildCoworkiaFooter(b)}
</div>
</body>
</html>`;
}

// ─── TEMPLATE: ENZO D+7 ─────────────────────────────────────────────────────

/**
 * 🎯 Email D+7 — Enzo último intento + caso de éxito
 * @param {string} nombre     — Nombre del prospecto
 * @param {string} proyecto   — Tipo de proyecto
 * @param {string} [caseStudy] — Descripción del caso de éxito (opcional)
 */
export function buildEnzoD7HTML({ nombre, proyecto = 'tu proyecto', caseStudy = '' }, { xiaomiSafe = false } = {}) {
  const b = AGENT_BRANDING.ENZO;
  const firstName = nombre ? nombre.split(' ')[0] : '';
  const defaultCase = 'Cliente del sector retail aumentó sus ventas online un 300% en 3 meses con nuestra estrategia de contenidos y pauta digital.';
  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:light !important;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light !important;}${getEmailStyles({ xiaomiSafe })}</style>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#fff7ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div class="em-container" style="width:100%;max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:${b.gradient};padding:36px 32px;text-align:center;">
    <img src="/images/logos/enzo.svg" alt="MarketingLab" style="height:40px;margin-bottom:12px;filter:brightness(0) invert(1);" onerror="this.style.display='none'">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">📈 Mira lo que logramos</h1>
    <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px;">Resultados reales para negocios reales</p>
  </div>

  <!-- Body -->
  <div style="padding:36px 32px;">
    <p style="font-size:15px;color:#475569;line-height:1.7;margin:0 0 20px;">
      ${firstName ? `<strong>${firstName}</strong>, a` : 'A'}ntes de que cerremos tu cotización para <strong>${proyecto}</strong>, 
      queremos compartir algo que te puede interesar:
    </p>

    <!-- Caso de éxito -->
    <div style="background:#fff7ed;border:2px solid ${b.primaryColor};border-radius:12px;padding:24px;margin-bottom:24px;">
      <div style="font-size:11px;color:#9a3412;font-weight:700;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">📊 Caso de Éxito Real</div>
      <blockquote style="margin:0;font-size:15px;color:#374151;line-height:1.7;font-style:italic;border-left:3px solid ${b.primaryColor};padding-left:16px;">
        "${caseStudy || defaultCase}"
      </blockquote>
      <div style="margin-top:12px;font-size:12px;color:#6b7280;">— Cliente MarketingLab · Resultados verificados</div>
    </div>

    <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0 0 20px;">
      ¿Te gustaría un resultado similar? Si en este momento no es el momento correcto, 
      no hay problema — guarda nuestro contacto para cuando estés listo. 🤝
    </p>

    <div style="text-align:center;margin:24px 0;display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
      <a href="https://wa.me/${process.env.BOT_PHONE || '593994837117'}?text=%40enzo%0AHola%20Enzo%2C%20me%20interesa%20el%20proyecto"
         style="display:inline-block;background:${b.primaryColor};color:#fff;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
        ✅ Me interesa
      </a>
      <a href="https://wa.me/${process.env.BOT_PHONE || '593994837117'}?text=%40enzo%0AHola%20Enzo%2C%20guardar%20para%20despues"
         style="display:inline-block;background:#f1f5f9;color:#475569;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
        📌 Para después
      </a>
    </div>
  </div>

  ${buildCoworkiaFooter(b)}
</div>
</body>
</html>`;
}

// ─── TEMPLATE: ADRIANA COMPARISON V2 ─────────────────────────────────────────

/**
 * 🛡️ Email comparativo VAZ Seguros V2 — con tabla de competidores dinámica
 *
 * Compatible con el caso demo jota@nube.ec (ADR-DEMO-011).
 *
 * @param {object} data
 * @param {string}   data.nombre             — Nombre completo del cliente
 * @param {string}   [data.marca]            — Marca del vehículo
 * @param {string}   [data.modelo]           — Modelo del vehículo
 * @param {number|string} [data.anio]        — Año
 * @param {string}   [data.placa]            — Placa
 * @param {string}   [data.valor_asegurado]  — Ej: "$42,000"
 * @param {string}   [data.vaz_prima_anual]  — Ej: "$1,101"
 * @param {string}   [data.vaz_prima_mensual]— Ej: "$110"
 * @param {string}   [data.vaz_deducible]    — Ej: "7% (Taller VAZ)"
 * @param {string}   [data.analisis_broker]  — Párrafo análisis personalizado
 * @param {Array}    [data.competitors]      — Filas de competidores (puede ser [])
 * @param {string}   [data.fecha_cotizacion] — Fecha formatted
 * @param {string}   [data.bot_phone]        — Número WA bot
 * @param {string}   [data.adriana_email]    — Email de Adriana
 * @param {string}   [data.adriana_phone]    — Teléfono de Adriana
 */
export function buildAdrianaComparisonV2HTML({
  nombre = '',
  marca = '', modelo = '', anio = '', placa = '',
  valor_asegurado = '',
  vaz_prima_anual = '',
  vaz_prima_mensual = '',
  vaz_deducible = '7% (Taller VAZ)',
  analisis_broker = '',
  competitors = [],
  fecha_cotizacion = new Date().toLocaleDateString('es-EC'),
  bot_phone = process.env.BOT_PHONE || '593994837117',
  adriana_email = process.env.ADRIANA_EMAIL || 'adriana@segpopular.com',
  adriana_phone = process.env.ADRIANA_PHONE || '+593 987 770 788',
} = {}, { xiaomiSafe = false } = {}) {
  const b           = AGENT_BRANDING.ADRIANA;
  const firstName   = nombre ? nombre.split(' ')[0] : 'Cliente';
  const vehicleDesc = [marca, modelo, anio].filter(Boolean).join(' ') || 'tu vehículo';
  const placaLabel  = placa && placa !== '-' ? ` · Placa ${placa}` : '';
  const vazEncoded  = encodeURIComponent(`@adriana\nHola Adriana 👋 Acepto la cotización VAZ Seguros para mi ${vehicleDesc}. ¿Qué sigue?`);
  const consultaEncoded = encodeURIComponent(`@adriana\nHola Adriana, quisiera usar mi cupón de asesoría gratuita en seguros corporativos 🎁`);

  // Solo mostrar sección comparativa si hay competidores reales (no usar fallback de mercado)
  const valorNum = parseInt((valor_asegurado || '').replace(/[^0-9]/g, '')) || 0;
  const effectiveCompetitors = competitors.length ? competitors : [];

  const competitorRows = effectiveCompetitors.map((c, i) => `
      <tr style="background:${i % 2 === 0 ? '#fafafa' : 'white'};border-bottom:1px solid #f0f0f0;">
        <td style="padding:11px 14px;font-size:13px;color:#374151;font-weight:600;">${c.nombre || `Competidor ${i + 1}`}</td>
        <td style="padding:11px 14px;font-size:13px;color:#9ca3af;text-align:center;">${c.plan || 'Estándar'}</td>
        <td style="padding:11px 14px;font-size:14px;font-weight:700;color:#dc2626;text-align:center;">${c.prima_anual || '—'}</td>
        <td style="padding:11px 14px;font-size:13px;color:#6b7280;text-align:center;">${c.prima_mensual || '—'}</td>
        <td style="padding:11px 14px;font-size:12px;text-align:center;color:#6b7280;">${c.deducible || '—'}</td>
        <td style="padding:11px 14px;font-size:12px;text-align:center;">${c.asistencia || '—'}</td>
      </tr>`).join('');

  const competitorSection = effectiveCompetitors.length > 0 ? `
    <div style="margin:28px 0 24px;">
      <h3 style="font-size:14px;font-weight:800;color:#1E3A8A;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.5px;">📊 Comparativa objetiva del mercado</h3>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7280;">Analizamos las principales aseguradoras para que tomes la mejor decisión:</p>
      <div style="border-radius:10px;overflow:auto;border:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <table style="width:100%;border-collapse:collapse;min-width:520px;">
          <thead>
            <tr style="background:#1E3A8A;">
              <th style="padding:10px 14px;color:white;font-size:11px;text-align:left;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Aseguradora</th>
              <th style="padding:10px 14px;color:white;font-size:11px;text-align:center;font-weight:700;">Plan</th>
              <th style="padding:10px 14px;color:#FCD34D;font-size:11px;text-align:center;font-weight:700;text-transform:uppercase;">Prima Anual</th>
              <th style="padding:10px 14px;color:white;font-size:11px;text-align:center;font-weight:700;">Mensual</th>
              <th style="padding:10px 14px;color:white;font-size:11px;text-align:center;font-weight:700;">Deducible</th>
              <th style="padding:10px 14px;color:white;font-size:11px;text-align:center;font-weight:700;">Asistencia</th>
            </tr>
          </thead>
          <tbody>${competitorRows}</tbody>
          <tfoot>
            <tr style="background:linear-gradient(135deg,#1E3A8A,#1E40AF);">
              <td style="padding:12px 14px;color:#FCD34D;font-size:13px;font-weight:800;">⭐ VAZ Seguros</td>
              <td style="padding:12px 14px;color:white;font-size:12px;text-align:center;font-weight:700;">Elemental</td>
              <td style="padding:12px 14px;color:#4ade80;font-size:15px;font-weight:900;text-align:center;">${vaz_prima_anual}</td>
              <td style="padding:12px 14px;color:white;font-size:12px;text-align:center;font-weight:600;">${vaz_prima_mensual}</td>
              <td style="padding:12px 14px;color:white;font-size:12px;text-align:center;">${vaz_deducible}</td>
              <td style="padding:12px 14px;color:#4ade80;font-size:12px;text-align:center;font-weight:700;">✅ 24/7</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;text-align:center;">* Cotización VAZ verificada. Valores de otras aseguradoras son de referencia del mercado ecuatoriano a ${fecha_cotizacion}.</p>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:light !important;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light !important;}${getEmailStyles({ xiaomiSafe })}</style>
  <title>Análisis de Seguros — ${firstName} — Adriana Bróker</title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<div style="max-width:620px;margin:0 auto;padding:20px 12px 40px;">

  <!-- ── HEADER ── -->
  <div style="background:linear-gradient(135deg,#1E3A8A 0%,#1d4ed8 100%);padding:44px 32px 36px;border-radius:14px 14px 0 0;text-align:center;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:rgba(255,255,255,0.05);border-radius:50%;"></div>
    <div style="position:absolute;bottom:-60px;left:-30px;width:200px;height:200px;background:rgba(255,255,255,0.03);border-radius:50%;"></div>
    <div style="position:relative;">
      <img src="https://coworkia-agent.herokuapp.com/assets/logos/segpopular.png" alt="SegPopular" style="height:42px;margin-bottom:16px;filter:brightness(0) invert(1);opacity:0.95;" />
      <div style="display:inline-block;background:rgba(255,255,255,0.12);border:1.5px solid rgba(255,255,255,0.2);padding:5px 18px;border-radius:99px;color:rgba(255,255,255,0.85);font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:18px;">🛡️ Adriana · Bróker de Seguros Vehiculares</div>
      <h1 style="color:#FCD34D;margin:0 0 8px;font-size:28px;font-weight:900;line-height:1.2;">Tu seguro está listo, ${firstName} ✅</h1>
      <p style="color:rgba(255,255,255,0.85);margin:0 0 16px;font-size:15px;line-height:1.5;">Cotización personalizada para tu <strong style="color:white;">${vehicleDesc}</strong>${placaLabel}</p>
      <div style="display:inline-block;background:rgba(252,211,77,0.2);border:1px solid rgba(252,211,77,0.4);padding:6px 20px;border-radius:99px;color:#FCD34D;font-size:12px;font-weight:600;">⏰ Válido por 72 horas · ${fecha_cotizacion}</div>
    </div>
  </div>

  <!-- ── BODY ── -->
  <div style="background:white;padding:36px 32px 28px;">

    <!-- Análisis del broker -->
    ${analisis_broker ? `
    <div style="background:#eff6ff;border-left:4px solid #1d4ed8;border-radius:0 10px 10px 0;padding:18px 20px;margin-bottom:28px;">
      <div style="font-size:11px;color:#1E3A8A;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">💬 Tu asesora Adriana dice:</div>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.75;font-style:italic;">"${analisis_broker}"</p>
    </div>` : ''}

    <!-- Urgencia -->
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 20px;margin-bottom:24px;display:flex;align-items:center;gap:12px;">
      <div style="font-size:24px;">⚠️</div>
      <div>
        <div style="font-size:13px;font-weight:700;color:#c2410c;">Cada día sin seguro es un riesgo real</div>
        <div style="font-size:12px;color:#9a3412;margin-top:2px;">Un solo accidente puede costarte más que 10 años de prima. Esta cotización vence en 72 horas.</div>
      </div>
    </div>

    <!-- VAZ Winner Card -->
    <div style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border:2px solid #16a34a;border-radius:14px;padding:24px 26px;margin-bottom:22px;position:relative;overflow:hidden;">
      <div class="badge-best" style="position:absolute;top:12px;right:16px;background:#16a34a;color:white;padding:4px 12px;border-radius:99px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">★ ADRIANA RECOMIENDA</div>
      <h2 style="margin:0 0 4px;font-size:19px;font-weight:900;color:#1E3A8A;">VAZ Seguros · Plan Elemental</h2>
      <p style="margin:0 0 18px;font-size:13px;color:#6b7280;">Cobertura amplia · Taller propio en Quito · 24/7</p>
      <div style="display:flex;align-items:flex-end;gap:20px;margin-bottom:18px;flex-wrap:wrap;">
        <div>
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Prima Anual</div>
          <div style="font-size:36px;font-weight:900;color:#16a34a;line-height:1;">${vaz_prima_anual || '—'}</div>
        </div>
        ${vaz_prima_mensual ? `
        <div style="margin-bottom:6px;">
          <div style="font-size:11px;color:#6b7280;">ó en hasta 12 meses</div>
          <div style="font-size:22px;font-weight:800;color:#1E3A8A;">${vaz_prima_mensual}<span style="font-size:13px;font-weight:600;color:#6b7280;">/mes</span></div>
        </div>` : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151;">
        <tr><td style="padding:6px 0;width:55%;">🔧 Deducible</td><td style="padding:6px 0;font-weight:700;">${vaz_deducible}</td></tr>
        <tr><td style="padding:6px 0;">🚐 Asistencia vial 24/7</td><td style="padding:6px 0;font-weight:700;color:#16a34a;">✅ Grúa ilimitada (accidente)</td></tr>
        <tr><td style="padding:6px 0;">🏠 Amparo Patrimonial</td><td style="padding:6px 0;font-weight:700;color:#16a34a;">✅ Incluido sin costo adicional</td></tr>
        <tr><td style="padding:6px 0;">🔑 Pérdida total / robo</td><td style="padding:6px 0;font-weight:700;color:#16a34a;">✅ Cubierto según póliza</td></tr>
        ${valor_asegurado ? `<tr><td style="padding:6px 0;">💰 Valor asegurado</td><td style="padding:6px 0;font-weight:700;">${valor_asegurado}</td></tr>` : ''}
      </table>
    </div>

    ${competitorSection}

    <!-- Beneficios VAZ Asistencia -->
    <div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:12px;padding:20px 24px;margin-bottom:22px;">
      <div style="font-size:11px;color:#0369a1;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px;">🛡️ LO QUE INCLUYE TU PÓLIZA VAZ — Sin costo adicional</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12.5px;color:#374151;">
        <div style="display:flex;align-items:center;gap:6px;"><span style="color:#16a34a;font-weight:900;">✓</span> <span><strong>Grúa ilimitada</strong> en accidente ($300/evento)</span></div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="color:#16a34a;font-weight:900;">✓</span> <span><strong>Auxilio vial</strong> · Llanta, corriente, gasolina</span></div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="color:#16a34a;font-weight:900;">✓</span> <span><strong>Cerrajería</strong> · Te quedaste sin llaves</span></div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="color:#16a34a;font-weight:900;">✓</span> <span><strong>Asistencia legal</strong> en accidentes</span></div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="color:#16a34a;font-weight:900;">✓</span> <span><strong>Conductor designado</strong> (si toma licor)</span></div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="color:#16a34a;font-weight:900;">✓</span> <span><strong>Llave protegida</strong> en caso de robo</span></div>
      </div>
      <!-- Auto sustituto — beneficio destacado -->
      <div style="margin-top:14px;background:white;border-radius:8px;padding:12px 16px;border-left:4px solid #0369a1;">
        <div style="font-size:12px;font-weight:800;color:#0369a1;margin-bottom:4px;">🚗 AUTO SUSTITUTO — Hasta 2 veces al año</div>
        <div style="font-size:12px;color:#374151;">Si tu vehículo está más de 3 días en el taller, <strong>te damos un auto de reemplazo</strong> en las principales ciudades del Ecuador. ${valorNum >= 40000 ? 'Con tu vehículo (<strong>$' + valorNum.toLocaleString('es-EC') + '</strong>) te corresponds un <strong>SUV compacto manual</strong> (Kia Sonet o similar).' : 'Te corresponde un <strong>compacto</strong> (Kia Soluto o similar).'}</div>
      </div>
    </div>

    <!-- CTA Principal -->
    <div style="text-align:center;margin:32px 0 24px;">
      <a href="https://wa.me/${bot_phone}?text=${vazEncoded}"
         style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:white;padding:20px 48px;border-radius:12px;text-decoration:none;font-weight:900;font-size:18px;box-shadow:0 8px 28px rgba(22,163,74,0.45);letter-spacing:0.3px;">
        ✅ Quiero este seguro — Activar ahora
      </a>
      <p style="margin:10px 0 4px;font-size:12px;color:#6b7280;">Responderé en segundos por WhatsApp · Sin papeleo</p>
      <div style="margin-top:10px;">
        <a href="https://wa.me/${bot_phone}?text=${encodeURIComponent('@adriana\nHola Adriana, tengo dudas sobre mi cotización de seguro vehicular')}"
           style="color:#1d4ed8;font-size:13px;text-decoration:none;font-weight:700;border-bottom:1px solid #bfdbfe;padding-bottom:1px;">
          💬 Tengo dudas · Quiero hablar con Adriana
        </a>
      </div>
    </div>

    <!-- Separador -->
    <div style="border-top:1px solid #f3f4f6;margin:0 0 20px;"></div>

    <!-- CUPÓN Seguros Corporativos -->
    <div style="background:linear-gradient(135deg,#faf5ff,#f3e8ff);border:1.5px dashed #a855f7;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <div style="font-size:11px;color:#7e22ce;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🎁 CUPÓN EXCLUSIVO — Solo para ti</div>
      <h3 style="margin:0 0 6px;font-size:16px;font-weight:800;color:#581c87;">Asesoría GRATUITA en Seguros Corporativos</h3>
      <p style="margin:0 0 14px;font-size:13px;color:#6b7280;line-height:1.6;">¿Tu empresa tiene vehículos, equipos o activos que proteger? Como cliente de SegPopular, tienes derecho a una sesión de análisis gratuita para optimizar tus coberturas corporativas y ahorrar hasta 30%.</p>
      <a href="https://wa.me/${bot_phone}?text=${consultaEncoded}"
         style="display:inline-block;background:#7c3aed;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">
        🎁 Usar mi cupón gratuito →
      </a>
    </div>

    <!-- Info del cliente -->
    <div style="background:#f9fafb;border-radius:10px;padding:14px 18px;font-size:12px;color:#6b7280;">
      <div style="margin-bottom:4px;"><strong style="color:#374151;">Cliente:</strong> ${nombre}</div>
      ${valor_asegurado ? `<div style="margin-bottom:4px;"><strong style="color:#374151;">Vehículo:</strong> ${vehicleDesc}${placaLabel}</div>` : ''}
      <div><strong style="color:#374151;">Cotización:</strong> ${fecha_cotizacion} · Válida 72 horas</div>
    </div>
  </div>

  <!-- ── FOOTER ── -->
  <div style="background:#1E3A8A;padding:28px 24px;text-align:center;border-radius:0 0 14px 14px;">
    <img src="https://coworkia-agent.herokuapp.com/assets/logos/segpopular.png" alt="SegPopular" style="height:32px;margin-bottom:12px;filter:brightness(0) invert(1);opacity:0.8;display:block;margin-left:auto;margin-right:auto;" />
    <div style="color:#FCD34D;font-size:12px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;">SegPopular Ecuador · Bróker de Seguros</div>
    <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-bottom:14px;">Tu asesora <strong style="color:white;">Adriana</strong> está disponible por WhatsApp 24/7</div>
    <a href="https://wa.me/${bot_phone}" style="display:inline-block;background:rgba(255,255,255,0.12);color:white;padding:8px 22px;border-radius:99px;text-decoration:none;font-size:12px;font-weight:700;border:1px solid rgba(255,255,255,0.25);">💬 Escribirle a Adriana</a>
    <div style="margin-top:14px;color:rgba(255,255,255,0.55);font-size:10px;">Si no solicitaste esta cotización puedes ignorar este mensaje.</div>
  </div>

</div>
</body>
</html>`;
}

// ─── TEMPLATE: ALUNA RENEWAL (recordatorio 1 día antes de vencimiento) ─────

/**
 * 🌙 Email Renewal — Aluna recordatorio de renovación de membresía
 * Mismo diseño Coworkia Business Center verde + upsale de upgrade de plan.
 *
 * @param {object} data
 * @param {string} data.name — Nombre del miembro
 * @param {string} data.plan — Plan actual (Plan 10, Plan 20, etc.)
 * @param {string} data.expirationDate — Fecha de vencimiento formateada
 * @param {number} data.monthlyFee — Precio mensual actual
 * @param {object} options — { xiaomiSafe: boolean }
 */
export function buildAlunaRenewalHTML({ name, plan = 'Membresía', expirationDate, monthlyFee }, { xiaomiSafe = false } = {}) {
  const firstName = name ? name.trim().split(' ')[0] : 'Hola';
  const displayName = name || '';
  const safeFirstName = escapeHtml(firstName);
  const safeDisplayName = escapeHtml(displayName);
  const safePlan = escapeHtml(plan);
  const safeExpirationDate = escapeHtml(expirationDate);
  const safeMonthlyFee = monthlyFee ? escapeHtml(monthlyFee) : '';
  const fee = monthlyFee ? parseFloat(monthlyFee) : 0;
  const parkingFee = 25;
  const totalWithParking = fee ? fee + parkingFee : parkingFee;
  const waText = encodeURIComponent(`¡Hola @aluna!, quiero renovar mi ${plan}`);
  const waParkingText = encodeURIComponent(`¡Hola @aluna!, quiero renovar mi ${plan} con estacionamiento — total $${totalWithParking}/mes`);
  const waUpgradeText = encodeURIComponent(`¡Hola @aluna!, me interesa hacer upgrade de mi membresía`);

  // Upsale dinámico según plan actual
  const upsaleMap = {
    'Plan 10':  { next: 'Plan 20', price: '$250/mes', benefit: '22 días completos (20 + 2 gratis)', save: '4 invitados/mes + 4 usos sala reuniones' },
    'Plan 20':  { next: 'Oficina Virtual', price: '$365/año', benefit: 'Dirección comercial oficial + correspondencia', save: 'Equivale a $1/día — cumplimiento SRI incluido' },
  };
  const upsale = upsaleMap[plan] || null;

  return `<!DOCTYPE html>
<html lang="es" style="color-scheme:light !important;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light !important;}${getEmailStyles({ xiaomiSafe })}</style>
  <title>🌙 Tu membresía vence mañana — Coworkia</title>
</head>
<body style="margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div class="em-container" style="width:100%;max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

  <!-- Header — fondo verde Coworkia -->
  <div style="background:linear-gradient(135deg,#047857 0%,#065F46 100%);text-align:center;padding:40px 20px 35px;">
    <div style="color:white;font-size:52px;font-weight:700;margin-bottom:6px;line-height:1;">Coworkia</div>
    <div style="color:rgba(255,255,255,0.9);font-size:11px;font-weight:600;letter-spacing:6px;text-transform:uppercase;margin-bottom:28px;">BUSINESS CENTER</div>

    <!-- Card blanca con info de renovación -->
    <div style="background:rgba(255,255,255,0.97);border-radius:16px;padding:22px 28px;display:inline-block;min-width:280px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.18);">
      <div style="background:#F59E0B;color:white;display:inline-block;padding:4px 14px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">⏰ RENOVACIÓN</div>
      ${displayName ? `<div style="color:#111827;font-size:22px;font-weight:800;margin-bottom:10px;">${safeDisplayName}</div>` : ''}
      <div style="color:#92400E;font-size:14px;font-weight:700;margin-bottom:8px;">Tu ${safePlan} vence el ${safeExpirationDate}</div>
      <div style="color:#047857;font-size:12px;font-weight:600;">Aluna · Especialista en Membresías</div>
    </div>
  </div>

  <!-- Body -->
  <div style="padding:30px 30px 10px;">

    <!-- Saludo -->
    <div style="text-align:center;margin-bottom:24px;">
      <h2 style="color:#1f2937;font-size:20px;margin:0;">${safeFirstName}, tu espacio te espera 🌟</h2>
      <p style="color:#6B7280;font-size:14px;margin:8px 0 0;">Renueva y sigue disfrutando todo sin interrupciones</p>
    </div>

    <!-- Resumen de membresía actual -->
    <div style="background:linear-gradient(135deg,rgba(4,120,87,0.08),rgba(6,95,70,0.12));border-left:4px solid #047857;border-radius:12px;padding:22px;margin-bottom:24px;">
      <div style="color:#047857;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">📋 Tu membresía actual</div>
      <div style="margin:8px 0;"><span style="color:#059669;font-size:16px;margin-right:8px;">✦</span><span style="color:#374151;font-size:14px;"><strong>${safePlan}</strong>${monthlyFee ? ` — $${safeMonthlyFee}/mes` : ''}</span></div>
      <div style="margin:8px 0;"><span style="color:#059669;font-size:16px;margin-right:8px;">✦</span><span style="color:#374151;font-size:14px;">Vencimiento: <strong>${safeExpirationDate}</strong></span></div>
      <div style="margin:8px 0;"><span style="color:#059669;font-size:16px;margin-right:8px;">✦</span><span style="color:#374151;font-size:14px;">${WIFI.display} + café ilimitado</span></div>
      <div style="margin:8px 0;"><span style="color:#059669;font-size:16px;margin-right:8px;">✦</span><span style="color:#374151;font-size:14px;">Locker o cajonera (a elegir)</span></div>
    </div>

    <!-- CTA principal — Renovar -->
    <div style="text-align:center;margin-bottom:28px;">
      <p style="color:#374151;font-size:14px;font-weight:600;margin:0 0 14px;">💬 Renueva con un mensaje</p>
      <a href="${CONTACT.whatsappUrl}?text=${waText}"
         style="background:linear-gradient(135deg,#047857,#065F46);color:white;padding:16px 36px;text-decoration:none;border-radius:25px;font-weight:700;display:inline-block;box-shadow:0 4px 12px rgba(4,120,87,0.35);font-size:16px;">
        🔄 Renovar mi ${safePlan} →
      </a>
      <p style="color:#9CA3AF;font-size:12px;margin:10px 0 0;">Respuesta en menos de 5 minutos · WhatsApp</p>
    </div>

    <!-- ADD-ON — Estacionamiento -->
    <div style="background:linear-gradient(135deg,rgba(14,116,144,0.08),rgba(6,95,70,0.06));border:1.5px solid rgba(14,116,144,0.25);border-radius:12px;padding:22px;margin-bottom:24px;">
      <div style="color:#0E7490;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">🅿️ AGREGA ESTACIONAMIENTO</div>
      <div style="color:#1f2937;font-size:16px;font-weight:700;margin-bottom:8px;">Parking privado — $${parkingFee}/mes adicional</div>
      <div style="margin:8px 0;"><span style="color:#0E7490;font-size:16px;margin-right:8px;">🚗</span><span style="color:#374151;font-size:14px;">Sótano nivel 2, acceso exclusivo miembros</span></div>
      <div style="margin:8px 0;"><span style="color:#0E7490;font-size:16px;margin-right:8px;">💰</span><span style="color:#374151;font-size:14px;">${safePlan}${fee ? ` ($${fee})` : ''} + parking = <strong>$${totalWithParking}/mes</strong></span></div>
      <div style="text-align:center;margin-top:16px;">
        <a href="${CONTACT.whatsappUrl}?text=${waParkingText}"
           style="background:linear-gradient(135deg,#0E7490,#0D6E85);color:white;padding:12px 28px;text-decoration:none;border-radius:25px;font-weight:700;display:inline-block;box-shadow:0 4px 12px rgba(14,116,144,0.35);font-size:14px;">
          🅿️ Renovar con estacionamiento →
        </a>
      </div>
    </div>

    ${upsale ? `
    <!-- UPSALE — Upgrade de plan -->
    <div style="background:linear-gradient(135deg,rgba(139,92,246,0.08),rgba(109,40,217,0.12));border:1.5px solid rgba(139,92,246,0.3);border-radius:12px;padding:22px;margin-bottom:24px;">
      <div style="color:#7C3AED;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">🚀 ¿Y si subes de nivel?</div>
      <div style="color:#1f2937;font-size:16px;font-weight:700;margin-bottom:8px;">${escapeHtml(upsale.next)} — ${escapeHtml(upsale.price)}</div>
      <div style="margin:8px 0;"><span style="color:#7C3AED;font-size:16px;margin-right:8px;">⭐</span><span style="color:#374151;font-size:14px;">${escapeHtml(upsale.benefit)}</span></div>
      <div style="margin:8px 0;"><span style="color:#7C3AED;font-size:16px;margin-right:8px;">💰</span><span style="color:#374151;font-size:14px;">${escapeHtml(upsale.save)}</span></div>
      <div style="text-align:center;margin-top:16px;">
        <a href="${CONTACT.whatsappUrl}?text=${waUpgradeText}"
           style="background:linear-gradient(135deg,#8B5CF6,#6D28D9);color:white;padding:12px 28px;text-decoration:none;border-radius:25px;font-weight:700;display:inline-block;box-shadow:0 4px 12px rgba(139,92,246,0.35);font-size:14px;">
          ⬆️ Quiero hacer upgrade →
        </a>
      </div>
    </div>
    ` : ''}

    <!-- Testimonio -->
    <div style="background:#F0FDF4;border-left:4px solid #047857;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;color:#374151;font-size:14px;font-style:italic;line-height:1.7;">
        "Llevo 6 meses en Coworkia y cada mes es mejor. El WiFi, el café, la ubicación... Todo funciona perfecto."
      </p>
      <p style="margin:8px 0 0;color:#047857;font-size:13px;font-weight:700;">— Miembro activo, Coworkia 2026</p>
    </div>

  </div>

  <!-- ECOSISTEMA + FOOTER OSCURO -->
  <div style="background:linear-gradient(180deg,#0C0F14 0%,#0A0D12 100%);padding:36px 32px;text-align:center;">
    <div style="color:#4ECDC4;font-size:20px;font-weight:800;margin-bottom:10px;line-height:1.3;">Un ecosistema completo de agentes IA</div>
    <div style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.7;max-width:480px;margin:0 auto 22px;">Coworkia es más que un espacio. Es un sistema inteligente que trabaja por ti.</div>
    <div style="margin-bottom:22px;">${ecosistemaTable({ aliados: ['aurora','adriana','angela','axel','aluna','gabi','paula','custom'], theme: 'dark' })}</div>
    <div style="margin-bottom:22px;padding:0 8px;">
      <p style="color:rgba(255,255,255,0.65);font-size:12px;line-height:1.8;margin:0;">Un solo ecosistema. Agentes especializados que se hablan entre sí.<br><strong style="color:rgba(255,255,255,0.75);">Haz clic en cualquier agente para hablar directamente por WhatsApp.</strong></p>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:24px;margin-top:8px;">
      <div style="color:#4ECDC4;font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;">Coworkia</div>
      <div style="color:rgba(255,255,255,0.55);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">BUSINESS CENTER</div>
      <div style="color:rgba(255,255,255,0.60);font-size:11px;line-height:1.8;">
        © 2026 Coworkia Ecuador — Espacios que inspiran<br>
        ${COWORKIA_ADDRESS_FULL}<br>
        ${CONTACT.email} &nbsp;·&nbsp; ${CONTACT.phoneDisplay}
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ─── DISPATCHER CENTRAL ──────────────────────────────────────────────────────

/**
 * 🚀 buildEmailTemplate — Wrapper central para todos los templates
 *
 * @param {string} agent    — 'ALUNA', 'AURORA', 'ADRIANA', 'ENZO', etc.
 * @param {string} type     — 'confirmation', 'rebooking', 'd1', 'd3', 'd7', 'comparison', etc.
 * @param {object} data     — Datos del template
 * @param {object} [options] — { xiaomiSafe: boolean } para control adaptivo de dark mode
 * @returns {string} HTML del email
 */
export function buildEmailTemplate(agent, type, data, options = {}) {
  const { xiaomiSafe = false } = options;
  const key = `${agent.toUpperCase()}_${type.toUpperCase()}`;

  const builders = {
    ALUNA_D1:                 () => buildAlunaD1HTML(data, { xiaomiSafe }),
    ALUNA_D3:                 () => buildAlunaD3HTML(data, { xiaomiSafe }),
    ALUNA_RENEWAL:            () => buildAlunaRenewalHTML(data, { xiaomiSafe }),
    AURORA_CONFIRMATION:      () => buildAuroraConfirmationHTML(data, { xiaomiSafe }),
    AURORA_REBOOKING:         () => buildAuroraRebookingHTML(data, { xiaomiSafe }),
    AURORA_D1:                () => buildAuroraD1HTML(data, { xiaomiSafe }),
    AURORA_D3:                () => buildAuroraD3HTML(data, { xiaomiSafe }),
    AURORA_REMINDER_24H:      () => buildAuroraReminder24hHTML(data, { xiaomiSafe }),
    ENZO_D1:                  () => buildEnzoD1HTML(data, { xiaomiSafe }),
    ENZO_D3:                  () => buildEnzoD3HTML(data, { xiaomiSafe }),
    ENZO_D7:                  () => buildEnzoD7HTML(data, { xiaomiSafe }),
    ADRIANA_COMPARISON_V2:    () => buildAdrianaComparisonV2HTML(data, { xiaomiSafe }),
  };

  const builder = builders[key];
  if (!builder) {
    console.warn(`[EMAIL-TEMPLATE-SYSTEM] ⚠️ Template no encontrado: ${key}. Usando fallback.`);
    return buildFallbackHTML(agent, data);
  }

  return builder();
}

// ─── FALLBACK ─────────────────────────────────────────────────────────────────

function buildFallbackHTML(agent, { name = '', message = '' }) {
  const branding = AGENT_BRANDING[agent.toUpperCase()] || AGENT_BRANDING.AURORA;
  return `<!DOCTYPE html>
<html lang="es">
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:${branding.gradient};padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <h2 style="color:white;margin:0;">${branding.emoji} ${branding.companyName}</h2>
  </div>
  <div style="background:white;padding:24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
    ${name ? `<p>Hola <strong>${name.split(' ')[0]}</strong>!</p>` : ''}
    <div style="white-space:pre-line;line-height:1.7;color:#374151;">${message}</div>
  </div>
</body>
</html>`;
}
