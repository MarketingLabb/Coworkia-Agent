/**
 * 🖼️ Enzo Studio — render de artes
 *
 * 1) Genera la imagen con la IA (escena + textos de marca).
 * 2) Pone el LOGO REAL encima con sharp (la IA no dibuja logos fieles):
 *    elige la versión clara u oscura según el fondo donde va el logo.
 * 3) Entrega en medidas de Meta: feed 1080×1080 y story/estado 1080×1920.
 */

import { FORMATS } from './creative-director.js';

const IMAGE_MODEL = () => process.env.ENZO_IMAGE_MODEL || 'gpt-image-1';
const IMAGE_QUALITY = () => process.env.ENZO_IMAGE_QUALITY || 'high';

async function getSharp() {
  return (await import('sharp')).default;
}

/** Genera la imagen base con OpenAI. Devuelve Buffer PNG. */
export async function generateBaseImage(prompt, format) {
  const { client } = await import('../../servicios-ia/openai.js');
  const res = await client.images.generate({
    model: IMAGE_MODEL(),
    prompt,
    size: FORMATS[format].size,
    quality: IMAGE_QUALITY(),
    n: 1,
  });
  const b64 = res?.data?.[0]?.b64_json;
  if (!b64) throw new Error('La IA no devolvió imagen');
  return Buffer.from(b64, 'base64');
}

/** Luminancia promedio (0–255) de una zona de la imagen. */
async function regionLuminance(sharp, buf, region) {
  const { channels } = await sharp(buf).extract(region).stats();
  const [r, g, b] = channels;
  return 0.2126 * r.mean + 0.7152 * g.mean + 0.0722 * b.mean;
}

async function logoFor(sharp, brand, background, region, width) {
  const lum = await regionLuminance(sharp, background, region).catch(() => 0);
  const path = lum > 150 ? (brand.logoOscuroPath || brand.logoClaroPath) : (brand.logoClaroPath || brand.logoOscuroPath);
  if (!path) return null;
  return sharp(path).resize({ width }).png().toBuffer();
}

/** Arma la pieza final (con logo) en la medida del formato. */
export async function composeArt(baseImage, brand, format) {
  const sharp = await getSharp();
  const { width, height } = FORMATS[format].out;

  if (format === 'feed') {
    const base = await sharp(baseImage).resize(width, height, { fit: 'cover' }).png().toBuffer();
    const pad = 44;
    const logoW = 230;
    const logo = await logoFor(sharp, brand, base, { left: pad, top: pad, width: logoW, height: 130 }, logoW);
    const layers = logo ? [{ input: logo, left: pad, top: pad }] : [];
    return sharp(base).composite(layers).jpeg({ quality: 92 }).toBuffer();
  }

  // story / estado 9:16: fondo desenfocado + pieza al centro + logo en la franja superior
  const bg = await sharp(baseImage).resize(width, height, { fit: 'cover' }).blur(28).modulate({ brightness: 0.55 }).png().toBuffer();
  const fgHeight = Math.round(width * 1.5); // 1024×1536 → 1080×1620
  const fg = await sharp(baseImage).resize(width, fgHeight, { fit: 'cover' }).png().toBuffer();
  const top = Math.round((height - fgHeight) / 2);
  const logoW = 220;
  const logo = await logoFor(sharp, brand, bg, { left: Math.round((width - logoW) / 2), top: 20, width: logoW, height: Math.max(40, top - 30) }, logoW);
  const logoMeta = logo ? await sharp(logo).metadata() : null;
  const layers = [{ input: fg, left: 0, top }];
  if (logo) {
    const logoTop = Math.max(12, Math.round((top - logoMeta.height) / 2));
    layers.push({ input: logo, left: Math.round((width - logoMeta.width) / 2), top: logoTop });
  }
  return sharp(bg).composite(layers).jpeg({ quality: 92 }).toBuffer();
}

/**
 * Genera y arma todas las piezas pedidas (en paralelo).
 * @returns {Promise<Array<{format, buffer, filename}>>}
 */
export async function renderArts({ brand, concept, formats, buildPrompt, generate = generateBaseImage, compose = composeArt }) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return Promise.all(formats.map(async (format) => {
    const base = await generate(buildPrompt(concept, brand, format), format);
    const buffer = await compose(base, brand, format);
    return { format, buffer, filename: `${brand.slug}-${format}-${stamp}.jpg` };
  }));
}
