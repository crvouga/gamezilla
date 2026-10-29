#!/usr/bin/env bun

// @io-wall-ok — tools composition root.

/**
 * One process of the `bun dev` stack, in the foreground.
 *
 * `dev-service.ts <service>` is the Turborepo task `dev:<service>`: it starts
 * that service on its planned port, publishes it for the services that depend
 * on it, and holds until the task is stopped. `dev-service.ts ready` is the
 * `dev` task, the stack's front door: it waits for every service and
 * publishes the manifest, the address book every consumer (tests, a browser,
 * another agent) reads rather than assuming a port.
 */

import { existsSync } from 'node:fs';
import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';
import { devStackOptions } from './dev-options';
import { resolveDevRepoRoot } from './dev-repo-root';
import {
  type RunningService,
  type ServiceContext,
  startService,
} from './dev-services';
import {
  developmentManifest,
  readDevelopmentServices,
} from './development-readiness';
import { removeManifest, writeManifest } from './manifest';
import {
  expectChildExit,
  installProcessDiagnostics,
  recordProcessFailure,
  waitForChildDiagnostics,
} from './process-observability';
import { readPlan, type StackPlan } from './stack-plan';
import {
  awaitService,
  publishFailed,
  publishOff,
  publishReady,
  SERVICE_NAMES,
  type ServiceName,
  type StackServices,
  withdrawService,
} from './stack-services';

const REPO_ROOT = resolveDevRepoRoot(import.meta.dir, existsSync);
const STOP_GRACE_MS = 5_000;

function say(name: string, message: string): void {
  process.stdout.write(`[${name}] ${message}\n`);
}

/** Hold the process open until Turborepo (or a terminal) stops the task. */
function holdUntilStopped(stop: () => Promise<void>): Promise<never> {
  let stopping = false;
  const onSignal = (): void => {
    if (stopping) return;
    stopping = true;
    void stop().finally(() => process.exit(0));
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)
    process.on(signal, onSignal);
  return new Promise<never>(() => {
    // held open by the signal handlers above
  });
}

async function runService<K extends ServiceName>(
  plan: StackPlan,
  name: K
): Promise<never> {
  const context: ServiceContext = {
    plan,
    repoRoot: REPO_ROOT,
    need: (other) => awaitService(plan, other),
  };
  let running: RunningService<StackServices[K]> | null;
  try {
    running = await startService(name, context);
  } catch (error) {
    recordProcessFailure(
      { instanceId: plan.options.instanceId, dataDir: plan.dataDir },
      {
        serviceName: `${NAMESPACE}-${name}`,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    );
    publishFailed(
      plan,
      name,
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
  if (running === null) {
    publishOff(plan, name);
    say(name, 'off for this stack');
    process.exit(0);
  }
  const service = running;
  publishReady(plan, name, service.value);
  say(name, 'ready');

  let stopped = false;
  const stop = async (): Promise<void> => {
    stopped = true;
    withdrawService(plan, name);
    // Turborepo gives a stopping task only so long before it kills the task
    // and leaves its processes behind: end one that is still draining.
    await Promise.race([service.stop(), Bun.sleep(STOP_GRACE_MS)]);
    for (const child of service.children ?? []) {
      if (child.exitCode === null && child.signalCode === null) {
        expectChildExit(child);
        child.kill('SIGKILL');
      }
    }
  };
  // A service whose process died is no longer serving, whatever it published.
  for (const child of service.children ?? []) {
    child.once('exit', (code, signal) => {
      if (stopped) return;
      say(name, `a process exited (${signal ?? `code ${String(code)}`})`);
      void waitForChildDiagnostics(child)
        .then(stop)
        .finally(() => process.exit(1));
    });
  }
  return holdUntilStopped(stop);
}

async function runFrontDoor(plan: StackPlan): Promise<never> {
  const services = await readDevelopmentServices(
    (name) => awaitService(plan, name),
    (name, error) =>
      say(
        'stack',
        `${name} unavailable: ${error instanceof Error ? error.message : String(error)}`
      )
  );
  const manifest = developmentManifest(plan, services, Date.now());
  const manifestPath = writeManifest(REPO_ROOT, manifest);
  say('stack', `addresses — ${manifestPath}`);
  if (services.web !== null) say('stack', `app: ${services.web.origin}/`);
  say('stack', 'Ctrl-C to stop');
  // A manifest must not point at processes that are gone.
  process.on('exit', () => {
    removeManifest(REPO_ROOT, plan.options.instanceId);
  });
  return holdUntilStopped(() => Promise.resolve());
}

const target = process.argv[2];
const plan = readPlan(REPO_ROOT, devStackOptions().instanceId);
installProcessDiagnostics(
  { instanceId: plan.options.instanceId, dataDir: plan.dataDir },
  `${NAMESPACE}-${target ?? 'stack'}`
);
if (target === 'ready') {
  await runFrontDoor(plan);
} else if ((SERVICE_NAMES as readonly string[]).includes(target ?? '')) {
  await runService(plan, target as ServiceName);
} else {
  throw new Error(
    `usage: dev-service.ts <ready|${SERVICE_NAMES.join('|')}> (got '${String(target)}')`
  );
}
