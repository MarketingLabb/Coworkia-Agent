import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, jest, test } from '@jest/globals';

const databaseService = {
  ensureInitialized: jest.fn().mockResolvedValue(),
  run: jest.fn().mockResolvedValue({ changes: 0 }),
  all: jest.fn().mockResolvedValue([]),
};

jest.unstable_mockModule('../../src/database/database.js', () => ({ default: databaseService }));

const { getMigrationStatus } = await import('../../src/database/migrations/migration-runner.js');
const consentMigration = await import('../../src/database/migrations/011_data_consent_requested_at.js');
const deliveryMigration = await import('../../src/database/migrations/012_automation_deliveries.js');

describe('migraciones precommit', () => {
  test('la numeración no colisiona y el runner descubre 011 y 012', async () => {
    const directory = path.resolve(import.meta.dirname, '../../src/database/migrations');
    const files = fs.readdirSync(directory).filter(file => /^\d{3}_.*\.js$/.test(file)).sort();
    const prefixes = files.map(file => file.slice(0, 3));
    expect(new Set(prefixes).size).toBe(prefixes.length);

    const status = await getMigrationStatus();
    expect(status.pending).toEqual(expect.arrayContaining([
      '011_data_consent_requested_at.js',
      '012_automation_deliveries.js',
    ]));

    const serverSource = fs.readFileSync(
      path.resolve(import.meta.dirname, '../../src/express-servidor/index.js'),
      'utf8'
    );
    expect(serverSource.indexOf('await runMigrations()')).toBeLessThan(serverSource.indexOf('startAuroraEnzoCronJobs()'));
  });

  test('011 puede ejecutarse dos veces y usa SQL PostgreSQL idempotente', async () => {
    const db = { run: jest.fn().mockResolvedValue({ changes: 0 }) };
    await consentMigration.up(db);
    await consentMigration.up(db);
    expect(db.run).toHaveBeenCalledTimes(2);
    expect(db.run.mock.calls.every(([sql]) => /ALTER TABLE users ADD COLUMN IF NOT EXISTS data_consent_requested_at TIMESTAMPTZ/i.test(sql))).toBe(true);
  });

  test('012 puede ejecutarse dos veces y crea tabla e índice idempotentes', async () => {
    const db = { run: jest.fn().mockResolvedValue({ changes: 0 }) };
    await deliveryMigration.up(db);
    await deliveryMigration.up(db);
    expect(db.run).toHaveBeenCalledTimes(4);
    const sql = db.run.mock.calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS automation_deliveries');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_automation_deliveries_due');
    expect(sql).toContain('JSONB NOT NULL');
    expect(sql).toContain('TIMESTAMPTZ');
  });
});
