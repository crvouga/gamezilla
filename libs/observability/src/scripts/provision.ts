#!/usr/bin/env bun
// @io-wall-ok
import { join } from 'node:path';
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { createLogger } from '@pkgs/logger';
import { createRepoTreeObjectStore } from '@pkgs/object-store-node-fs/repo-tree-store';
import { createSecretAdminStore } from '@pkgs/secret-provider';
import { isProductionSecretsEnv } from '@pkgs/secrets-config/deploy-mode';
import { ObservabilitySecretName } from '../public/secret-names';
import { ensureGrafanaCloudTraces } from '../server/ensure-grafana-cloud-traces';

const log = createLogger({
  name: 'observability:provision',
  now: wallClock.now,
});

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const ENV = 'prd';

async function provision(): Promise<void> {
  const store = await createSecretAdminStore({
    repoRoot: REPO_ROOT,
    configStore: createRepoTreeObjectStore({ rootDir: REPO_ROOT }),
  });
  const stored = await store.exportSecrets(ENV);
  const apiToken = (
    stored.get(ObservabilitySecretName.grafanaCloudApiToken) ?? ''
  ).trim();
  if (apiToken.length === 0) {
    throw new Error(
      `${ObservabilitySecretName.grafanaCloudApiToken} missing in secrets env ${ENV}. ` +
        `Run \`bun run secrets:seed -- --env ${ENV} ${ObservabilitySecretName.grafanaCloudApiToken}\` ` +
        '(or set OBSERVABILITY_ENABLED=0 to deploy without tracing).'
    );
  }

  const { secrets } = await ensureGrafanaCloudTraces({
    http: createGlobalHttpClient(),
    timers: wallTimers,
    apiToken,
    config: PRODUCT_CONFIG.observability,
    stored,
    log: (line) => log.info(line),
  });

  for (const [name, value] of Object.entries(secrets)) {
    if ((stored.get(name) ?? '').trim() === value) continue;
    await store.setSecret(name, value, ENV);
    log.info(`· ${name} written to secrets env ${ENV}`);
  }
  log.info('✓ Grafana Cloud traces provisioned');
}

if (!isProductionSecretsEnv()) {
  log.info('[observability:provision] dry-run (SECRETS_ENV is not prd)');
  process.exit(0);
}
if ((process.env['OBSERVABILITY_ENABLED'] ?? '').trim() === '0') {
  log.info('[observability:provision] skipped (OBSERVABILITY_ENABLED=0)');
  process.exit(0);
}

await provision();
