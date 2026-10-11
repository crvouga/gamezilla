// @io-wall-ok — tools composition root.

/**
 * The stack, one service per process.
 *
 * Each entry is what the Turborepo task `dev:<name>` runs (`dev-service.ts`):
 * start one service on the port the plan gave it, waiting first for the ones
 * it talks to. Turborepo is the only thing that runs them side by side; the
 * same starters boot a whole stack in one process for a test run
 * (`boot-stack.ts`).
 */

import type { ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import {
  infraEnv,
  startMqtt,
  startOpenAi,
  startPostgres,
  startS3,
} from './boot-infra';
import {
  resolveIdpState,
  startApiTier,
  startBillingProvider,
  startWeb,
  stopChild,
} from './boot-stack';
import { waitForHttp } from './free-port';
import { startLoadBalancer } from './load-balancer';
import { configureLocalPopulation } from './local-population';
import type { StackPlan } from './stack-plan';
import type { ServiceName, StackServices } from './stack-services';
import { startStackIdps } from './start-idps';
import { startObservabilityStack } from './start-observability-stack';
import {
  startSyntheticPopulationSidecars,
  syntheticPopulationStackSecrets,
} from './synthetic-population-sidecars';

export type ServiceContext = {
  readonly plan: StackPlan;
  readonly repoRoot: string;
  /** What another service published; null when the stack runs without it. */
  need<K extends ServiceName>(name: K): Promise<StackServices[K] | null>;
};

export type RunningService<T> = {
  /** What dependents are told once this service can serve. */
  readonly value: T;
  /** Processes this service is made of: when one exits, so has the service. */
  readonly children?: readonly ChildProcess[];
  stop(): Promise<void>;
};

/** Null when the stack's options turn the service off. */
type Service<K extends ServiceName> = (
  context: ServiceContext
) => Promise<RunningService<StackServices[K]> | null>;

/** A service every stack has: its absence is a broken boot, not an option. */
async function required<K extends ServiceName>(
  context: ServiceContext,
  name: K
): Promise<StackServices[K]> {
  const value = await context.need(name);
  if (value === null) throw new Error(`the stack cannot run without ${name}`);
  return value;
}

const DEV_SERVICES: { readonly [K in ServiceName]: Service<K> } = {
  async postgres({ plan }) {
    const postgres = await startPostgres({
      port: plan.ports.postgres,
      dataDir: plan.dataDir,
    });
    try {
      // Before the service is announced: no worker may claim a lease first.
      await configureLocalPopulation(
        postgres.url,
        plan.options.syntheticPopulationWorkers
      );
    } catch (error) {
      await postgres.stop();
      throw error;
    }
    return { value: { databaseUrl: postgres.url }, stop: postgres.stop };
  },

  async openai({ plan }) {
    const server = await startOpenAi({ port: plan.ports.openAi });
    return { value: { url: server.url }, stop: () => server.close() };
  },

  async s3({ plan }) {
    if (!plan.options.withS3) return null;
    const s3 = await startS3({ port: plan.ports.s3 });
    return { value: { endpoint: s3.endpoint }, stop: s3.stop };
  },

  async mqtt({ plan }) {
    if (!plan.options.withMqtt) return null;
    const mqtt = await startMqtt({
      mqttPort: plan.ports.mqtt,
      wsPort: plan.ports.mqttWs,
    });
    return {
      value: { wssUrl: mqtt.wssUrl, mqttUrl: mqtt.mqttUrl },
      stop: mqtt.stop,
    };
  },

  async observability({ plan }) {
    const backend = plan.options.observabilityBackend;
    if (backend === 'off') return null;
    const { stop, ...value } = await startObservabilityStack({
      backend,
      dataDir: join(plan.dataDir, 'observability'),
      instanceId: plan.options.instanceId,
      ports: plan.ports.observability,
    });
    return { value, stop };
  },

  async idp({ plan }) {
    const idps = await startStackIdps({
      apiOrigin: plan.apiOrigin,
      ports: { google: plan.ports.google, apple: plan.ports.apple },
      state: resolveIdpState(plan.options, plan.dataDir),
    });
    return {
      value: {
        google: idps.google.url,
        apple: idps.apple.url,
        apiEnv: idps.apiEnv,
      },
      async stop() {
        await Promise.all([idps.google.close(), idps.apple.close()]);
      },
    };
  },

  async billing({ plan }) {
    const billing = await startBillingProvider({
      apiOrigin: plan.apiOrigin,
      port: plan.ports.billing,
      dataDir: plan.dataDir,
    });
    return {
      value: {
        origin: billing.server.url,
        webhookSecret: billing.webhookSecret,
      },
      stop: () => billing.server.close(),
    };
  },

  /** The API: N instances of the production Worker behind one balancer. */
  async server(context) {
    const { plan } = context;
    const [postgres, openai, s3, mqtt, observability, idp, billing] =
      await Promise.all([
        required(context, 'postgres'),
        required(context, 'openai'),
        context.need('s3'),
        context.need('mqtt'),
        context.need('observability'),
        required(context, 'idp'),
        required(context, 'billing'),
      ]);
    const tier = await startApiTier({
      options: plan.options,
      apiOrigin: plan.apiOrigin,
      idpEnv: idp.apiEnv,
      billing,
      webOrigin: plan.webOrigin,
      infraEnv: infraEnv({
        databaseUrl: postgres.databaseUrl,
        openAiUrl: openai.url,
        s3Endpoint: s3?.endpoint ?? null,
        mqtt,
        observability,
      }),
      syntheticPopulationSecrets: syntheticPopulationStackSecrets(plan.dataDir),
      ports: plan.ports.apiNodes,
    });
    const balancer = startLoadBalancer({
      port: plan.ports.api,
      backends: tier.backends,
    });
    await waitForHttp(`${balancer.origin}/api/health`);
    return {
      value: { apiOrigin: balancer.origin, nodes: tier.backends },
      children: tier.children,
      async stop() {
        await Promise.all(tier.children.map(stopChild));
        await balancer.stop();
      },
    };
  },

  async population(context) {
    const { plan } = context;
    const workers = plan.options.syntheticPopulationWorkers;
    if (workers === 0) return null;
    const server = await required(context, 'server');
    const token = syntheticPopulationStackSecrets(plan.dataDir)[
      'POPULATION_WORKER_TOKEN'
    ];
    if (token === undefined) throw new Error('population: no worker token');
    const children: ChildProcess[] = [];
    const stop = async (): Promise<void> => {
      await Promise.all(children.map(stopChild));
    };
    try {
      await startSyntheticPopulationSidecars({
        repoRoot: context.repoRoot,
        origin: server.apiOrigin,
        count: workers,
        token,
        ports: plan.ports.population,
        track: (child) => children.push(child),
      });
    } catch (error) {
      await stop();
      throw error;
    }
    return { value: { workers }, children, stop };
  },

  /** The product web app (`/`, `/harness`, `/simulator`): Vite itself. */
  async web(context) {
    const { plan } = context;
    if (plan.webOrigin === null) return null;
    const server = await required(context, 'server');
    const child = await startWeb({
      origin: plan.webOrigin,
      apiOrigin: server.apiOrigin,
      frozen: plan.options.frozenWeb,
      testHooks: plan.options.testHooks,
    });
    return {
      value: { origin: plan.webOrigin },
      children: [child],
      stop: () => stopChild(child),
    };
  },
};

/** Start `name`; null when the stack's options turn it off. */
export function startService<K extends ServiceName>(
  name: K,
  context: ServiceContext
): Promise<RunningService<StackServices[K]> | null> {
  const service: Service<K> = DEV_SERVICES[name];
  return service(context);
}
