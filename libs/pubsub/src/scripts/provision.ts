#!/usr/bin/env bun
// @io-wall-ok
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import { assert } from '@pkgs/assert';
import { wallClock } from '@pkgs/clock';
import {
  ensureCustomDomain,
  ensureProject,
  ensureService,
  ensureServiceDomain,
  ensureVolume,
  validateRailwayToken,
} from '@pkgs/emqx-server/railway/railway-api';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { createLogger } from '@pkgs/logger';
import { isProductionSecretsEnv } from '@pkgs/secrets-config/deploy-mode';
import { cfHeadersForZones, upsertDnsRecord } from '../shared/provision/cf-dns';
import { ensureBrokerCredentials } from './ensure-broker-credentials';

const log = createLogger({ name: 'pubsub:provision', now: wallClock.now });

const http = createGlobalHttpClient();

async function railwayToken(): Promise<string> {
  const t = (process.env['RAILWAY_TOKEN'] ?? '').trim();
  assert.ok(t.length > 0, 'RAILWAY_TOKEN required to provision EMQX');
  await validateRailwayToken(t);
  return t;
}

async function findZoneId(): Promise<string | null> {
  const domain = PRODUCT_CONFIG.domain;
  const res = await http.fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${domain}&per_page=1`,
    { headers: cfHeadersForZones() }
  );
  if (!res.ok) return null;
  const body = (await res.json()) as {
    result?: Array<{ id: string; name: string }>;
  };
  return body.result?.find((z) => z.name === domain)?.id ?? null;
}

async function provision(): Promise<void> {
  const zoneId = await findZoneId();
  assert.ok(
    zoneId !== null,
    'emqx: Cloudflare zone must exist for DNS provisioning'
  );

  const token = await railwayToken();
  const cfg = PRODUCT_CONFIG.emqx;
  const githubRepo = `${PRODUCT_CONFIG.github.owner}/${PRODUCT_CONFIG.github.repo}`;
  const preferredWorkspace =
    cfg.railwayWorkspaceName.length > 0 ? cfg.railwayWorkspaceName : undefined;

  const project = await ensureProject(
    token,
    cfg.railwayProjectName,
    preferredWorkspace === undefined
      ? undefined
      : { preferredWorkspaceName: preferredWorkspace }
  );
  log.info(`✓ Railway project — ${project.name} (${project.id})`);

  const service = await ensureService({
    token,
    project,
    serviceName: cfg.railwayServiceName,
    githubRepo,
    rootDirectory: cfg.githubRootDirectory,
  });
  log.info(`✓ Railway service — ${service.name} (${service.id})`);

  await ensureVolume({
    token,
    projectId: project.id,
    environmentId: project.environmentId,
    serviceId: service.id,
    mountPath: '/opt/emqx/data',
  });

  await ensureServiceDomain({
    token,
    serviceId: service.id,
    environmentId: project.environmentId,
  });

  const domain = await ensureCustomDomain({
    token,
    projectId: project.id,
    serviceId: service.id,
    environmentId: project.environmentId,
    domain: cfg.hostname,
    targetPort: cfg.targetPort,
  });

  const cnameTarget = domain.cnameTarget ?? `${service.name}.up.railway.app`;
  await upsertDnsRecord(http, {
    zoneId,
    type: 'CNAME',
    name: cfg.hostname,
    content: cnameTarget,
    proxied: false,
  });
  log.info(`· DNS CNAME — ${cfg.hostname} → ${cnameTarget}`);

  if (domain.verificationToken) {
    await upsertDnsRecord(http, {
      zoneId,
      type: 'TXT',
      name: `_railway-verify.${cfg.hostname}`,
      content: domain.verificationToken,
    });
    log.info(`· DNS TXT — _railway-verify.${cfg.hostname}`);
  }

  log.info(`✓ EMQX domain — ${cfg.hostname}`);

  await ensureBrokerCredentials({
    service: {
      token,
      projectId: project.id,
      environmentId: project.environmentId,
      serviceId: service.id,
    },
    apiUrl: `https://${cfg.hostname}`,
    baseVariables: { PORT: String(cfg.targetPort) },
    http,
    log,
  });
}

if (!isProductionSecretsEnv()) {
  log.info('[pubsub:provision] dry-run (SECRETS_ENV is not prd)');
  process.exit(0);
}

await provision();
