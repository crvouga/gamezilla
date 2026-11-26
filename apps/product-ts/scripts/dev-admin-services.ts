// @io-wall-ok — owned localhost development services.
import { join } from 'node:path';
import { spawnOwned } from '@pkgs/dev-owner-server-ts/dev-owner-spawn';
import { infraEnv } from './boot-infra';
import { stopChild } from './boot-stack';
import type { ServiceContext } from './dev-services';
import { waitForHttp } from './free-port';
import { localAdminEnv } from './local-admin-env';
import { localApiEnv } from './local-api-env';
import { localProcessEnv } from './local-process-env';
import { isolatedSharedDataEnv } from './local-shared-data-env';
import { observeChildFailures } from './process-observability';

async function launch(
  context: ServiceContext,
  args: {
    readonly name: string;
    readonly origin: string;
    readonly probe: string;
    readonly command: readonly string[];
    readonly cwd: string;
    readonly env: Readonly<Record<string, string>>;
  }
) {
  const child = spawnOwned('bun', args.command, {
    cwd: args.cwd,
    env: args.env,
    stdio: ['inherit', 'inherit', 'pipe'],
  });
  observeChildFailures(
    child,
    {
      dataDir: context.plan.dataDir,
      instanceId: context.plan.options.instanceId,
    },
    args.name
  );
  const stop = () => stopChild(child);
  try {
    await waitForHttp(`${args.origin}${args.probe}`);
    return { value: { origin: args.origin }, children: [child], stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

export async function startAdminApi(context: ServiceContext) {
  const { plan } = context;
  if (plan.adminOrigin === null) return null;
  const [postgres, idp, openAi, s3, mqtt, observability] = await Promise.all([
    context.need('postgres'),
    context.need('idp'),
    context.need('openai'),
    context.need('s3'),
    context.need('mqtt'),
    context.need('observability'),
  ]);
  if (!postgres || !idp || !openAi)
    throw new Error(
      'Local administration needs the shared database, accounts and identity providers.'
    );
  const infra = infraEnv({
    databaseUrl: postgres.databaseUrl,
    openAiUrl: openAi.url,
    gitHubUrl: null,
    s3Endpoint: s3?.endpoint ?? null,
    mqtt,
    observability,
  });
  return launch(context, {
    name: 'admin-api',
    origin: `http://127.0.0.1:${String(plan.ports.adminApi)}`,
    probe: '/api/health',
    command: [
      '--no-env-file',
      'run',
      'apps/admin-api-ts/scripts/serve-local.ts',
    ],
    cwd: context.repoRoot,
    env: {
      ...localApiEnv(process.env),
      ...infra,
      ...isolatedSharedDataEnv(infra),
      ...idp.apiEnv,
      ...(await localAdminEnv(postgres.databaseUrl, idp.adminIdentities)),
      API_NODE_PORT: String(plan.ports.adminApi),
      API_URL: plan.adminOrigin,
      WEB_CLIENT_ORIGIN: plan.adminOrigin,
      WEB_CLIENT_APEX_ORIGIN: plan.adminOrigin,
    },
  });
}

export function startAdminClient(context: ServiceContext) {
  const { plan } = context;
  if (plan.adminOrigin === null) return Promise.resolve(null);
  return launch(context, {
    name: 'admin-client',
    origin: plan.adminOrigin,
    probe: '/',
    command: [
      '--no-env-file',
      'run',
      'vite',
      '--host',
      '127.0.0.1',
      '--port',
      new URL(plan.adminOrigin).port,
      '--strictPort',
    ],
    cwd: join(context.repoRoot, 'apps/admin-client-ts'),
    env: {
      ...localProcessEnv(process.env),
      LOCAL_ADMIN_API_ORIGIN: `http://127.0.0.1:${String(plan.ports.adminApi)}`,
    },
  });
}
