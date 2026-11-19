/**
 * 📧 Templates de Email para Agentes Especializados
 * Cada empresa tiene su propio diseño HTML con branding
 * ✅ v1148: Dark mode eliminado para compatibilidad universal Xiaomi/MIUI
 */

import { LOGOS_BASE64 } from './email-assets.js';
import { ecosistemaTable } from './email-ecosystem.js';
import { calcularLeadScore, generarReporteLeadScore } from './paula-lead-scoring.js';
import { EMAIL_TRANSLATIONS } from './email-i18n.js';
import { buildEmailTemplate } from './email-template-system.js';
import { CONTACT, LOCATION, WIFI } from '../utils/coworkia-facts.js';

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

/**
 * 🛡️ ADRIANA - SegPopular (Seguros)
 * Colores: Azul profesional (#1E40AF, #3B82F6)
 */
// ─── HTML ─────────────────────────────────────────────────────────────────────

function _adrianaQuoteHTML(d) {
  const fechaFmt = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const premium = { annual: d.quotedPremium || 0, monthly: d.quotedMonthly || Math.round((d.quotedPremium || 0) / 12) };
  const vehicleLabel = `${d.vehicleBrand} ${d.vehicleModel} ${d.vehicleYear}`;
  const waLink = `https://wa.me/${d.waNumber || '593994837117'}?text=${encodeURIComponent(
    `Hola Adriana! Soy ${d.nombre}. Recibí la cotización de seguro para mi ${vehicleLabel} (${d.quoteCode}). Me interesa proceder.`
  )}`;

  const ecosistemaItems = ecosistemaTable({
    aliados: ['enzo', 'gabi', 'angela', 'axel', 'paula', 'aurora'],
    theme: 'dark',
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Cotización Seguro — ${vehicleLabel}</title>
  <style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style>
</head>
<body style="margin:0;padding:0;background-color:#F0F4F8;background:#F0F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="max-width:640px;margin:30px auto;">

  <!-- ══ HEADER SEGPOPULAR ══ -->
  <div style="background:#FFD700;border-radius:20px 20px 0 0;padding:44px 40px 38px;text-align:center;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:rgba(30,58,138,0.06);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-30px;left:-30px;width:130px;height:130px;border-radius:50%;background:rgba(30,58,138,0.04);pointer-events:none;"></div>

    <div style="margin-bottom:22px;">
      <img src="data:image/png;base64,${LOGOS_BASE64.segpopular}"
           alt="SegPopular"
           style="max-width:240px;height:auto;display:block;margin:0 auto;" />
    </div>
    <div style="color:#1E3A8A;font-size:11px;font-weight:700;letter-spacing:3.5px;text-transform:uppercase;margin-bottom:26px;">Seguros Vehiculares · Ecuador</div>

    <div style="background:white;border:2px solid #1E3A8A;border-radius:14px;padding:20px 28px;display:inline-block;box-shadow:0 4px 16px rgba(30,58,138,0.2);">
      <div style="color:#1E3A8A;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:7px;">Cotización para</div>
      <div style="color:#1E3A8A;font-size:22px;font-weight:800;margin-bottom:3px;">${d.nombre}</div>
      <div style="color:#6B7280;font-size:12px;margin-bottom:6px;">${fechaFmt}</div>
      ${d.quoteCode ? `<div style="color:#1E3A8A;font-size:11px;font-family:monospace;font-weight:700;background:#FFF9C4;border-radius:5px;padding:3px 10px;display:inline-block;">${d.quoteCode}</div>` : ''}
    </div>
  </div>

  <!-- ══ CUERPO ══ -->
  <div style="background:white;padding:40px 40px 12px;">

    <!-- Intro personalizada (OpenAI) -->
    <div style="background:#FFFBEB;border-left:4px solid #FFD700;border-radius:0 12px 12px 0;padding:20px 24px;margin-bottom:30px;">
      <p style="color:#1E3A8A;font-size:15px;line-height:1.85;margin:0;">${d.intro_personalizada}</p>
    </div>

    <!-- Ficha del Vehículo -->
    <div style="border:2px solid #E5E7EB;border-radius:16px;overflow:hidden;margin-bottom:26px;">
      <div style="background:#1E3A8A;padding:18px 24px;display:flex;align-items:center;gap:14px;">
        <div style="font-size:28px;">🚗</div>
        <div>
          <div style="color:#FFD700;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Vehículo asegurado</div>
          <div style="color:white;font-size:18px;font-weight:800;">${vehicleLabel}</div>
        </div>
      </div>
      <div style="padding:20px 24px;background:#FAFAFA;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:9px 0;color:#6B7280;font-size:13px;border-bottom:1px solid #F3F4F6;width:45%;">Marca</td>
            <td style="padding:9px 0;color:#1E3A8A;font-size:13px;font-weight:700;border-bottom:1px solid #F3F4F6;">${d.vehicleBrand}</td>
          </tr>
          <tr>
            <td style="padding:9px 0;color:#6B7280;font-size:13px;border-bottom:1px solid #F3F4F6;">Modelo</td>
            <td style="padding:9px 0;color:#1E3A8A;font-size:13px;font-weight:700;border-bottom:1px solid #F3F4F6;">${d.vehicleModel}</td>
          </tr>
          <tr>
            <td style="padding:9px 0;color:#6B7280;font-size:13px;border-bottom:1px solid #F3F4F6;">Año</td>
            <td style="padding:9px 0;color:#1E3A8A;font-size:13px;font-weight:700;border-bottom:1px solid #F3F4F6;">${d.vehicleYear}</td>
          </tr>
          <tr>
            <td style="padding:9px 0;color:#6B7280;font-size:13px;border-bottom:1px solid #F3F4F6;">Valor comercial</td>
            <td style="padding:9px 0;color:#1E3A8A;font-size:13px;font-weight:700;border-bottom:1px solid #F3F4F6;">${(d.commercialValue || 0).toLocaleString()} USD</td>
          </tr>
          <tr>
            <td style="padding:9px 0;color:#6B7280;font-size:13px;">Ciudad</td>
            <td style="padding:9px 0;color:#1E3A8A;font-size:13px;font-weight:700;">${d.city}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- ══ PRIMA ══ -->
    <div style="background-color:#1E3A8A;background:linear-gradient(145deg,#1E3A8A 0%,#1D4ED8 100%);border-radius:18px;padding:32px;text-align:center;margin-bottom:26px;">
      <div style="color:#FFD700;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:12px;">Tu cotización anual</div>
      <div style="color:white;font-size:46px;font-weight:900;line-height:1;margin-bottom:6px;">${premium.annual.toLocaleString()}</div>
      <div style="color:rgba(255,255,255,0.6);font-size:14px;margin-bottom:22px;">USD incluye IVA · Seguro ${d.insuranceType}</div>
      <div style="background:rgba(255,215,0,0.12);border:1px solid rgba(255,215,0,0.3);border-radius:10px;padding:14px;display:inline-block;margin-bottom:20px;">
        <div style="color:#FFD700;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">O en cómodas cuotas</div>
        <div style="color:white;font-size:22px;font-weight:800;">${premium.monthly}/mes <span style="font-size:14px;font-weight:400;opacity:0.7;">× 12</span></div>
      </div>
      <a href="${waLink}" style="display:block;background-color:#FFD700;background:linear-gradient(135deg,#FFD700,#FFC200);color:#1E3A8A;padding:16px 36px;border-radius:50px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 6px 22px rgba(255,215,0,0.45);">
        🛡️ Quiero activar mi seguro →
      </a>
    </div>

    <!-- ¿Qué incluye? -->
    <div style="margin-bottom:26px;">
      <div style="color:#6B7280;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:14px;">¿Qué cubre tu seguro?</div>
      <div style="background:#F8FAFC;border-radius:12px;padding:6px 20px;">
        ${[
          '🚗 Pérdida total o parcial por colisión',
          '🔥 Incendio, rayo y explosión',
          '🌊 Fenómenos naturales (terremoto, inundación)',
          '🚨 Robo total del vehículo',
          '💥 Responsabilidad civil frente a terceros',
          '🔧 Asistencia en carretera 24/7',
          '🔄 Vehículo de reemplazo (cobertura completa)',
        ].map(item => `
        <div style="display:flex;gap:10px;padding:11px 0;border-bottom:1px solid #F3F4F6;font-size:14px;color:#374151;align-items:center;">
          <span style="flex-shrink:0;">${item.split(' ')[0]}</span>
          <span>${item.split(' ').slice(1).join(' ')}</span>
        </div>`).join('')}
      </div>
    </div>

    <!-- Por qué SegPopular -->
    <div style="background-color:#FFFBEB;background:linear-gradient(135deg,#FFFBEB,#FFF9C4);border:2px solid #FFD700;border-radius:14px;padding:24px;margin-bottom:10px;">
      <div style="color:#1E3A8A;font-size:14px;font-weight:700;margin-bottom:12px;">⭐ ¿Por qué elegir SegPopular?</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${[
          ['🏢', 'Edificio Finistere, Whymper 403, Quito'],
          ['⏱️', 'Trámite de siniestro en 24 horas'],
          ['📋', 'Contratos claros, sin letra pequeña'],
          ['💬', 'Adriana te atiende personalmente por WhatsApp'],
        ].map(([ic, txt]) => `
        <div style="display:flex;gap:10px;align-items:baseline;">
          <span style="font-size:15px;flex-shrink:0;">${ic}</span>
          <span style="color:#374151;font-size:13px;line-height:1.6;">${txt}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- ══ CO-BRANDING COWORKIA ══ -->
  <div style="background-color:#0A1520;background:linear-gradient(180deg,#0A1520 0%,#060E17 100%);border-radius:0 0 20px 20px;padding:40px;text-align:center;">
    <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:30px;margin-bottom:26px;">
      <div style="color:rgba(255,255,255,0.25);font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">Cotización presentada a través de</div>
      <div style="color:white;font-size:22px;font-weight:800;margin-bottom:4px;">Coworkia Business Center</div>
      <div style="color:#FFD700;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Ecosistema de Inteligencia Empresarial · Ecuador</div>
    </div>
    <div style="color:rgba(255,255,255,0.25);font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">Todo el ecosistema a tu servicio</div>
    <div style="margin-bottom:26px;">${ecosistemaItems}</div>
    <div style="color:rgba(255,255,255,0.15);font-size:11px;line-height:1.7;">
      Cotización generada por <strong style="color:rgba(255,255,255,0.3);">Adriana</strong> · SegPopular<br>
      Coworkia Intelligence System · ${fechaFmt}
    </div>
  </div>

</div>
</body>
</html>`;
}

export function generateAdrianaEmailHTML(leadData, { type = 'confirmation', userLanguage = 'es' } = {}) {
  if (type === 'quote') return _adrianaQuoteHTML(leadData);
  const t = (EMAIL_TRANSLATIONS[userLanguage] || EMAIL_TRANSLATIONS.es).adriana;
  const {
    userName,
    insuranceType,
    cedula,
    email,
    phone,
    vehicleBrand,
    vehicleModel,
    vehicleYear,
    commercialValue,
    quotedPremium,
    leadId
  } = leadData;

  const monthlyPremium = quotedPremium ? Math.round(quotedPremium / 12) : null;
  const waLink = `https://wa.me/593994837117?text=%40adriana%2C+quiero+activar+mi+seguro`;

  const premiumSection = quotedPremium ? `
    <div style="background-color:#1E3A8A;background:linear-gradient(145deg,#1E3A8A 0%,#1D4ED8 100%);border-radius:18px;padding:32px;text-align:center;margin:25px 0;">
      <div style="color:#FFD700;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:12px;">${t.premiumLabel}</div>
      <div style="color:white;font-size:46px;font-weight:900;line-height:1;margin-bottom:6px;">$${quotedPremium.toLocaleString()}</div>
      <div style="color:rgba(255,255,255,0.65);font-size:14px;margin-bottom:20px;">${t.premiumCurrency} · Seguro ${insuranceType || 'Vehículo Liviano'}</div>
      <div style="background:rgba(255,215,0,0.12);border:1px solid rgba(255,215,0,0.3);border-radius:10px;padding:14px;display:inline-block;margin-bottom:22px;">
        <div style="color:#FFD700;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">${t.installmentsLabel}</div>
        <div style="color:white;font-size:22px;font-weight:800;">$${monthlyPremium}/mes <span style="font-size:14px;font-weight:400;opacity:0.7;">${t.installmentsSuffix}</span></div>
      </div>
      <a href="${waLink}" style="display:block;background-color:#FFD700;background:linear-gradient(135deg,#FFD700,#FFC200);color:#1E3A8A;padding:16px 36px;border-radius:50px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 6px 22px rgba(255,215,0,0.45);">
        ${t.ctaConfirm}
      </a>
    </div>
  ` : '';

  const specificDetails = vehicleBrand ? `
    <div style="background: white; border-radius: 8px; padding: 15px; margin: 10px 0; border: 1px solid rgba(30,58,138,0.3);">
      <div style="display:table;width:100%;">
        <span style="display:table-cell;color:#1E3A8A;font-size:20px;width:32px;vertical-align:middle;">🚗</span>
        <span style="display:table-cell;color:#374151;font-weight:600;font-size:16px;vertical-align:middle;">${t.labelVehicle}: ${vehicleBrand} ${vehicleModel || ''}${vehicleYear ? ` ${vehicleYear}` : ''}</span>
      </div>
      ${commercialValue ? `<div style="margin-top:8px;color:#6B7280;font-size:13px;padding-left:32px;">${t.labelCommercialValue}: <strong style="color:#1E3A8A;">$${Number(commercialValue).toLocaleString()} USD</strong></div>` : ''}
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>${t.title} - SegPopular</title>
      <style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 0;">
      
      <div class="email-container" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header SegPopular - Fondo Amarillo Característico -->
        <div class="brand-yellow" style="background: #FFD700; text-align: center; padding: 40px 20px;">
          <!-- Logo SegPopular PNG embebido base64 -->
          <div style="margin-bottom: 25px;">
            <img src="data:image/png;base64,${LOGOS_BASE64.segpopular}" 
                 alt="SegPopular" 
                 style="max-width: 280px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <div class="card-white shadow" style="background: white; color: #374151; padding: 20px 30px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.2); border: 3px solid #1E3A8A;">
            <h1 class="brand-blue" style="margin: 0; font-size: 22px; font-weight: 600; color: #1E3A8A;">${t.title}</h1>
            <p class="text-gray" style="margin: 8px 0 0 0; color: #374151; font-size: 15px;">${t.subtitle}</p>
          </div>
        </div>

        <div class="content-section" style="padding: 30px;">
          
          <!-- Saludo personalizado -->
          <div style="text-align: center; margin-bottom: 25px;">
            <h2 class="text-dark" style="color: #1f2937; font-size: 20px; margin: 0;">${t.greeting}, ${userName}! ${t.greetingEnd}</h2>
            <p class="text-gray" style="color: #6B7280; font-size: 15px; margin: 10px 0 0 0;">
              ${t.requestReceived} <strong class="brand-blue" style="color: #1E3A8A;">${insuranceType}</strong>
            </p>
          </div>

          <!-- Detalles de la solicitud -->
          <div style="background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.3)); border-left: 4px solid #1E3A8A; border-radius: 12px; padding: 25px; margin: 25px 0; box-shadow: 0 2px 8px rgba(30,58,138,0.2);">
            <h3 class="brand-blue" style="color: #1E3A8A; margin-top: 0; font-size: 18px; font-weight: 600;">${t.sectionData}</h3>
            
            <div style="margin: 20px 0;">
              <div style="background: white; border-radius: 8px; padding: 15px; margin: 10px 0; border: 1px solid rgba(30,58,138,0.3);">
                <div style="display:table;width:100%;">
                  <span style="display:table-cell;color:#1E3A8A;font-size:20px;width:32px;vertical-align:middle;">🛡️</span>
                  <span style="display:table-cell;color:#374151;font-weight:600;font-size:16px;vertical-align:middle;">${t.labelInsuranceType}: ${insuranceType}</span>
                </div>
              </div>
              
              <div style="background: white; border-radius: 8px; padding: 15px; margin: 10px 0; border: 1px solid rgba(30,58,138,0.3);">
                <div style="display:table;width:100%;">
                  <span style="display:table-cell;color:#1E3A8A;font-size:20px;width:32px;vertical-align:middle;">🆔</span>
                  <span style="display:table-cell;color:#374151;font-weight:600;font-size:16px;vertical-align:middle;">${t.labelId}: ${cedula}</span>
                </div>
              </div>
              
              <div style="background: white; border-radius: 8px; padding: 15px; margin: 10px 0; border: 1px solid rgba(30,58,138,0.3);">
                <div style="display:table;width:100%;">
                  <span style="display:table-cell;color:#1E3A8A;font-size:20px;width:32px;vertical-align:middle;">📧</span>
                  <span style="display:table-cell;color:#374151;font-weight:600;font-size:16px;vertical-align:middle;">${email}</span>
                </div>
              </div>
              
              <div style="background: white; border-radius: 8px; padding: 15px; margin: 10px 0; border: 1px solid rgba(30,58,138,0.3);">
                <div style="display:table;width:100%;">
                  <span style="display:table-cell;color:#1E3A8A;font-size:20px;width:32px;vertical-align:middle;">📱</span>
                  <span style="display:table-cell;color:#374151;font-weight:600;font-size:16px;vertical-align:middle;">${phone}</span>
                </div>
              </div>

              ${specificDetails}
            </div>
          </div>

          ${premiumSection}

          <!-- Próximos pasos -->
          <div style="background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1)); border: 2px solid #10B981; border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #374151; font-size: 18px; margin-bottom: 15px; font-weight: 600;">${t.stepsTitle}</h3>
            <div style="color: #374151; font-size: 15px; line-height: 1.8;">
              <p style="margin: 10px 0;">
                <strong style="color: #10B981;">1.</strong> ${t.step1}
              </p>
              <p style="margin: 10px 0;">
                <strong style="color: #10B981;">2.</strong> ${t.step2}
              </p>
              <p style="margin: 10px 0;">
                <strong style="color: #10B981;">3.</strong> ${t.step3}
              </p>
            </div>
          </div>

          <!-- Referencia -->
          <!-- Información adicional sobre servicios -->
          <div style="background: white; border: 2px solid #1E3A8A; border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #1E3A8A; font-size: 18px; margin-bottom: 15px; font-weight: 600;">${t.servicesTitle}</h3>
            <div style="color: #374151; font-size: 15px; line-height: 1.8;">
              <p style="margin: 8px 0;">✓ ${t.svc1}</p>
              <p style="margin: 8px 0;">✓ ${t.svc2}</p>
              <p style="margin: 8px 0;">✓ ${t.svc3}</p>
              <p style="margin: 8px 0;">✓ ${t.svc4}</p>
            </div>
          </div>

          <!-- Ubicación y contacto -->
          <div style="background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.3)); border-radius: 12px; padding: 25px; margin: 25px 0; border: 2px solid #1E3A8A;">
            <h3 style="color: #1E3A8A; margin-top: 0; font-size: 18px; font-weight: 600;">${t.officeTitle}</h3>
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 15px 0;">
              <p style="margin: 5px 0; color: #1E3A8A; font-weight: 700; font-size: 18px;">SegPopular</p>
              <p style="margin: 5px 0; color: #374151; font-weight: 500;">${t.officeAddress}</p>
              <p style="margin: 5px 0; color: #374151;">${t.officeCity}</p>
              <p style="margin: 10px 0 5px 0; color: #1E3A8A; font-weight: 600;">🌐 www.segpopular.com</p>
            </div>
            <div style="text-align: center; margin: 20px 0;">
              <a href="https://goo.gl/maps/9GD83LV3XRf23XK59" 
                 style="background: #1E3A8A; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(30,58,138,0.4);">
              ${t.mapsBtn}
              </a>
            </div>
          </div>

          <!-- Referencia -->
          <div style="background: rgba(255,215,0,0.3); border-radius: 12px; padding: 20px; margin: 25px 0; border: 1px solid #1E3A8A;">
            <p style="color: #1E3A8A; font-size: 13px; margin: 0; font-weight: 600;">
              <strong>Referencia:</strong> ${leadId}
            </p>
          </div>

          <!-- Contacto -->
          <div style="text-align: center; margin: 25px 0;">
            <p style="color: #374151; font-size: 14px; margin: 5px 0 15px 0; font-weight: 600;">
              ${t.ctaTagline}
            </p>
            <a href="https://wa.me/593994837117?text=%40adriana%2C%20es%20exactamente%20lo%20que%20buscaba%20%C2%BFActivamos%20mi%20seguro%20ahora%3F" 
               style="background-color:#25D366;background:linear-gradient(135deg, #25D366, #128C7E); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(37,211,102,0.3); font-size: 14px;">
              ${t.ctaActivate}
            </a>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin: 35px 0 0 0; padding: 25px; background: #FFD700; border-radius: 12px; border: 3px solid #1E3A8A;">
            <p style="color: #1E3A8A; font-size: 18px; font-weight: 700; margin: 0;">${t.footerWelcome}</p>
            <p style="color: #1E3A8A; font-size: 14px; margin: 8px 0; font-weight: 600;">${t.footerTeam}</p>
            <p style="color: #1E3A8A; font-size: 13px; margin: 5px 0;">${t.footerSub}</p>
          </div>

        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * 🔨 AXEL - PaintBull (Centro de Colisiones)
 * Diseño premium con foto-grid CID, tabla de trabajos, badges de severidad
 * Parámetros: { customerName, vehicleData, damageAnalysis, quote, priceRange, photoAssets, quoteCode }
 */
export function generateAxelEmailHTML({ customerName, vehicleData = {}, damageAnalysis = {}, quote, priceRange, photoAssets = [], quoteCode, userLanguage = 'es' }) {
  const t = (EMAIL_TRANSLATIONS[userLanguage] || EMAIL_TRANSLATIONS.es).axel;
  const formatDate = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const q = (quote && typeof quote === 'object' && !quote.raw_text) ? quote : null;

  const severityMap = {
    LEVE:    { bg: '#DCFCE7', color: '#166534', dot: '#22C55E', label: t.severityLabels.LEVE },
    MODERADO:{ bg: '#FEF3C7', color: '#92400E', dot: '#F59E0B', label: t.severityLabels.MODERADO },
    GRAVE:   { bg: '#FEE2E2', color: '#991B1B', dot: '#EF4444', label: t.severityLabels.GRAVE },
  };
  const sv = severityMap[damageAnalysis.severity] || severityMap.MODERADO;

  const parts = (damageAnalysis.affectedParts || []).slice(0, 6);
  const partsBadges = parts.map(p =>
    `<span style="display:inline-block;background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600;margin:3px;">${p}</span>`
  ).join('');

  let trabajosHTML = '';
  let desgloseHTML = '';

  if (q && Array.isArray(q.trabajos) && q.trabajos.length > 0) {
    trabajosHTML = q.trabajos.map((t, i) => `
      <tr style="background:${i % 2 === 0 ? '#FAFAFA' : 'white'};">
        <td style="padding:14px 16px;font-size:14px;font-weight:600;color:#111827;border-bottom:1px solid #F3F4F6;">${t.item}</td>
        <td style="padding:14px 16px;font-size:13px;color:#6B7280;border-bottom:1px solid #F3F4F6;">${t.detalle}</td>
        <td style="padding:14px 16px;font-size:14px;font-weight:700;color:#DC2626;text-align:right;white-space:nowrap;border-bottom:1px solid #F3F4F6;">$${t.rango_min}–$${t.rango_max}</td>
      </tr>`).join('');

    const rows = [
      q.subtotal_mano_obra?.min ? [t.labelLabor, q.subtotal_mano_obra.min, q.subtotal_mano_obra.max] : null,
      q.subtotal_materiales?.min ? [t.labelMaterials, q.subtotal_materiales.min, q.subtotal_materiales.max] : null,
      q.subtotal_repuestos?.min ? [t.labelParts, q.subtotal_repuestos.min, q.subtotal_repuestos.max] : null,
    ].filter(Boolean);

    desgloseHTML = rows.map(([label, min, max]) => `
      <div style="display:table;width:100%;padding:10px 0;border-bottom:1px solid #F3F4F6;">
        <span style="display:table-cell;color:#6B7280;font-size:14px;vertical-align:middle;">${label}</span>
        <span style="display:table-cell;text-align:right;color:#374151;font-size:14px;font-weight:600;vertical-align:middle;white-space:nowrap;">$${min} – $${max}</span>
      </div>`).join('');
  } else {
    const rawText = (quote && quote.raw_text) ? quote.raw_text : (typeof quote === 'string' ? quote : t.worksFallback);
    trabajosHTML = `<tr><td colspan="3" style="padding:20px;font-size:14px;color:#374151;line-height:1.8;white-space:pre-wrap;">${rawText}</td></tr>`;
  }

      const photoGrid = photoAssets.length > 0
    ? `<div style="margin-bottom:28px;">
        <div style="color:#6B7280;font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">${t.photosLabel}</div>
        <div style="display:grid;grid-template-columns:repeat(${Math.min(photoAssets.length, 4)},1fr);gap:6px;">
          ${photoAssets.map((_, i) => `<img src="cid:foto-${i+1}@paintbull" alt="Foto ${i+1}" width="100%" style="width:100%;height:90px;object-fit:cover;border-radius:6px;border:1px solid #E5E7EB;display:block;" />`).join('')}
        </div>
      </div>`
    : '';

  const waLink = `https://wa.me/593994837117?text=Hola%2C+quiero+confirmar+mi+cotizaci%C3%B3n+${quoteCode}`;

  const vMarca = vehicleData.marca && vehicleData.marca !== 'Pendiente' ? vehicleData.marca : '';
  const vModelo = vehicleData.modelo && vehicleData.modelo !== 'Pendiente' ? vehicleData.modelo : '';
  const vAño = vehicleData.año && vehicleData.año !== 'Pendiente' ? vehicleData.año : '';
  const vehicleTitle = [vMarca, vModelo].filter(Boolean).join(' ') || 'Por inspeccionar';
  const vehicleYearLine = vAño ? `Año ${vAño}` : t.inspectionFallback;

  const ecosistemaItems = ecosistemaTable({
    aliados: ['enzo', 'gabi', 'angela', 'adriana', 'paula', 'aurora'],
    theme: 'light',
  });

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Cotización The PaintBull — ${vehicleTitle}</title>
  <style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
<div style="max-width:660px;margin:30px auto;">

  <!-- ══ HEADER ══ -->
  <div style="background-color:#B91C1C;background:linear-gradient(150deg,#B91C1C 0%,#DC2626 50%,#991B1B 100%);border-radius:20px 20px 0 0;padding:48px 40px 40px;text-align:center;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-50px;right:-50px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.04);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-40px;left:-30px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.03);pointer-events:none;"></div>
    <div style="margin:0 auto 22px;width:82px;height:82px;position:relative;">
      <div style="position:absolute;inset:0;border-radius:50%;background:white;box-shadow:0 4px 18px rgba(0,0,0,0.25);"></div>
      <div style="position:absolute;top:10px;left:10px;right:10px;bottom:10px;border-radius:50%;background:#DC2626;"></div>
      <div style="position:absolute;top:20px;left:20px;right:20px;bottom:20px;border-radius:50%;background:white;"></div>
      <div style="position:absolute;top:30px;left:30px;right:30px;bottom:30px;border-radius:50%;background:#DC2626;"></div>
      <div style="position:absolute;top:38px;left:38px;right:38px;bottom:38px;border-radius:50%;background:white;"></div>
    </div>
    <div style="color:white;font-size:34px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;">The PaintBull</div>
    <div style="color:rgba(255,255,255,0.75);font-size:13px;letter-spacing:2px;text-transform:uppercase;margin-bottom:28px;">Colisiones & Pintura Vehicular · Quito</div>
    <div style="background:rgba(255,255,255,0.97);border-radius:16px;padding:24px 28px;display:inline-block;text-align:left;min-width:300px;">
      <div style="color:#DC2626;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;">${t.preparedFor}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:10px;">
        <div style="color:#111827;font-size:22px;font-weight:700;line-height:1.2;">${customerName}</div>
        <span style="background:#DC2626;color:white;font-size:11px;font-weight:700;padding:5px 10px;border-radius:6px;letter-spacing:1px;white-space:nowrap;flex-shrink:0;margin-top:4px;">${quoteCode}</span>
      </div>
      <div style="color:#6B7280;font-size:13px;">${formatDate}</div>
    </div>
  </div>

  <!-- ══ PRECIO TOTAL ══ -->
  ${priceRange ? `
  <div style="background:white;padding:32px 40px;border-bottom:1px solid #F3F4F6;text-align:center;">
    <div style="color:#9CA3AF;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;">${t.investmentTitle}</div>
    <div style="color:#DC2626;font-size:52px;font-weight:800;letter-spacing:-1px;line-height:1;">$${priceRange.min} <span style="font-size:28px;color:#9CA3AF;font-weight:500;">–</span> $${priceRange.max}</div>
    <div style="color:#6B7280;font-size:14px;margin-top:6px;">${t.investmentSub}</div>
  </div>` : ''}

  <!-- ══ CUERPO ══ -->
  <div style="background:white;padding:36px 40px 10px;">

    <!-- Vehículo + Severidad -->
    <div style="display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap;">
      <div style="flex:1;min-width:200px;background:#FFF8F8;border:1px solid #FECACA;border-radius:14px;padding:20px;">
        <div style="color:#DC2626;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">${t.labelVehicle}</div>
        <div style="color:#111827;font-size:22px;font-weight:800;line-height:1.2;">${vehicleTitle}</div>
        <div style="color:#6B7280;font-size:15px;margin-top:4px;">${vehicleYearLine}</div>
      </div>
      <div style="flex:1;min-width:160px;background:${sv.bg};border:1px solid ${sv.dot}33;border-radius:14px;padding:20px;text-align:center;">
        <div style="font-size:32px;margin-bottom:8px;">🔍</div>
        <div style="background:${sv.bg};border:2px solid ${sv.dot};border-radius:8px;padding:6px 14px;display:inline-block;">
          <span style="color:${sv.color};font-size:13px;font-weight:700;">${sv.label}</span>
        </div>
        <div style="color:${sv.color};font-size:12px;margin-top:10px;opacity:0.8;">${t.hiddenDamageRisk}: <strong>${damageAnalysis.hiddenDamageRisk || 'MEDIO'}</strong></div>
      </div>
    </div>

    ${parts.length > 0 ? `
    <div style="margin-bottom:28px;">
      <div style="color:#374151;font-size:13px;font-weight:700;margin-bottom:10px;">${t.affectedAreas}</div>
      <div>${partsBadges}</div>
    </div>` : ''}

    ${photoGrid}

    ${q?.resumen_danos ? `
    <div style="background:#FFF8F8;border-left:4px solid #DC2626;border-radius:0 12px 12px 0;padding:18px 22px;margin-bottom:28px;">
      <div style="color:#DC2626;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">${t.sectionDiagnosis}</div>
      <p style="color:#374151;font-size:14px;line-height:1.75;margin:0;">${q.resumen_danos}</p>
    </div>` : ''}

    <!-- Tabla de trabajos -->
    <div style="margin-bottom:28px;">
      <div style="color:#374151;font-size:14px;font-weight:700;margin-bottom:12px;">${t.sectionWorks}</div>
      <div style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#111827;">
              <th style="padding:12px 16px;text-align:left;color:rgba(255,255,255,0.7);font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${t.colWork}</th>
              <th style="padding:12px 16px;text-align:left;color:rgba(255,255,255,0.7);font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${t.colProcess}</th>
              <th style="padding:12px 16px;text-align:right;color:rgba(255,255,255,0.7);font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${t.colRange}</th>
            </tr>
          </thead>
          <tbody>${trabajosHTML}</tbody>
        </table>
      </div>
    </div>

    ${desgloseHTML ? `
    <div style="background:#F9FAFB;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
      <div style="color:#374151;font-size:13px;font-weight:700;margin-bottom:12px;">${t.sectionBreakdown}</div>
      ${desgloseHTML}
      <div style="display:table;width:100%;padding-top:14px;margin-top:4px;border-top:2px solid #E5E7EB;">
        <span style="display:table-cell;color:#111827;font-size:15px;font-weight:700;vertical-align:middle;">${t.totalLabel}</span>
        <span style="display:table-cell;text-align:right;color:#DC2626;font-size:20px;font-weight:800;vertical-align:middle;white-space:nowrap;">$${priceRange?.min || q?.total_min || '—'} – $${priceRange?.max || q?.total_max || '—'} USD</span>
      </div>
    </div>` : ''}

    <!-- Tiempo + Garantía -->
<table role="presentation" width="100%" style="border-collapse:collapse;border-spacing:0;margin-bottom:28px;">
      <tr>
        <td width="48%" style="padding-right:14px;vertical-align:top;">
          <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:12px;padding:18px;text-align:center;">
            <div style="font-size:28px;margin-bottom:6px;">⏱️</div>
            <div style="color:#166534;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${t.deliveryLabel}</div>
            <div style="color:#15803D;font-size:16px;font-weight:700;">${q?.dias_entrega || damageAnalysis.estimatedRepairDays || '3-5 días hábiles'}</div>
          </div>
        </td>
        <td width="48%" style="vertical-align:top;">
          <div style="background:#EFF6FF;border:1px solid #93C5FD;border-radius:12px;padding:18px;text-align:center;">
            <div style="font-size:28px;margin-bottom:6px;">🛡️</div>
            <div style="color:#1E40AF;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${t.warrantyLabel}</div>
            <div style="color:#1D4ED8;font-size:13px;font-weight:600;line-height:1.4;">${q?.garantia || t.warrantyFallback}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Nota inspección -->
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 18px;margin-bottom:28px;display:table;width:100%;box-sizing:border-box;">
      <span style="font-size:18px;display:table-cell;width:28px;vertical-align:top;padding-top:1px;">⚠️</span>
      <p style="color:#92400E;font-size:13px;line-height:1.65;margin:0;display:table-cell;vertical-align:top;padding-left:10px;">${q?.nota_inspeccion || t.noteInspection}</p>
    </div>

    <!-- CTA -->
    <div style="background-color:#DC2626;background:linear-gradient(145deg,#DC2626,#991B1B);border-radius:18px;padding:36px;text-align:center;margin-bottom:10px;">
      <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-bottom:8px;">${t.ctaTitle1}</div>
      <div style="color:white;font-size:20px;font-weight:700;margin-bottom:6px;">${t.ctaTitle2}</div>
      <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-bottom:24px;">${t.ctaDesc}</div>
      <a href="${waLink}" style="display:inline-block;background:white;color:#DC2626;padding:16px 44px;border-radius:50px;text-decoration:none;font-weight:800;font-size:15px;box-shadow:0 6px 20px rgba(0,0,0,0.25);letter-spacing:0.3px;">
        ${t.ctaButton(quoteCode)}
      </a>
      <div style="margin-top:24px;">
        <div style="background:rgba(0,0,0,0.18);border-radius:10px;padding:14px 20px;display:inline-block;">
          <div style="color:rgba(255,255,255,0.85);font-size:12px;">${t.address}</div>
          <div style="color:rgba(255,255,255,0.75);font-size:12px;margin-top:4px;">${t.phone} · <a href="https://www.google.com/maps?q=-0.1640916,-78.4665958" style="color:white;text-decoration:none;">Ver en mapa →</a></div>
        </div>
      </div>
    </div>

    <!-- Por qué PaintBull -->
    <div style="padding:28px 0;border-top:1px solid #F3F4F6;margin-top:10px;">
      <div style="text-align:center;color:#9CA3AF;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:20px;">${t.whyTitle}</div>
      <table role="presentation" width="100%" style="border-collapse:collapse;border-spacing:0;text-align:center;">
        <tr>
          ${[['🏆',t.proof1t,t.proof1d],['✅',t.proof2t,t.proof2d],['⚡',t.proof3t,t.proof3d]].map(([ic,tt,d])=>`
          <td width="33%" style="padding:0 7px;vertical-align:top;text-align:center;"><div style="font-size:28px;margin-bottom:6px;">${ic}</div><div style="color:#111827;font-size:13px;font-weight:700;">${tt}</div><div style="color:#9CA3AF;font-size:12px;">${d}</div></td>`).join('')}
        </tr>
      </table>
    </div>
  </div>

  <!-- ══ CO-BRANDING COWORKIA ══ -->
  <div style="background:white;border-radius:0 0 20px 20px;padding:44px;text-align:center;border-top:1px solid #F3F4F6;">
    <div style="border-top:1px solid #F3F4F6;padding-top:32px;margin-bottom:28px;">
      <div style="color:#9CA3AF;font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">${t.cobrandingTag}</div>
      <div style="color:#111827;font-size:22px;font-weight:800;margin-bottom:4px;">Coworkia Business Center</div>
      <div style="color:#DC2626;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">Ecosistema de Inteligencia Empresarial · Ecuador</div>
    </div>
    <div style="color:#9CA3AF;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">Todo el ecosistema a tu servicio</div>
    <div style="margin-bottom:28px;">${ecosistemaItems}</div>
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:16px;margin-bottom:22px;">
      <p style="color:#7F1D1D;font-size:12px;line-height:1.8;margin:0;">${t.cobrandingBlurb}</p>
    </div>
    <div style="color:#9CA3AF;font-size:11px;line-height:1.7;">
      ${t.footerBy('Axel', formatDate)}
    </div>
  </div>

</div>
</body>
</html>`;
}

/**
 * 🎯 ENZO - MarketingLab
 * Template ÚNICO: confirmación + briefHTML inyectado desde cada contexto
 * (boss-command, web form, WA consulting flow)
 */
export function generateEnzoEmailHTML(leadData, { type = 'confirmation', userLanguage = 'es' } = {}) {
  const t = (EMAIL_TRANSLATIONS[userLanguage] || EMAIL_TRANSLATIONS.es).enzo;
  const {
    userName,
    projectType,
    companyName,
    email,
    phone,
    budget,
    urgency,
    description,
    leadId,
    briefHTML = null,
  } = leadData;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cotización MarketingLab — ${leadId}</title>
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light">
      <style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #0D9488; margin: 0; padding: 0;">

      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 0; overflow: hidden;">

        <!-- ═══ HEADER DARK NAVY ═══ -->
        <div style="background: #0A0F1E; text-align: center; padding: 44px 20px 38px;">
          <div style="margin-bottom: 10px;">
            <img src="data:image/png;base64,${LOGOS_BASE64.marketinglab}"
                 alt="MarketingLab"
                 style="max-width: 320px; height: auto; display: block; margin: 0 auto;" />
          </div>
          <div style="color: rgba(255,255,255,0.45); font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 28px;">ESTRATEGIAS QUE FUNCIONAN</div>
          <!-- Tarjeta oscura métricas style -->
          <div style="background: #0D1520; border: 1px solid rgba(45,212,191,0.3); border-radius: 14px; padding: 24px; max-width: 340px; margin: 0 auto;">
            <div style="color: #2DD4BF; font-size: 9px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; text-align: center; margin-bottom: 16px;">${t.cardProjectLabel}</div>
            <div style="color: white; font-size: 22px; font-weight: 800; text-align: center; line-height: 1.2; margin-bottom: 16px;">${userName}</div>
            <div style="border-top: 1px solid rgba(45,212,191,0.2); margin-bottom: 16px;"></div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 50%; padding: 0 4px 0 0;">
                  <div style="background: rgba(45,212,191,0.06); border: 1px solid rgba(45,212,191,0.2); border-radius: 10px; padding: 12px; text-align: center;">
                    <div style="color: #2DD4BF; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">${t.colProject}</div>
                    <div style="color: white; font-size: 13px; font-weight: 700; line-height: 1.3;">${projectType}</div>
                  </div>
                </td>
                <td style="width: 50%; padding: 0 0 0 4px;">
                  <div style="background: rgba(45,212,191,0.06); border: 1px solid rgba(45,212,191,0.2); border-radius: 10px; padding: 12px; text-align: center;">
                    <div style="color: #2DD4BF; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">${t.colRef}</div>
                    <div style="color: white; font-size: 13px; font-weight: 700; line-height: 1.3;">${leadId}</div>
                  </div>
                </td>
              </tr>
            </table>
            ${companyName ? `<div style="text-align: center; margin-top: 12px; color: rgba(255,255,255,0.5); font-size: 12px;">${companyName}</div>` : ''}
            <div style="text-align: center; border-top: 1px solid rgba(45,212,191,0.2); margin-top: 16px; padding-top: 12px;">
              <span style="color: #2DD4BF; font-size: 12px; font-weight: 600;">Enzo · MarketingLab</span>
            </div>
          </div>
        </div>

        <!-- ═══ CUERPO ═══ -->
        <div style="padding: 32px 28px;">

          <!-- Intro -->
          <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
            ${t.introReceived(projectType, companyName)}
          </p>

          <!-- Resumen del proyecto / Brief IA -->
          ${briefHTML || `<div style="background: #F8FFFE; border-left: 4px solid #2DD4BF; border-radius: 0 12px 12px 0; padding: 20px 24px; margin: 0 0 24px;">
            <div style="font-size: 11px; font-weight: 700; color: #2DD4BF; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 14px;">${t.sectionSummary}</div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 6px 0; color: #6B7280; font-size: 13px; width: 40%;">${t.labelType}</td><td style="padding: 6px 0; color: #1F2937; font-size: 13px; font-weight: 600;">${projectType}</td></tr>
              ${companyName ? `<tr><td style="padding: 6px 0; color: #6B7280; font-size: 13px;">${t.labelCompany}</td><td style="padding: 6px 0; color: #1F2937; font-size: 13px; font-weight: 600;">${companyName}</td></tr>` : ''}
              ${budget ? `<tr><td style="padding: 6px 0; color: #6B7280; font-size: 13px;">${t.labelBudget}</td><td style="padding: 6px 0; color: #1F2937; font-size: 13px; font-weight: 600;">${budget}</td></tr>` : ''}
              ${urgency ? `<tr><td style="padding: 6px 0; color: #6B7280; font-size: 13px;">${t.labelUrgency}</td><td style="padding: 6px 0; color: #1F2937; font-size: 13px; font-weight: 600;">${urgency}</td></tr>` : ''}
              <tr><td style="padding: 6px 0; color: #6B7280; font-size: 13px;">${t.labelRef}</td><td style="padding: 6px 0; color: #2DD4BF; font-size: 13px; font-weight: 700;">${leadId}</td></tr>
            </table>
          </div>`}

          <!-- Servicios: solo cuando NO hay briefHTML (formulario genérico sin propuesta específica) -->
          ${!briefHTML ? `<div style="margin: 0 0 24px;">
            <div style="font-size: 11px; font-weight: 700; color: #2DD4BF; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">${t.sectionServices}</div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 50%; padding: 0 8px 8px 0; vertical-align: top;">
                  <div style="background: #F0FDFC; border: 1px solid rgba(45,212,191,0.2); border-radius: 10px; padding: 14px;">
                    <div style="font-size: 22px; margin-bottom: 6px;">🤖</div>
                    <div style="font-size: 13px; font-weight: 700; color: #0D9488; margin-bottom: 4px;">${t.svc1t}</div>
                    <div style="color: #6B7280; font-size: 12px; line-height: 1.4;">${t.svc1d}</div>
                  </div>
                </td>
                <td style="width: 50%; padding: 0 0 8px 0; vertical-align: top;">
                  <div style="background: #F0FDFC; border: 1px solid rgba(45,212,191,0.2); border-radius: 10px; padding: 14px;">
                    <div style="font-size: 22px; margin-bottom: 6px;">🎯</div>
                    <div style="font-size: 13px; font-weight: 700; color: #0D9488; margin-bottom: 4px;">${t.svc2t}</div>
                    <div style="color: #6B7280; font-size: 12px; line-height: 1.4;">${t.svc2d}</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="width: 50%; padding: 0 8px 0 0; vertical-align: top;">
                  <div style="background: #F0FDFC; border: 1px solid rgba(45,212,191,0.2); border-radius: 10px; padding: 14px;">
                    <div style="font-size: 22px; margin-bottom: 6px;">📱</div>
                    <div style="font-size: 13px; font-weight: 700; color: #0D9488; margin-bottom: 4px;">${t.svc3t}</div>
                    <div style="color: #6B7280; font-size: 12px; line-height: 1.4;">${t.svc3d}</div>
                  </div>
                </td>
                <td style="width: 50%; padding: 0; vertical-align: top;">
                  <div style="background: #F0FDFC; border: 1px solid rgba(45,212,191,0.2); border-radius: 10px; padding: 14px;">
                    <div style="font-size: 22px; margin-bottom: 6px;">📊</div>
                    <div style="font-size: 13px; font-weight: 700; color: #0D9488; margin-bottom: 4px;">${t.svc4t}</div>
                    <div style="color: #6B7280; font-size: 12px; line-height: 1.4;">${t.svc4d}</div>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Tabla de precios -->
          <div style="margin: 0 0 24px;">
            <div style="font-size: 11px; font-weight: 700; color: #2DD4BF; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">${t.sectionPricing}</div>
            <table style="width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden;">
              <tr style="background: #0A0F1E;">
                <td style="padding: 10px 14px; color: #2DD4BF; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">${t.colService}</td>
                <td style="padding: 10px 14px; color: #2DD4BF; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; text-align: right;">${t.colPrice}</td>
              </tr>
              <tr style="background: #F9FAFB;"><td style="padding: 11px 14px; color: #374151; font-size: 13px; border-bottom: 1px solid #ECFDF5;">🎯 Gestión Meta Ads + Google Ads</td><td style="padding: 11px 14px; color: #1F2937; font-size: 13px; font-weight: 600; text-align: right; border-bottom: 1px solid #ECFDF5;">$900</td></tr>
              <tr style="background: white;"><td style="padding: 11px 14px; color: #374151; font-size: 13px; border-bottom: 1px solid #ECFDF5;">📱 Producción de contenido (IG / FB / TikTok)</td><td style="padding: 11px 14px; color: #1F2937; font-size: 13px; font-weight: 600; text-align: right; border-bottom: 1px solid #ECFDF5;">$600</td></tr>
              <tr style="background: #F9FAFB;"><td style="padding: 11px 14px; color: #374151; font-size: 13px; border-bottom: 1px solid #ECFDF5;">🤖 IA + Automatizaciones con OpenAI</td><td style="padding: 11px 14px; color: #1F2937; font-size: 13px; font-weight: 600; text-align: right; border-bottom: 1px solid #ECFDF5;">$350</td></tr>
              <tr style="background: white;"><td style="padding: 11px 14px; color: #374151; font-size: 13px; border-bottom: 1px solid #E5E7EB;">📊 Dashboard + Reportes semanales</td><td style="padding: 11px 14px; color: #1F2937; font-size: 13px; font-weight: 600; text-align: right; border-bottom: 1px solid #E5E7EB;">$150</td></tr>
              <tr style="background: #F9FAFB;"><td style="padding: 11px 14px; color: #6B7280; font-size: 13px; border-bottom: 1px solid #E5E7EB;">Total sin descuento</td><td style="padding: 11px 14px; color: #9CA3AF; font-size: 13px; text-align: right; text-decoration: line-through; border-bottom: 1px solid #E5E7EB;">$2,000</td></tr>
              <tr style="background: #FFF7ED;"><td style="padding: 11px 14px; color: #D97706; font-size: 13px; font-weight: 600; border-bottom: 1px solid #FDE68A;">🎉 Descuento lanzamiento (primeros 3 meses)</td><td style="padding: 11px 14px; color: #D97706; font-size: 13px; font-weight: 700; text-align: right; border-bottom: 1px solid #FDE68A;">- $500</td></tr>
              <tr style="background: #0A0F1E;">
                <td style="padding: 14px; color: white; font-size: 15px; font-weight: 800;">Total mes 1</td>
                <td style="padding: 14px; color: #2DD4BF; font-size: 20px; font-weight: 900; text-align: right;">$1,500 / mes</td>
              </tr>
            </table>
            <p style="color: #9CA3AF; font-size: 11px; margin: 8px 0 0; text-align: center;">Precio promocional aplicado automáticamente · Desde el mes 4 retorna a $2,000/mes</p>
          </div>

          <!-- CTA consultoría -->
          <div style="background-color:#1F2937;background:linear-gradient(135deg, #1F2937 0%, #0A0F1E 100%); border-radius: 14px; padding: 28px 24px; margin: 0 0 24px; text-align: center;">
            <div style="color: #2DD4BF; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">${t.sectionBonus}</div>
            <div style="color: white; font-size: 20px; font-weight: 800; margin-bottom: 6px;">${t.bonusTitle}</div>
            <div style="color: rgba(255,255,255,0.65); font-size: 13px; line-height: 1.7; margin-bottom: 22px;">${t.bonusDesc}</div>
            <a href="https://wa.me/593994837117?text=%40enzo%2C%20mejoremos%20el%20precio%20de%20tu%20oferta%20y%20cerremos%20este%20negocio%20en%20una%20reuni%C3%B3n%20en%20tu%20oficina"
               style="display: inline-block; background-color:#2DD4BF;background:linear-gradient(135deg, #2DD4BF 0%, #0D9488 100%); color: #042f2e; padding: 14px 32px; text-decoration: none; border-radius: 50px; font-weight: 800; font-size: 15px; box-shadow: 0 6px 20px rgba(45,212,191,0.40); letter-spacing: 0.3px;">
              ${t.ctaNegotiate}
            </a>
            <p style="color: rgba(255,255,255,0.4); font-size: 11px; margin: 12px 0 0; letter-spacing: 0.3px;">${t.ctaNegotiateNote}</p>
          </div>

          <!-- Cronograma de implementación -->
          <div style="margin: 0 0 24px;">
            <div style="font-size: 11px; font-weight: 700; color: #2DD4BF; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">${t.sectionTimeline}</div>
            <p style="color: #6B7280; font-size: 13px; margin: 0 0 16px; line-height: 1.6;">${t.timelineIntro(companyName || userName)}</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="width: 25%; padding: 0 4px 0 0; vertical-align: top; height: 175px;">
                  <div style="background: #0A0F1E; border-radius: 10px; padding: 14px 12px; text-align: center; min-height: 175px; height: 100%; box-sizing: border-box;">
                    <div style="color: #2DD4BF; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">${t.week(1)}</div>
                    <div style="font-size: 22px; margin-bottom: 6px;">${t.weekIcons[0]}</div>
                    <div style="color: white; font-size: 12px; font-weight: 700; margin-bottom: 4px;">${t.weekTitles[0]}</div>
                    <div style="color: rgba(255,255,255,0.5); font-size: 10px; line-height: 1.5;">${t.weekDescs[0]}</div>
                  </div>
                </td>
                <td style="width: 25%; padding: 0 4px; vertical-align: top; height: 175px;">
                  <div style="background: #0D1520; border: 1px solid rgba(45,212,191,0.2); border-radius: 10px; padding: 14px 12px; text-align: center; min-height: 175px; height: 100%; box-sizing: border-box;">
                    <div style="color: #2DD4BF; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">${t.week(2)}</div>
                    <div style="font-size: 22px; margin-bottom: 6px;">${t.weekIcons[1]}</div>
                    <div style="color: white; font-size: 12px; font-weight: 700; margin-bottom: 4px;">${t.weekTitles[1]}</div>
                    <div style="color: rgba(255,255,255,0.5); font-size: 10px; line-height: 1.5;">${t.weekDescs[1]}</div>
                  </div>
                </td>
                <td style="width: 25%; padding: 0 4px; vertical-align: top; height: 175px;">
                  <div style="background: #0D1520; border: 1px solid rgba(45,212,191,0.2); border-radius: 10px; padding: 14px 12px; text-align: center; min-height: 175px; height: 100%; box-sizing: border-box;">
                    <div style="color: #2DD4BF; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">${t.week(3)}</div>
                    <div style="font-size: 22px; margin-bottom: 6px;">${t.weekIcons[2]}</div>
                    <div style="color: white; font-size: 12px; font-weight: 700; margin-bottom: 4px;">${t.weekTitles[2]}</div>
                    <div style="color: rgba(255,255,255,0.5); font-size: 10px; line-height: 1.5;">${t.weekDescs[2]}</div>
                  </div>
                </td>
                <td style="width: 25%; padding: 0 0 0 4px; vertical-align: top; height: 175px;">
                  <div style="background-color:#042f2e;background:linear-gradient(135deg, #042f2e 0%, #0A0F1E 100%); border: 1px solid rgba(45,212,191,0.4); border-radius: 10px; padding: 14px 12px; text-align: center; min-height: 175px; height: 100%; box-sizing: border-box;">
                    <div style="color: #2DD4BF; font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">${t.week(4)}</div>
                    <div style="font-size: 22px; margin-bottom: 6px;">${t.weekIcons[3]}</div>
                    <div style="color: white; font-size: 12px; font-weight: 700; margin-bottom: 4px;">${t.weekTitles[3]}</div>
                    <div style="color: rgba(255,255,255,0.5); font-size: 10px; line-height: 1.5;">${t.weekDescs[3]}</div>
                  </div>
                </td>
              </tr>
            </table>
          </div>
          ` : ''}

          <!-- CTA WhatsApp -->
          <div style="text-align: center; margin: 0 0 8px;">
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 14px; font-weight: 500;">${t.ctaQue}</p>
            <a href="https://wa.me/593994837117?text=%40enzo%20recib%C3%AD%20tu%20cotizaci%C3%B3n%20por%20correo%20(${encodeURIComponent(leadId)})%20y%20tengo%20algunas%20dudas"
               style="background-color:#25D366;background:linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; padding: 13px 32px; text-decoration: none; border-radius: 50px; font-weight: 700; display: inline-block; box-shadow: 0 5px 18px rgba(37,211,102,0.35); font-size: 14px;">
              ${t.ctaWa}
            </a>
            <p style="color: #9CA3AF; font-size: 11px; margin: 10px 0 0;">${t.ctaWaSub}</p>
          </div>

        </div>
      </div>

      <!-- ═══ ECOSISTEMA DE AGENTES ═══ -->
      <div style="background-color:#12121a;background:linear-gradient(180deg,#12121a 0%,#0d0d12 100%);padding:40px 24px 0;text-align:center;border-top:3px solid #0D9488;">
        <div style="max-width:480px;margin:0 auto 28px;">
          <h2 style="color:#2DD4BF;font-size:22px;font-weight:700;line-height:1.3;margin:0 0 12px;letter-spacing:-0.5px;">${t.ecosistemaTitle}</h2>
          <p style="color:rgba(255,255,255,0.7);font-size:13px;line-height:1.7;margin:0;">${t.ecosistemaDesc}</p>
        </div>
        <div style="margin-bottom:22px;">${ecosistemaTable({aliados:['aurora','adriana','angela','axel','aluna','gabi','paula','custom'],theme:'dark'})}</div>
        <div style="background:rgba(13,148,136,0.06);border:1px solid rgba(13,148,136,0.12);border-radius:10px;padding:14px;margin-bottom:36px;">
          <p style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.8;margin:0;">
            Un solo ecosistema. Agentes especializados que se hablan entre sí.<br>
            <strong style="color:rgba(255,255,255,0.8);">Haz clic en cualquier agente para hablar directamente por WhatsApp.</strong>
          </p>
        </div>
        <!-- Brand footer -->
        <div style="border-top: 1px solid rgba(255,255,255,0.07); padding: 28px 20px 32px; text-align: center;">
          <img src="data:image/png;base64,${LOGOS_BASE64.marketinglab}" alt="MarketingLab" style="max-width: 180px; height: auto; display: block; margin: 0 auto 12px;" />
          <div style="color: rgba(255,255,255,0.35); font-size: 12px; letter-spacing: 1px; margin-bottom: 16px;">${t.footerTagline}</div>
          <div style="color: rgba(255,255,255,0.25); font-size: 11px; line-height: 1.8;">
            © 2026 Coworkia Ecuador — Espacios que inspiran<br>
            Whymper 403, Edificio Finistere - Planta Baja, Quito<br>
            <span style="font-size:10px;">coworkia.ec@gmail.com · +593 99 483 7117</span>
          </div>
        </div>
      </div>

    </body>
    </html>
  `;
}

/**
 * 🏘️ PAULA - PropElite Bienes Raíces (Real Estate Expert)
 * Colores: Rosa elegante (#DB2777, #EC4899) + Verde esmeralda (#059669)
 */
export function generatePaulaEmailHTML(leadData, { userLanguage = 'es', leadScoreData = null } = {}) {
  const t = (EMAIL_TRANSLATIONS[userLanguage] || EMAIL_TRANSLATIONS.es).paula;
  const {
    userName,
    operationType,
    propertyType,
    zone,
    budgetRange,
    email,
    phone,
    leadId
  } = leadData;

  // Calcular lead score si los datos están disponibles
  let leadScoreHTML = '';
  if (leadScoreData) {
    const score = calcularLeadScore(leadScoreData);
    const reporte = generarReporteLeadScore(leadScoreData, score);
    leadScoreHTML = reporte.html;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Búsqueda de Propiedad - PropElite</title>
      <style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style>
    </head>
    <body style="font-family: 'Georgia', serif; line-height: 1.6; color: #EDE8D0; background-color: #3D4436; margin: 0; padding: 20px;">
      
      <div class="email-container" style="max-width: 600px; margin: 0 auto; background: #F5F5DC; border: 2px solid #D4AF37; border-radius: 0; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);">
        
        <!-- Header PropElite - Diseño Ultra Minimalista Wordmark -->
        <div style="background: #3D4436; text-align: center; padding: 60px 20px 50px 20px; border-bottom: 1px solid rgba(212,175,55,0.3);">
          <!-- Logo Wordmark Ultra Minimalista -->
          <div style="margin-bottom: 45px;">
            <!-- Prop Elite - Wordmark principal con potencia -->
            <div style="font-family: 'Georgia', serif; color: #D4AF37; font-size: 64px; font-weight: 700; letter-spacing: 2px; margin-bottom: 15px; line-height: 1.1; text-shadow: 0 2px 8px rgba(0,0,0,0.3);">
              Prop Elite
            </div>
            <!-- Prime Living - Tagline -->
            <div style="font-family: 'Helvetica Neue', 'Arial', sans-serif; color: #EDE8D0; font-size: 13px; font-weight: 400; letter-spacing: 5px; text-transform: uppercase; opacity: 0.9; margin-top: 20px;">
              PRIME LIVING
            </div>
          </div>
          
          <!-- Línea divisoria sutil -->
          <div style="height: 1px; width: 80px; background: rgba(212,175,55,0.4); margin: 35px auto 40px auto;"></div>
          
          <!-- Card de confirmación -->
          <div class="card-white shadow" style="background: #EDE8D0; color: #3D4436; padding: 28px 40px; border-radius: 0; display: inline-block; box-shadow: 0 8px 30px rgba(0,0,0,0.25); border: 1px solid #D4AF37;">
            <h1 class="text-dark" style="margin: 0; font-size: 20px; font-weight: 600; color: #3D4436; letter-spacing: 3px; font-family: 'Georgia', serif; text-transform: uppercase;">${t.title}</h1>
            <p class="text-gray" style="margin: 10px 0 0 0; color: #52594B; font-size: 13px; font-family: 'Arial', sans-serif; letter-spacing: 1px;">${t.subtitle}</p>
          </div>
        </div>

        <div class="content-section" style="padding: 45px 40px; background: #F5F5DC;">
          
          <!-- Saludo personalizado -->
          <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #D4AF37; padding-bottom: 30px;">
            <h2 class="text-dark" style="color: #3D4436; font-size: 28px; margin: 0 0 15px 0; font-weight: 400; font-family: 'Georgia', serif; letter-spacing: 2px;">${userName}</h2>
            <p class="text-gray" style="color: #52594B; font-size: 15px; margin: 0; font-family: 'Arial', sans-serif;">
              ${t.searchStarted} <span style="color: #D4AF37; font-weight: 700; font-family: 'Georgia', serif;">${propertyType}</span>
            </p>
          </div>

          <!-- Detalles de la búsqueda -->
          <div class="card-white-border" style="background: #4A5241; border: 2px solid #D4AF37; border-radius: 0; padding: 35px; margin: 35px 0; box-shadow: 0 4px 20px rgba(74,82,65,0.3);">
            <h3 class="text-dark" style="color: #D4AF37; margin-top: 0; font-size: 15px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; font-family: 'Arial', sans-serif; border-bottom: 2px solid #D4AF37; padding-bottom: 15px; margin-bottom: 25px;">${t.sectionSpecs}</h3>
            
            <div style="margin: 25px 0;">
              <div class="card-white-border" style="background: #EDE8D0; border-radius: 0; padding: 18px 25px; margin: 15px 0; border-left: 4px solid #D4AF37;">
                <div style="color: #52594B; font-weight: 600; font-size: 12px; font-family: 'Arial', sans-serif; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">${t.labelOperation}</div>
                <div class="text-dark" style="color: #3D4436; font-weight: 700; font-size: 17px; font-family: 'Georgia', serif;">${operationType}</div>
              </div>
              
              <div class="card-white-border" style="background: #EDE8D0; border-radius: 0; padding: 18px 25px; margin: 15px 0; border-left: 4px solid #D4AF37;">
                <div style="color: #52594B; font-weight: 600; font-size: 12px; font-family: 'Arial', sans-serif; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">${t.labelPropertyType}</div>
                <div class="text-dark" style="color: #3D4436; font-weight: 700; font-size: 17px; font-family: 'Georgia', serif;">${propertyType}</div>
              </div>
              
              <div class="card-white-border" style="background: #EDE8D0; border-radius: 0; padding: 18px 25px; margin: 15px 0; border-left: 4px solid #D4AF37;">
                <div style="color: #52594B; font-weight: 600; font-size: 12px; font-family: 'Arial', sans-serif; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">${t.labelZone}</div>
                <div class="text-dark" style="color: #3D4436; font-weight: 700; font-size: 17px; font-family: 'Georgia', serif;">${zone}</div>
              </div>
              
              <div class="card-white-border" style="background: #EDE8D0; border-radius: 0; padding: 18px 25px; margin: 15px 0; border-left: 4px solid #D4AF37;">
                <div style="color: #52594B; font-weight: 600; font-size: 12px; font-family: 'Arial', sans-serif; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">${t.labelBudget}</div>
                <div class="text-dark" style="color: #3D4436; font-weight: 700; font-size: 17px; font-family: 'Georgia', serif;">${budgetRange}</div>
              </div>
            </div>
          </div>

          <!-- Contacto -->
          <div class="card-white-border" style="background: #EDE8D0; border: 2px solid #D4AF37; border-radius: 0; padding: 30px; margin: 30px 0;">
            <div style="margin: 12px 0;">
              <span class="text-muted" style="color: #52594B; font-size: 12px; font-family: 'Arial', sans-serif; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">${t.labelEmail}</span>
              <div class="text-dark" style="color: #3D4436; font-weight: 600; font-size: 15px; font-family: 'Arial', sans-serif; margin-top: 6px;">${email}</div>
            </div>
            <div style="height: 2px; background: #D4AF37; margin: 20px 0;"></div>
            <div style="margin: 12px 0;">
              <span class="text-muted" style="color: #52594B; font-size: 12px; font-family: 'Arial', sans-serif; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">${t.labelPhone}</span>
              <div class="text-dark" style="color: #3D4436; font-weight: 600; font-size: 15px; font-family: 'Arial', sans-serif; margin-top: 6px;">${phone}</div>
            </div>
          </div>

          <!-- Próximos pasos -->
          <div class="card-white-border" style="background: #4A5241; border: 2px solid #D4AF37; border-radius: 0; padding: 35px; margin: 35px 0;">
            <h3 style="color: #D4AF37; font-size: 15px; margin-bottom: 25px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; font-family: 'Arial', sans-serif;">${t.processTitle}</h3>
            <div style="color: #EDE8D0; font-size: 15px; line-height: 2.2; font-family: 'Georgia', serif;">
              <p style="margin: 15px 0;">
                <span style="color: #D4AF37; font-weight: 700; font-size: 18px; font-family: 'Georgia', serif;">I.</span> &nbsp; ${t.step1}
              </p>
              <p style="margin: 15px 0;">
                <span style="color: #D4AF37; font-weight: 700; font-size: 18px; font-family: 'Georgia', serif;">II.</span> &nbsp; ${t.step2}
              </p>
              <p style="margin: 15px 0;">
                <span style="color: #D4AF37; font-weight: 700; font-size: 18px; font-family: 'Georgia', serif;">III.</span> &nbsp; ${t.step3}
              </p>
              <p style="margin: 15px 0;">
                <span style="color: #D4AF37; font-weight: 700; font-size: 18px; font-family: 'Georgia', serif;">IV.</span> &nbsp; ${t.step4}
              </p>
            </div>
          </div>

          <!-- Referencia -->
          <div style="background: #EDE8D0; border-radius: 0; padding: 25px; margin: 35px 0 0 0; border-top: 2px solid #D4AF37;">
            <p class="text-muted" style="color: #52594B; font-size: 11px; margin: 0; font-family: 'Arial', sans-serif; letter-spacing: 2px; text-transform: uppercase; font-weight: 600;">
              <strong>Referencia:</strong> ${leadId}
            </p>
          </div>

          <!-- Lead Score - Internal Qualification -->
          ${leadScoreHTML}

          <!-- Footer Elite Minimalista -->
          <div style="text-align: center; margin: 45px 0 0 0; padding: 45px 30px; background: #3D4436; border-top: 1px solid rgba(212,175,55,0.3);">
            <!-- Wordmark pequeño -->
            <p style="color: #D4AF37; font-size: 22px; font-weight: 700; margin: 0 0 10px 0; font-family: 'Georgia', serif; letter-spacing: 2px;">Prop Elite</p>
            <p style="color: #EDE8D0; font-size: 10px; margin: 8px 0 15px 0; font-family: 'Helvetica Neue', 'Arial', sans-serif; letter-spacing: 4px; text-transform: uppercase; opacity: 0.8;">PRIME LIVING</p>
            <div style="height: 1px; width: 60px; background: rgba(212,175,55,0.3); margin: 20px auto;"></div>
            <p style="color: #EDE8D0; font-size: 11px; margin: 8px 0 0 0; font-family: 'Arial', sans-serif; opacity: 0.7;">${t.footerRole}</p>
          </div>

        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * 🎫 ALUNA - Coworkia Membresías
 * Colores: Turquesa Coworkia (#4ECDC4, #44A08D)
 */
export function generateAlunaEmailHTML(leadData, userLanguage = 'es') {
  const {
    userName,
    membershipType,
    startDate,
    email,
    phone,
    companyName,
    leadId
  } = leadData;
  const t = (EMAIL_TRANSLATIONS[userLanguage] || EMAIL_TRANSLATIONS.es).aluna;

  const waVisita = encodeURIComponent(`@aluna, quiero reservar mi visita gratuita, ¿cuándo puedo ir?`);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Membresía Coworkia</title>
  <style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">

    <!-- Header — mismo estilo aprobado de la proforma -->
    <div style="background-color:#047857;background:linear-gradient(135deg, #047857 0%, #065F46 100%); text-align: center; padding: 40px 20px 35px;">
      <div style="color: white; font-size: 70px; font-weight: 700; margin-bottom: 8px; line-height: 0.9;">Coworkia</div>
      <div style="color: rgba(255,255,255,0.9); font-size: 12px; font-weight: 600; letter-spacing: 6px; text-transform: uppercase; margin-bottom: 30px;">BUSINESS CENTER</div>
      <div style="background:rgba(255,255,255,0.97);border-radius:16px;padding:24px 32px;display:inline-block;min-width:300px;text-align:left;box-shadow:0 4px 20px rgba(0,0,0,0.18);">
        <div style="color:#9CA3AF;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:14px;text-align:center;">· SOLICITUD RECIBIDA ·</div>
        <div style="color:#111827;font-size:26px;font-weight:800;margin-bottom:14px;text-align:center;">${userName}</div>
        <div style="border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;padding:12px 0;margin-bottom:12px;text-align:center;">
          <span style="font-size:18px;vertical-align:middle;">🎫</span>&nbsp;&nbsp;<strong style="color:#111827;font-size:16px;font-weight:700;vertical-align:middle;">${membershipType}</strong>
        </div>
        <div style="color:#047857;font-size:13px;font-weight:600;text-align:center;">Aluna · Especialista en Membresías</div>
      </div>
    </div>

    <div style="padding: 32px 30px 28px;">

      <!-- Texto corto vendedor -->
      <p style="color:#111827;font-size:15px;font-weight:700;margin:0 0 6px 0;">¡${userName}, ya tenemos todo listo para recibirte! 🎉</p>
      <p style="color:#6B7280;font-size:13px;line-height:1.6;margin:0 0 20px 0;">Tu solicitud llegó perfectamente. Antes de activar tu membresía, queremos que <strong style="color:#047857;">vengas un día completo sin costo</strong> — prueba el espacio, trabajo, café y WiFi incluidos. Si te convence, lo activamos ese mismo día.</p>

      <!-- Lo que te espera -->
      <div style="background:#ECFDF5;border-left:4px solid #047857;border-radius:10px;padding:14px 18px;margin-bottom:22px;">
        <div style="color:#065F46;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">Lo que te espera 👇</div>
        <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#059669;margin-right:8px;">✓</span>Escritorio, ${WIFI.display} y café ilimitado desde que llegas</div>
        <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#059669;margin-right:8px;">✓</span>Salas de reuniones, impresoras y toda la infraestructura disponible</div>
        <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#059669;margin-right:8px;">✓</span>Una comunidad de profesionales y empresarios que ya están creciendo aquí</div>
      </div>

      <!-- CTA único -->
      <div style="text-align:center;margin-bottom:20px;">
        <a href="https://wa.me/593994837117?text=${waVisita}"
           style="background-color:#047857;background:linear-gradient(135deg,#047857,#065F46);color:white;padding:14px 36px;text-decoration:none;border-radius:25px;font-weight:700;display:inline-block;box-shadow:0 4px 14px rgba(4,120,87,0.4);font-size:15px;">
          📅 Reservar mi primera visita gratuita
        </a>
        <div style="color:#9CA3AF;font-size:12px;margin-top:8px;">Respuesta en minutos · Puedes venir cualquier día de la semana</div>
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding:18px;background:linear-gradient(135deg,rgba(4,120,87,0.08),rgba(6,95,70,0.12));border-radius:10px;">
        <p style="color:#047857;font-size:14px;font-weight:700;margin:0 0 4px 0;">¡Te esperamos con el café listo! ☕</p>
        <p style="color:#9CA3AF;font-size:12px;margin:0;">Equipo Coworkia · Whymper 403, Edificio Finistere, Quito</p>
      </div>

    </div>
  </div>
</body>
</html>`;
}

/** * ⚖️ GABI - GR Consulting (Consultoría Legal y Contable)
 * Colores: Azul profesional (#1E3A8A, #3B82F6, #1E40AF)
 */
export function generateGabiEmailHTML(leadData, userLanguage = 'es') {
  const {
    userName,
    consultationType,
    company,
    ruc,
    email,
    phone,
    description,
    urgency,
    consultationCode,
    recipientType = 'client',
    aiAnalysis = null,
  } = leadData;
  const t = (EMAIL_TRANSLATIONS[userLanguage] || EMAIL_TRANSLATIONS.es).gabi;

  const gabiWaNumber = '593994837117';

  const urgencyMap = {
    'Urgente':       { text: '#DC2626', icon: '🚨' },
    'Normal':        { text: '#D97706', icon: '📅' },
    'Planificación': { text: '#2563EB', icon: '📋' },
  };
  const urgencyStyle = urgencyMap[urgency] || urgencyMap['Normal'];

  // WA links
  const adminWaLink  = `https://wa.me/${(phone||'').replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${userName}, soy del equipo de GR Consulting. Tu consulta ${consultationCode} ha sido recibida. ¿Cuándo podemos coordinar la sesión inicial gratuita?`)}`;
  // CTA 1: triggers $100 / 90-min advisory payment flow in backend
  const clientWaCTA1 = `https://wa.me/${gabiWaNumber}?text=${encodeURIComponent('@gabi ya tengo claro el camino, quiero seguir con la asesoría')}`;
  // CTA 2: questions about the offer
  const clientWaCTA2 = `https://wa.me/${gabiWaNumber}?text=${encodeURIComponent(`@gabi recibí su correo y tengo algunas preguntas - (${consultationCode})`)}`;

  // Opening: AI-personalized if provided, else persuasive default
  const openingText = aiAnalysis
    ? aiAnalysis
    : (t.fallbackOpening ? t.fallbackOpening(userName, consultationType) : `Hemos revisado tu solicitud de asesoría en <strong style="color:#1B3358;">${consultationType}</strong>${company ? ` para <strong>${company}</strong>` : ''}. Gabi ya tiene el camino trazado para tu caso. La primera sesión de diagnóstico (30 min) es completamente gratuita y sin compromiso — ahí mapeamos tu situación, identificamos riesgos y definimos el alcance exacto. Si decides avanzar, la <strong style="color:#1B3358;">asesoría profunda de 90 minutos por $100</strong> es donde construimos juntos el plan de acción completo con informe profesional listo para ejecutar.`);

  // 6-area services grid
  const services = [
    { icon: '🏛️', title: 'Cumplimiento UAFE',         desc: 'Oficial de Cumplimiento certificado (LOPDLAFT), reportes ROS/RUI, matrices AML/CFT y políticas KYC.' },
    { icon: '💰', title: 'Finanzas & Tributación SRI', desc: 'Declaraciones IVA y Renta, conciliaciones bancarias, estados financieros y optimización fiscal.' },
    { icon: '👥', title: 'RRHH & Nómina',              desc: 'Décimos, IESS, afiliaciones, contratos laborales, reglamentos internos y liquidaciones de ley.' },
    { icon: '⚖️', title: 'Legal Empresarial',           desc: 'Constitución de compañías, contratos societarios, trámites Registro Mercantil, SRI e IESS.' },
    { icon: '🔍', title: 'Due Diligence & KYC',         desc: 'Auditorías internas, políticas antilavado, debida diligencia mejorada y gestión de riesgos.' },
    { icon: '🛡️', title: 'Ley de Datos / LOPDLAFT',     desc: 'Políticas privacidad, registro SENADI, derechos ARCO y cumplimiento normativo digital.' },
  ];

  const servicesHTML = [0, 2, 4].map(i => `
    <tr>
      <td style="width:50%;padding:0 6px 10px 0;vertical-align:top;">
        <div style="background:#FFF9E6;border:1px solid rgba(255,224,51,0.45);border-radius:10px;padding:16px;">
          <div style="font-size:22px;margin-bottom:8px;">${services[i].icon}</div>
          <div style="font-size:13px;font-weight:700;color:#1B3358;margin-bottom:5px;">${services[i].title}</div>
          <div style="color:#6B7280;font-size:12px;line-height:1.5;">${services[i].desc}</div>
        </div>
      </td>
      <td style="width:50%;padding:0 0 10px 0;vertical-align:top;">
        <div style="background:#FFF9E6;border:1px solid rgba(255,224,51,0.45);border-radius:10px;padding:16px;">
          <div style="font-size:22px;margin-bottom:8px;">${services[i+1].icon}</div>
          <div style="font-size:13px;font-weight:700;color:#1B3358;margin-bottom:5px;">${services[i+1].title}</div>
          <div style="color:#6B7280;font-size:12px;line-height:1.5;">${services[i+1].desc}</div>
        </div>
      </td>
    </tr>`).join('');

  const clientBodyContent = `
    <!-- Opening paragraph: AI or default persuasive -->
    <div style="background:#FFFBEB;border-left:4px solid #FFE033;border-radius:0 12px 12px 0;padding:20px 24px;margin:0 0 24px;">
      <p style="color:#374151;font-size:15px;line-height:1.8;margin:0;">${openingText}</p>
    </div>

    <!-- Summary card -->
    <div style="background:#F9FAFB;border-left:4px solid #C9A82A;border-radius:0 12px 12px 0;padding:20px 24px;margin:0 0 24px;">
      <div style="font-size:11px;font-weight:700;color:#1B3358;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;">📋 ${t.sectionSummary}</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;width:40%;">Tipo de consultoría</td><td style="padding:6px 0;color:#1B3358;font-size:13px;font-weight:700;">${consultationType}</td></tr>
        ${company ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Empresa</td><td style="padding:6px 0;color:#1F2937;font-size:13px;font-weight:600;">${company}</td></tr>` : ''}
        ${ruc ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">RUC</td><td style="padding:6px 0;color:#1F2937;font-size:13px;font-weight:600;">${ruc}</td></tr>` : ''}
        <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Urgencia</td><td style="padding:6px 0;color:${urgencyStyle.text};font-size:13px;font-weight:700;">${urgencyStyle.icon} ${urgency||'Normal'}</td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Código</td><td style="padding:6px 0;color:#1B3358;font-size:13px;font-weight:700;">${consultationCode}</td></tr>
      </table>
    </div>

    <!-- Services: 6-area grid -->
    <div style="margin:0 0 24px;">
      <div style="font-size:11px;font-weight:700;color:#1B3358;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">${t.sectionServices}</div>
      <p style="color:#6B7280;font-size:13px;margin:0 0 14px;line-height:1.6;">${t.servicesDesc}</p>
      <table style="width:100%;border-collapse:collapse;">${servicesHTML}</table>
    </div>

    <!-- OFFER: clear 2-tier pitch -->
    <div style="background-color:#1B3358;background:linear-gradient(145deg,#1B3358 0%,#0D2137 100%);border-radius:16px;padding:32px 24px;margin:0 0 24px;text-align:center;">
      <div style="background:rgba(255,224,51,0.1);border:1px solid rgba(255,224,51,0.3);border-radius:20px;padding:5px 18px;display:inline-block;margin-bottom:20px;">
        <span style="color:#FFE033;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">🎁 ${t.sectionOffer}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="width:50%;padding:0 6px 0 0;vertical-align:top;">
            <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:18px;text-align:center;">
              <div style="color:rgba(255,255,255,0.45);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">${t.tierFreeLabel}</div>
              <div style="color:#FFE033;font-size:38px;font-weight:900;line-height:1;margin-bottom:4px;">${t.tierFreePrice}</div>
              <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-bottom:10px;">${t.tierFreeDuration}</div>
              <div style="color:rgba(255,255,255,0.45);font-size:11px;line-height:1.5;">${t.tierFreeDesc}</div>
            </div>
          </td>
          <td style="width:50%;padding:0 0 0 6px;vertical-align:top;">
            <div style="background:rgba(255,224,51,0.07);border:2px solid rgba(255,224,51,0.5);border-radius:12px;padding:18px;text-align:center;">
              <div style="color:#FFE033;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">${t.tierPaidLabel}</div>
              <div style="color:#FFE033;font-size:38px;font-weight:900;line-height:1;margin-bottom:4px;">${t.tierPaidPrice}</div>
              <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-bottom:10px;">${t.tierPaidDuration}</div>
              <div style="color:rgba(255,255,255,0.6);font-size:11px;line-height:1.5;">${t.tierPaidDesc}</div>
            </div>
          </td>
        </tr>
      </table>
      <div style="color:rgba(255,255,255,0.65);font-size:14px;line-height:1.8;margin-bottom:26px;max-width:380px;margin-left:auto;margin-right:auto;">
        ${t.offerDesc}
      </div>
      <a href="${clientWaCTA1}"
         style="display:inline-block;background-color:#FFE033;background:linear-gradient(135deg,#FFE033 0%,#E8B800 100%);color:#0D2137;padding:16px 36px;text-decoration:none;border-radius:50px;font-weight:900;font-size:15px;box-shadow:0 6px 22px rgba(255,224,51,0.5);letter-spacing:0.3px;">
        ${t.ctaPrimary}
      </a>
      <p style="color:rgba(255,255,255,0.35);font-size:11px;margin:12px 0 0;letter-spacing:0.3px;">${t.ctaNote}</p>
    </div>

    <!-- Process: 3 steps -->
    <div style="margin:0 0 24px;">
      <div style="font-size:11px;font-weight:700;color:#1B3358;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;">${t.sectionProcess}</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:33.3%;padding:0 5px 0 0;vertical-align:top;">
            <div style="background:#0A0F1E;border-radius:10px;padding:16px 12px;text-align:center;">
              <div style="color:#FFE033;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">${t.processDay1}</div>
              <div style="font-size:24px;margin-bottom:8px;">📞</div>
              <div style="color:white;font-size:12px;font-weight:700;margin-bottom:4px;">${t.process1Title}</div>
              <div style="color:rgba(255,255,255,0.45);font-size:11px;">${t.process1Sub}</div>
            </div>
          </td>
          <td style="width:33.3%;padding:0 5px;vertical-align:top;">
            <div style="background:#0D1520;border:1px solid rgba(255,224,51,0.2);border-radius:10px;padding:16px 12px;text-align:center;">
              <div style="color:#FFE033;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">${t.processStep2}</div>
              <div style="font-size:24px;margin-bottom:8px;">💳</div>
              <div style="color:white;font-size:12px;font-weight:700;margin-bottom:4px;">${t.process2Title}</div>
              <div style="color:rgba(255,255,255,0.45);font-size:11px;">${t.process2Sub}</div>
            </div>
          </td>
          <td style="width:33.3%;padding:0 0 0 5px;vertical-align:top;">
            <div style="background-color:#2a1a00;background:linear-gradient(135deg,#2a1a00 0%,#0A0F1E 100%);border:1px solid rgba(255,224,51,0.4);border-radius:10px;padding:16px 12px;text-align:center;">
              <div style="color:#FFE033;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">${t.processResult}</div>
              <div style="font-size:24px;margin-bottom:8px;">📋</div>
              <div style="color:white;font-size:12px;font-weight:700;margin-bottom:4px;">${t.process3Title}</div>
              <div style="color:rgba(255,255,255,0.45);font-size:11px;">${t.process3Sub}</div>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- CTA 2: WhatsApp questions -->
    <div style="text-align:center;margin:0 0 8px;">
      <p style="color:#6B7280;font-size:14px;margin:0 0 14px;font-weight:500;">${t.ctaQue}</p>
      <a href="${clientWaCTA2}"
         style="background-color:#25D366;background:linear-gradient(135deg,#25D366 0%,#128C7E 100%);color:white;padding:13px 32px;text-decoration:none;border-radius:50px;font-weight:700;display:inline-block;box-shadow:0 5px 18px rgba(37,211,102,0.35);font-size:14px;">
        ${t.ctaWa}
      </a>
      <p style="color:#9CA3AF;font-size:11px;margin:10px 0 0;">${t.ctaWaSub}</p>
    </div>
  `;

  const adminBodyContent = `
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Nueva solicitud de consultoría de <strong style="color:#1B3358;">${userName}</strong> en <strong style="color:#1B3358;">${consultationType}</strong>.
    </p>
    <div style="background:#F9FAFB;border-left:4px solid #C9A82A;border-radius:0 12px 12px 0;padding:20px 24px;margin:0 0 24px;">
      <div style="font-size:11px;font-weight:700;color:#1B3358;text-transform:uppercase;letter-spacing:2px;margin-bottom:14px;">👤 Datos del cliente</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;width:35%;">Nombre</td><td style="padding:6px 0;color:#1F2937;font-size:13px;font-weight:600;">${userName}</td></tr>
        ${company ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Empresa</td><td style="padding:6px 0;color:#1F2937;font-size:13px;font-weight:600;">${company}</td></tr>` : ''}
        ${ruc ? `<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">RUC</td><td style="padding:6px 0;color:#1F2937;font-size:13px;font-weight:600;">${ruc}</td></tr>` : ''}
        <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Email</td><td style="padding:6px 0;color:#1F2937;font-size:13px;font-weight:600;">${email}</td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Teléfono</td><td style="padding:6px 0;color:#1F2937;font-size:13px;font-weight:600;">${phone}</td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Urgencia</td><td style="padding:6px 0;color:${urgencyStyle.text};font-size:13px;font-weight:700;">${urgencyStyle.icon} ${urgency||'Normal'}</td></tr>
        <tr><td style="padding:6px 0;color:#6B7280;font-size:13px;">Código</td><td style="padding:6px 0;color:#1B3358;font-size:13px;font-weight:700;">${consultationCode}</td></tr>
      </table>
    </div>
    <div style="background:white;border:1px solid rgba(27,51,88,0.15);border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <div style="font-size:11px;font-weight:700;color:#1B3358;text-transform:uppercase;letter-spacing:2px;margin-bottom:12px;">📝 Descripción del caso</div>
      <p style="color:#374151;margin:0;line-height:1.7;font-size:14px;">${description}</p>
    </div>
    <div style="text-align:center;margin:0 0 8px;">
      <p style="color:#6B7280;font-size:14px;margin:0 0 14px;">💬 Contactar al cliente</p>
      <a href="${adminWaLink}"
         style="background-color:#25D366;background:linear-gradient(135deg,#25D366 0%,#128C7E 100%);color:white;padding:13px 32px;text-decoration:none;border-radius:50px;font-weight:700;display:inline-block;box-shadow:0 5px 18px rgba(37,211,102,0.35);font-size:14px;">
        📱 Abrir WhatsApp con ${userName}
      </a>
    </div>
  `;

  const ecosistemaItems = ecosistemaTable({
    aliados: ['aurora', 'adriana', 'angela', 'axel', 'aluna', 'enzo', 'paula', 'custom'],
    theme: 'dark',
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light">
      <title>${recipientType === 'admin' ? 'Nueva Consultoría' : `Cotización ${consultationCode}`} — GR Consulting</title>
      <style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style>
    </head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;background-color:#0D2137;margin:0;padding:0;">

      <div style="max-width:600px;margin:0 auto;background:white;border-radius:0;overflow:hidden;">

        <!-- ═══ HEADER: dark navy + fluorescent gold ═══ -->
        <div style="background-color:#1B3358;background:linear-gradient(145deg,#1B3358 0%,#0D2137 55%,#14293F 100%);text-align:center;padding:48px 20px 40px;position:relative;overflow:hidden;">

          <div style="color:white;font-size:32px;font-weight:900;letter-spacing:-0.5px;margin-bottom:5px;font-family:Georgia,serif;">GR Consulting</div>
          <div style="color:#FFE033;font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;margin-bottom:28px;">FINANZAS · LEGAL · RRHH · COMPLIANCE</div>

          <!-- Metrics card -->
          <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,224,51,0.35);border-radius:14px;padding:20px 26px;max-width:340px;margin:0 auto;">
            <div style="color:#FFE033;font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;text-align:center;margin-bottom:12px;">${t.headerSub}</div>
            <div style="color:white;font-size:22px;font-weight:800;text-align:center;line-height:1.2;margin-bottom:14px;">${userName}</div>
            <div style="border-top:1px solid rgba(255,224,51,0.2);margin-bottom:14px;"></div>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="width:50%;padding:0 4px 0 0;">
                  <div style="background:rgba(255,224,51,0.06);border:1px solid rgba(255,224,51,0.2);border-radius:10px;padding:12px;text-align:center;">
                    <div style="color:#FFE033;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">TIPO</div>
                    <div style="color:white;font-size:12px;font-weight:700;line-height:1.3;">${consultationType}</div>
                  </div>
                </td>
                <td style="width:50%;padding:0 0 0 4px;">
                  <div style="background:rgba(255,224,51,0.06);border:1px solid rgba(255,224,51,0.2);border-radius:10px;padding:12px;text-align:center;">
                    <div style="color:#FFE033;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">REFERENCIA</div>
                    <div style="color:white;font-size:12px;font-weight:700;line-height:1.3;">${consultationCode}</div>
                  </div>
                </td>
              </tr>
            </table>
            ${company ? `<div style="text-align:center;margin-top:12px;color:rgba(255,255,255,0.5);font-size:12px;">${company}</div>` : ''}
            <div style="text-align:center;border-top:1px solid rgba(255,224,51,0.2);margin-top:14px;padding-top:12px;">
              <span style="color:#FFE033;font-size:12px;font-weight:600;">Gabi · GR Consulting</span>
            </div>
          </div>
        </div>

        <!-- ═══ BODY ═══ -->
        <div style="padding:32px 28px;">
          ${recipientType === 'admin' ? adminBodyContent : clientBodyContent}
        </div>
      </div>

      <!-- ═══ ECOSISTEMA ═══ -->
      <div style="background-color:#12121a;background:linear-gradient(180deg,#12121a 0%,#0d0d12 100%);padding:40px 24px 0;text-align:center;border-top:3px solid #FFE033;">
        <div style="max-width:480px;margin:0 auto 28px;">
          <h2 style="color:#FFE033;font-size:22px;font-weight:700;line-height:1.3;margin:0 0 12px;letter-spacing:-0.5px;">${t.ecosistemaTitle}</h2>
          <p style="color:rgba(255,255,255,0.7);font-size:13px;line-height:1.7;margin:0;">${t.ecosistemaDesc}</p>
        </div>
        <div style="margin-bottom:22px;">${ecosistemaItems}</div>
        <div style="background:rgba(255,224,51,0.04);border:1px solid rgba(255,224,51,0.1);border-radius:10px;padding:14px;margin-bottom:36px;">
          <p style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.8;margin:0;">
            Un solo ecosistema. Agentes especializados que se hablan entre sí.<br>
            <strong style="color:rgba(255,255,255,0.8);">Haz clic en cualquier agente para hablar directamente por WhatsApp.</strong>
          </p>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.07);padding:28px 20px 32px;text-align:center;">
          <h2 style="color:white;font-size:24px;font-weight:900;margin:0 0 6px;letter-spacing:1px;font-family:Georgia,serif;">GR CONSULTING</h2>
          <div style="color:rgba(255,255,255,0.35);font-size:12px;letter-spacing:1px;margin-bottom:16px;">${t.footerTagline}</div>
          <div style="color:rgba(255,255,255,0.25);font-size:11px;line-height:1.8;">
            © 2026 Coworkia Ecuador — Espacios que inspiran<br>
            Whymper 403, Edificio Finistere - Planta Baja, Quito<br>
            <span style="font-size:10px;">coworkia.ec@gmail.com · +593 99 483 7117</span>
          </div>
        </div>
      </div>

    </body>
    </html>
  `;
}


/**
 * � ALUNA PROFORMA — Email de propuesta de membresía específica
 * Solo muestra el plan elegido. Colores: Verde Oscuro (#047857 → #065F46)
 */
export function generateAlunaProformaHTML(data, userLanguage = 'es') {
  const t = (EMAIL_TRANSLATIONS[userLanguage] || EMAIL_TRANSLATIONS.es).proforma;
  const {
    clientName,
    planName,
    planPrice,
    planDays,
    planHours,
    planBenefits = [],
    planIdeal = '',
    proformaCode = '',
    nota = null,
    coworkiaWhatsApp = CONTACT.phoneWhatsApp
  } = data;
  const safeClientName = escapeHtml(clientName || 'Cliente');
  const safePlanName = escapeHtml(planName);
  const safePlanPrice = escapeHtml(planPrice);
  const safePlanDays = escapeHtml(planDays);
  const safePlanHours = escapeHtml(planHours);
  const safePlanBenefits = planBenefits.map(escapeHtml);
  const safePlanIdeal = escapeHtml(planIdeal);
  const safeProformaCode = escapeHtml(proformaCode);
  const safeNota = nota ? escapeHtml(nota) : null;

  // Paleta Aluna — Verde Oscuro Elegante
  // Primary: #047857 (emerald-700)  Accent: #065F46 (emerald-800)  Light: #059669
  // BG light: #ECFDF5  BG mid: #D1FAE5  Border: #A7F3D0
  // Static glow: rgba(4,120,87,0.35)

  const benefitsList = safePlanBenefits.map(b => `
    <div style="margin:10px 0;line-height:1.5;">
      <span style="color:#059669;font-size:18px;margin-right:8px;vertical-align:top;">✦</span><span style="color:#374151;font-size:15px;line-height:1.5;">${b}</span>
    </div>`).join('');

  const waText = encodeURIComponent(`@aluna, el ${planName} es justo lo que necesito ¿Cuándo empiezo?`);
  const waComboText = encodeURIComponent(`@aluna, quiero el combo ${planName} + Oficina Virtual con descuento`);

  // Upsell solo para planes Hot Desk (Plan 10 y Plan 20)
  const isHotDeskPlan = planName && (planName.includes('Plan 10') || planName.includes('Plan 20'));
  const is20 = planName?.includes('Plan 20');
  const comboDiscount = is20 ? '15%' : '10%';
  // Precios mensuales con descuento aplicado (contrato anual)
  const planMonthlyBase  = is20 ? 99 : 67;
  const discountRate     = is20 ? 0.15 : 0.10;
  const planMonthlyNet   = Math.round(planMonthlyBase * (1 - discountRate));
  const ovMonthlyNet     = Math.round(365 * (1 - discountRate) / 12);
  const comboTotalMonthly = planMonthlyNet + ovMonthlyNet;

  const upsellSection = isHotDeskPlan ? `
  <!-- POTENCIA TU MEMBRESÍA -->
  <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:14px;padding:18px 16px;margin:22px 0;">
    <!-- Header compacto -->
    <div style="text-align:center;margin-bottom:12px;">
      <div style="background:#065F46;color:white;display:inline-block;padding:5px 14px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">${t.upsellHeader}</div>
      <div style="color:#111827;font-size:17px;font-weight:800;line-height:1.3;">${t.upsellTitle}</div>
      <div style="color:#047857;font-size:12px;font-weight:600;margin-top:3px;">${t.upsellSubtitle}</div>
    </div>
    <!-- Beneficios COMBO: plan + oficina virtual -->
    <div style="background:white;border:1px solid #D1FAE5;border-radius:10px;padding:10px 14px;margin-bottom:12px;">
      <!-- Label plan -->
      <div style="color:#047857;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;border-bottom:1px solid #D1FAE5;padding-bottom:4px;">✦ ${planName || 'Tu Plan'}</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        ${(() => {
          const rows = [];
          const items = safePlanBenefits.length > 0 ? safePlanBenefits : [];
          for (let i = 0; i < items.length; i += 2) {
            const pair = items.slice(i, i + 2);
            rows.push(`<tr>${pair.map(b => `<td style="width:50%;padding:3px 4px;vertical-align:top;"><div style="font-size:11px;color:#374151;line-height:1.4;"><span style="color:#059669;margin-right:4px;">✓</span>${b}</div></td>`).join(pair.length < 2 ? '<td></td>' : '')}</tr>`);
          }
          return rows.join('');
        })()}
      </table>
      <!-- Label oficina virtual -->
      <div style="color:#047857;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;border-bottom:1px solid #D1FAE5;padding-bottom:4px;">🏢 Oficina Virtual</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          ${[t.upsellBenefits[0], t.upsellBenefits[1]].map(b => `<td style="width:50%;padding:3px 4px;vertical-align:top;"><div style="font-size:11px;color:#374151;line-height:1.4;"><span style="color:#059669;margin-right:4px;">✓</span>${b}</div></td>`).join('')}
        </tr>
        <tr>
          ${[t.upsellBenefits[2], t.upsellBenefits[3]].map(b => `<td style="width:50%;padding:3px 4px;vertical-align:top;"><div style="font-size:11px;color:#374151;line-height:1.4;"><span style="color:#059669;margin-right:4px;">✓</span>${b}</div></td>`).join('')}
        </tr>
      </table>
    </div>
    <!-- Descuentos: dos tarjetas -->
    <div style="background:#FFFBEB;border:2px dashed #F59E0B;border-radius:10px;padding:10px 12px;margin-bottom:10px;">
      <div style="color:#D97706;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;margin-bottom:8px;">⚡ ${t.comboLabel}</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <tr>
          <td style="width:50%;padding:0 3px 0 0;vertical-align:top;">
            <div style="background:white;border:1px solid #FDE68A;border-radius:7px;padding:7px 8px;text-align:center;">
              <div style="color:#D97706;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Oficina Virtual</div>
              <div style="color:#DC2626;font-size:20px;font-weight:900;line-height:1;">${comboDiscount} OFF</div>
            </div>
          </td>
          <td style="width:50%;padding:0 0 0 3px;vertical-align:top;">
            <div style="background:white;border:1px solid #FDE68A;border-radius:7px;padding:7px 8px;text-align:center;">
              <div style="color:#D97706;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Plan Mensual</div>
              <div style="color:#DC2626;font-size:20px;font-weight:900;line-height:1;">${comboDiscount} OFF</div>
            </div>
          </td>
        </tr>
      </table>
      <!-- Desglose mensual -->
      <div style="background:white;border-radius:7px;padding:8px 12px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <tr>
            <td style="color:#6B7280;padding:3px 0;">Plan mensual c/dcto.</td>
            <td style="color:#111827;font-weight:700;text-align:right;padding:3px 0;">\$${planMonthlyNet}/mes</td>
          </tr>
          <tr>
            <td style="color:#6B7280;padding:3px 0;">Oficina Virtual c/dcto.</td>
            <td style="color:#111827;font-weight:700;text-align:right;padding:3px 0;">\$${ovMonthlyNet}/mes</td>
          </tr>
          <tr>
            <td style="color:#047857;font-weight:700;padding:5px 0 0;border-top:1px solid #E5E7EB;">Total mensual</td>
            <td style="color:#047857;font-size:16px;font-weight:900;text-align:right;padding:5px 0 0;border-top:1px solid #E5E7EB;">\$${comboTotalMonthly}/mes</td>
          </tr>
        </table>
        <div style="color:#9CA3AF;font-size:10px;text-align:center;margin-top:4px;">Cobro mensual · contrato anual</div>
      </div>
    </div>
    <div style="text-align:center;">
      <a href="https://wa.me/${coworkiaWhatsApp}?text=${waComboText}" style="background-color:#047857;background:linear-gradient(135deg,#047857,#065F46);color:white;padding:12px 28px;text-decoration:none;border-radius:22px;font-weight:600;display:inline-block;box-shadow:0 4px 12px rgba(4,120,87,0.35);font-size:14px;">${t.comboCTA}</a>
      <div style="color:#9CA3AF;font-size:11px;margin-top:6px;">${t.comboNote}</div>
    </div>
  </div>` : '';

  // ─── CUPONES EXCLUSIVOS ───────────────────────────────────────────────────────
  // Para añadir un cupón nuevo: agrega un objeto al array. El grid 2 col es automático.
  const cupones = [
    {
      icon: '🎉',
      discount: '30% OFF',
      titulo: 'Descuento primer mes',
      desc: 'Adquiere hoy y tu primer mes tiene 30% de descuento automático.',
      badge: 'Tiempo limitado',
    },
    {
      icon: '🚗',
      discount: '+$35/mes',
      titulo: 'Parqueadero Privado',
      desc: 'Subsuelo 2 del Edificio Finistere — espacio exclusivo para miembros.',
      badge: 'Disponible ahora',
    },
  ];
  const cuponesRows = [];
  for (let i = 0; i < cupones.length; i += 2) {
    const pair = cupones.slice(i, i + 2);
    cuponesRows.push(`<tr>${pair.map((c, j) => `
      <td style="width:50%;padding:${j === 0 ? '0 5px 10px 0' : '0 0 10px 5px'};vertical-align:top;">
        <div style="background:#F0FDF4;border:1.5px solid #6EE7B7;border-radius:12px;padding:16px 14px;text-align:center;">
          <div style="font-size:26px;margin-bottom:6px;">${c.icon}</div>
          <div style="background:#047857;color:white;font-size:13px;font-weight:900;padding:4px 12px;border-radius:20px;display:inline-block;margin-bottom:8px;">${c.discount}</div>
          <div style="color:#065F46;font-size:13px;font-weight:700;margin-bottom:4px;line-height:1.3;">${c.titulo}</div>
          <div style="color:#6B7280;font-size:11px;line-height:1.5;">${c.desc}</div>
          <div style="background:#DCFCE7;color:#166534;font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;display:inline-block;margin-top:8px;">${c.badge}</div>
        </div>
      </td>`).join('')}</tr>`);
  }
  const cuponesSection = `
  <!-- CUPONES EXCLUSIVOS -->
  <div style="margin:25px 0;">
    <div style="text-align:center;margin-bottom:14px;">
      <span style="background:#F0FDF4;border:1px solid #A7F3D0;border-radius:8px;padding:6px 16px;color:#065F46;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;display:inline-block;">🏷️ Cupones Exclusivos · Solo para ti</span>
    </div>
    <table style="width:100%;border-collapse:collapse;">${cuponesRows.join('')}</table>
  </div>`;

  const ecosistemaItems = ecosistemaTable({
    aliados: ['aurora', 'enzo', 'angela', 'axel', 'adriana', 'gabi', 'paula', 'custom'],
    theme: 'dark',
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Tu propuesta de membresía — Coworkia</title>
  <style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 0;">

  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

    <!-- Header Coworkia Verde Oscuro -->
    <div style="background-color:#047857;background:linear-gradient(135deg, #047857 0%, #065F46 100%); text-align: center; padding: 40px 20px 35px;">
      <!-- Logo texto simple -->
      <div style="color: white; font-size: 70px; font-weight: 700; margin-bottom: 8px; line-height: 0.9;">Coworkia</div>
      <div style="color: rgba(255,255,255,0.9); font-size: 12px; font-weight: 600; letter-spacing: 6px; text-transform: uppercase; margin-bottom: 30px;">
        BUSINESS CENTER
      </div>
      
      <!-- Tarjeta membresía preparada para —— diseño aprobado -->
      <div style="background:rgba(255,255,255,0.97);border-radius:16px;padding:24px 32px;display:inline-block;min-width:300px;text-align:left;box-shadow:0 4px 20px rgba(0,0,0,0.18);">
        <div style="color:#9CA3AF;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:14px;text-align:center;">${t.headerLabel}</div>
        <div style="color:#111827;font-size:26px;font-weight:800;margin-bottom:14px;text-align:center;">${safeClientName}</div>
        <div style="border-top:1px solid #E5E7EB;border-bottom:1px solid #E5E7EB;padding:12px 0;margin-bottom:12px;text-align:center;">
          <span style="font-size:18px;vertical-align:middle;">🎫</span>&nbsp;&nbsp;<strong style="color:#111827;font-size:16px;font-weight:700;vertical-align:middle;">${safePlanName}</strong>&nbsp;&nbsp;${proformaCode ? `<span style="background:#047857;color:white;font-size:11px;font-weight:700;padding:4px 10px;border-radius:6px;letter-spacing:0.5px;vertical-align:middle;">${safeProformaCode}</span>` : ''}
        </div>
        <div style="color:#047857;font-size:13px;font-weight:600;text-align:center;">${t.agentTag}</div>
      </div>
    </div>

    <div style="padding: 30px 30px 0;">

      <!-- Saludo -->
      <div style="text-align: center; margin-bottom: 25px;">
        <h2 style="color: #1f2937; font-size: 20px; margin: 0;">${t.greeting}, ${safeClientName}! ${t.greetingEnd}</h2>
        <p style="color: #6B7280; font-size: 15px; margin: 10px 0 0 0;">
          ${t.greetingBody}
        </p>
      </div>

      <!-- Card del Plan -->
      <div style="background: linear-gradient(135deg, rgba(4,120,87,0.08), rgba(6,95,70,0.12)); border-left: 4px solid #047857; border-radius: 12px; padding: 25px; margin: 25px 0; box-shadow: 0 2px 8px rgba(4,120,87,0.15);">
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;width:100%;">
          <tr>
            <td style="width:62px;vertical-align:middle;padding-right:14px;">
              <div style="background-color:#047857;background:linear-gradient(135deg,#047857,#065F46);border-radius:10px;width:48px;height:48px;text-align:center;line-height:48px;box-shadow:0 4px 12px rgba(4,120,87,0.3);">
                <span style="font-size:24px;">🎫</span>
              </div>
            </td>
            <td style="vertical-align:middle;">
              <div style="color:#047857;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">${t.membershipLabel}</div>
              <div style="color:#1f2937;font-size:24px;font-weight:800;line-height:1;">${safePlanName}</div>
            </td>
          </tr>
        </table>

        <!-- Precio destacado -->
        <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid rgba(4,120,87,0.2); margin-bottom: 15px; text-align: center; box-shadow: 0 2px 6px rgba(4,120,87,0.08);">
          <div style="color: #6B7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">${t.investmentLabel}</div>
          <div style="color: #047857; font-size: 36px; font-weight: 800; letter-spacing: -1px;">${safePlanPrice}</div>
        </div>

        <!-- Detalles -->
        <div style="background: white; border-radius: 10px; padding: 14px 18px; border: 1px solid rgba(4,120,87,0.15); margin-bottom: 10px;">
          <span style="color: #059669; font-size: 16px; margin-right: 8px;">📅</span>
          <span style="color: #374151; font-size: 15px; font-weight: 600;">${safePlanDays}</span>
        </div>

        ${planHours ? `
        <div style="background: white; border-radius: 10px; padding: 14px 18px; border: 1px solid rgba(4,120,87,0.15); margin-bottom: 10px;">
          <span style="color: #059669; font-size: 16px; margin-right: 8px;">⏱️</span>
          <span style="color: #374151; font-size: 15px; font-weight: 600;">${safePlanHours}</span>
        </div>` : ''}

        ${planIdeal ? `
        <div style="background: linear-gradient(135deg, rgba(4,120,87,0.06), rgba(5,150,105,0.06)); border-radius: 10px; padding: 14px 18px; border: 1px solid rgba(4,120,87,0.2);">
          <span style="color: #059669; font-size: 15px; margin-right: 8px;">🎯</span>
          <span style="color: #047857; font-size: 14px; font-weight: 600;">${t.idealLabel}</span>
          <span style="color: #374151; font-size: 14px;">${safePlanIdeal}</span>
        </div>` : ''}
      </div>

      <!-- Beneficios -->
      ${safePlanBenefits.length > 0 ? `
      <div style="margin-bottom: 25px;">
        <h3 style="color: #1f2937; font-size: 18px; font-weight: 700; margin: 0 0 15px 0;">${t.benefitsTitle}</h3>
        <div style="background: #F9FAFB; border-radius: 12px; padding: 20px; border: 1px solid #D1FAE5;">
          ${benefitsList}
        </div>
      </div>` : ''}

      <!-- Diferenciador IA -->
      <div style="background-color:#047857;background:linear-gradient(135deg, #047857, #065F46); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center; box-shadow: 0 4px 16px rgba(4,120,87,0.25);">
        <div style="color: rgba(255,255,255,0.8); font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px;">${t.aiSectionLabel}</div>
        <div style="color: white; font-size: 22px; font-weight: 800; margin-bottom: 10px;">${t.aiTitle}</div>
        <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0; line-height: 1.6;">${t.aiDesc}</p>
      </div>

      <!-- CTA WhatsApp -->
      <div style="text-align: center; margin: 25px 0;">
        <p style="color: #374151; font-size: 14px; margin: 5px 0 15px 0; font-weight: 600;">
          ${t.ctaTagline}
        </p>
        <a href="https://wa.me/${coworkiaWhatsApp}?text=${waText}"
           style="background-color:#047857;background:linear-gradient(135deg, #047857, #065F46); color: white; padding: 14px 32px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(4,120,87,0.35); font-size: 15px;">
          ${t.ctaButton}
        </a>
        <p style="color: #9CA3AF; font-size: 12px; margin: 12px 0 0 0;">${t.ctaNote}</p>
      </div>

      ${cuponesSection}

      ${upsellSection}

      <!-- Ubicación -->
      <div style="background:#ECFDF5;border-radius:12px;padding:16px;margin:25px 0;">
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          <tr>
            <td style="width:50%;vertical-align:middle;padding-right:8px;">
              <div style="background:white;border-radius:10px;padding:16px 18px;">
                <div style="color:#047857;font-size:15px;font-weight:700;margin-bottom:6px;">Coworkia</div>
                <div style="color:#6B7280;font-size:13px;line-height:1.7;">${LOCATION.addressFull}</div>
              </div>
            </td>
            <td style="width:50%;vertical-align:middle;padding-left:8px;text-align:center;">
              <div style="background:white;border-radius:10px;padding:16px 18px;text-align:center;">
                <a href="${LOCATION.mapsUrl}" style="background:#047857;color:white;padding:12px 18px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;font-size:13px;box-shadow:0 4px 10px rgba(4,120,87,0.3);">📍 Ver en Google Maps</a>
              </div>
            </td>
          </tr>
        </table>
      </div>

      ${nota ? `
      <div style="background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 12px; padding: 18px 20px; margin: 20px 0;">
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
          <tr>
            <td style="width:30px;vertical-align:top;padding-right:10px;padding-top:2px;"><span style="font-size:20px;">📝</span></td>
            <td style="vertical-align:top;">
              <div style="color:#92400E;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${t.noteTitle}</div>
    <div style="color:#78350F;font-size:14px;line-height:1.6;">${safeNota}</div>
            </td>
          </tr>
        </table>
      </div>` : ''}

    </div>

    <!-- ECOSISTEMA 8 AGENTES + FOOTER -->
    <div style="background-color:#0C0F14;background:linear-gradient(180deg,#0C0F14 0%,#0A0D12 100%);padding:36px 32px;text-align:center;">
      <div style="color:#4ECDC4;font-size:22px;font-weight:800;margin-bottom:12px;line-height:1.3;">${t.ecosistemaTitle}</div>
      <div style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.7;max-width:480px;margin:0 auto 28px;">${t.ecosistemaDesc}</div>
      <div style="margin-bottom:22px;">${ecosistemaItems}</div>
      <!-- texto conector -->
      <div style="margin-bottom:28px;padding:0 8px;">
        <p style="color:rgba(255,255,255,0.45);font-size:12px;line-height:1.8;margin:0;">Un solo ecosistema. Agentes especializados que se hablan entre sí.<br><strong style="color:rgba(255,255,255,0.75);">Haz clic en cualquier agente para hablar directamente por WhatsApp.</strong></p>
      </div>
      <!-- footer dentro del dark section -->
      <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:24px;margin-top:8px;">
        <div style="color:#4ECDC4;font-size:22px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;">Coworkia</div>
        <div style="color:rgba(255,255,255,0.35);font-size:10px;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">${t.footerTagline}</div>
        <div style="color:rgba(255,255,255,0.4);font-size:11px;line-height:1.8;">
          © 2026 Coworkia Ecuador — Espacios que inspiran<br>
          ${LOCATION.addressFull}<br>
          ${CONTACT.email} &nbsp;·&nbsp; ${CONTACT.phoneDisplay}
        </div>
      </div>
    </div>

  </div>
</body>
</html>`;
}

/**
 * 🔀 Dispatcher universal de emails por agente
 * Centraliza la generación de emails para todos los agentes.
 * @param {string} agentName - Nombre del agente (ALUNA, GABI, AXEL, ENZO, PAULA, ADRIANA)
 * @param {string} type - Tipo de email: 'admin' | 'client' | 'proforma'
 * @param {Object} data - Datos del email
 * @returns {{ subject: string, html: string }}
 */
// ─── ALUNA FOLLOW-UP TEMPLATES ────────────────────────────────────────────────
// Helper privado DRY: genera el header verde oscuro idéntico al de la proforma.
function _alunaEmailHeader(userName, badgeLabel) {
  return `
    <div style="background-color:#047857;background:linear-gradient(135deg,#047857 0%,#065F46 100%);text-align:center;padding:40px 20px 35px;">
      <div style="color:white;font-size:70px;font-weight:700;margin-bottom:8px;line-height:0.9;">Coworkia</div>
      <div style="color:rgba(255,255,255,0.9);font-size:12px;font-weight:600;letter-spacing:6px;text-transform:uppercase;margin-bottom:30px;">BUSINESS CENTER</div>
      <div style="background:rgba(255,255,255,0.97);border-radius:16px;padding:20px 32px;display:inline-block;min-width:280px;box-shadow:0 4px 20px rgba(0,0,0,0.18);">
        <div style="color:#9CA3AF;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px;">${badgeLabel}</div>
        <div style="color:#111827;font-size:22px;font-weight:800;">${userName}</div>
      </div>
    </div>`;
}

/**
 * 🔥 ALUNA — Follow-up 2 (24h): oferta 15% adicional, válida 7 días
 */
export function generateAlunaFollowup2HTML({ userName, membershipType, membershipCode, expiryDate }) {
  const firstName = (userName || 'Hola').split(' ')[0];
  const waText = encodeURIComponent(`@aluna, quiero el 15% adicional en ${membershipType || 'mi plan'} — ¿lo activamos?`);
  const proformaRef = membershipCode
    ? `<div style="background:#F0FDF4;border:1px solid #D1FAE5;border-radius:8px;padding:8px 14px;margin-bottom:16px;font-size:11px;color:#065F46;">Ref. proforma: <strong>${membershipCode}</strong></div>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Oferta especial — Coworkia</title><style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;margin:0;padding:0;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  ${_alunaEmailHeader(firstName, '· OFERTA ESPECIAL PARA TI ·')}
  <div style="padding:28px 30px 24px;">
    ${proformaRef}
    <p style="color:#111827;font-size:16px;font-weight:700;margin:0 0 6px 0;">¡Conseguí algo especial para ti, ${firstName}! 🔥</p>
    <p style="color:#6B7280;font-size:13px;line-height:1.6;margin:0 0 20px 0;">Hablé con el equipo y reservé un <strong style="color:#047857;">15% de descuento adicional</strong> sobre ${membershipType || 'el plan que cotizaste'}. Se suma al precio normal y tu tarifa queda congelada mientras seas miembro.</p>
    <div style="background:#ECFDF5;border-left:4px solid #047857;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
      <div style="color:#065F46;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">Tu oferta incluye</div>
      <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#059669;margin-right:8px;">✓</span>15% adicional sobre el precio del plan</div>
      <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#059669;margin-right:8px;">✓</span>Precio congelado de por vida como miembro</div>
      <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#059669;margin-right:8px;">✓</span>Garantía de devolución los primeros 15 días</div>
      <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#DC2626;margin-right:8px;">⏰</span>Oferta válida hasta el <strong>${expiryDate || '7 días desde hoy'}</strong></div>
    </div>
    <div style="text-align:center;margin-bottom:20px;">
      <a href="https://wa.me/593994837117?text=${waText}" style="background-color:#047857;background:linear-gradient(135deg,#047857,#065F46);color:white;padding:14px 36px;text-decoration:none;border-radius:25px;font-weight:700;display:inline-block;box-shadow:0 4px 14px rgba(4,120,87,0.4);font-size:15px;">🔥 Quiero mi 15% adicional</a>
      <div style="color:#9CA3AF;font-size:12px;margin-top:8px;">Respuesta en minutos · Abre WhatsApp directo con Aluna</div>
    </div>
    <div style="text-align:center;padding:16px;background:linear-gradient(135deg,rgba(4,120,87,0.08),rgba(6,95,70,0.12));border-radius:10px;">
      <p style="color:#9CA3AF;font-size:12px;margin:0;">Equipo Coworkia · Whymper 403, Edificio Finistere, Quito</p>
    </div>
  </div>
</div>
</body></html>`;
}

/**
 * ⏰ ALUNA — Follow-up 3 (7d): FOMO "último día"
 */
export function generateAlunaFollowup3HTML({ userName, membershipType, membershipCode }) {
  const firstName = (userName || 'Hola').split(' ')[0];
  const waText = encodeURIComponent(`@aluna, quiero activar ${membershipType || 'mi plan'} antes que venza la oferta`);
  const proformaRef = membershipCode
    ? `<div style="background:#F0FDF4;border:1px solid #D1FAE5;border-radius:8px;padding:8px 14px;margin-bottom:16px;font-size:11px;color:#065F46;">Ref. proforma: <strong>${membershipCode}</strong></div>`
    : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Última oportunidad — Coworkia</title><style>@media(prefers-color-scheme:dark){body{background-color:#f3f4f6!important}.em-wrap{background-color:#fff!important;color:#1f2937!important}}</style></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;margin:0;padding:0;">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
  ${_alunaEmailHeader(firstName, '· ÚLTIMO DÍA · OFERTA VENCE HOY ·')}
  <div style="padding:28px 30px 24px;">
    ${proformaRef}
    <p style="color:#DC2626;font-size:16px;font-weight:700;margin:0 0 6px 0;">${firstName}, hoy es el último día. ⏰</p>
    <p style="color:#6B7280;font-size:13px;line-height:1.6;margin:0 0 20px 0;">La oferta del 15% adicional sobre ${membershipType || 'tu plan'} vence hoy a medianoche. Después vuelve al precio normal sin excepciones.</p>
    <div style="background:#FEF2F2;border-left:4px solid #DC2626;border-radius:10px;padding:14px 18px;margin-bottom:14px;">
      <div style="color:#991B1B;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">Lo que dejas ir si no actúas hoy</div>
      <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#DC2626;margin-right:8px;">✗</span>El 15% de descuento adicional</div>
      <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#DC2626;margin-right:8px;">✗</span>Tu precio congelado de por vida</div>
      <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#DC2626;margin-right:8px;">✗</span>Los días productivos sin espacio fijo</div>
    </div>
    <div style="background:#ECFDF5;border-left:4px solid #047857;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
      <div style="color:#065F46;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">Lo que ganas activando ahora</div>
      <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#059669;margin-right:8px;">✓</span>Tu espacio separado desde mañana</div>
      <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#059669;margin-right:8px;">✓</span>Precio con el mejor descuento posible</div>
      <div style="color:#374151;font-size:13px;margin:5px 0;"><span style="color:#059669;margin-right:8px;">✓</span>Garantía: 15 días de devolución completa si no convence</div>
    </div>
    <div style="text-align:center;margin-bottom:20px;">
      <a href="https://wa.me/593994837117?text=${waText}" style="background-color:#DC2626;background:linear-gradient(135deg,#DC2626,#991B1B);color:white;padding:14px 36px;text-decoration:none;border-radius:25px;font-weight:700;display:inline-block;box-shadow:0 4px 14px rgba(220,38,38,0.4);font-size:15px;">⚡ Activar ahora — último día</a>
      <div style="color:#9CA3AF;font-size:12px;margin-top:8px;">En 10 minutos queda todo listo</div>
    </div>
    <div style="text-align:center;padding:16px;background-color:rgba(4,120,87,0.08);background:linear-gradient(135deg,rgba(4,120,87,0.08),rgba(6,95,70,0.12));border-radius:10px;">
      <p style="color:#9CA3AF;font-size:12px;margin:0;">Equipo Coworkia · Whymper 403, Edificio Finistere, Quito</p>
    </div>
  </div>
</div>
</body></html>`;
}

export function generateEmailForAgent(agentName, type, data) {
  const clientName = data.clientName || data.userName || 'Cliente';
  const lang = data.userLanguage || 'es';

  switch (agentName) {
    case 'ALUNA': {
      if (type === 'proforma') {
        return {
          subject: `Tu propuesta de ${data.planName} — Coworkia`,
          html: generateAlunaProformaHTML(data, lang)
        };
      }
      if (type === 'admin') {
        const adminHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; background:#f9fafb; padding: 24px;">
<div style="max-width:560px; margin:0 auto; background:white; border-radius:12px; padding:28px; border:1px solid #EDE9FE;">
<h2 style="color:#5B21B6; margin-top:0;">🎫 Nuevo Lead de Membresía</h2>
<table style="width:100%; font-size:14px; border-collapse:collapse;">
<tr><td style="padding:8px 0; color:#6B7280; font-weight:600; width:160px;">Nombre</td><td style="padding:8px 0; color:#1F2937;">${clientName}</td></tr>
<tr><td style="padding:8px 0; color:#6B7280; font-weight:600;">Membresía</td><td style="padding:8px 0; color:#1F2937;">${data.membershipType || '—'}</td></tr>
<tr><td style="padding:8px 0; color:#6B7280; font-weight:600;">Precio</td><td style="padding:8px 0; color:#5B21B6; font-weight:700;">${data.price || '—'}</td></tr>
<tr><td style="padding:8px 0; color:#6B7280; font-weight:600;">Email</td><td style="padding:8px 0; color:#1F2937;">${data.email || '—'}</td></tr>
<tr><td style="padding:8px 0; color:#6B7280; font-weight:600;">Teléfono</td><td style="padding:8px 0; color:#1F2937;">${data.phone || '—'}</td></tr>
<tr><td style="padding:8px 0; color:#6B7280; font-weight:600;">Inicio</td><td style="padding:8px 0; color:#1F2937;">${data.startDate || 'Flexible'}</td></tr>
<tr><td style="padding:8px 0; color:#6B7280; font-weight:600;">Notas</td><td style="padding:8px 0; color:#1F2937;">${data.specialRequirements || 'Ninguna'}</td></tr>
${data.leadId ? `<tr><td style="padding:8px 0; color:#6B7280; font-weight:600;">Ref. Lead</td><td style="padding:8px 0; color:#1F2937; font-family:monospace;">${data.leadId}</td></tr>` : ''}
${data.whatsappLink ? `<tr><td style="padding:8px 0; color:#6B7280; font-weight:600;">WhatsApp</td><td style="padding:8px 0;"><a href="${data.whatsappLink}" style="color:#7C3AED;">${data.whatsappLink}</a></td></tr>` : ''}
</table>
</div></body></html>`;
        return {
          subject: `🎫 Nuevo lead membresía: ${clientName} — ${data.membershipType || 'Plan'}`,
          html: adminHtml
        };
      }
      if (type === 'followup2') {
        const expiryDate = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'long' }); })();
        return {
          subject: `🔥 ${clientName.split(' ')[0]}, 15% adicional reservado para ti — vence en 7 días`,
          html: generateAlunaFollowup2HTML({ ...data, userName: clientName, expiryDate })
        };
      }
      if (type === 'followup3') {
        return {
          subject: `⏰ ${clientName.split(' ')[0]}, hoy es el último día — oferta cierra a medianoche`,
          html: generateAlunaFollowup3HTML({ ...data, userName: clientName })
        };
      }
      // type === 'client'
      return {
        subject: `✅ Solicitud de membresía confirmada — Coworkia`,
        html: generateAlunaEmailHTML({ ...data, userName: clientName }, lang)
      };
    }

    case 'GABI':
      return {
        subject: type === 'admin'
          ? `💼 Nueva consultoría: ${clientName} · ${data.consultationType}`
          : `Cotización 💼 ${data.consultationCode} — ${data.consultationType} · ${data.company || clientName} | Gabi - GR Consulting`,
        html: generateGabiEmailHTML({ ...data, userName: clientName }, lang)
      };

    case 'AXEL': {
      const vTitle = [data.vehicleBrand, data.vehicleModel].filter(Boolean).join(' ') || 'Vehículo';
      return {
        subject: `🚗 Cotización ${data.quoteCode || ''} — ${vTitle} · ${clientName} | Axel - The PaintBull`,
        html: generateAxelEmailHTML({
          customerName: clientName,
          vehicleData: { marca: data.vehicleBrand, modelo: data.vehicleModel, año: data.vehicleYear },
          damageAnalysis: data.damageAnalysis || { severity: 'MODERADO', affectedParts: [], hiddenDamageRisk: 'MEDIO' },
          quote: data.quoteDetails || null,
          priceRange: { min: data.priceMin || 0, max: data.priceMax || 0 },
          photoAssets: [],
          quoteCode: data.quoteCode || 'PB-XXXX',
          userLanguage: lang
        })
      };
    }

    case 'ENZO':
      return {
        subject: type === 'admin'
          ? `📊 Nueva propuesta marketing: ${clientName}`
          : `Cotización 🚀 ${data.leadId} — ${data.projectType} · ${data.companyName || clientName} | Enzo - MarketingLab`,
        html: generateEnzoEmailHTML({ ...data, userName: clientName }, { type: 'confirmation', userLanguage: lang })
      };

    case 'PAULA':
      return {
        subject: type === 'admin'
          ? `🏡 Nuevo lead inmobiliario: ${clientName}`
          : `✅ Búsqueda confirmada — El Morenal`,
        html: generatePaulaEmailHTML({ ...data, userName: clientName }, { userLanguage: lang })
      };

    case 'ADRIANA': {
      const vehicleDesc = [data.vehicleBrand, data.vehicleModel, data.vehicleYear].filter(Boolean).join(' ') || 'tu vehículo';
      const annualPremium = data.quotedPremium || 0;
      const monthlyPremium = Math.round(annualPremium / 12);
      return {
        subject: `🛡️ Cotización de Seguro — ${clientName} | ${vehicleDesc}`,
        html: buildEmailTemplate('ADRIANA', 'COMPARISON_V2', {
          nombre: clientName,
          marca: data.vehicleBrand || '',
          modelo: data.vehicleModel || '',
          anio: data.vehicleYear || '',
          placa: data.plate || '',
          valor_asegurado: data.commercialValue ? `$${Number(data.commercialValue).toLocaleString()}` : '',
          vaz_prima_anual: annualPremium ? `$${Number(annualPremium).toLocaleString()}` : '',
          vaz_prima_mensual: monthlyPremium ? `$${monthlyPremium}/mes` : '',
          vaz_deducible: '7%',
          analisis_broker: '',
          competitors: [],
        }),
      };
    }

    default:
      throw new Error(`[generateEmailForAgent] Agente desconocido: ${agentName}`);
  }
}
