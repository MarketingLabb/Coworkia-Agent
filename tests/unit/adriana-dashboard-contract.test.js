import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const databaseService = {
  initialize: jest.fn().mockResolvedValue(),
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn().mockResolvedValue({ rowCount: 1 }),
};

jest.unstable_mockModule('../../src/database/database.js', () => ({ default: databaseService }));
jest.unstable_mockModule('../../src/express-servidor/endpoints-api/wassenger.js', () => ({
  enviarWhatsApp: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.unstable_mockModule('../../src/servicios/email-template-system.js', () => ({
  buildEmailTemplate: jest.fn(() => '<html></html>'),
}));
jest.unstable_mockModule('../../src/servicios/email.js', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  AGENT_FROM_NAMES: { adriana: 'Adriana' },
  DEFAULT_FROM_EMAIL: 'adriana@example.com',
}));

const router = (await import('../../src/express-servidor/endpoints-api/adriana-dashboard.js')).default;
const app = express();
app.use(express.json());
app.use('/api/adriana/dashboard', router);

beforeEach(() => jest.clearAllMocks());

describe('D — contrato backend del dashboard Adriana', () => {
  test('devuelve ceros/listas reales cuando no hay datos', async () => {
    databaseService.all.mockResolvedValue([]);
    databaseService.get
      .mockResolvedValueOnce({ total: '0' })
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce({ avg_premium: null, total_premium: null });

    const [leads, stats] = await Promise.all([
      request(app).get('/api/adriana/dashboard/leads'),
      request(app).get('/api/adriana/dashboard/leads-stats'),
    ]);

    expect(leads.body).toEqual({ ok: true, data: [] });
    expect(stats.body).toEqual({
      ok: true,
      data: { total: '0', thisMonth: '0', thisWeek: '0', byStatus: [], avgPremium: 0, totalPremium: 0 },
    });
  });

  test('serializa leads y métricas con datos', async () => {
    const lead = { id: 'INS-1', quote_code: 'ADR-1', status: 'accepted', quoted_premium: '800' };
    databaseService.all
      .mockResolvedValueOnce([lead])
      .mockResolvedValueOnce([{ status: 'accepted', count: '1' }]);
    databaseService.get
      .mockResolvedValueOnce({ total: '1' })
      .mockResolvedValueOnce({ count: '1' })
      .mockResolvedValueOnce({ count: '1' })
      .mockResolvedValueOnce({ avg_premium: '800', total_premium: '800' });

    const leads = await request(app).get('/api/adriana/dashboard/leads');
    const stats = await request(app).get('/api/adriana/dashboard/leads-stats');
    expect(leads.body.data).toEqual([lead]);
    expect(stats.body.data).toMatchObject({ total: '1', totalPremium: 800, byStatus: [{ status: 'accepted', count: '1' }] });
  });

  test('falla con mensaje útil sin filtrar el error interno', async () => {
    databaseService.all.mockRejectedValue(new Error('password=secret host=private-db'));
    const response = await request(app).get('/api/adriana/dashboard/leads');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ ok: false, error: 'No se pudieron cargar los leads de Adriana' });
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });
});

function createDashboardContext(fetchImpl) {
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        textContent: '', innerHTML: '', style: {}, disabled: false,
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        addEventListener() {},
      });
    }
    return elements.get(id);
  };
  const context = {
    window: { location: { origin: 'https://dashboard.test' }, open() {} },
    document: {
      getElementById: getElement,
      querySelectorAll: () => [],
      addEventListener() {},
      createElement: () => ({ style: {}, remove() {} }),
      body: { appendChild() {} },
    },
    fetch: fetchImpl,
    console: { error: jest.fn(), log: jest.fn() },
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    Date,
  };
  const source = fs.readFileSync(path.resolve(import.meta.dirname, '../../public/js/adriana-dashboard.js'), 'utf8');
  vm.runInNewContext(`${source}\nglobalThis.__dashboard = { loadStats, loadLeads };`, context);
  return { context, elements };
}

describe('D — render del dashboard Adriana', () => {
  test('usa el API dedicado y representa vacío como 0/tabla vacía', async () => {
    const fetchMock = jest.fn(async url => ({
      ok: true,
      json: async () => url.endsWith('leads-stats')
        ? { ok: true, data: { total: 0, thisMonth: 0, byStatus: [], totalPremium: 0 } }
        : { ok: true, data: [] },
    }));
    const { context, elements } = createDashboardContext(fetchMock);
    await context.__dashboard.loadStats();
    await context.__dashboard.loadLeads();

    expect(fetchMock.mock.calls.every(([url]) => url.includes('/api/adriana/dashboard/'))).toBe(true);
    expect(elements.get('stat-total').textContent).toBe(0);
    expect(elements.get('stat-total-premium').textContent).toBe('$0');
    expect(elements.get('leads-container').innerHTML).toContain('Sin cotizaciones');
  });

  test('representa datos y muestra un error útil ante fallo real', async () => {
    const lead = { id: '1', quote_code: 'ADR-1', client_name: 'Ana', status: 'accepted', quoted_premium: 500 };
    const fetchMock = jest.fn(async url => ({
      ok: true,
      json: async () => url.endsWith('leads-stats')
        ? { ok: true, data: { total: 1, thisMonth: 1, byStatus: [{ status: 'accepted', count: 1 }], totalPremium: 500 } }
        : { ok: true, data: [lead] },
    }));
    const rendered = createDashboardContext(fetchMock);
    await rendered.context.__dashboard.loadStats();
    await rendered.context.__dashboard.loadLeads();
    expect(rendered.elements.get('stat-accepted').textContent).toBe(1);
    expect(rendered.elements.get('leads-container').innerHTML).toContain('ADR-1');

    const failed = createDashboardContext(jest.fn(async () => ({ ok: false, json: async () => ({ ok: false }) })));
    await failed.context.__dashboard.loadStats();
    await failed.context.__dashboard.loadLeads();
    expect(failed.elements.get('stat-total').textContent).toBe('Error');
    expect(failed.elements.get('leads-container').innerHTML).toContain('No se pudieron cargar los leads de Adriana');
    expect(failed.elements.get('leads-container').innerHTML).not.toContain('undefined');
  });
});
