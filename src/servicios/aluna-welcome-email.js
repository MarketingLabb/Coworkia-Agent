/**
 * 🌙 ALUNA — Email de Bienvenida post-pago
 *
 * Se dispara DESPUÉS de que el pago es aprobado (automático o manual).
 * Enviado por Aluna (no Gabi — Gabi ya envió el recibo financiero).
 *
 * Contenido:
 *  1. Bienvenida personalizada
 *  2. Número de contrato (membership_code)
 *  3. Servicios y beneficios del plan contratado
 *  4. Credenciales WiFi para 3 dispositivos
 *  5. Próximos pasos operativos
 */

import { sendEmail, getAdminCC } from './email.js';
import { ecosistemaTable } from './email-ecosystem.js';

// ─── Datos de planes ─────────────────────────────────────────────────────────
const PLAN_DETAILS = {
  'Plan 10': {
    price: '$67 USD/mes',
    dias: '10 días hábiles + 1 día de cortesía = 11 días',
    horario: 'Lunes a Viernes · 8:30 am → 7:00 pm',
    beneficios: [
      '🔒 Locker o cajonera privada con llave',
      '👥 2 invitados gratis por mes',
      '📋 2 usos de sala de reuniones por mes (hasta 4 personas)',
      '☕ WiFi ultrarrápido + café incluido todos los días',
      '🤖 Secretaria Virtual IA — Aluna (funciones por 9+ meses)'
    ]
  },
  'Plan 20': {
    price: '$99 USD/mes',
    dias: '20 días hábiles + 2 días de cortesía = 22 días',
    horario: 'Lunes a Viernes · 8:30 am → 7:00 pm',
    beneficios: [
      '🔒 Locker o cajonera privada con llave',
      '👥 4 invitados gratis por mes',
      '📋 4 usos de sala de reuniones por mes (hasta 4 personas)',
      '☕ WiFi ultrarrápido + café incluido todos los días',
      '🤖 Secretaria Virtual IA — Aluna (funciones por 9+ meses)'
    ]
  },
  'Plan 30': {
    price: '$310 USD/mes',
    dias: '30 días → acceso ilimitado todos los días hábiles del mes',
    horario: 'Lunes a Viernes · 8:30 am → 7:00 pm',
    beneficios: [
      '🔒 Locker o cajonera privada con llave',
      '👥 6 invitados gratis por mes',
      '📋 6 usos de sala de reuniones por mes (hasta 4 personas)',
      '☕ WiFi ultrarrápido + café incluido todos los días',
      '🤖 Secretaria Virtual IA — Aluna (funciones por 9+ meses)'
    ]
  },
  'Plan Full': {
    price: '$395 USD/mes',
    dias: 'Acceso ilimitado todos los días del mes incluyendo sábados',
    horario: 'Lunes a Sábado · 8:30 am → 7:00 pm',
    beneficios: [
      '🔒 Locker privado grande con llave',
      '👥 Invitados ilimitados',
      '📋 Usos de sala de reuniones ilimitados (hasta 4 personas)',
      '☕ WiFi ultrarrápido + café incluido todos los días',
      '🤖 Secretaria Virtual IA — Aluna (funciones por 9+ meses)',
      '🎁 1 sesión de sala de alto rendimiento/mes (8 personas)'
    ]
  },
  'Oficina Virtual': {
    price: '$365 USD/año',
    dias: 'Dirección comercial activa todo el año',
    horario: 'Cobertura permanente — 365 días',
    beneficios: [
      '📍 Dirección comercial oficial en Quito (Whymper 403)',
      '📬 Recepción y notificación de correspondencia',
      '🏛️ Cumplimiento legal SRI (comprobantes con dirección válida)',
      '📋 1 uso de sala de reuniones por mes incluido (2 horas)',
      '🏢 Ideal para empresas 100% remotas'
    ]
  }
};

function buildWelcomeHTML({ memberName, membershipType, membershipCode, startDate, totalAmount, cashAmount, canjeAmount, canjeDescription, wifiCode }) {
  const plan = PLAN_DETAILS[membershipType] || PLAN_DETAILS['Plan 20'];

  const formatDate = (d) => new Date(d).toLocaleDateString('es-EC', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const paymentLine = canjeAmount > 0
    ? `$${(cashAmount || 0).toFixed(2)} USD efectivo + $${canjeAmount.toFixed(2)} USD en canje de servicios`
    : `$${(totalAmount || 0).toFixed(2)} USD`;

  const benefitsHTML = plan.beneficios
    .map(b => `
      <div style="margin:10px 0;line-height:1.5;">
        <span style="color:#059669;font-size:18px;margin-right:8px;vertical-align:top;">✦</span><span style="color:#374151;font-size:15px;line-height:1.5;">${b}</span>
      </div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Bienvenida a Coworkia — ${membershipCode}</title>
  <style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div class="em-wrap" style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">

    <!-- Header Coworkia Verde Oscuro — igual al template aprobado de proformas -->
    <div style="background-color:#047857;background:linear-gradient(135deg,#047857 0%,#065F46 100%);text-align:center;padding:40px 20px 35px;">
      <div style="color:white;font-size:70px;font-weight:700;margin-bottom:8px;line-height:0.9;">Coworkia</div>
      <div style="color:rgba(255,255,255,0.9);font-size:12px;font-weight:600;letter-spacing:6px;text-transform:uppercase;margin-bottom:30px;">BUSINESS CENTER</div>
      <div style="background:rgba(255,255,255,0.97);border-radius:16px;padding:20px 32px;display:inline-block;min-width:280px;box-shadow:0 4px 20px rgba(0,0,0,0.18);">
        <div style="color:#9CA3AF;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;text-align:center;">BIENVENIDA A LA COMUNIDAD</div>
        <div style="color:#111827;font-size:22px;font-weight:800;margin-bottom:10px;text-align:center;">${memberName}</div>
        <div style="border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;padding:10px 0;margin-bottom:10px;text-align:center;">
          <span style="font-size:16px;vertical-align:middle;">🎫</span>&nbsp;&nbsp;<strong style="color:#111827;font-size:15px;font-weight:700;vertical-align:middle;">${membershipType}</strong>&nbsp;&nbsp;<span style="background:#047857;color:white;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;letter-spacing:0.5px;vertical-align:middle;">${membershipCode}</span>
        </div>
        <div style="color:#047857;font-size:13px;font-weight:600;text-align:center;">Aluna · Coworkia Membresías</div>
      </div>
    </div>

    <div style="padding:30px 30px 0;">

      <!-- Saludo personalizado -->
      <div style="text-align:center;margin-bottom:25px;">
        <h2 style="color:#1f2937;font-size:22px;margin:0 0 10px;">¡Tu membresía está activa! 🎉</h2>
        <p style="color:#6B7280;font-size:15px;margin:0;line-height:1.6;">
          Hola <strong style="color:#1f2937;">${memberName}</strong>, estamos felices de tenerte en nuestra comunidad.<br>
          Tu espacio de trabajo ya está listo — aquí está todo lo que necesitas.
        </p>
      </div>

      <!-- Número de contrato — destacado con borde verde -->
      <div style="background-color:rgba(4,120,87,0.08);background:linear-gradient(135deg,rgba(4,120,87,0.08),rgba(6,95,70,0.12));border-left:4px solid #047857;border-radius:12px;padding:22px 25px;margin:0 0 20px;text-align:center;box-shadow:0 2px 8px rgba(4,120,87,0.15);">
        <div style="color:#047857;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:8px;">Número de Contrato</div>
        <div style="color:#065F46;font-size:36px;font-weight:900;letter-spacing:4px;margin:0 0 6px;">${membershipCode}</div>
        <div style="color:#6B7280;font-size:12px;">Preséntalo en recepción — te lo pedirán la primera vez</div>
      </div>

      <!-- Detalles del plan -->
      <div style="background-color:rgba(4,120,87,0.08);background:linear-gradient(135deg,rgba(4,120,87,0.08),rgba(6,95,70,0.12));border-left:4px solid #047857;border-radius:12px;padding:25px;margin:0 0 20px;box-shadow:0 2px 8px rgba(4,120,87,0.15);">
        <div style="color:#047857;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">📋 Detalles de tu Plan</div>
        <div style="background:white;border-radius:10px;padding:18px;border:1px solid rgba(4,120,87,0.15);">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr>
              <td style="color:#6B7280;padding:8px 0;width:42%;vertical-align:top;border-bottom:1px solid #F3F4F6;">Plan contratado</td>
              <td style="color:#047857;font-weight:700;padding:8px 0;border-bottom:1px solid #F3F4F6;">${membershipType}</td>
            </tr>
            <tr>
              <td style="color:#6B7280;padding:8px 0;vertical-align:top;border-bottom:1px solid #F3F4F6;">Días incluidos</td>
              <td style="color:#374151;padding:8px 0;border-bottom:1px solid #F3F4F6;">${plan.dias}</td>
            </tr>
            <tr>
              <td style="color:#6B7280;padding:8px 0;vertical-align:top;border-bottom:1px solid #F3F4F6;">Horario de acceso</td>
              <td style="color:#374151;padding:8px 0;border-bottom:1px solid #F3F4F6;">${plan.horario}</td>
            </tr>
            <tr>
              <td style="color:#6B7280;padding:8px 0;vertical-align:top;border-bottom:1px solid #F3F4F6;">Precio mensual</td>
              <td style="color:#374151;font-weight:600;padding:8px 0;border-bottom:1px solid #F3F4F6;">${plan.price}</td>
            </tr>
            <tr>
              <td style="color:#6B7280;padding:8px 0;vertical-align:top;border-bottom:1px solid #F3F4F6;">Inicio de membresía</td>
              <td style="color:#374151;padding:8px 0;border-bottom:1px solid #F3F4F6;">${startDate ? formatDate(startDate) : 'Siguiente día hábil'}</td>
            </tr>
            <tr>
              <td style="color:#6B7280;padding:8px 0;vertical-align:top;">Pago realizado</td>
              <td style="color:#374151;padding:8px 0;">${paymentLine}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Beneficios -->
      <div style="margin:0 0 20px;">
        <div style="color:#1f2937;font-size:17px;font-weight:700;margin-bottom:14px;">✨ Beneficios incluidos</div>
        <div style="background:#F9FAFB;border-radius:12px;padding:20px;border:1px solid #D1FAE5;">
          ${benefitsHTML}
        </div>
      </div>

      <!-- WiFi — Portal cautivo Coworkia -->
      <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:20px;margin:0 0 20px;">
        <div style="color:#047857;font-size:16px;font-weight:700;margin-bottom:12px;">📡 Acceso WiFi — Portal Cautivo</div>
        <p style="color:#374151;margin:0 0 14px;font-size:14px;line-height:1.6;">Tu membresía incluye acceso a internet en Coworkia. Cuando llegues por primera vez, el staff activa tu acceso personalmente.</p>
        <div style="background:white;border-radius:10px;padding:16px;border:1px solid #D1FAE5;">
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr>
              <td style="color:#6B7280;padding:7px 0;width:45%;border-bottom:1px solid #F0FDF4;">Sistema</td>
              <td style="color:#065F46;font-weight:700;padding:7px 0;border-bottom:1px solid #F0FDF4;">Portal cautivo Coworkia</td>
            </tr>
            <tr>
              <td style="color:#6B7280;padding:7px 0;border-bottom:1px solid #F0FDF4;">Tu código WiFi</td>
              <td style="color:#047857;font-weight:700;padding:7px 0;border-bottom:1px solid #F0FDF4;font-family:monospace;font-size:16px;letter-spacing:2px;">${wifiCode ? wifiCode : '<span style="font-family:sans-serif;font-size:13px;font-weight:400;color:#6B7280;">te lo entregamos en recepción</span>'}</td>
            </tr>
            <tr>
              <td style="color:#6B7280;padding:7px 0;">Vigencia</td>
              <td style="color:#374151;padding:7px 0;">Todo el período de tu membresía activa</td>
            </tr>
          </table>
        </div>
        <div style="background:#D1FAE5;border-radius:8px;padding:12px 14px;margin-top:12px;">
          <p style="color:#065F46;font-size:13px;margin:0;line-height:1.6;">💡 <strong>Cómo conectarte:</strong> abre cualquier página en tu navegador estando conectado a la red Coworkia → el portal te pide tu código → ingrésalo → ¡listo!</p>
        </div>
      </div>

      <!-- Próximos pasos -->
      <div style="background-color:rgba(4,120,87,0.08);background:linear-gradient(135deg,rgba(4,120,87,0.08),rgba(6,95,70,0.12));border-left:4px solid #047857;border-radius:12px;padding:24px 25px;margin:0 0 20px;box-shadow:0 2px 8px rgba(4,120,87,0.15);">
        <div style="color:#047857;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">🚀 Próximos Pasos</div>
        <div style="background:white;border-radius:10px;padding:18px;border:1px solid rgba(4,120,87,0.15);">
          <div style="display:flex;align-items:baseline;gap:12px;padding:9px 0;border-bottom:1px solid #F0FDF4;">
            <span style="color:#047857;font-weight:800;font-size:15px;min-width:22px;">1.</span>
            <span style="color:#374151;font-size:14px;line-height:1.6;">Preséntate en recepción con tu <strong style="color:#065F46;">código: ${membershipCode}</strong></span>
          </div>
          <div style="display:flex;align-items:baseline;gap:12px;padding:9px 0;border-bottom:1px solid #F0FDF4;">
            <span style="color:#047857;font-weight:800;font-size:15px;min-width:22px;">2.</span>
            <span style="color:#374151;font-size:14px;line-height:1.6;">Elige tu hot desk preferido — primer llegado, primer servido</span>
          </div>
          <div style="display:flex;align-items:baseline;gap:12px;padding:9px 0;border-bottom:1px solid #F0FDF4;">
            <span style="color:#047857;font-weight:800;font-size:15px;min-width:22px;">3.</span>
            <span style="color:#374151;font-size:14px;line-height:1.6;">Ingresa tu código WiFi en el portal cautivo → acceso a internet activado</span>
          </div>
          <div style="display:flex;align-items:baseline;gap:12px;padding:9px 0;">
            <span style="color:#047857;font-weight:800;font-size:15px;min-width:22px;">4.</span>
            <span style="color:#374151;font-size:14px;line-height:1.6;">Toma un café ☕ y empieza a producir</span>
          </div>
        </div>
      </div>

      <!-- CTA WhatsApp — persuasivo y contextual al momento post-pago -->
      <div style="text-align:center;margin:25px 0 30px;">
        <p style="color:#374151;font-size:14px;margin:0 0 6px;font-weight:600;">¿Todo listo para tu primer día?</p>
        <p style="color:#6B7280;font-size:13px;margin:0 0 16px;line-height:1.5;">Escríbeme ahora y coordinamos la hora de llegada — quiero asegurarme de que todo esté perfecto.</p>
        <a href="https://wa.me/593994837117?text=${encodeURIComponent('@aluna soy ' + memberName + ', acabo de confirmar mi ' + membershipType + ' (' + membershipCode + ') — ¿a qué hora puedo llegar mañana para mi primer día?')}" style="background-color:#047857;background:linear-gradient(135deg,#047857,#065F46);color:white;padding:15px 36px;text-decoration:none;border-radius:25px;font-weight:700;display:inline-block;box-shadow:0 4px 12px rgba(4,120,87,0.35);font-size:15px;letter-spacing:0.3px;">¿Cuándo empiezo mi primer día? →</a>
        <p style="color:#9CA3AF;font-size:12px;margin:12px 0 0;">Whymper 403, Edificio Finistere - PB, Quito · secretaria.coworkia@gmail.com</p>
      </div>

    </div>

    <!-- ECOSISTEMA 8 AGENTES + FOOTER (igual al template aprobado de proformas) -->
    <div style="background-color:#0C0F14;background:linear-gradient(180deg,#0C0F14 0%,#0A0D12 100%);padding:36px 32px;text-align:center;">
      <div style="color:#4ECDC4;font-size:22px;font-weight:800;margin-bottom:12px;line-height:1.3;">Todo el ecosistema a tu servicio</div>
      <div style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.7;max-width:480px;margin:0 auto 28px;">Como miembro de Coworkia tienes acceso a todos nuestros especialistas. Cada uno resuelve un área de tu negocio — seguros, marketing, bienes raíces, colisiones, finanzas y más.</div>
      <div style="margin-bottom:22px;">${ecosistemaTable({ aliados: ['aurora', 'enzo', 'angela', 'axel', 'adriana', 'gabi', 'paula', 'custom'], theme: 'dark' })}</div>
      <div style="margin-bottom:28px;padding:0 8px;">
        <p style="color:rgba(255,255,255,0.45);font-size:12px;line-height:1.8;margin:0;">Un solo ecosistema. Agentes especializados que se hablan entre sí.<br><strong style="color:rgba(255,255,255,0.75);">Haz clic en cualquier agente para hablar directamente por WhatsApp.</strong></p>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:24px;margin-top:8px;">
        <div style="color:#4ECDC4;font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;">Coworkia</div>
        <div style="color:rgba(255,255,255,0.35);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">BUSINESS CENTER · ECOSISTEMA IA</div>
        <div style="color:rgba(255,255,255,0.4);font-size:11px;line-height:1.8;">
          © 2026 Coworkia Ecuador — Espacios que inspiran<br>
          Whymper 403, Edificio Finistere, Planta Baja, Quito<br>
          coworkia.ec@gmail.com &nbsp;·&nbsp; +593 99 483 7117<br>
          <span style="font-size:10px;color:rgba(255,255,255,0.25);">Email enviado por Aluna · asistente de membresías Coworkia</span>
        </div>
      </div>
    </div>

  </div>
</body>
</html>`;
}

/**
 * 📧 Envía email de bienvenida de Aluna al nuevo miembro
 * @param {Object} lead       - Fila de membership_leads
 * @param {Object} payment    - Datos del pago (amount, etc.)
 * @param {Object} composite  - Pago compuesto {cashAmount, canjeAmount, canjeDescription} o null
 * @returns {Object}          - { success, messageId }
 */
export async function sendAlunaWelcomeEmail(lead, payment, composite = null, wifiCode = null) {
  if (!lead.email) {
    console.log('[ALUNA-WELCOME] ⚠️ Lead sin email — se omite correo de bienvenida');
    return { success: false, error: 'Sin email' };
  }

  console.log('[ALUNA-WELCOME] 🌙 Preparando email de bienvenida...');
  const clientName = lead.client_name || lead.full_name || '';
  console.log('[ALUNA-WELCOME] - Cliente:', clientName);
  console.log('[ALUNA-WELCOME] - Plan:', lead.membership_type);
  console.log('[ALUNA-WELCOME] - Contrato:', lead.membership_code);

  const htmlContent = buildWelcomeHTML({
    memberName:       clientName,
    membershipType:   lead.membership_type,
    membershipCode:   lead.membership_code,
    startDate:        lead.start_date,
    totalAmount:      composite?.totalAmount ?? payment?.amount ?? 0,
    cashAmount:       composite?.cashAmount  ?? payment?.amount ?? 0,
    canjeAmount:      composite?.canjeAmount ?? 0,
    canjeDescription: composite?.canjeDescription ?? '',
    wifiCode
  });

  const result = await sendEmail({
    from:    '"Aluna - Coworkia Membresías" <noreply@coworkia.ec>',
    to:      lead.email,
    cc:      getAdminCC(),
    subject: `🎉 ¡Bienvenida a Coworkia, ${lead.client_name || lead.full_name}! — Tu ${lead.membership_type} está activa · ${lead.membership_code}`,
    html:    htmlContent
  });

  if (result.success) {
    console.log('[ALUNA-WELCOME] ✅ Email de bienvenida enviado:', result.messageId);
  } else {
    console.error('[ALUNA-WELCOME] ❌ Error enviando bienvenida:', result.error);
  }

  return result;
}
