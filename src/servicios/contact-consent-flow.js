const PRIVACY_URL = 'https://coworkia-agent-e97d15dac56f.herokuapp.com/privacidad.html';

export function isGreetingOnly(message) {
  const text = String(message || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  return [
    /^hola[!.?\s]*$/,
    /^hi[!.?\s]*$/,
    /^hey[!.?\s]*$/,
    /^buenas[!.?\s]*$/,
    /^buenos dias[!.?\s]*$/,
    /^buenas tardes[!.?\s]*$/,
    /^buenas noches[!.?\s]*$/,
    /^que tal[!.?\s]*$/,
    /^como estas[!.?\s]*$/,
    /^hola aurora[!.?\s]*$/,
    /^hola como estas[!.?\s]*$/,
  ].some(pattern => pattern.test(text));
}

export function getConsentDecision({ message, consentAt, consentRequestedAt, isInternal = false }) {
  if (isInternal || consentAt) return { action: 'continue' };

  const normalized = String(message || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (['SI', 'ACEPTO'].includes(normalized)) return { action: 'accept' };
  if (['NO', 'NO ACEPTO'].includes(normalized)) return { action: 'decline' };

  if (isGreetingOnly(message)) {
    return {
      action: 'greet',
      message: '¡Hola! 👋 Soy Aurora, asistente de Coworkia. ¿En qué puedo ayudarte hoy?'
    };
  }

  if (consentRequestedAt) {
    return {
      action: 'await-consent',
      message: 'Para continuar con tu solicitud, necesito que respondas *SI* para aceptar o *NO* para rechazar el consentimiento pendiente.'
    };
  }

  return {
    action: 'request',
    message: `Claro, te ayudo con eso. Antes de continuar, necesitamos procesar tus datos personales (nombre, teléfono) según nuestra política de privacidad.\n\n📄 ${PRIVACY_URL}\n\nResponde *SI* para aceptar y continuar.`
  };
}

async function sendConsentMessage(send, userId, message) {
  try {
    const result = await send(userId, message);
    return result?.ok === true;
  } catch {
    return false;
  }
}

export async function handleConsentDecision({
  decision,
  userId,
  name,
  run,
  send,
  invalidate = () => {},
}) {
  if (decision.action === 'continue') return { handled: false };

  if (decision.action === 'accept') {
    await run(
      `INSERT INTO users (phone_number, whatsapp_display_name, data_consent_at, data_consent_source, last_message_at)
       VALUES ($1, $2, NOW(), 'whatsapp', NOW())
       ON CONFLICT (phone_number) DO UPDATE SET
         data_consent_at = NOW(), data_consent_source = 'whatsapp', last_message_at = NOW()`,
      [userId, name || null]
    );
    invalidate(userId);
    const delivered = await sendConsentMessage(
      send,
      userId,
      '✅ ¡Gracias! Tu consentimiento quedó registrado. ¿En qué puedo ayudarte hoy?'
    );
    return { handled: true, delivered, accepted: true };
  }

  if (decision.action === 'decline') {
    const delivered = await sendConsentMessage(
      send,
      userId,
      'Entendemos. No procesaremos tus datos. Si cambias de opinión, escríbenos.\n\nPuedes ejercer tus derechos ARCO en:\nhttps://coworkia-agent-e97d15dac56f.herokuapp.com/privacidad-arco.html'
    );
    return { handled: true, delivered, declined: true };
  }

  const delivered = await sendConsentMessage(send, userId, decision.message);
  if (decision.action === 'request' && delivered) {
    await run(
      `INSERT INTO users (phone_number, data_consent_requested_at, last_message_at)
       VALUES ($1, NOW(), NOW())
       ON CONFLICT (phone_number) DO UPDATE SET
         data_consent_requested_at = COALESCE(users.data_consent_requested_at, NOW()),
         last_message_at = NOW()`,
      [userId]
    );
    invalidate(userId);
  }

  return { handled: true, delivered, requested: decision.action === 'request' && delivered };
}

export { PRIVACY_URL };
