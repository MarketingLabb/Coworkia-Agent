/**
 * 🧾 Textos de recibos en todos los idiomas del sistema (es, en, fr, it, pt).
 * Quechua y cualquier idioma sin traducción usan español.
 * Antes estos mensajes eran "español o inglés": un usuario en francés,
 * italiano o portugués recibía la respuesta en inglés.
 */

const COPY = {
  es: {
    noReceipts: 'No encontré recibos de pago en tu historial. 🤔\n\nSi realizaste un pago recientemente, el recibo fue enviado automáticamente a tu email registrado.\n\n📧 Revisa tu bandeja de entrada y la carpeta de Spam/Promociones.\n\n¿Necesitas ayuda con algo más?',
    resent: (n) => `✅ ¡Listo! Te reenvié el recibo \`${n}\` a tu email.\n\n📧 Revisa tu bandeja de entrada en unos minutos.\n\n¿Necesitas algo más?`,
    notFound: (n) => `⚠️ No encontré el recibo \`${n}\` en tu historial.\n\nVerifica el número o dime "mis recibos" para ver todos tus recibos disponibles.`,
    listIntro: (list) => `${list}\n\n📧 Los recibos fueron enviados automáticamente a tu email registrado.\n\nSi necesitas que te reenvíe alguno, dime el número de recibo (por ejemplo: \`REC-1234-ABC123\`).`,
    error: 'Disculpa, tuve un problema consultando tus recibos. ¿Puedes intentar nuevamente en un momento?',
    emptyList: 'No encontré recibos de pago en tu historial.',
    header: '📋 *Tus recibos de pago:*\n\n',
    footer: '\n\n💡 Para reenviar un recibo, dime cuál número necesitas.',
    serviceFallback: 'Servicio',
    locale: 'es-EC',
  },
  en: {
    noReceipts: 'I couldn\'t find any payment receipts in your history. 🤔\n\nIf you made a payment recently, the receipt was automatically sent to your registered email.\n\n📧 Check your inbox and Spam/Promotions folder.\n\nNeed help with something else?',
    resent: (n) => `✅ Done! I resent receipt \`${n}\` to your email.\n\n📧 Check your inbox in a few minutes.\n\nNeed anything else?`,
    notFound: (n) => `⚠️ I couldn't find receipt \`${n}\` in your history.\n\nVerify the number or tell me "my receipts" to see all your available receipts.`,
    listIntro: (list) => `${list}\n\n📧 Receipts were automatically sent to your registered email.\n\nIf you need me to resend one, tell me the receipt number (for example: \`REC-1234-ABC123\`).`,
    error: 'Sorry, I had a problem checking your receipts. Can you try again in a moment?',
    emptyList: 'I couldn\'t find any payment receipts in your history.',
    header: '📋 *Your payment receipts:*\n\n',
    footer: '\n\n💡 To resend a receipt, tell me which number you need.',
    serviceFallback: 'Service',
    locale: 'en-US',
  },
  fr: {
    noReceipts: 'Je n\'ai trouvé aucun reçu de paiement dans votre historique. 🤔\n\nSi vous avez effectué un paiement récemment, le reçu a été envoyé automatiquement à votre e-mail enregistré.\n\n📧 Vérifiez votre boîte de réception et le dossier Spam/Promotions.\n\nPuis-je vous aider avec autre chose ?',
    resent: (n) => `✅ C'est fait ! Je vous ai renvoyé le reçu \`${n}\` par e-mail.\n\n📧 Vérifiez votre boîte de réception dans quelques minutes.\n\nAutre chose ?`,
    notFound: (n) => `⚠️ Je n'ai pas trouvé le reçu \`${n}\` dans votre historique.\n\nVérifiez le numéro ou écrivez "mes reçus" pour voir tous vos reçus disponibles.`,
    listIntro: (list) => `${list}\n\n📧 Les reçus ont été envoyés automatiquement à votre e-mail enregistré.\n\nSi vous voulez que j'en renvoie un, indiquez-moi le numéro du reçu (par exemple : \`REC-1234-ABC123\`).`,
    error: 'Désolée, j\'ai eu un problème pour consulter vos reçus. Pouvez-vous réessayer dans un instant ?',
    emptyList: 'Je n\'ai trouvé aucun reçu de paiement dans votre historique.',
    header: '📋 *Vos reçus de paiement :*\n\n',
    footer: '\n\n💡 Pour renvoyer un reçu, indiquez-moi le numéro dont vous avez besoin.',
    serviceFallback: 'Service',
    locale: 'fr-FR',
  },
  it: {
    noReceipts: 'Non ho trovato ricevute di pagamento nella tua cronologia. 🤔\n\nSe hai effettuato un pagamento di recente, la ricevuta è stata inviata automaticamente alla tua email registrata.\n\n📧 Controlla la posta in arrivo e la cartella Spam/Promozioni.\n\nPosso aiutarti con altro?',
    resent: (n) => `✅ Fatto! Ti ho reinviato la ricevuta \`${n}\` via email.\n\n📧 Controlla la posta tra qualche minuto.\n\nTi serve altro?`,
    notFound: (n) => `⚠️ Non ho trovato la ricevuta \`${n}\` nella tua cronologia.\n\nVerifica il numero oppure scrivi "le mie ricevute" per vedere tutte le ricevute disponibili.`,
    listIntro: (list) => `${list}\n\n📧 Le ricevute sono state inviate automaticamente alla tua email registrata.\n\nSe vuoi che te ne reinvii una, dimmi il numero della ricevuta (per esempio: \`REC-1234-ABC123\`).`,
    error: 'Scusa, ho avuto un problema nel consultare le tue ricevute. Puoi riprovare tra un momento?',
    emptyList: 'Non ho trovato ricevute di pagamento nella tua cronologia.',
    header: '📋 *Le tue ricevute di pagamento:*\n\n',
    footer: '\n\n💡 Per reinviare una ricevuta, dimmi quale numero ti serve.',
    serviceFallback: 'Servizio',
    locale: 'it-IT',
  },
  pt: {
    noReceipts: 'Não encontrei recibos de pagamento no seu histórico. 🤔\n\nSe você fez um pagamento recentemente, o recibo foi enviado automaticamente para o seu e-mail cadastrado.\n\n📧 Verifique sua caixa de entrada e a pasta de Spam/Promoções.\n\nPosso ajudar com mais alguma coisa?',
    resent: (n) => `✅ Pronto! Reenviei o recibo \`${n}\` para o seu e-mail.\n\n📧 Verifique sua caixa de entrada em alguns minutos.\n\nPrecisa de mais alguma coisa?`,
    notFound: (n) => `⚠️ Não encontrei o recibo \`${n}\` no seu histórico.\n\nVerifique o número ou escreva "meus recibos" para ver todos os seus recibos disponíveis.`,
    listIntro: (list) => `${list}\n\n📧 Os recibos foram enviados automaticamente para o seu e-mail cadastrado.\n\nSe precisar que eu reenvie algum, diga o número do recibo (por exemplo: \`REC-1234-ABC123\`).`,
    error: 'Desculpe, tive um problema ao consultar seus recibos. Pode tentar novamente em um momento?',
    emptyList: 'Não encontrei recibos de pagamento no seu histórico.',
    header: '📋 *Seus recibos de pagamento:*\n\n',
    footer: '\n\n💡 Para reenviar um recibo, diga qual número você precisa.',
    serviceFallback: 'Serviço',
    locale: 'pt-BR',
  },
};

/** Textos de recibos en el idioma del usuario (español si no hay traducción). */
export function receiptCopy(language = 'es') {
  return COPY[language] || COPY.es;
}
