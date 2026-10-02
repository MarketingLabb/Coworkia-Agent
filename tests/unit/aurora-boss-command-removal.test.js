import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../../src/servicios/reservation-state.js', () => ({
  getPendingConfirmation: jest.fn(),
  setPendingConfirmation: jest.fn(),
  clearPendingConfirmation: jest.fn()
}));

const { extractDataFromMessage, PartialReservationForm } = await import('../../src/servicios/partial-reservation-form.js');

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const wassengerPath = path.join(repositoryRoot, 'src/express-servidor/endpoints-api/wassenger.js');
const sourceDirectories = [path.join(repositoryRoot, 'src')];

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
  });
}

function getReservationIntentDetector(source) {
  const start = source.indexOf('function isCasualGreetingOnly');
  const end = source.indexOf('/* ─────────────────────────────────────────────────────────────', start);

  if (start === -1 || end === -1) {
    throw new Error('No se encontró el detector de intención de reserva de Aurora');
  }

  const context = {};
  vm.runInNewContext(
    `${source.slice(start, end)}\nglobalThis.isReservationIntent = isReservationIntent;`,
    context
  );
  return context.isReservationIntent;
}

describe('Aurora boss command removal', () => {
  const wassengerSource = fs.readFileSync(wassengerPath, 'utf8');

  test('removes BOSS_DIRECT from executable source', () => {
    for (const filePath of sourceDirectories.flatMap(listJavaScriptFiles)) {
      expect(fs.readFileSync(filePath, 'utf8')).not.toContain('BOSS_DIRECT');
    }
  });

  test('does not import or execute aurora-boss-command from the webhook', () => {
    expect(wassengerSource).not.toContain('aurora-boss-command');
    expect(wassengerSource).not.toContain('BOSS COMMANDS: Aurora');
    expect(wassengerSource).not.toMatch(
      /isAuroraBossCommand|parseAuroraReservationData|executeAuroraBossReservation/
    );
  });

  test('routes the admin reservation wording to the normal form flow', () => {
    const message = 'quiero hacer una reserva para hoy a las 10pm, necesito un hot desk';
    const isReservationIntent = getReservationIntentDetector(wassengerSource);
    const form = new PartialReservationForm('admin-user');
    const updates = extractDataFromMessage(message, form);

    expect(isReservationIntent(message)).toBe(true);
    expect(wassengerSource).toContain("const _formInput = _hasAF ? (text || '') : processedText");
    expect(wassengerSource).toContain('processMessageWithForm(userId, _formInput, profile, currentAgentForm)');
    expect(wassengerSource).toContain("handleFormResult(formResult, userId, 'AURORA', profile)");
    expect(updates).toMatchObject({
      spaceType: 'hotDesk',
      time: '22:00'
    });
    expect(updates.date).toBeDefined();
  });

});
