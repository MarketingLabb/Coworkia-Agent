/**
 * 🌍 Léxico y puntaje de idiomas (usado por language-detector.js)
 * Soporta: es, en, fr, it, pt, qu
 */

/**
 * Léxico por idioma, comparado por PALABRA COMPLETA (no por subcadena).
 *  - strong: palabras propias del idioma (peso 2)
 *  - common: palabras frecuentes que pueden aparecer en idiomas vecinos (peso 1)
 *  Una palabra que aparece en varios idiomas pesa menos (no distingue).
 * Antes se usaba `includes()`: "pi" (quechua) coincidía con "pizarra",
 * "ma" (italiano) con "mañana", "como" + "pago" daban portugués, etc.
 */
export const LEXICON = {
  es: {
    strong: ['hola', 'buenas', 'buenos', 'gracias', 'quiero', 'quisiera', 'necesito', 'tengo', 'tienen', 'tienes',
      'puedo', 'puedes', 'pueden', 'estoy', 'usted', 'ustedes', 'cuánto', 'cuanto', 'cuántos', 'cuantos', 'cuántas', 'cuantas',
      'cuándo', 'dónde', 'qué', 'cómo', 'también', 'mañana', 'pero', 'porfa', 'porfavor', 'disculpa', 'dale', 'listo',
      'vale', 'cuesta', 'precio', 'pagar', 'pago', 'reservar', 'reserva', 'ayuda', 'ayudar', 'ayudas', 'dime',
      'carro', 'auto', 'seguro', 'cotizar', 'cotización', 'cotizacion', 'matrícula', 'matricula', 'parqueadero',
      'oficina', 'tarde', 'noche', 'semana', 'mes', 'hoy', 'ahora', 'aquí', 'aqui', 'ahí', 'ahi', 'el', 'los', 'las', 'del',
      'una', 'unos', 'es', 'son', 'está', 'esta', 'este', 'eso', 'esto', 'muy', 'sí', 'mi', 'tu', 'su', 'y', 'o', 'pasas',
      'envío', 'envio', 'foto', 'interesa', 'disponible', 'disponibilidad', 'horario', 'personas', 'perfecto', 'cuál', 'cual',
      'casa', 'departamento', 'comprar', 'vender', 'choque', 'pintura', 'renuevo', 'renovar', 'información', 'informacion',
      'hablo', 'habla', 'hablas', 'inglés', 'ingles', 'español', 'espanol', 'sé', 'saber', 'quería', 'queria', 'cuándo',
      'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo', 'ya', 'bueno', 'claro'],
    common: ['para', 'por', 'con', 'sin', 'que', 'como', 'de', 'en', 'la', 'lo', 'le', 'me', 'te', 'se', 'nos', 'al', 'un', 'no',
      'favor', 'sala', 'plan', 'día', 'dia', 'días', 'dias'],
    chars: [[/[ñ¿¡]/, 3], [/ción\b/, 1]],
  },
  en: {
    strong: ['hello', 'hi', 'hey', 'thanks', 'thank', 'please', 'the', 'is', 'are', 'am', 'was', 'were', 'i', "i'm", 'im',
      'you', 'your', 'my', 'we', 'our', 'they', 'what', 'when', 'where', 'how', 'which', 'want', 'need', 'would', 'could',
      'like', 'have', 'has', 'do', 'does', 'can', 'will', 'tomorrow', 'today', 'morning', 'afternoon', 'evening', 'booking',
      'book', 'room', 'meeting', 'price', 'much', 'many', 'insurance', 'car', 'help', 'with', 'and', 'for', 'of', 'to',
      'this', 'that', 'there', 'here', 'about', 'monthly', 'parking', 'yes', 'good', 'great', 'space', 'office', 'cost', 'pay'],
    common: ['plan', 'ok', 'okay', 'info'],
    chars: [],
  },
  fr: {
    strong: ['bonjour', 'bonsoir', 'salut', 'merci', 'je', 'vous', 'nous', 'est', 'suis', 'sont', 'voudrais', 'veux',
      'besoin', 'avec', 'pour', 'pas', 'une', 'des', 'les', 'aujourd', 'hui', 'demain', 'combien', 'coûte', 'coute', 'où',
      'quand', 'comment', 'pourquoi', 'réserver', 'reserver', 'réservation', 'salle', 'réunion', 'reunion', 'prix', 'mois',
      'oui', 'aussi', 'mais', 'très', 'avez', 'pouvez', 'mon', 'ma', 'mes', 'votre', 'le', 'du', 'au', 'et', 'il', 'elle',
      'plaît', 'plait', 'mensuel', 'voiture', 'assurance', 'bureau'],
    common: ['que', 'de', 'la', 'en', 'un', 'plan', 'sans'],
    chars: [[/[èêëîïûœ]/, 2], [/[àâç]/, 1]],
  },
  it: {
    strong: ['ciao', 'buongiorno', 'buonasera', 'salve', 'grazie', 'prego', 'vorrei', 'voglio', 'sono', 'siamo', 'hanno',
      'avete', 'posso', 'potete', 'quanto', 'costa', 'quando', 'dove', 'perché', 'perche', 'anche', 'adesso', 'domani',
      'oggi', 'prenotare', 'prenotazione', 'riunione', 'riunioni', 'prezzo', 'mese', 'mensile', 'il', 'gli', 'della',
      'dello', 'nel', 'nella', 'per', 'con', 'una', 'uno', 'mi', 'piace', 'piano', 'macchina', 'assicurazione', 'ufficio',
      'sì', 'bene', 'molto', 'questo', 'questa', 'aiuto', 'informazioni'],
    common: ['che', 'come', 'di', 'la', 'le', 'un', 'non', 'ma', 'e', 'sala'],
    chars: [[/[ìò]/, 1]],
  },
  pt: {
    strong: ['olá', 'ola', 'oi', 'obrigado', 'obrigada', 'quero', 'gostaria', 'preciso', 'você', 'voce', 'vocês', 'tenho',
      'têm', 'tem', 'estou', 'são', 'não', 'nao', 'também', 'tambem', 'amanhã', 'amanha', 'hoje', 'agora', 'aqui', 'onde',
      'quanto', 'custa', 'reservar', 'reunião', 'preço', 'preco', 'mês', 'mes', 'mensal', 'plano', 'carro', 'seguro', 'uma',
      'um', 'do', 'da', 'dos', 'das', 'na', 'muito', 'sim', 'bom', 'dia', 'boa', 'tarde', 'escritório', 'ajuda',
      'informação', 'informacao', 'pagamento', 'meu', 'minha', 'é'],
    common: ['para', 'por', 'com', 'que', 'como', 'de', 'em', 'o', 'a', 'os', 'as', 'sala', 'favor', 'no'],
    chars: [[/[ãõ]/, 3], [/ção\b|ções\b/, 2], [/[êô]/, 1]],
  },
  qu: {
    strong: ['allinllachu', 'imaynalla', 'imanalla', 'maypi', 'hayka', 'munani', 'yachani', 'kani', 'atini', 'kunan',
      'paqarin', 'qayna', 'yanapay', 'chanin', 'willay', 'tapuy', 'yupaychani', 'yupaichani', 'allinmi', 'napaykullayki',
      'rimaykullayki', 'sumaq', 'yuyarini', 'ñuqa', 'ñoqa', 'qam', 'allinta', 'kusikuni', 'manam', 'qhali', 'kawsay',
      'pachapi', 'kachkanki', 'kachkani', 'rimay', 'runasimi'],
    common: [],
    chars: [],
  },
};

// Índice palabra → [[idioma, peso]]
const WORD_INDEX = (() => {
  const idx = new Map();
  const add = (w, lang, weight) => {
    const k = w.toLowerCase();
    if (!idx.has(k)) idx.set(k, []);
    const list = idx.get(k);
    if (!list.some(([l]) => l === lang)) list.push([lang, weight]);
  };
  for (const [lang, lex] of Object.entries(LEXICON)) {
    lex.strong.forEach(w => add(w, lang, 2));
    lex.common.forEach(w => add(w, lang, 1));
  }
  for (const [k, list] of idx) {
    if (list.length > 1) idx.set(k, list.map(([l, w]) => [l, Math.min(w, 1) / list.length]));
  }
  return idx;
})();

function tokenize(text) {
  return (text.toLowerCase().normalize('NFC').match(/[\p{L}']+/gu) || [])
    .map(t => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

/**
 * Puntúa un mensaje en cada idioma.
 * @returns {{ ranked: Array<[string, {score:number, matchCount:number}]>, scores: object }}
 */
export function scoreLanguages(normalizedMessage, preferredLanguage = null) {
  const scores = Object.fromEntries(Object.keys(LEXICON).map(l => [l, { score: 0, matchCount: 0 }]));
  for (const tok of tokenize(normalizedMessage)) {
    const hits = WORD_INDEX.get(tok);
    if (!hits) continue;
    for (const [lang, w] of hits) {
      scores[lang].score += w;
      scores[lang].matchCount++;
    }
  }
  for (const [lang, lex] of Object.entries(LEXICON)) {
    for (const [re, w] of lex.chars) {
      if (re.test(normalizedMessage)) { scores[lang].score += w; scores[lang].matchCount++; }
    }
  }
  const ranked = Object.entries(scores).sort((a, b) => (b[1].score - a[1].score)
    // empate: preferir el idioma del usuario y luego español
    || ((b[0] === preferredLanguage) - (a[0] === preferredLanguage))
    || ((b[0] === 'es') - (a[0] === 'es')));
  return { ranked, scores };
}
