/**
 * 🎨 Enzo Studio — cuentas de marca
 *
 * Cada cuenta vive en `marcas/<slug>/` (brand.json + logos). Enzo la lee en cada
 * pedido, así cualquier cambio que hagas en el archivo aplica al siguiente arte.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BRANDS_DIR = process.env.ENZO_BRANDS_DIR || path.resolve(__dirname, '../../../marcas');
export const DEFAULT_BRAND = 'coworkia';

export async function listBrands(dir = BRANDS_DIR) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const slugs = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try {
        await fs.access(path.join(dir, e.name, 'brand.json'));
        slugs.push(e.name);
      } catch { /* carpeta sin brand.json */ }
    }
    return slugs.sort();
  } catch {
    return [];
  }
}

/**
 * @returns {Promise<object>} brand.json + { dir, logoClaroPath, logoOscuroPath }
 */
export async function loadBrand(slug = DEFAULT_BRAND, dir = BRANDS_DIR) {
  const safe = String(slug || DEFAULT_BRAND).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const brandDir = path.join(dir, safe);
  const raw = await fs.readFile(path.join(brandDir, 'brand.json'), 'utf8');
  const brand = JSON.parse(raw);
  return {
    ...brand,
    slug: brand.slug || safe,
    dir: brandDir,
    logoClaroPath: brand.logo?.claro ? path.join(brandDir, brand.logo.claro) : null,
    logoOscuroPath: brand.logo?.oscuro ? path.join(brandDir, brand.logo.oscuro) : null,
  };
}

/** Resumen corto de la marca para WhatsApp. */
export function brandSummary(brand) {
  const c = brand.colores || {};
  return [
    `🎨 *Cuenta: ${brand.nombre}*`,
    brand.slogan ? `_${brand.slogan}_` : null,
    ``,
    `*Colores:* primario ${c.primario || '—'} · acento ${c.acento || '—'} · oscuro ${c.oscuro || '—'}`,
    `*Tipografía:* ${brand.tipografia || '—'}`,
    `*Tono:* ${(brand.tono || []).slice(0, 2).join(' · ') || '—'}`,
    `*Público:* ${(brand.publico || []).slice(0, 2).join(' · ') || '—'}`,
    ``,
    `📁 Archivo: marcas/${brand.slug}/brand.json — edítalo y el próximo arte ya sale con el cambio.`,
  ].filter(l => l !== null).join('\n');
}
