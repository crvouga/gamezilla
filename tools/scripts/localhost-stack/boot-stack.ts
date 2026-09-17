// @io-wall-ok — tools composition root.

/**
 * Boot the whole product on loopback: backing services, a simulated Google,
 * N API instances, the balancer in front of them, and (optionally) the built
 * web bundle.
 *
 * Every port is OS-assigned and every piece of state lives under one
 * instance directory, so several stacks run side by side with no
 * coordination beyond the manifest each one writes.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { bootInfra, type InfraHandles } from './boot-infra';
import { reservePort, waitForHttp } from './free-port';
import { startLoadBalancer } from './load-balancer';
import { type StackManifest, writeManifest } from './manifest';
import type { StackOptions } from './stack-options';

const REPO_ROOT = join(import.meta.dir, '../../..');
const AUTH_SECRET = 'localhost-stack-auth-secret-0123456789';
const GOOGLE_CLIENT_ID = 'localhost-stack.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = 'localhost-stack-google-secret';

export type LocalhostStack = {
  readonly manifest: StackManifest;
  readonly manifestPath: string;
  stop(): Promise<void>;
};

function nodeId(index: number): string {
  return `api-${String.fromCharCode(97 + index)}`;
}

function turboTask(
  packageName: string
): [string, string, string, string, string] {
  return ['run', 'turbo', 'run', 'stack', `--filter=${packageName}`];
}

function killChild(child: ChildProcess): void {
  if (child.exitCode !== null || child.killed) return;
  try {
    child.kill('SIGTERM');
  } catch {
    // already gone
  }
}

async function startIdp(args: {
  readonly apiOrigin: string;
  readonly port: number;
}): Promise<ChildProcess> {
  const child = spawn('bun', turboTask('@pkgs/idp-google-sim'), {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      IDP_PORT: String(args.port),
      IDP_CLIENT_ID: GOOGLE_CLIENT_ID,
      IDP_CLIENT_SECRET: GOOGLE_CLIENT_SECRET,
      IDP_REDIRECT_URIS: `${args.apiOrigin}/api/auth/callback/google`,
      IDP_APP_NAME: 'Gamezilla',
    },
  });
  await waitForHttp(
    `http://127.0.0.1:${String(args.port)}/.well-known/openid-configuration`
  );
  return child;
}

function startApiNode(args: {
  readonly id: string;
  readonly port: number;
  readonly apiOrigin: string;
  readonly idpOrigin: string;
  readonly infraEnv: Readonly<Record<string, string>>;
}): ChildProcess {
  return spawn('bun', turboTask('@apps/server'), {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...args.infraEnv,
      API_NODE_ID: args.id,
      API_NODE_PORT: String(args.port),
      SECRETS_ENV: 'dev',
      API_URL: args.apiOrigin,
      AUTH_SECRET,
      WEB_CLIENT_GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
      WEB_CLIENT_GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT_SECRET,
      GOOGLE_IDP_ORIGIN: args.idpOrigin,
      OBSERVABILITY_BACKEND: 'noop',
    },
  });
}

async function startWeb(args: {
  readonly port: number;
  readonly apiOrigin: string;
}): Promise<ChildProcess> {
  const child = spawn('bun', turboTask('@apps/client'), {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      PREVIEW_PORT: String(args.port),
      // Same-origin `/api/*` proxy: the bundle needs no baked-in API origin,
      // so a dynamically-ported stack does not require a rebuild.
      LOCAL_PREVIEW_API_ORIGIN: args.apiOrigin,
    },
  });
  await waitForHttp(`http://127.0.0.1:${String(args.port)}/`);
  return child;
}

function instanceDataDir(options: StackOptions): string {
  const dir = join(REPO_ROOT, '.cache', 'localhost-stack', options.instanceId);
  if (!options.keepData) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function startApiTier(args: {
  readonly options: StackOptions;
  readonly apiOrigin: string;
  readonly idpOrigin: string;
  readonly infra: InfraHandles;
}): Promise<{
  readonly children: ChildProcess[];
  readonly backends: { readonly id: string; readonly origin: string }[];
}> {
  const children: ChildProcess[] = [];
  const backends: { readonly id: string; readonly origin: string }[] = [];
  for (let index = 0; index < args.options.apiNodes; index += 1) {
    const reservation = reservePort();
    reservation.release();
    const id = nodeId(index);
    children.push(
      startApiNode({
        id,
        port: reservation.port,
        apiOrigin: args.apiOrigin,
        idpOrigin: args.idpOrigin,
        infraEnv: args.infra.env,
      })
    );
    backends.push({
      id,
      origin: `http://127.0.0.1:${String(reservation.port)}`,
    });
  }
  for (const backend of backends) {
    await waitForHttp(`${backend.origin}/api/health`, 90_000);
  }
  return { children, backends };
}

export async function bootLocalhostStack(
  options: StackOptions
): Promise<LocalhostStack> {
  const dataDir = instanceDataDir(options);
  // The balancer's port must be known before anything else boots: it is the
  // API origin baked into OAuth redirect URIs and the IdP client.
  const lbReservation = reservePort();
  const idpReservation = reservePort();
  const apiOrigin = `http://127.0.0.1:${String(lbReservation.port)}`;
  const idpOrigin = `http://127.0.0.1:${String(idpReservation.port)}`;

  const infra = await bootInfra({ options, dataDir });
  idpReservation.release();
  const idpChild = await startIdp({ apiOrigin, port: idpReservation.port });
  const api = await startApiTier({ options, apiOrigin, idpOrigin, infra });
  lbReservation.release();
  const balancer = startLoadBalancer({
    port: lbReservation.port,
    backends: api.backends,
  });
  await waitForHttp(`${balancer.origin}/api/health`);

  const webReservation = options.withWeb ? reservePort() : null;
  webReservation?.release();
  const webChild =
    webReservation === null
      ? null
      : await startWeb({ port: webReservation.port, apiOrigin });

  const manifest: StackManifest = {
    instanceId: options.instanceId,
    startedAtMs: Date.now(),
    apiOrigin: balancer.origin,
    apiNodes: api.backends,
    webOrigin:
      webReservation === null
        ? ''
        : `http://127.0.0.1:${String(webReservation.port)}`,
    idpOrigin,
    databaseUrl: infra.databaseUrl,
    s3Endpoint: infra.s3Endpoint,
    emqxWssUrl: infra.emqxWssUrl,
    emqxApiUrl: infra.emqxApiUrl,
    dataDir,
  };
  const path = writeManifest(REPO_ROOT, manifest);

  return {
    manifest,
    manifestPath: path,
    async stop() {
      if (webChild !== null) killChild(webChild);
      for (const child of api.children) killChild(child);
      killChild(idpChild);
      await balancer.stop();
      await infra.stop();
    },
  };
}
