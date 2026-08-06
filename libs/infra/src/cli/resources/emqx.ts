import { assert } from '@pkgs/assert';
import { PROJECT_CONFIG } from '../../project-config';
import { deleteDnsRecordsByName, upsertDnsRecord } from '../lib/cf-dns';
import { info, ok, warn } from '../lib/fmt';
import {
  deleteService,
  ensureCustomDomain,
  ensureProject,
  ensureService,
  ensureServiceDomain,
  ensureVolume,
  listProjects,
  redeployService,
  upsertVariables,
  validateRailwayToken,
} from '../lib/railway-api';
import type { CiPlatform } from '../platform/platform';
import { cfHeaders } from '../secrets/cloudflare';
import { ResourceBase, type InfraContext } from './types';

async function railwayToken(): Promise<string> {
  const t = (process.env['RAILWAY_TOKEN'] ?? '').trim();
  assert.ok(t.length > 0, 'RAILWAY_TOKEN required to provision EMQX');
  await validateRailwayToken(t);
  return t;
}

export class EmqxResource extends ResourceBase {
  readonly id = 'emqx';

  async provision(_platform: CiPlatform, ctx: InfraContext): Promise<void> {
    assert.ok(!!ctx.zoneId, 'emqx: ctx.zoneId must be set by ZoneResource');
    const token = await railwayToken();
    const cfg = PROJECT_CONFIG.emqx;
    const githubRepo = `${PROJECT_CONFIG.github.owner}/${PROJECT_CONFIG.github.repo}`;

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
      zoneId: ctx.zoneId!,
      type: 'CNAME',
      name: cfg.hostname,
      content: cnameTarget,
      proxied: false,
    });
    info('DNS CNAME', `${cfg.hostname} → ${cnameTarget}`);

    if (domain.verificationToken) {
      await upsertDnsRecord({
        zoneId: ctx.zoneId!,
        type: 'TXT',
        name: `_railway-verify.${cfg.hostname}`,
        content: domain.verificationToken,
      });
      info('DNS TXT', `_railway-verify.${cfg.hostname}`);
    }

    ok('EMQX domain', cfg.hostname);
  }

  async deploy(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    const token = await railwayToken();
    const cfg = PROJECT_CONFIG.emqx;
    const listed = await listProjects(token);
    const match = listed.find((p) => p.project.name === cfg.railwayProjectName);
    const service = match?.services.find(
      (s) => s.name === cfg.railwayServiceName
    );
    if (!match || !service) {
      warn('EMQX deploy', 'project/service missing — run provision first');
      return;
    }
    await redeployService({
      token,
      serviceId: service.id,
      environmentId: match.project.environmentId,
    });
    ok('EMQX redeploy', 'triggered');
  }

  async destroy(_platform: CiPlatform): Promise<void> {
    const token = (process.env['RAILWAY_TOKEN'] ?? '').trim();
    if (token.length === 0) {
      warn('EMQX destroy', 'RAILWAY_TOKEN unset — skipping');
      return;
    }
    const cfg = PROJECT_CONFIG.emqx;
    const listed = await listProjects(token);
    const match = listed.find((p) => p.project.name === cfg.railwayProjectName);
    const service = match?.services.find(
      (s) => s.name === cfg.railwayServiceName
    );
    if (service) {
      await deleteService(token, service.id);
      ok('EMQX service', 'deleted');
    }

    const zoneId = await findZoneId();
    if (zoneId) {
      await deleteDnsRecordsByName({
        zoneId,
        name: cfg.hostname,
        types: ['CNAME'],
      });
      await deleteDnsRecordsByName({
        zoneId,
        name: `_railway-verify.${cfg.hostname}`,
        types: ['TXT'],
      });
    }
  }
}

async function findZoneId(): Promise<string | null> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${PROJECT_CONFIG.domain}&per_page=1`,
    { headers: cfHeaders() }
  );
  if (!res.ok) return null;
  const body = (await res.json()) as {
    result?: Array<{ id: string; name: string }>;
  };
  return body.result?.find((z) => z.name === PROJECT_CONFIG.domain)?.id ?? null;
}
