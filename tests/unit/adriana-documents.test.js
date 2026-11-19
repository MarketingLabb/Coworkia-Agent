import { describe, test, expect, jest } from '@jest/globals';

jest.unstable_mockModule('../../src/database/database.js', () => ({ default: {} }));

const { isValidEcuadorianCedula, normalizeCompetitorOffers } = await import('../../src/servicios/adriana-document-analyzer.js');
const { loadMedia, toOpenAIContentPart } = await import('../../src/servicios-ia/media-input.js');

describe('cédula ecuatoriana (dígito verificador)', () => {
  test('acepta cédulas válidas', () => {
    expect(isValidEcuadorianCedula('1710034065')).toBe(true);
    expect(isValidEcuadorianCedula('0926687856')).toBe(true);
  });
  test('rechaza dígito verificador o provincia incorrectos', () => {
    expect(isValidEcuadorianCedula('1710034066')).toBe(false);
    expect(isValidEcuadorianCedula('9910034065')).toBe(false);
    expect(isValidEcuadorianCedula('12345')).toBe(false);
  });
});

describe('ofertas de otras aseguradoras', () => {
  test('normaliza varias ofertas de un PDF de bróker y descarta duplicados y cifras absurdas', () => {
    const offers = normalizeCompetitorOffers({ ofertas: [
      { aseguradora: 'Zurich', plan: 'Todo Riesgo', prima_total_anual: '1,250.50', deducible: '10%', asistencia_vial: true },
      { aseguradora: 'Zurich', plan: 'Todo Riesgo', prima_total_anual: 1250.5, deducible: '10%' },
      { aseguradora: 'Sweaden', prima_neta_anual: 980, asistencia_vial: false },
      { aseguradora: 'Leyó el valor del auto', prima_total_anual: 25000000 },
    ] });
    expect(offers).toHaveLength(2);
    expect(offers[0]).toMatchObject({ nombre: 'Zurich', prima_anual: '$1,250.5', asistencia: '✅ 24/7', prima_mensual: '$104/mes' });
    expect(offers[1]).toMatchObject({ nombre: 'Sweaden', plan: 'Plan estándar', asistencia: '❌' });
  });
  test('sin ofertas → lista vacía', () => {
    expect(normalizeCompetitorOffers({ ofertas: [] })).toEqual([]);
    expect(normalizeCompetitorOffers(null)).toEqual([]);
  });
});

describe('archivos de WhatsApp para la IA', () => {
  const fakeFetch = (buf, type = '') => async () => ({
    ok: true, status: 200,
    headers: { get: () => type },
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length),
  });

  test('un PDF se envía como archivo (no como imagen)', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n');
    const media = await loadMedia('https://api.wassenger.com/v1/files/x/download', { fetchImpl: fakeFetch(pdf, 'application/octet-stream') });
    expect(media.kind).toBe('pdf');
    const part = toOpenAIContentPart(media);
    expect(part.type).toBe('file');
    expect(part.file.file_data.startsWith('data:application/pdf;base64,')).toBe(true);
  });

  test('una foto JPEG se envía como imagen en base64', async () => {
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const media = await loadMedia('https://example.com/a.jpg', { fetchImpl: fakeFetch(jpg, 'image/jpeg') });
    expect(media.kind).toBe('image');
    expect(toOpenAIContentPart(media).image_url.url.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  test('otros archivos se rechazan con mensaje claro', async () => {
    const doc = Buffer.from('PK\u0003\u0004word');
    const media = await loadMedia('https://example.com/a.docx', { fetchImpl: fakeFetch(doc, 'application/zip') });
    expect(() => toOpenAIContentPart(media)).toThrow();
  });
});
