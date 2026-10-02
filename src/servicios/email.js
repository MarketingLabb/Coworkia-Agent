// Sistema de Email para confirmaciones de reservas - Coworkia
// Envía emails profesionales con detalles de reserva

import { EMAIL_USER, getTransporter, getAdrianaTransporter, ADRIANA_FROM_EMAIL } from './mailer.js';
import { ecosistemaTable } from './email-ecosystem.js';
import { createCalendarEvent } from './google-calendar.js';
import { validateEmail, formatEmailError } from '../utils/email-validator.js';
import { getServiceLabel } from '../utils/service-labels.js';
import databaseService from '../database/database.js';
import { isBlocked, recordBounce, classifyEmailError } from './email-blocklist.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_FROM_EMAIL = EMAIL_USER || 'secretaria.coworkia@gmail.com';
const FORBIDDEN_AUTOMATIC_COPY_DOMAIN = '@diegovillota.com';

function isForbiddenAutomaticCopy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized.endsWith(FORBIDDEN_AUTOMATIC_COPY_DOMAIN)
    || normalized.endsWith(`${FORBIDDEN_AUTOMATIC_COPY_DOMAIN}>`);
}

export function sanitizeAutomaticCopies(recipients) {
  if (!recipients) return undefined;
  if (Array.isArray(recipients)) {
    const sanitized = recipients.flatMap(value => {
      const item = sanitizeAutomaticCopies(value);
      return Array.isArray(item) ? item : (item ? [item] : []);
    });
    return sanitized.length ? sanitized : undefined;
  }
  if (typeof recipients === 'object') {
    return isForbiddenAutomaticCopy(recipients.address)
      ? undefined
      : recipients;
  }

  const sanitized = String(recipients)
    .split(/[;,]/)
    .map(value => value.trim())
    .filter(Boolean)
    .filter(value => !isForbiddenAutomaticCopy(value));
  return sanitized.length ? sanitized.join(', ') : undefined;
}

/**
 * 📧 Devuelve el CC del admin coworkia (centralizado).
 * Usado por todos los agentes que necesitan copiar a Diego.
 * Configurable vía env COWORKIA_ADMIN_EMAIL. Devuelve '' si está vacío.
 */
export function getAdminCC() {
  const cc = (process.env.COWORKIA_ADMIN_EMAIL || 'coworkia.ec@gmail.com').trim();
  return sanitizeAutomaticCopies(cc) || '';
}

// Nombres de remitente personalizados por agente
const AGENT_FROM_NAMES = {
  aurora: 'Aurora • Reservas Coworkia Business Center',
  aluna: 'Aluna • Membresías Coworkia Business Center',
  enzo: 'Enzo • Estrategia Digital MarketingLab',
  axel: 'Axel • Reparación Automotriz PaintBull',
  gabi: 'Gabi • Asesoría Legal y Contable',
  adriana: 'Adriana • Directora SegPopular',
  paula: 'Paula · PropElite Bienes Raíces',
  _default: 'Coworkia Secretaría'
};

// 💰 PRECIOS REALES COWORKIA (Enero 2026)
const PRICING = {
  hotDesk: {
    base: 10.00,
    conTarjeta: 12.08, // +20.8% fee procesamiento Payphone
    descripcion: 'Hot Desk — 2 horas',
    incluye: 'WiFi + café ☕'
  },
  salaReuniones: {
    base: 29.00,
    conTarjeta: 35.03, // +20.8% fee procesamiento Payphone  
    descripcion: 'Sala Reuniones — 2 horas',
    incluye: 'Pizarra + TV + WiFi + café ☕'
  },
  primeraVisita: {
    base: 0.00,
    descripcion: 'Primera Visita GRATIS (8am-12pm)',
    incluye: 'Hot Desk + WiFi + café ☕'
  }
};

/**
 * 🔤 Formatea el tipo de servicio para mostrar en subject
 * @param {string} serviceType - "hotDesk" o "meetingRoom"
 * @returns {string} - "Hot Desk" o "Sala Reuniones"
 */
// formatServiceType — replaced by getServiceLabel from utils/service-labels.js
const formatServiceType = getServiceLabel;

/**
 * 🕐 Convierte hora 24h a 12h con am/pm
 * @param {string} time24 - "16:15" o "09:30"
 * @returns {string} - "4:15pm" o "9:30am"
 */
function formatTime12h(time24) {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const hours12 = hours % 12 || 12; // 0 -> 12, 13 -> 1, etc.
  return `${hours12}:${minutes.toString().padStart(2, '0')}${period}`;
}

/**
 * 🎨 Genera HTML template para email de confirmación (estilo actualizado)
 */
function generateConfirmationEmailHTML(reservationData) {
  const {
    userName,
    date,
    startTime,
    endTime,
    durationHours,
    serviceType,
    wasFree,
    totalPrice,
    reservation,
    paymentReceipt = null,
    wifiCode = null
  } = reservationData;

  const formatDate = new Date(date).toLocaleDateString('es-EC', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Sección de recibo de pago si existe
  const paymentReceiptSection = paymentReceipt ? `
    <div style="background: #f0fdf4; border: 1px solid #16a34a; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #15803d; margin-top: 0; display: flex; align-items: center;">
        ✅ <span style="margin-left: 8px;">Pago Confirmado</span>
      </h3>
      <div style="background: white; border-radius: 8px; padding: 15px; border: 1px solid #dcfce7;">
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 5px 0; color: #374151; font-weight: 500;">Método de pago:</td>
            <td style="padding: 5px 0; color: #6b7280;">${paymentReceipt.method || 'Transferencia/Payphone'}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #374151; font-weight: 500;">Referencia:</td>
            <td style="padding: 5px 0; color: #6b7280; font-family: monospace;">${paymentReceipt.reference || reservation.id}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #374151; font-weight: 500;">Monto:</td>
            <td style="padding: 5px 0; color: #6b7280; font-weight: 600;">$${paymentReceipt.amount || totalPrice} USD</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #374151; font-weight: 500;">Fecha de pago:</td>
            <td style="padding: 5px 0; color: #6b7280;">${paymentReceipt.date || new Date().toLocaleDateString('es-EC')}</td>
          </tr>
          ${paymentReceipt.bank ? `
          <tr>
            <td style="padding: 5px 0; color: #374151; font-weight: 500;">Banco:</td>
            <td style="padding: 5px 0; color: #6b7280;">${paymentReceipt.bank}</td>
          </tr>` : ''}
        </table>
      </div>
      <p style="color: #059669; font-size: 14px; margin: 10px 0 0 0;">
        💰 Tu pago ha sido verificado y procesado exitosamente.
      </p>
    </div>
  ` : '';

  // Solo Hot Desk puede ser gratis, sala de reuniones NUNCA
  const isActuallyFree = wasFree && serviceType === 'Hot Desk';
  
  // Si ya pagó (paymentReceipt existe), NO mostrar sección de pago
  const priceSection = paymentReceipt ? '' : (isActuallyFree ? `
    <div style="background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1)); border: 2px solid #4ECDC4; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center; box-shadow: 0 4px 12px rgba(78,205,196,0.2);">
      <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
        <span style="color: #4ECDC4; font-size: 28px; margin-right: 10px;">🎉</span>
        <h3 style="color: #374151; margin: 0; font-size: 20px; font-weight: 700;">¡2 Horas Gratis Confirmadas!</h3>
      </div>
      <p style="margin: 8px 0 0 0; color: #374151; font-size: 16px;">Esta es tu primera visita, disfruta 2 horas sin costo.</p>
    </div>
  ` : `
    <div style="background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.1)); border: 2px solid #F59E0B; border-radius: 12px; padding: 25px; margin: 25px 0;">
      <div style="display: flex; align-items: center; margin-bottom: 15px;">
        <span style="color: #F59E0B; font-size: 24px; margin-right: 10px;">💳</span>
        <h3 style="color: #374151; margin: 0; font-size: 18px; font-weight: 600;">Información de Pago</h3>
      </div>
      <div style="background: white; border-radius: 8px; padding: 20px; margin: 15px 0; border: 1px solid rgba(245,158,11,0.2);">
        <p style="margin: 0; color: #374151; font-size: 20px; font-weight: 600; text-align: center;">
          Total: <span style="color: #4ECDC4; font-size: 24px;">$${totalPrice} USD</span>
        </p>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
        <div style="background: white; border-radius: 8px; padding: 15px; border: 1px solid rgba(245,158,11,0.2);">
          <p style="margin: 0; color: #374151; font-weight: 600;">💳 Payphone</p>
          <a href="https://ppls.me/hnMI9yMRxbQ6rgIVi6L2DA" style="color: #4ECDC4; text-decoration: none; font-weight: 500;">Pagar aquí</a>
        </div>
        <div style="background: white; border-radius: 8px; padding: 15px; border: 1px solid rgba(245,158,11,0.2);">
          <p style="margin: 0; color: #374151; font-weight: 600;">🏦 Transferencia</p>
          <p style="margin: 5px 0 0 0; color: #374151; font-size: 13px;">Produbanco Ahorros<br>Cta: 20059783069<br>CI: 1702683499</p>
        </div>
      </div>
    </div>
  `);

  const ecosistemaItems = ecosistemaTable({
    aliados: ['aluna', 'enzo', 'angela', 'axel', 'adriana', 'gabi', 'paula', 'custom'],
    theme: 'dark',
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Reserva confirmada en Coworkia!</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 0;">
      
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header limpio con colores corporativos Coworkia -->
        <div style="background: linear-gradient(135deg, #5DE5DB 0%, #3B9177 100%); text-align: center; padding: 40px 20px 35px;">
          <!-- Logo texto simple -->
          <div style="color: white; font-size: 70px; font-weight: 700; margin-bottom: 8px; line-height: 0.9;">Coworkia</div>
          <div style="color: rgba(255,255,255,0.9); font-size: 12px; font-weight: 600; letter-spacing: 6px; text-transform: uppercase; margin-bottom: 30px;">
            BUSINESS CENTER
          </div>
          <div style="background: rgba(255,255,255,0.95); color: #374151; padding: 20px 30px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #374151;">✅ ¡Reserva Confirmada!</h1>
            <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 15px;">Tu espacio te está esperando</p>
          </div>
        </div>

        <div style="padding: 30px;">
          
          <!-- Saludo personalizado -->
          <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="color: #1f2937; font-size: 20px; margin: 0;">¡Perfecto, ${userName}! 👋</h2>
          </div>

          <!-- Detalles de la reserva -->
          <div style="background: linear-gradient(135deg, rgba(78,205,196,0.1), rgba(68,160,141,0.1)); border-left: 4px solid #4ECDC4; border-radius: 12px; padding: 25px; margin: 25px 0; box-shadow: 0 2px 8px rgba(78,205,196,0.1);">
            <h3 style="color: #374151; margin-top: 0; font-size: 18px; font-weight: 600;">📋 DETALLES DE TU RESERVA</h3>
            
            ${reservation?.id ? `
            <div style="background: white; border-radius: 8px; padding: 15px; margin: 0 0 15px 0; border: 1px solid rgba(78,205,196,0.3);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="color: #6B7280; font-size: 13px; font-weight: 500;">Código de Reserva:</span>
                <span style="color: #374151; font-weight: 700; font-size: 16px; font-family: 'Courier New', monospace; letter-spacing: 0.5px;">${reservation.id}</span>
              </div>
            </div>
            ` : ''}
            
            <div style="margin: 20px 0;">
              <div style="background: white; border-radius: 8px; padding: 15px; margin: 10px 0; border: 1px solid rgba(78,205,196,0.2);">
                <div style="display: flex; align-items: center;">
                  <span style="color: #4ECDC4; font-size: 20px; margin-right: 12px;">📅</span>
                  <span style="color: #374151; font-weight: 600; font-size: 16px;">${formatDate}</span>
                </div>
              </div>
              
              <div style="background: white; border-radius: 8px; padding: 15px; margin: 10px 0; border: 1px solid rgba(78,205,196,0.2);">
                <div style="display: flex; align-items: center;">
                  <span style="color: #4ECDC4; font-size: 20px; margin-right: 12px;">🕐</span>
                  <span style="color: #374151; font-weight: 600; font-size: 16px;">${startTime} - ${endTime}</span>
                </div>
              </div>
              
              <div style="background: white; border-radius: 8px; padding: 15px; margin: 10px 0; border: 1px solid rgba(78,205,196,0.2);">
                <div style="display: flex; align-items: center;">
                  <span style="color: #4ECDC4; font-size: 20px; margin-right: 12px;">🏢</span>
                  <span style="color: #374151; font-weight: 600; font-size: 16px;">${serviceType}</span>
                </div>
              </div>
            </div>
          </div>

          ${paymentReceiptSection}
          <div style="background: linear-gradient(135deg, rgba(78,205,196,0.08), rgba(68,160,141,0.08)); border: 2px solid #4ECDC4; border-radius: 12px; padding: 28px; margin: 25px 0;">
            <h3 style="color: #374151; margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">📶 Acceso WiFi Incluido</h3>
            <div style="background: white; border-radius: 10px; padding: 20px; border: 1px solid rgba(78,205,196,0.2);">
              <p style="color: #374151; font-size: 14px; line-height: 1.8; margin: 0 0 18px 0;">
                <strong style="color: #4ECDC4;">Paso 1:</strong> Selecciona la red WiFi <strong>📡 Coworkia WiFi</strong>
              </p>
              <p style="color: #374151; font-size: 14px; line-height: 1.8; margin: 0 0 18px 0;">
                <strong style="color: #4ECDC4;">Paso 2:</strong> Digita la contraseña de acceso <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 15px; color: #1f2937;">12345678</code>
              </p>
              <p style="color: #374151; font-size: 14px; line-height: 1.8; margin: 0 0 18px 0;">
                <strong style="color: #4ECDC4;">Paso 3:</strong> Cuando se te solicite, escribe tu código personal:
              </p>
              ${wifiCode ? `
              <div style="text-align: center; margin: 20px 0;">
                <div style="display: inline-block; background: linear-gradient(135deg, #4ECDC4, #44A08D); padding: 16px 28px; border-radius: 10px; box-shadow: 0 4px 16px rgba(78,205,196,0.35);">
                  <div style="color: white; font-family: 'Courier New', Consolas, monospace; font-size: 26px; font-weight: bold; letter-spacing: 3px;">${wifiCode}</div>
                </div>
              </div>
              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 6px; margin-top: 20px;">
                <p style="color: #92400e; font-size: 13px; line-height: 1.6; margin: 0;">
                  ⏰ <strong>Válido:</strong> ${formatDate} de ${startTime} a ${endTime}<br>
                  💡 <strong>Importante:</strong> Tu código funciona solo durante el horario de tu reserva.
                </p>
              </div>` : `
              <div style="text-align: center; margin: 20px 0;">
                <div style="background: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 10px; padding: 20px 28px;">
                  <p style="color: #6b7280; font-size: 14px; font-weight: 600; margin: 0 0 6px 0;">🔒 Código aún no disponible</p>
                  <p style="color: #9ca3af; font-size: 13px; margin: 0; line-height: 1.6;">Tu código WiFi personal se activa al completar<br>el <strong style="color: #374151;">pago en efectivo</strong> directamente en Coworkia.</p>
                </div>
              </div>`}
            </div>
          </div>
          ${priceSection}

          <!-- Ubicación (2 columnas) -->
          <div style="background: linear-gradient(135deg, rgba(55,65,81,0.05), rgba(55,65,81,0.1)); border-radius: 12px; padding: 25px; margin: 25px 0; border: 2px solid rgba(78,205,196,0.2);">
            <h3 style="color: #374151; margin-top: 0; margin-bottom: 18px; font-size: 18px; font-weight: 600;">📍 UBICACIÓN</h3>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="48%" valign="top" style="padding-right:8px;">
                  <div style="background: white; border-radius: 8px; padding: 18px; height: 120px;">
                    <p style="margin: 0 0 10px 0; color: #4ECDC4; font-weight: 700; font-size: 17px;">Coworkia</p>
                    <p style="margin: 5px 0; color: #374151; font-weight: 500; font-size: 14px;">Edificio Finistere - Planta Baja</p>
                    <p style="margin: 5px 0; color: #6B7280; font-size: 13px;">Whymper 403, Quito</p>
                  </div>
                </td>
                <td width="4%"></td>
                <td width="48%" valign="top" style="padding-left:8px;">
                  <div style="background: white; border-radius: 8px; padding: 18px; height: 120px; display: flex; align-items: center; justify-content: center;">
                    <a href="https://goo.gl/maps/9GD83LV3XRf23XK59" 
                       style="background: linear-gradient(135deg, #4ECDC4, #44A08D); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(78,205,196,0.35); font-size: 14px;">
                      📍 Ver en Google Maps
                    </a>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <!-- Advertencia importante -->
          <div style="background: linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.1)); border: 2px solid #F59E0B; border-radius: 12px; padding: 20px; margin: 25px 0;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <span style="color: #F59E0B; font-size: 24px; margin-right: 10px;">⚠️</span>
              <h4 style="color: #374151; margin: 0; font-size: 16px; font-weight: 600;">IMPORTANTE - Llegada tardía</h4>
            </div>
            <p style="color: #374151; font-size: 14px; margin: 5px 0; line-height: 1.6;">
              El tiempo regular de espera es de <strong>10 minutos</strong>. Si llegarás más tarde, avísanos para mantener tu espacio reservado.
            </p>
          </div>

          <!-- Lo que te espera -->
          <div style="background: rgba(78,205,196,0.05); border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #374151; font-size: 18px; margin-bottom: 15px; font-weight: 600;">🌟 Lo que te espera:</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div style="background: white; border-radius: 8px; padding: 15px; border: 1px solid rgba(78,205,196,0.2);">
                <span style="color: #4ECDC4; font-size: 18px; margin-right: 8px;">☕</span>
                <span style="color: #374151; font-weight: 500;">Café ilimitado</span>
              </div>
              <div style="background: white; border-radius: 8px; padding: 15px; border: 1px solid rgba(78,205,196,0.2);">
                <span style="color: #4ECDC4; font-size: 18px; margin-right: 8px;">🌐</span>
                <span style="color: #374151; font-weight: 500;">Internet de alta velocidad</span>
              </div>
              <div style="background: white; border-radius: 8px; padding: 15px; border: 1px solid rgba(78,205,196,0.2);">
                <span style="color: #4ECDC4; font-size: 18px; margin-right: 8px;">🖥️</span>
                <span style="color: #374151; font-weight: 500;">Espacios cómodos y modernos</span>
              </div>
              <div style="background: white; border-radius: 8px; padding: 15px; border: 1px solid rgba(78,205,196,0.2);">
                <span style="color: #4ECDC4; font-size: 18px; margin-right: 8px;">🤝</span>
                <span style="color: #374151; font-weight: 500;">Ambiente colaborativo</span>
              </div>
            </div>
          </div>

          <!-- Contacto -->
          <div style="text-align: center; margin: 25px 0;">
            <p style="color: #6b7280; font-size: 14px; margin: 5px 0 15px 0;">
              💬 ¿Tienes dudas sobre tu reserva?
            </p>
            <a href="https://wa.me/593994837117?text=%40aurora%2C%20recib%C3%AD%20tu%20correo%20y%20tengo%20dudas%20sobre%20mi%20reserva%20en%20Coworkia" 
               style="background: linear-gradient(135deg, #25D366, #128C7E); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; display: inline-block; box-shadow: 0 4px 12px rgba(37,211,102,0.3); font-size: 14px;">
              📱 Habla con Aurora por WhatsApp
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0 0;">
              Estoy aquí para ayudarte con cualquier cambio o pregunta 😊
            </p>
          </div>

          <!-- Footer -->
          <div style="background: linear-gradient(135deg, #5DE5DB 0%, #3B9177 100%); text-align: center; padding: 30px 20px; border-radius: 12px;">
            <div style="color: white; font-size: 70px; font-weight: 700; margin-bottom: 8px; line-height: 0.9;">Coworkia</div>
            <div style="color: rgba(255,255,255,0.9); font-size: 12px; font-weight: 600; letter-spacing: 6px; text-transform: uppercase; margin-bottom: 18px;">
              BUSINESS CENTER
            </div>
            <p style="color: rgba(255,255,255,0.95); font-size: 15px; font-weight: 600; margin: 0;">¡Nos vemos pronto! 🚀</p>
            <p style="color: rgba(255,255,255,0.85); font-size: 13px; margin: 4px 0 0 0;">Aurora ✨ - Tu asistente de Coworkia</p>
          </div>

        </div>
      </div>

      <!-- ECOSISTEMA DE AGENTES -->
      <div style="background:linear-gradient(180deg,#12121a 0%,#0d0d12 100%);padding:40px 24px 36px;text-align:center;border-top:3px solid #4ECDC4;">
        <div style="max-width:480px;margin:0 auto 28px;">
          <h2 style="color:#4ECDC4;font-size:22px;font-weight:700;line-height:1.3;margin:0 0 12px;letter-spacing:-0.5px;">Tu próximo equipo no se contrata. Se activa.</h2>
          <p style="color:rgba(255,255,255,0.7);font-size:13px;line-height:1.7;margin:0;">OneMind conecta agentes especializados, memoria operativa y automatización inteligente para atender, vender, coordinar y ejecutar procesos empresariales <strong style="color:rgba(255,255,255,0.9);">24/7</strong> — sin turnos, sin tiempos de espera, sin límites.</p>
        </div>
        <div style="margin-bottom:22px;">${ecosistemaItems}</div>
        <div style="background:rgba(78,205,196,0.06);border:1px solid rgba(78,205,196,0.12);border-radius:10px;padding:14px;">
          <p style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.8;margin:0;">
            Un solo ecosistema. Agentes especializados que se hablan entre sí.<br>
            <strong style="color:rgba(255,255,255,0.8);">Haz clic en cualquier agente para hablar directamente por WhatsApp.</strong>
          </p>
        </div>
      </div>

      <!-- Footer externo limpio -->
      <div style="text-align: center; padding: 30px 20px; background: #374151; color: #9CA3AF;">
        <!-- Solo texto elegante, sin logos -->
        <div style="color: #4ECDC4; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 2px;">
          Coworkia
        </div>
        <div style="color: #9CA3AF; font-size: 14px; font-weight: 400; letter-spacing: 1px; margin-bottom: 20px;">
          work · connect · grow
        </div>
        <div style="color: #6B7280; font-size: 12px; line-height: 1.6;">
          © 2025 Coworkia Ecuador - Espacios que inspiran<br>
          Whymper 403, Edificio Finistere - Planta Baja, Quito
        </div>
      </div>
    </body>
    </html>
  `;
}

// 🗑️ REMOVIDO: processPaymentReceipt stub (versión real está en payment-receipts.js)

/**
 * �📧 Envía email de confirmación de reserva
 */
/**
 * 📧 Función genérica para enviar emails HTML
 * Útil para cotizaciones de Axel y otros casos personalizados
 */

// ─── Anti-spam helpers ────────────────────────────────────────────────────────
/**
 * Convierte HTML de email a texto plano (text/plain fallback).
 * Los filtros de spam penalizan emails sin versión text/plain.
 */
function htmlToPlainText(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Minifica HTML de email — elimina comentarios y colapsa whitespace entre tags.
 * Reduce el tamaño del email y mejora el score anti-spam (HTML muy pesado es flag).
 */
function minifyEmailHTML(html) {
  return html
    // Eliminar comentarios HTML (excepto condicionales de Outlook <!--[if ...]-->)
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    // Colapsar whitespace entre tags
    .replace(/>\s{2,}</g, '><')
    .trim();
}

/**
 * 📱 Detecta si el User-Agent corresponde a un dispositivo problemático con dark mode
 * @param {string} userAgent — User-Agent string desde HTTP headers (Wassenger webhook)
 * @returns {boolean} — true si es Xiaomi/Honor/MIUI, false en caso contrario
 * 
 * Xiaomi/MIUI y Honor/Magic UI ignoran @media (prefers-color-scheme: dark) y aplican sus propios estilos.
 * Cuando detectemos estos dispositivos, enviamos emails con xiaomiSafe=true (sin dark CSS).
 */
export function isXiaomiDevice(userAgent = '') {
  if (!userAgent) return false;
  const problematicPatterns = [
    /xiaomi/i,      // Xiaomi genérico
    /miui/i,        // ROM MIUI Browser
    /redmi/i,       // Redmi (submarca Xiaomi)
    /mi \d+/i,      // Mi 10, Mi 11, Mi 12, etc
    /poco/i,        // POCO (submarca gaming Xiaomi)
    /honor/i,       // Honor (ex-Huawei, usa Magic UI)
    /magicui/i      // Magic UI (ROM Honor)
  ];
  return problematicPatterns.some(pattern => pattern.test(userAgent));
}

export async function sendEmail({ to, subject, html, text, from, cc, bcc, attachments, agent, refId }) {
  try {
    console.log(`[EMAIL] 📧 Enviando email genérico a: ${to}`);
    console.log(`[EMAIL] 📋 Asunto: ${subject}`);

    // 🚫 BLOCKLIST: cortar antes de gastar SMTP si el destinatario está marcado como rebotador
    const primaryRecipient = Array.isArray(to) ? to[0] : to;
    if (primaryRecipient) {
      const block = await isBlocked(primaryRecipient);
      if (block.blocked) {
        console.warn(`[EMAIL] 🚫 Destinatario en blocklist: ${primaryRecipient} (${block.reason}, count=${block.bounce_count})`);
        return {
          success: false,
          skipped: true,
          blocked: true,
          reason: block.reason,
          error: `Recipient is in email blocklist (${block.reason})`
        };
      }
    }

    // Detectar si es email de Adriana para usar transporter dedicado
    const isAdriana = agent === 'adriana' || 
      (typeof from === 'object' && from?.name?.toLowerCase().includes('adriana')) ||
      (typeof from === 'string' && from.toLowerCase().includes('adriana'));
    
    const transporter = isAdriana 
      ? await getAdrianaTransporter() 
      : await getTransporter();
    
    if (!transporter) {
      console.error('[EMAIL] ❌ No se pudo crear transportador');
      return { success: false, error: 'Email transporter not configured' };
    }
    
    // Normalizar from: puede ser string o { name, address } object
    let fromAddress;
    if (typeof from === 'object' && from !== null && from.address) {
      fromAddress = from.name ? `"${from.name}" <${from.address}>` : from.address;
    } else if (from) {
      fromAddress = from;
    } else if (agent && AGENT_FROM_NAMES[agent]) {
      fromAddress = `"${AGENT_FROM_NAMES[agent]}" <${DEFAULT_FROM_EMAIL}>`;
    } else {
      fromAddress = `"${AGENT_FROM_NAMES._default}" <${DEFAULT_FROM_EMAIL}>`;
    }
    
    const processedHtml = html ? minifyEmailHTML(html) : html;

    // Detectar agente desde FROM name si no viene explícito
    const detectedAgent = agent || detectAgentFromFrom(fromAddress);
    
    // Generar Message-ID con tracking del agente
    const trackingId = `coworkia-${detectedAgent}-${refId || Date.now()}-${Math.random().toString(36).substr(2, 6)}@coworkia.ec`;

    const mailOptions = {
      from: fromAddress,
      to: to,
      cc: sanitizeAutomaticCopies(cc),
      bcc: sanitizeAutomaticCopies(bcc),
      subject: subject,
      html: processedHtml,
      text: text || (html ? htmlToPlainText(html) : undefined),
      attachments,
      messageId: trackingId,
      headers: {
        'X-Mailer': 'Coworkia Agent v2.0',
        'X-Priority': '3',
        'X-Auto-Response-Suppress': 'All',
        'X-Coworkia-Agent': detectedAgent,
        'X-Coworkia-Ref': refId || '',
      }
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] ✅ Email enviado: ${info.messageId} (agent: ${detectedAgent})`);
    
    // Log to email_sent_log for multi-agent reply isolation
    try {
      await databaseService.initialize();
      await databaseService.run(`
        INSERT INTO email_sent_log (message_id, agent, entity_type, entity_id, to_email, subject, user_phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        trackingId,
        detectedAgent,
        refId ? 'reservation' : null,
        refId || null,
        to,
        subject,
        null
      ]);
    } catch (logErr) {
      // Never block email delivery for logging failure
      console.warn('[EMAIL] ⚠️ Failed to log sent email:', logErr.message);
    }
    
    return { success: true, messageId: info.messageId, trackingId };
    
  } catch (error) {
    console.error('[EMAIL] ❌ Error enviando email:', error);

    // 📥 BOUNCE HANDLER: clasificar el error y registrar en blocklist si aplica
    try {
      const classification = classifyEmailError(error);
      if (classification.type === 'hard_bounce' || classification.type === 'soft_bounce') {
        const recipient = Array.isArray(to) ? to[0] : to;
        if (recipient) {
          await recordBounce(recipient, {
            reason: classification.type,
            lastError: `${classification.reason || ''}: ${error.message || ''}`.slice(0, 500),
            agent: agent || null
          });
        }
      }
    } catch (bounceErr) {
      console.warn('[EMAIL] ⚠️ No se pudo registrar bounce:', bounceErr.message);
    }

    return { success: false, error: error.message };
  }
}

/**
 * 🔍 Detecta el agente desde el FROM address/name
 */
function detectAgentFromFrom(fromStr) {
  if (!fromStr) return 'system';
  const lower = fromStr.toLowerCase();
  for (const agent of Object.keys(AGENT_FROM_NAMES)) {
    if (agent === '_default') continue;
    if (lower.includes(agent)) return agent;
  }
  return 'system';
}

export async function sendReservationConfirmation(reservationData) {
  console.log('[EMAIL] 🚀 Iniciando envío de confirmación de reserva...');
  const transporter = await getTransporter();
  
  if (!transporter) {
    console.error('[EMAIL] ❌ No se pudo crear el transportador de email');
    return {
      success: false,
      error: 'Configuración de email no disponible'
    };
  }

  const {
    email,
    userName,
    date,
    startTime,
    serviceType,
    wasFree
  } = reservationData;

  if (!email) {
    return {
      success: false,
      error: 'Email del usuario no proporcionado'
    };
  }
  
  // ✅ Validar email antes de enviar
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    const errorMsg = formatEmailError(emailValidation);
    console.error(`[EMAIL] ❌ Email inválido detectado: ${email}`);
    console.error(`[EMAIL] ${errorMsg}`);
    return {
      success: false,
      error: `Email inválido: ${emailValidation.error}`
    };
  }
  
  // ⚠️ Warning si hay sugerencia
  if (emailValidation.warning) {
    console.warn(`[EMAIL] ⚠️ Email sospechoso: ${email} - ${emailValidation.warning}`);
  }

  const emailHTML = generateConfirmationEmailHTML(reservationData);
  
  // Formatear subject para que sea conciso y legible
  const serviceName = formatServiceType(serviceType);
  const timeFormatted = formatTime12h(startTime);
  
  const mailOptions = {
    from: {
      name: AGENT_FROM_NAMES.aurora || AGENT_FROM_NAMES._default,
      address: DEFAULT_FROM_EMAIL
    },
    to: [email],
    cc: getAdminCC(), // Copia al administrador (centralizado vía COWORKIA_ADMIN_EMAIL)
    subject: `✅ Reserva Confirmada - ${serviceName} Coworkia desde ${timeFormatted}`,
    html: emailHTML,
    text: `
Hola ${userName},

Tu reserva en Coworkia ha sido confirmada:

📅 Fecha: ${date}
🕐 Horario: ${startTime}
🏢 Servicio: ${serviceType}
${wasFree ? '🎉 2 horas gratis confirmadas!' : '💳 Recuerda realizar el pago'}

Ubicación: Edificio Finistere - Planta Baja, Whymper 403, Quito
https://goo.gl/maps/9GD83LV3XRf23XK59

¿Preguntas? WhatsApp: +593 99 483 7117

¡Te esperamos!
Equipo Coworkia
    `.trim()
  };

  try {
    console.log(`[EMAIL] 📤 Enviando confirmación a ${email}...`);

    // 🚫 BLOCKLIST guard
    const block = await isBlocked(email);
    if (block.blocked) {
      console.warn(`[EMAIL] 🚫 Aurora confirmation skipped — destinatario en blocklist: ${email} (${block.reason})`);
      return { success: false, skipped: true, blocked: true, reason: block.reason };
    }
    console.log('[EMAIL] 📋 Configuración del email:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      hasHtml: !!mailOptions.html,
      hasText: !!mailOptions.text
    });
    
    const result = await transporter.sendMail(mailOptions);
    
    console.log(`[EMAIL] ✅ Email enviado exitosamente!`);
    console.log('[EMAIL] 📊 Detalles del resultado:', {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      pending: result.pending,
      response: result.response
    });
    
    // Verificar si hay destinatarios rechazados
    if (result.rejected && result.rejected.length > 0) {
      console.warn('[EMAIL] ⚠️ Algunos destinatarios fueron rechazados:', result.rejected);
    }
    
    // 📅 CREAR EVENTO EN GOOGLE CALENDAR AUTOMÁTICAMENTE
    // ⚠️ NOTA: El evento de Google Calendar se crea desde confirmation-flow.js
    // NO duplicar la creación aquí para evitar eventos múltiples
    
    return {
      success: true,
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      message: 'Email de confirmación enviado exitosamente'
    };
    
  } catch (error) {
    console.error('[EMAIL] ❌ Error enviando email:', error.message);
    console.error('[EMAIL] 📜 Tipo de error:', error.name);
    console.error('[EMAIL] 🔍 Código de error:', error.code);
    console.error('[EMAIL] 📋 Stack trace:', error.stack);
    try {
      const c = classifyEmailError(error);
      if (c.type === 'hard_bounce' || c.type === 'soft_bounce') {
        await recordBounce(email, { reason: c.type, lastError: `${c.reason || ''}: ${error.message || ''}`.slice(0, 500), agent: 'aurora' });
      }
    } catch (_) {}
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 📧 Envía email de recordatorio (24h antes)
 */
export async function sendReservationReminder(reservationData) {
  const transporter = await getTransporter();
  
  if (!transporter) {
    return { success: false, error: 'Configuración de email no disponible' };
  }

  const {
    email,
    userName,
    date,
    startTime,
    serviceType
  } = reservationData;

  const serviceName = formatServiceType(serviceType);
  const timeFormatted = formatTime12h(startTime);

  const mailOptions = {
    from: {
      name: 'Coworkia',
      address: DEFAULT_FROM_EMAIL
    },
    to: email,
    subject: `🔔 Recordatorio - Tu ${serviceName} mañana a las ${timeFormatted}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4a90e2;">🔔 Recordatorio de Reserva</h2>
        <p>Hola <strong>${userName}</strong>,</p>
        <p>Te recordamos que tienes una reserva <strong>mañana</strong>:</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>📅 Fecha:</strong> ${date}</p>
          <p><strong>🕐 Horario:</strong> ${startTime}</p>
          <p><strong>🏢 Servicio:</strong> ${serviceType}</p>
        </div>
        
        <p><strong>📍 Ubicación:</strong> Edificio Finistere - Planta Baja, Whymper 403, Quito</p>
        <p>¡Te esperamos!</p>
        
        <p style="color: #666; font-size: 14px;">Equipo Coworkia</p>
      </div>
    `,
    text: `
Hola ${userName},

Recordatorio: Tienes una reserva mañana en Coworkia
📅 ${date} a las ${startTime}
🏢 ${serviceType}

Ubicación: Edificio Finistere - Planta Baja, Whymper 403, Quito

¡Te esperamos!
Equipo Coworkia
    `.trim()
  };

  try {
    const block = await isBlocked(email);
    if (block.blocked) {
      console.warn(`[EMAIL] 🚫 Reminder skipped — destinatario en blocklist: ${email} (${block.reason})`);
      return { success: false, skipped: true, blocked: true, reason: block.reason };
    }
    const result = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] 🔔 Recordatorio enviado a ${email}`);
    return {
      success: true,
      messageId: result.messageId
    };
  } catch (error) {
    console.error('[EMAIL] Error enviando recordatorio:', error);
    try {
      const c = classifyEmailError(error);
      if (c.type === 'hard_bounce' || c.type === 'soft_bounce') {
        await recordBounce(email, { reason: c.type, lastError: `${c.reason || ''}: ${error.message || ''}`.slice(0, 500), agent: 'aurora' });
      }
    } catch (_) {}
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 💳 Envía email de confirmación de pago
 */
export async function sendPaymentConfirmationEmail(userEmail, userName, reservationData) {
  console.log('[EMAIL] 🚀 Iniciando envío de confirmación de pago');
  console.log('[EMAIL] - Destinatario:', userEmail ? 'Configurado' : 'No configurado');
  console.log('[EMAIL] - Usuario:', userName ? 'Sí' : 'No');
  console.log('[EMAIL] - Datos reserva: [SANITIZED]');
  
  const transporter = await getTransporter();
  if (!transporter) {
    console.error('[EMAIL] ❌ Transportador no configurado');
    return { success: false, error: 'Email no configurado' };
  }
  
  console.log('[EMAIL] ✅ Transportador creado exitosamente');

  const { paymentData } = reservationData;
  
  // Generar link de Google Calendar
  const calendarLink = generateGoogleCalendarLink(reservationData);
  
  const emailHtml = generatePaymentConfirmationHTML({
    userName,
    ...reservationData,
    paymentData,
    calendarLink
  });
  
  console.log('[EMAIL] ✅ HTML del email generado');

  const emailOptions = {
    from: `"Coworkia" <${DEFAULT_FROM_EMAIL}>`,
    to: userEmail,
    subject: `✅ Pago Confirmado - Reserva ${reservationData.date}`,
    html: emailHtml,
    text: `¡Pago confirmado! Tu reserva para ${reservationData.date} está lista. Referencia: ${paymentData?.transactionNumber}`
  };
  
  console.log('[EMAIL] 📧 Configuración de email:', {
    from: emailOptions.from,
    to: emailOptions.to,
    subject: emailOptions.subject
  });

  try {
    console.log('[EMAIL] 📤 Enviando email...');
    const block = await isBlocked(userEmail);
    if (block.blocked) {
      console.warn(`[EMAIL] 🚫 Payment confirmation skipped — destinatario en blocklist: ${userEmail} (${block.reason})`);
      return { success: false, skipped: true, blocked: true, reason: block.reason };
    }
    const info = await transporter.sendMail(emailOptions);
    console.log('[EMAIL] ✅ Email enviado exitosamente. ID:', info.messageId);
    console.log('[EMAIL] 📊 Info completa:', info);
    
    // 📅 CREAR EVENTO EN GOOGLE CALENDAR AUTOMÁTICAMENTE
    console.log('[EMAIL] 📅 Creando evento en Google Calendar...');
    const calendarResult = await createCalendarEvent({
      userName,
      email: userEmail,
      date: reservationData.date,
      startTime: reservationData.startTime,
      endTime: reservationData.endTime,
      serviceType: reservationData.serviceType || 'Hot Desk',
      duration: reservationData.durationHours ? `${reservationData.durationHours} horas` : '2 horas',
      price: reservationData.total,
      hotDeskNumber: reservationData.reservation?.hot_desk_number || reservationData.hotDeskNumber || null,
      hotDeskNumbers: reservationData.reservation?.hot_desk_numbers || reservationData.hotDeskNumbers || null
    });
    
    if (calendarResult.success) {
      console.log('[EMAIL] ✅ Evento de calendario creado exitosamente!');
      console.log('[EMAIL] 🔗 URL del evento:', calendarResult.eventUrl);
    } else {
      console.error('[EMAIL] ⚠️ No se pudo crear evento de calendario:', calendarResult.error);
    }
    
    return {
      success: true,
      messageId: info.messageId,
      email: userEmail,
      calendarEvent: calendarResult // Incluir resultado del calendario
    };
  } catch (error) {
    console.error('[EMAIL] ❌ ERROR enviando confirmación de pago:', error.message);
    console.error('[EMAIL] 📜 Stack trace completo:', error.stack);
    console.error('[EMAIL] 🔍 Tipo de error:', error.name);
    console.error('[EMAIL] 📋 Código de error:', error.code);
    try {
      const c = classifyEmailError(error);
      if (c.type === 'hard_bounce' || c.type === 'soft_bounce') {
        await recordBounce(userEmail, { reason: c.type, lastError: `${c.reason || ''}: ${error.message || ''}`.slice(0, 500), agent: 'aurora' });
      }
    } catch (_) {}
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 🎨 Template HTML para confirmación de pago
 */
function generatePaymentConfirmationHTML(data) {
  const {
    userName,
    date,
    startTime,
    endTime,
    durationHours,
    serviceType,
    total,
    paymentData
  } = data;

  const serviceName = serviceType === 'hotDesk' ? 'Hot Desk' : 
                     serviceType === 'meetingRoom' ? 'Sala de Reuniones' : 
                     serviceType === 'privateOffice' ? 'Oficina Privada' : 'Espacio';

  const ecosistemaItems = ecosistemaTable({
    aliados: ['aluna', 'enzo', 'angela', 'axel', 'adriana', 'gabi', 'paula', 'custom'],
    theme: 'dark',
  });

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light">
        <meta name="supported-color-schemes" content="light">
        <title>Pago Confirmado - Coworkia</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f8fafc;">
        
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header con colores corporativos Coworkia -->
            <div style="background: linear-gradient(135deg, #4FD1C7 0%, #2DD4BF 100%); padding: 30px 20px; text-align: center;">
                <div style="margin-bottom: 15px;">
                    <svg width="80" height="60" viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg">
                      <!-- Laptop con taza de café (logo Coworkia) -->
                      <rect x="10" y="25" width="50" height="30" rx="3" fill="#374151" stroke="#1f2937" stroke-width="2"/>
                      <rect x="15" y="28" width="40" height="22" rx="1" fill="white"/>
                      <rect x="25" y="55" width="30" height="3" rx="1" fill="#374151"/>
                      <!-- Taza de café -->
                      <ellipse cx="55" cy="18" rx="8" ry="6" fill="#374151"/>
                      <ellipse cx="55" cy="15" rx="6" ry="4" fill="white"/>
                      <path d="M63 18 Q68 18 68 22 Q68 26 63 26" stroke="#374151" stroke-width="2" fill="none"/>
                      <!-- Vapor -->
                      <path d="M52 8 Q53 5 54 8 Q55 5 56 8" stroke="#4FD1C7" stroke-width="1.5" fill="none"/>
                    </svg>
                </div>
                <h1 style="color: #1f2937; margin: 0; font-size: 28px; font-weight: 600;">✅ ¡Pago Confirmado!</h1>
                <p style="color: #374151; margin: 10px 0 0 0; font-size: 16px;">Tu reserva está confirmada</p>
            </div>

            <!-- Contenido -->
            <div style="padding: 30px 20px;">
                
                <!-- Saludo -->
                <div style="margin-bottom: 25px;">
                    <h2 style="color: #2d3748; margin: 0 0 10px 0; font-size: 20px;">¡Hola ${userName}! 👋</h2>
                    <p style="color: #4a5568; line-height: 1.6; margin: 0;">
                        Hemos confirmado tu pago exitosamente. Tu espacio de trabajo está reservado y listo para usar.
                    </p>
                </div>

                <!-- Información de la Reserva -->
                <div style="background: #f0fdfa; border-left: 4px solid #4FD1C7; padding: 20px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
                    <h3 style="color: #0f766e; margin: 0 0 15px 0; font-size: 18px;">📋 Detalles de tu Reserva</h3>
                    <div style="display: grid; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ccfbf1;">
                            <span style="color: #0f766e; font-weight: 500;">📅 Fecha:</span>
                            <span style="color: #1f2937; font-weight: 600;">${date}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ccfbf1;">
                            <span style="color: #0f766e; font-weight: 500;">⏰ Horario:</span>
                            <span style="color: #1f2937; font-weight: 600;">${startTime} - ${endTime}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ccfbf1;">
                            <span style="color: #0f766e; font-weight: 500;">🏢 Espacio:</span>
                            <span style="color: #1f2937; font-weight: 600;">${serviceName}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ccfbf1;">
                            <span style="color: #0f766e; font-weight: 500;">⏱️ Duración:</span>
                            <span style="color: #1f2937; font-weight: 600;">${durationHours} hora${durationHours > 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>

                <!-- Información de Pago -->
                <div style="background: #f0fdfa; border-left: 4px solid #4FD1C7; padding: 20px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
                    <h3 style="color: #0f766e; margin: 0 0 15px 0; font-size: 18px;">💳 Confirmación de Pago</h3>
                    <div style="display: grid; gap: 12px;">
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ccfbf1;">
                            <span style="color: #0f766e; font-weight: 500;">💰 Monto Total:</span>
                            <span style="color: #1a202c; font-weight: 700; font-size: 18px;">$${total}</span>
                        </div>
                        ${paymentData?.transactionNumber ? `
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ccfbf1;">
                            <span style="color: #0f766e; font-weight: 500;">🔢 Referencia:</span>
                            <span style="color: #1a202c; font-weight: 600;">${paymentData.transactionNumber}</span>
                        </div>
                        ` : ''}
                        ${paymentData?.bank ? `
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ccfbf1;">
                            <span style="color: #0f766e; font-weight: 500;">🏦 Banco:</span>
                            <span style="color: #1a202c; font-weight: 600;">${paymentData.bank}</span>
                        </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                            <span style="color: #0f766e; font-weight: 500;">✅ Estado:</span>
                            <span style="color: #0f766e; font-weight: 700;">PAGADO</span>
                        </div>
                    </div>
                </div>

                <!-- Información Importante -->
                <div style="background: #fff5b4; border-left: 4px solid #f6e05e; padding: 20px; margin-bottom: 25px; border-radius: 0 8px 8px 0;">
                    <h3 style="color: #744210; margin: 0 0 10px 0; font-size: 16px;">📋 Información Importante</h3>
                    <ul style="color: #744210; line-height: 1.6; margin: 0; padding-left: 20px;">
                        <li>Llega 5 minutos antes de tu horario reservado</li>
                        <li>Presenta este email en recepción</li>
                        <li>WiFi disponible las 24/7</li>
                        <li>Café y agua incluidos</li>
                    </ul>
                </div>

                <!-- Acciones -->
                <div style="text-align: center; margin: 30px 0;">
                    ${data.calendarLink ? `
                    <a href="${data.calendarLink}" style="background: #4285F4; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; margin-bottom: 10px;">
                        📅 Agregar a Google Calendar
                    </a>
                    <br>
                    ` : ''}
                    <a href="https://wa.me/593994837117" style="background: #4FD1C7; color: #1f2937; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                        💬 Contactar Soporte
                    </a>
                </div>

                <!-- Ubicación -->
                <div style="text-align: center; margin: 25px 0; padding: 20px; background: #f7fafc; border-radius: 8px;">
                    <h4 style="color: #2d3748; margin: 0 0 10px 0;">📍 Ubicación</h4>
                    <p style="color: #4a5568; margin: 0; line-height: 1.5;">
                        <strong>Coworkia</strong><br>
                        Av. Principal 123<br>
                        Quito, Ecuador<br>
                        <a href="https://maps.google.com/?q=Coworkia" style="color: #3182ce;">Ver en Google Maps</a>
                    </p>
                </div>

            </div>

            <!-- ECOSISTEMA DE AGENTES -->
            <div style="background:linear-gradient(180deg,#12121a 0%,#0d0d12 100%);padding:36px 24px;text-align:center;">
                <div style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;">Todos los agentes IA del ecosistema</div>
                <div style="margin-bottom:22px;">${ecosistemaItems}</div>
                <div style="background:rgba(79,209,199,0.06);border:1px solid rgba(79,209,199,0.12);border-radius:10px;padding:14px;">
                    <p style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.8;margin:0;">
                        Un solo ecosistema. Agentes especializados que se hablan entre sí.<br>
                        <strong style="color:rgba(255,255,255,0.8);">Haz clic en cualquier agente para hablar directamente por WhatsApp.</strong>
                    </p>
                </div>
            </div>

            <!-- Footer con branding corporativo -->
            <div style="background: #1f2937; padding: 20px; text-align: center;">
                <div style="margin-bottom: 15px;">
                  <svg width="60" height="45" viewBox="0 0 80 60" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;">
                    <!-- Laptop con taza de café (logo Coworkia) -->
                    <rect x="10" y="25" width="50" height="30" rx="3" fill="#4FD1C7" stroke="#2DD4BF" stroke-width="2"/>
                    <rect x="15" y="28" width="40" height="22" rx="1" fill="white"/>
                    <rect x="25" y="55" width="30" height="3" rx="1" fill="#4FD1C7"/>
                    <!-- Taza de café -->
                    <ellipse cx="55" cy="18" rx="8" ry="6" fill="#4FD1C7"/>
                    <ellipse cx="55" cy="15" rx="6" ry="4" fill="white"/>
                    <path d="M63 18 Q68 18 68 22 Q68 26 63 26" stroke="#4FD1C7" stroke-width="2" fill="none"/>
                    <!-- Vapor -->
                    <path d="M52 8 Q53 5 54 8 Q55 5 56 8" stroke="#4FD1C7" stroke-width="1.5" fill="none"/>
                  </svg>
                </div>
                <div style="color: #4FD1C7; font-size: 18px; font-weight: 600; margin-bottom: 5px;">coWorkia</div>
                <div style="color: #9ca3af; font-size: 14px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">Business Center</div>
                <p style="color: #a0aec0; margin: 0; font-size: 14px;">
                    ¡Gracias por elegir Coworkia! 🚀<br>
                    <a href="mailto:coworkia.ec@gmail.com" style="color: #4FD1C7;">coworkia.ec@gmail.com</a> | 
                    <a href="https://wa.me/593994837117" style="color: #4FD1C7;">+593 994837117</a>
                </p>
            </div>

        </div>

    </body>
    </html>
  `;
}

/**
 * 🧪 Prueba la configuración de email
 */
export async function testEmailConfiguration() {
  const transporter = await getTransporter();
  
  if (!transporter) {
    return {
      success: false,
      error: 'Transportador de email no configurado'
    };
  }

  try {
    await transporter.verify();
    return {
      success: true,
      message: 'Configuración de email válida'
    };
  } catch (error) {
    return {
      success: false,
      error: `Error en configuración: ${error.message}`
    };
  }
}

/**
 * 📅 Genera link de Google Calendar para agregar evento
 */
export function generateGoogleCalendarLink(reservationData) {
  const { date, startTime, endTime, userName = 'Cliente' } = reservationData;
  
  try {
    // Convertir fecha y horas a formato de Google Calendar (UTC)
    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    
    // Formato ISO para Google Calendar (quitamos los : de la hora)
    const start = startDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const end = endDateTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    const title = encodeURIComponent('Reserva Coworkia - Hot Desk');
    const details = encodeURIComponent(`
Reserva confirmada en Coworkia
👤 Usuario: ${userName}
📅 Fecha: ${date}
⏰ Horario: ${startTime} - ${endTime}
📍 Ubicación: Whymper 403, Edificio Finistere, Quito
🏢 Espacio: Hot Desk

¡Nos vemos en Coworkia! 🚀
    `.trim());
    
    const location = encodeURIComponent('Coworkia - Whymper 403, Edificio Finistere, Quito');
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
  } catch (error) {
    console.error('[EMAIL] Error generando link de Google Calendar:', error);
    return null;
  }
}

// Export constantes para otros módulos
export { AGENT_FROM_NAMES, DEFAULT_FROM_EMAIL, ADRIANA_FROM_EMAIL };

export default {
  sendReservationConfirmation,
  sendPaymentConfirmationEmail,
  sendReservationReminder,
  testEmailConfiguration,
  generateGoogleCalendarLink
};
