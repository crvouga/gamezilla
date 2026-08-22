#!/usr/bin/env bun
// @io-wall-ok
import { assert } from '@pkgs/assert';
import { EMQX_PRODUCT_CONFIG } from '../src/emqx-config';
import {
  ensureCustomDomain,
  ensureProject,
  ensureService,
  ensureServiceDomain,
  ensureVolume,
  upsertVariables,
  validateRailwayToken,
} from '@pkgs/emqx-server/railway/railway-api';
import { isProductionSecretsEnv } from '../../../tools/src/deploy-mode';
import { upsertDnsRecord } from '../src/cf-dns';
import { cliHttp } from '../src/cli-io';
import { info, ok } from '../src/fmt';

function cfHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env['CLOUDFLARE_API_TOKEN'] ?? ''}`,
    'Content-Type': 'application/json',
  };
}

async function railwayToken(): Promise<string> {
  const t = (process.env['RAILWAY_TOKEN'] ?? '').trim();
  assert.ok(t.length > 0, 'RAILWAY_TOKEN required to provision EMQX');
  await validateRailwayToken(t);
  return t;
}

async function findZoneId(): Promise<string | null> {
  const res = await cliHttp.fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${EMQX_PRODUCT_CONFIG.domain}&per_page=1`,
    { headers: cfHeaders() }
  );
  if (!res.ok) return null;
  const body = (await res.json()) as {
    result?: Array<{ id: string; name: string }>;
  };
  return body.result?.find((z) => z.name === EMQX_PRODUCT_CONFIG.domain)?.id ?? null;
}

async function provision(): Promise<void> {
  const zoneId = await findZoneId();
  assert.ok(zoneId !== null, 'emqx: Cloudflare zone must exist for DNS provisioning');

  const token = await railwayToken();
  const cfg = EMQX_PRODUCT_CONFIG.emqx;
  const githubRepo = `${EMQX_PRODUCT_CONFIG.github.owner}/${EMQX_PRODUCT_CONFIG.github.repo}`;

  const project = await ensureProject(token, cfg.railwayProjectName);
  ok('Railway project', `${project.name} (${project.id})`);

  const service = await ensureService({
    token,
    project,
    serviceName: cfg.railwayServiceName,
    githubRepo,
    rootDirectory: cfg.githubRootDirectory,
  });
  ok('Railway service', `${service.name} (${service.id})`);

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
  info('DNS CNAME', `${cfg.hostname} → ${cnameTarget}`);

  if (domain.verificationToken) {
    await upsertDnsRecord({
      zoneId,
      type: 'TXT',
      name: `_railway-verify.${cfg.hostname}`,
      content: domain.verificationToken,
    });
    info('DNS TXT', `_railway-verify.${cfg.hostname}`);
  }

  ok('EMQX domain', cfg.hostname);
}

if (!isProductionSecretsEnv()) {
  console.log('[emqx-server:provision] dry-run (SECRETS_ENV is not prd)');
  process.exit(0);
}

await provision();
