// @io-wall-ok — tools composition root.

/**
 * What one boot of the stack settled before any of its processes started.
 *
 * `bun dev` runs every service as its own Turborepo task, so no process can
 * hand another a port. `dev:prepare` reserves them all here — the balancer's
 * has to be known first regardless: it is the API origin baked into OAuth
 * redirect URIs and the IdP clients — and each task binds the one planned for
 * it. A port is planned for a service the options turn off as well, so the
 * same service keeps the same port across boots whatever the flags.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PortReservation } from './free-port';
import { reservePort } from './free-port';
import { instanceDataDir, stackRootDir } from './manifest';
import type { StackOptions } from './stack-options';
import { withdrawAllServices } from './stack-services';

export type StackPlan = {
  readonly options: StackOptions;
  /** Where every service of this instance keeps its state. */
  readonly dataDir: string;
  /** The balancer: the single API origin every client is given. */
  readonly apiOrigin: string;
  /** Null when the stack runs without the web app. */
  readonly webOrigin: string | null;
  readonly ports: {
    readonly api: number;
    readonly google: number;
    readonly apple: number;
    readonly billing: number;
    readonly web: number | null;
    readonly postgres: number;
    readonly openAi: number;
    readonly s3: number;
    readonly mqtt: number;
    readonly mqttWs: number;
    readonly observability: {
      readonly collector: number;
      readonly tempo: number;
      readonly grafana: number;
    };
    /** One per API instance behind the balancer. */
    readonly apiNodes: readonly number[];
    /** One per synthetic population worker. */
    readonly population: readonly number[];
  };
};

function loopback(port: number): string {
  return `http://127.0.0.1:${String(port)}`;
}

export function planPath(repoRoot: string, instanceId: string): string {
  return join(stackRootDir(repoRoot), instanceId, 'plan.json');
}

/**
 * Empty the instance (unless it keeps its data) and plan its ports. Every
 * placeholder is held until all are chosen, so no two services of this stack
 * are handed the same number.
 */
export async function createStackPlan(
  repoRoot: string,
  options: StackOptions
): Promise<StackPlan> {
  // A plan from the last boot must not outlive a failure to write this one.
  rmSync(planPath(repoRoot, options.instanceId), { force: true });
  const dataDir = instanceDataDir(repoRoot, options);
  withdrawAllServices(dataDir);
  const held: PortReservation[] = [];
  const take = (port = 0): number => {
    const reservation = reservePort(port);
    held.push(reservation);
    return reservation.port;
  };
  try {
    const ports: StackPlan['ports'] = {
      api: take(),
      google: take(),
      apple: take(),
      billing: take(),
      web: options.withWeb ? take(options.webPort ?? 0) : null,
      postgres: take(),
      openAi: take(),
      s3: take(),
      mqtt: take(),
      mqttWs: take(),
      observability: { collector: take(), tempo: take(), grafana: take() },
      apiNodes: Array.from({ length: options.apiNodes }, () => take()),
      population: Array.from(
        { length: options.syntheticPopulationWorkers },
        () => take()
      ),
    };
    const plan: StackPlan = {
      options,
      dataDir,
      apiOrigin: loopback(ports.api),
      webOrigin: ports.web === null ? null : loopback(ports.web),
      ports,
    };
    writeFileSync(
      planPath(repoRoot, options.instanceId),
      `${JSON.stringify(plan, null, 2)}\n`,
      'utf8'
    );
    return plan;
  } finally {
    await Promise.all(held.map((reservation) => reservation.release()));
  }
}

export function readPlan(repoRoot: string, instanceId: string): StackPlan {
  const path = planPath(repoRoot, instanceId);
  if (!existsSync(path)) {
    throw new Error(
      `no plan for stack instance '${instanceId}' — \`dev:prepare\` writes it (${path})`
    );
  }
  return JSON.parse(readFileSync(path, 'utf8')) as StackPlan;
}
