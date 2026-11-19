// src/servicios/aluna-renewal/renewal-sequence.js
// 🌙 Secuencia inteligente de renovación de membresías (Aluna).
//
// Garantías:
//  - Un paso sale UNA sola vez por persona y ciclo (candado en BD antes de enviar).
//  - Se agrupa por teléfono: varios leads del mismo número = una sola secuencia.
//  - Si ya renovó (o su comprobante está en revisión), se detiene.
//  - Respeta lo que el cliente dijo: no escribir más, "renuevo el 25", "no voy a renovar".
//  - Tope global: no se suma a otro mensaje automático del día (salvo último día de ventana).
//  - Si el cliente está conversando (escribió hace <2h), espera.
//  - Si Wassenger no confirma (timeout), NO se reintenta: mejor perder un aviso que duplicarlo.

import { localizeOutgoing } from '../../utils/outbound-localizer.js';
import * as defaultRepo from '../../database/renewalRepository.js';
import { normalizePhoneEC } from '../../utils/validators.js';
import { getPayphoneLink, getBankAccountInfo } from '../payment-calculator.js';
import {
  STEPS, RECOVERY_DISCOUNT_PCT, RECOVERY_DISCOUNT_MONTHS, RECOVERY_OFFER_VALID_DAYS, REPLY_CONTEXT_DAYS,
  todayEC, hourEC, addDays, diffDays, formatDateEs, firstName, phoneKey,
  pickCurrentMemberships, isExcludedPhone, isEligibleByAffiliation, decideStep, buildWhatsAppMessage, buildEmailContent,
  classifyRenewalReply, paymentBlock,
} from './renewal-rules.js';

const LOG = '[ALUNA-RENEWAL]';
const SEND_HOURS = { from: 9, to: 19 }; // 9:00–19:59 Ecuador
const ACTIVE_CONVERSATION_HOURS = 2;
const WASSENGER_TIMEOUT_MS = 20000;

// Precios base: misma fuente que valida los comprobantes (membership-payment-verification.js)
const BASE_PRICES = { 'Plan 10': 67, 'Plan 20': 99, 'Oficina Virtual': 365 };

export function renewalAmount(membershipType, discountPct = 0) {
  const base = BASE_PRICES[membershipType];
  if (!base) return null;
  return Math.round(base * (1 - (Number(discountPct) || 0) / 100) * 100) / 100;
}

// ─── Envío ───────────────────────────────────────────────────────────────────

export async function sendWhatsApp(phone, message) {
  const token = process.env.WASSENGER_TOKEN;
  const device = process.env.WASSENGER_DEVICE_ID;
  if (!token || !device) return { status: 'failed', error: 'WASSENGER_NOT_CONFIGURED' };
  const target = normalizePhoneEC(phone);
  if (!target) return { status: 'failed', error: 'INVALID_PHONE' };
  message = await localizeOutgoing(phone, message); // 🌍 idioma del cliente

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WASSENGER_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.wassenger.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Token: token },
      body: JSON.stringify({ phone: target, message, device }),
      signal: controller.signal,
    });
    if (res.ok) return { status: 'sent' };
    // 4xx: Wassenger rechazó → no se entregó, se puede reintentar.
    // 5xx: no sabemos si quedó en cola → no reintentar.
    return { status: res.status < 500 ? 'failed' : 'unknown', error: `HTTP_${res.status}` };
  } catch (err) {
    return { status: 'unknown', error: err?.name === 'AbortError' ? 'TIMEOUT' : (err?.message || 'NETWORK') };
  } finally {
    clearTimeout(timer);
  }
}

async function sendRenewalEmail(step, ctx, deps) {
  const content = buildEmailContent(step, ctx);
  if (!content || !ctx.email) return null;
  const { buildEmailTemplate } = await import('../email-template-system.js');
  const { sendEmail, AGENT_FROM_NAMES, DEFAULT_FROM_EMAIL } = await import('../email.js');
  const html = content.template === 'RENEWAL'
    ? buildEmailTemplate('ALUNA', 'RENEWAL', {
      name: ctx.name, plan: ctx.plan, expirationDate: formatDateEs(ctx.expiry), monthlyFee: ctx.monthlyFee,
    }, { xiaomiSafe: true })
    : buildEmailTemplate('ALUNA', 'RENEWAL_STEP', {
      name: ctx.name, plan: ctx.plan, badge: content.badge, title: content.title, message: content.message,
    }, { xiaomiSafe: true });
  const result = await (deps.sendEmail || sendEmail)({
    to: ctx.email, subject: content.subject, html,
    from: { name: AGENT_FROM_NAMES.aluna, address: DEFAULT_FROM_EMAIL },
    agent: 'aluna',
  });
  return result?.success ? { status: 'sent' } : { status: 'failed', error: result?.error || 'EMAIL_FAILED' };
}

// ─── Lead de renovación (para que el comprobante se valide solo) ─────────────

/**
 * Crea (o reutiliza) un lead 'pending_payment' copiando el plan vigente, aplicando
 * el descuento de recuperación si la oferta está aceptada y quedan meses.
 * @returns {{lead:object, discountPct:number, amount:number|null}}
 */
export async function ensureRenewalLead(member, { db, applyOffer = false, repo = defaultRepo, now = new Date() } = {}) {
  const prefs = await repo.getPrefs(member.phone_key, db);
  let discountPct = 0;
  if (prefs?.offer_pct && prefs.offer_accepted_at) {
    const used = await repo.countDiscountedRenewalsSince(member.user_phone, prefs.offer_accepted_at, db);
    if (used < (prefs.offer_months || RECOVERY_DISCOUNT_MONTHS)) discountPct = Number(prefs.offer_pct);
  } else if (applyOffer && prefs?.offer_pct && prefs.offer_valid_until >= todayEC(now)) {
    await repo.upsertPrefs(member.phone_key, member.user_phone, { offer_accepted_at: now.toISOString() }, db);
    discountPct = Number(prefs.offer_pct);
  }

  const existing = await repo.findPendingRenewalLead(member.user_phone, db);
  if (existing && existing.membership_type === member.membership_type
      && Number(existing.renewal_discount_pct || 0) === discountPct) {
    return { lead: existing, discountPct, amount: renewalAmount(member.membership_type, discountPct) };
  }
  if (existing && !existing.renewal_of_lead_id) {
    // El cliente está comprando otro plan por su cuenta (p.ej. upgrade): no se toca.
    const pct = Number(existing.renewal_discount_pct || 0);
    return { lead: existing, discountPct: pct, amount: renewalAmount(existing.membership_type, pct) };
  }
  if (existing) {
    // Lead de renovación nuestro con otro plan/descuento: se reemplaza para que el comprobante no se cruce.
    await repo.cancelLead(existing.id, db);
  }

  const source = await repo.getLeadById(member.id, db) || member;
  const code = await repo.nextMembershipCode(db);
  const lead = {
    id: `MB-${now.getTime()}_${String(member.user_phone).replace(/\D/g, '')}`,
    membershipCode: code,
    userPhone: member.user_phone,
    membershipType: member.membership_type,
    clientName: source.client_name,
    email: source.email,
    phone: source.phone || member.user_phone,
    companyName: source.company_name || null,
    monthlyFee: renewalAmount(member.membership_type, discountPct) ?? source.monthly_fee,
    notes: `Renovación de ${member.id} (ciclo que vence ${member.expiry_date})${discountPct ? ` · ${discountPct}% dcto recuperación` : ''}`,
    discountPct,
    renewalOfLeadId: member.id,
  };
  await repo.insertRenewalLead(lead, db);
  return { lead: { id: lead.id, membership_type: lead.membershipType }, discountPct, amount: renewalAmount(member.membership_type, discountPct) };
}

// ─── Proceso programado ──────────────────────────────────────────────────────

function lastDayOfWindow(step, today, expiry) {
  const def = STEPS[step];
  return def ? diffDays(expiry, today) >= def.to : true;
}

export async function processRenewalSequence({ db, now = new Date(), deps = {} } = {}) {
  const dbx = db || (await import('../../database/database.js')).default;
  const send = deps.sendWhatsApp || sendWhatsApp;
  const repo = deps.repo || defaultRepo;
  const summary = { sent: 0, deferred: 0, skipped: 0, failed: 0, byStep: {} };

  const hour = hourEC(now);
  if (hour < SEND_HOURS.from || hour > SEND_HOURS.to) return { ...summary, outsideHours: true };

  const today = todayEC(now);
  const members = pickCurrentMemberships(await repo.findRenewalCandidates(dbx));

  for (const member of members) {
    try {
      if (!isEligibleByAffiliation(member, deps.startDate)) continue;
      if (isExcludedPhone(member.user_phone, deps.excludedPhones)) continue;
      if (diffDays(member.expiry_date, today) < -3 || diffDays(member.expiry_date, today) > 12) continue;

      const prefs = await repo.getPrefs(member.phone_key, dbx);
      const history = await repo.getCycleHistory(member.phone_key, member.expiry_date, dbx);
      const decision = decideStep({ today, now, expiry: member.expiry_date, history, prefs });
      if (!decision.step) continue;
      const step = decision.step;

      // Máximo un aviso de renovación por día (el par d3_offer → d3_link es la excepción).
      const sentToday = Object.values(history).some(h => h.status === 'sent' && h.sent_at && todayEC(new Date(h.sent_at)) === today);
      if (step !== 'd3_link' && sentToday) { summary.deferred++; continue; }

      if (await repo.hasPaymentInReviewSince(member.phone_key, member.payment_date, dbx)) {
        summary.skipped++;
        continue;
      }

      const base = { phoneKey: member.phone_key, userPhone: member.user_phone, leadId: member.id, cycleEnd: member.expiry_date };

      if (step === 'd3_link') {
        // Si respondió al primer mensaje, la conversación ya la lleva Aluna (con link si dijo que sí).
        if (await repo.hasInboundSince(member.phone_key, history.d3_offer.sent_at, dbx)) {
          await repo.skipStep({ ...base, step, reason: 'client_replied' }, dbx);
          summary.skipped++;
          continue;
        }
      } else {
        const since = new Date(now.getTime() - ACTIVE_CONVERSATION_HOURS * 3600000);
        if (await repo.hasInboundSince(member.phone_key, since, dbx)) { summary.deferred++; continue; }
        if (step !== 'snooze' && !lastDayOfWindow(step, today, member.expiry_date)
            && await repo.hadOtherAutomatedContact(member.phone_key, 20, dbx)) {
          summary.deferred++;
          continue;
        }
      }

      const ctx = {
        name: member.client_name, plan: member.membership_type, email: member.email,
        monthlyFee: member.monthly_fee, expiry: member.expiry_date, today,
        payphoneLink: getPayphoneLink(), bankInfo: getBankAccountInfo(),
      };

      if (step === 'dp5') {
        ctx.offerValidUntil = addDays(member.expiry_date, 5 + RECOVERY_OFFER_VALID_DAYS);
        await repo.upsertPrefs(member.phone_key, member.user_phone, {
          offer_pct: RECOVERY_DISCOUNT_PCT, offer_months: RECOVERY_DISCOUNT_MONTHS,
          offer_valid_until: ctx.offerValidUntil, offer_accepted_at: null,
        }, dbx);
      }

      if (step === 'd3_link' || step === 'snooze') {
        const { discountPct, amount } = await ensureRenewalLead(member, { db: dbx, repo, now });
        ctx.amount = amount;
        ctx.discountPct = discountPct;
      }

      const message = buildWhatsAppMessage(step, ctx);
      const claimId = await repo.claimNotification({ ...base, step, channel: 'whatsapp', message }, dbx);
      if (!claimId) { summary.skipped++; continue; } // otro proceso ya lo envió

      const result = await send(member.user_phone, message);
      await repo.finishNotification(claimId, result.status, result.error, dbx);
      if (result.status !== 'sent') {
        console.warn(`${LOG} ⚠️ ${step} a ${member.user_phone}: ${result.status} (${result.error})`);
        summary.failed++;
        continue;
      }
      summary.sent++;
      summary.byStep[step] = (summary.byStep[step] || 0) + 1;
      console.log(`${LOG} ✅ ${step} enviado a ${member.user_phone} (vence ${member.expiry_date})`);

      // El registro en interactions es best-effort: si falla, el envío YA quedó marcado.
      repo.logRenewalInteraction({ userPhone: member.user_phone, step, message }, dbx)
        .catch(err => console.warn(`${LOG} ⚠️ interactions:`, err.message));

      if (STEPS[step]?.channels.includes('email') && member.email) {
        const emailClaim = await repo.claimNotification({ ...base, step, channel: 'email', message: null }, dbx);
        if (emailClaim) {
          const emailResult = await sendRenewalEmail(step, ctx, deps).catch(err => ({ status: 'failed', error: err.message }));
          if (emailResult) await repo.finishNotification(emailClaim, emailResult.status, emailResult.error, dbx);
        }
      }

      if (deps.pauseMs !== 0) await new Promise(r => setTimeout(r, deps.pauseMs ?? 2000));
    } catch (err) {
      summary.failed++;
      console.error(`${LOG} ❌ ${member.user_phone}:`, err.message);
    }
  }

  console.log(`${LOG} 📊 ${JSON.stringify(summary)}`);
  return summary;
}

// ─── Respuestas del cliente (llamado desde el webhook de WhatsApp) ───────────

/**
 * Si el número está en una secuencia de renovación reciente y el mensaje es una
 * respuesta clara (sí/renovar, "renuevo el 25", "no voy a renovar", "no me escribas"),
 * Aluna responde aquí mismo. Si no, devuelve null y el flujo normal sigue.
 * @returns {Promise<{reply:string, type:string}|null>}
 */
export async function handleRenewalReply({ userId, text, db, now = new Date(), deps = {} }) {
  if (!text) return null;
  const repo = deps.repo || defaultRepo;
  const dbx = db || (await import('../../database/database.js')).default;
  const key = phoneKey(userId);
  if (!key) return null;

  const latest = await repo.getLatestRenewalContact(key, dbx);
  if (!latest?.sent_at) return null;
  const today = todayEC(now);
  if (now.getTime() - new Date(latest.sent_at).getTime() > REPLY_CONTEXT_DAYS * 86400000) return null;

  const intent = classifyRenewalReply(text, today);
  if (!intent) return null;

  // Respuestas cortas ("sí", "no") solo cuentan si el último aviso fue hace <48h.
  const shortAnswer = String(text).trim().split(/\s+/).length <= 3;
  // Además, deben ser lo primero que escribe tras el aviso (si ya conversó con otro
  // agente, un "no" probablemente responde a otra cosa).
  if (shortAnswer) {
    if (now.getTime() - new Date(latest.sent_at).getTime() > 48 * 3600000) return null;
    if (await repo.hasInboundSince(key, latest.sent_at, dbx, { excludeText: text })) return null;
  }

  const members = pickCurrentMemberships(await repo.findRenewalCandidates(dbx));
  const member = members.find(m => m.phone_key === key);
  if (!member || !isEligibleByAffiliation(member, deps.startDate)) return null;
  // Si ya pagó un ciclo nuevo, la secuencia vieja no aplica.
  if (member.expiry_date !== latest.cycle_end) return null;

  const name = firstName(member.client_name);
  const base = { phoneKey: key, userPhone: member.user_phone, leadId: member.id, cycleEnd: member.expiry_date };
  let reply;

  switch (intent.type) {
    case 'optout':
      await repo.upsertPrefs(key, member.user_phone, { opted_out_at: now.toISOString() }, dbx);
      reply = `Entendido${name ? `, ${name}` : ''} 🌙 No te enviaré más recordatorios de renovación. Si algún día quieres volver, aquí estaré para ayudarte.`;
      break;

    case 'decline':
      await repo.upsertPrefs(key, member.user_phone, {
        declined_cycle_end: member.expiry_date, decline_message: String(text).slice(0, 500),
      }, dbx);
      reply = `Gracias por contarme${name ? `, ${name}` : ''} 💚 No te escribiré más por esta renovación.\n\n¿Me cuentas qué te haría falta? Si es por presupuesto o porque vienes menos, el *Plan 10* o la *Oficina Virtual* pueden calzarte mejor, y con gusto te lo armo.`;
      break;

    case 'snooze':
      await repo.upsertPrefs(key, member.user_phone, { snooze_until: intent.date, snooze_cycle_end: member.expiry_date }, dbx);
      reply = `¡Perfecto${name ? `, ${name}` : ''}! 😊 Te escribo el *${formatDateEs(intent.date)}* con todo listo para renovar.${intent.date > member.expiry_date ? `\n\nTen en cuenta que tu *${member.membership_type}* vence el ${formatDateEs(member.expiry_date)}.` : ''}`;
      break;

    case 'renew': {
      const { discountPct, amount } = await ensureRenewalLead(member, { db: dbx, applyOffer: true, repo, now });
      reply = `¡Qué alegría${name ? `, ${name}` : ''}! 💚 Aquí tienes todo para renovar tu *${member.membership_type}*:\n\n${paymentBlock({
        amount, discountPct, payphoneLink: getPayphoneLink(), bankInfo: getBankAccountInfo(),
      })}`;
      // El link ya va aquí: no mandar el d3_link automático después.
      await repo.skipStep({ ...base, step: 'd3_link', reason: 'renew_reply' }, dbx).catch(() => {});
      break;
    }
    default:
      return null;
  }

  repo.logRenewalInteraction({ userPhone: userId, step: `reply_${intent.type}`, message: reply, input: text }, dbx)
    .catch(err => console.warn(`${LOG} ⚠️ interactions:`, err.message));
  console.log(`${LOG} 💬 Respuesta ${intent.type} de ${userId}`);
  return { reply, type: intent.type };
}
