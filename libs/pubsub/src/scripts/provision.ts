#!/usr/bin/env bun
// @io-wall-ok
import { PRODUCT_CONFIG } from '@libs/db/public/product-config';
import {
  cfHeadersForZones,
  upsertDnsRecord,
} from '../shared/provision/cf-dns';
import { assert } from '@pkgs/assert';
import {
  ensureCustomDomain,
  ensureProject,
  ensureService,
  ensureServiceDomain,
  ensureVolume,
  upsertVariables,
  validateRailwayToken,
} from '@pkgs/emqx-server/railway/railway-api';
import { isProductionSecretsEnv } from '../../../../tools/src/deploy-mode';

async function railwayToken(): Promise<string> {
  const t = (process.env['RAILWAY_TOKEN'] ?? '').trim();
  assert.ok(t.length > 0, 'RAILWAY_TOKEN required to provision EMQX');
  await validateRailwayToken(t);
  return t;
}

async function findZoneId(): Promise<string | null> {
  const domain = PRODUCT_CONFIG.domain;
  const res = await fetch(
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
  console.log(`✓ Railway project — ${project.name} (${project.id})`);

  const service = await ensureService({
    token,
    project,
    serviceName: cfg.railwayServiceName,
    githubRepo,
    rootDirectory: cfg.githubRootDirectory,
  });
  console.log(`✓ Railway service — ${service.name} (${service.id})`);

  await upsertVariables({
    token,
    projectId: project.id,
    environmentId: project.environmentId,
    serviceId: service.id,
    variables: {
      PORT: String(cfg.targetPort),
      EMQX_API_KEY__BOOTSTRAP_FILE: '/opt/emqx/data/api-keys.bootstrap',
    },
  });

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
  await upsertDnsRecord({
    zoneId,
    type: 'CNAME',
    name: cfg.hostname,
    content: cnameTarget,
    proxied: false,
  });
  console.log(`· DNS CNAME — ${cfg.hostname} → ${cnameTarget}`);

  if (domain.verificationToken) {
    await upsertDnsRecord({
      zoneId,
      type: 'TXT',
      name: `_railway-verify.${cfg.hostname}`,
      content: domain.verificationToken,
    });
    console.log(`· DNS TXT — _railway-verify.${cfg.hostname}`);
  }

  console.log(`✓ EMQX domain — ${cfg.hostname}`);
}

if (!isProductionSecretsEnv()) {
  console.log('[pubsub:provision] dry-run (SECRETS_ENV is not prd)');
  process.exit(0);
}

await provision();
