// @io-wall-ok — live smoke probe (production client assets Worker).
import { describe, expect, test } from 'bun:test';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { productionClientOrigin } from '@libs/secrets/shared/deploy-origins';
import { httpProbe } from '@libs/secrets/shared/http-probe';
import { isProductionSecretsEnv } from '@pkgs/secrets-config/deploy-mode';

const PROBE_TIMEOUT_MS = 15_000;

describe.skipIf(!isProductionSecretsEnv())('client worker (prd)', () => {
  for (const path of ['/', '/simulator']) {
    test(`www serves the app shell at ${path}`, async () => {
      const result = await httpProbe(
        `${productionClientOrigin()}${path}`,
        PROBE_TIMEOUT_MS
      );
      expect(result.status).toBe(200);
      expect(result.body ?? '').toContain('id="root"');
    });
  }

  test('apex domain serves or redirects to www', async () => {
    const result = await httpProbe(
      `https://${PRODUCT_CONFIG.domain}/`,
      PROBE_TIMEOUT_MS
    );
    expect(result.status ?? 0).toBeGreaterThanOrEqual(200);
    expect(result.status ?? 0).toBeLessThan(400);
  });
});
