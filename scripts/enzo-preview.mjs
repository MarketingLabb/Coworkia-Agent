/**
 * Vista previa local de Enzo Studio (sin WhatsApp).
 *   node scripts/enzo-preview.mjs                 → arma post y story con un fondo de prueba (sin IA)
 *   node scripts/enzo-preview.mjs "sala de reuniones para equipos"   → usa OpenAI (necesita OPENAI_API_KEY)
 * Deja los JPG en ./enzo-preview/
 */
import 'dotenv/config';
import fs from 'fs/promises';
import sharp from 'sharp';
import { loadBrand } from '../src/servicios/enzo-studio/brand-store.js';
import { composeArt, renderArts } from '../src/servicios/enzo-studio/art-renderer.js';
import { buildDirectorPrompt, normalizeConcept, buildImagePrompt, detectFormats } from '../src/servicios/enzo-studio/creative-director.js';

const request = process.argv.slice(2).join(' ');
const brand = await loadBrand('coworkia');
await fs.mkdir('enzo-preview', { recursive: true });

if (!request) {
  for (const [format, w, h] of [['feed', 1024, 1024], ['story', 1024, 1536]]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ECFDF5"/><stop offset="1" stop-color="#047857"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
    const base = await sharp(Buffer.from(svg)).png().toBuffer();
    const out = await composeArt(base, brand, format);
    await fs.writeFile(`enzo-preview/prueba-${format}.jpg`, out);
    console.log(`✅ enzo-preview/prueba-${format}.jpg`, (await sharp(out).metadata()).width, 'x', (await sharp(out).metadata()).height);
  }
} else {
  const { complete } = await import('../src/servicios-ia/openai.js');
  const { system, prompt } = buildDirectorPrompt(brand, request);
  const concept = normalizeConcept(await complete(prompt, { system, temperature: 0.9, max_tokens: 1200 }), brand);
  console.log('💡', concept.titular, '—', concept.concepto);
  const arts = await renderArts({ brand, concept, formats: detectFormats(request), buildPrompt: buildImagePrompt });
  for (const a of arts) { await fs.writeFile(`enzo-preview/${a.filename}`, a.buffer); console.log('✅ enzo-preview/' + a.filename); }
  console.log('\n' + concept.copy_instagram + '\n' + concept.hashtags.join(' '));
}
process.exit(0);
