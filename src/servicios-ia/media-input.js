/**
 * 📎 media-input.js — Descarga un archivo de WhatsApp (imagen o PDF) y lo deja
 * listo para enviarlo a la IA.
 *
 * Por qué existe:
 *  - Antes se le pasaba a OpenAI la URL de Wassenger con el token en la URL.
 *    Eso expone el token y falla si OpenAI no puede descargar el archivo.
 *  - OpenAI NO acepta PDFs como `image_url`. Los PDF (cotizaciones de otras
 *    aseguradoras, matrículas escaneadas) se rechazaban siempre.
 *
 * Ahora descargamos el archivo nosotros, detectamos si es imagen o PDF y lo
 * mandamos como corresponde (imagen → image_url base64; PDF → file base64).
 */

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const DOWNLOAD_TIMEOUT_MS = 30000;
const SUPPORTED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function sniffMime(buf, headerMime = '') {
  if (buf.length >= 4 && buf.slice(0, 4).toString() === '%PDF') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buf.slice(0, 3).toString() === 'GIF') return 'image/gif';
  return (headerMime || '').split(';')[0].trim().toLowerCase() || 'application/octet-stream';
}

/**
 * @param {string} url - URL del archivo (Wassenger u otra) o data URL
 * @param {object} [opts] - { fetchImpl }
 * @returns {Promise<{kind:'image'|'pdf'|'other', mime:string, base64:string, dataUrl:string, bytes:number}>}
 */
export async function loadMedia(url, opts = {}) {
  if (!url || typeof url !== 'string') throw new Error('URL de archivo vacía');

  // Ya viene como data URL
  const dataMatch = url.match(/^data:([^;]+);base64,(.+)$/);
  if (dataMatch) {
    const mime = dataMatch[1].toLowerCase();
    const kind = mime === 'application/pdf' ? 'pdf' : mime.startsWith('image/') ? 'image' : 'other';
    return { kind, mime, base64: dataMatch[2], dataUrl: url, bytes: Math.floor(dataMatch[2].length * 0.75) };
  }

  const fetchImpl = opts.fetchImpl || fetch;
  const headers = {};
  if (/wassenger\.com/i.test(url) && process.env.WASSENGER_TOKEN) headers.Token = process.env.WASSENGER_TOKEN;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`No se pudo descargar el archivo (HTTP ${res.status})`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error('El archivo llegó vacío');
  if (buf.length > MAX_BYTES) throw new Error('El archivo supera 20 MB');

  let mime = sniffMime(buf, res.headers?.get?.('content-type'));
  let data = buf;

  // Imágenes en formatos que la IA no acepta (HEIC, TIFF, BMP…) → JPEG
  if (mime.startsWith('image/') && !SUPPORTED_IMAGE_MIMES.includes(mime)) {
    try {
      const sharp = (await import('sharp')).default;
      data = await sharp(buf).jpeg({ quality: 90 }).toBuffer();
      mime = 'image/jpeg';
    } catch (err) {
      throw new Error(`Formato de imagen no soportado (${mime})`);
    }
  }

  const kind = mime === 'application/pdf' ? 'pdf' : mime.startsWith('image/') ? 'image' : 'other';
  const base64 = data.toString('base64');
  return { kind, mime, base64, dataUrl: `data:${mime};base64,${base64}`, bytes: data.length };
}

/**
 * Convierte un archivo cargado en la parte de contenido que espera OpenAI.
 * @param {{kind:string, dataUrl:string}} media
 * @param {object} [opts] - { detail, filename }
 */
export function toOpenAIContentPart(media, opts = {}) {
  if (media.kind === 'image') {
    return { type: 'image_url', image_url: { url: media.dataUrl, detail: opts.detail || 'high' } };
  }
  if (media.kind === 'pdf') {
    return { type: 'file', file: { filename: opts.filename || 'documento.pdf', file_data: media.dataUrl } };
  }
  throw new Error('Tipo de archivo no soportado: envía una foto o un PDF');
}
