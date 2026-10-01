import { describe, test, expect } from '@jest/globals';

import { getHealthStatusCode } from '../../src/utils/observability.js';

describe('getHealthStatusCode', () => {
  test.each([
    ['healthy', 200],
    ['warning', 200],
    ['unhealthy', 503],
  ])('%s devuelve HTTP %i', (status, expectedStatusCode) => {
    expect(getHealthStatusCode(status)).toBe(expectedStatusCode);
  });
});
