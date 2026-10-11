// @io-wall-ok — tools composition root.

/** The backing services an API instance shares with its peers. */

import { join } from 'node:path';
import { DEFAULT_TOKEN } from '@crvouga/mockingbird-service-openai';
import { createServer as createOpenAiServer } from '@crvouga/mockingbird-service-openai/server';
import { startAedesServer } from '@pkgs/aedes-server/start';
import { startMockingbirdPostgres } from '@pkgs/postgres-mockingbird-server/start';
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  startS3Server,
} from '@pkgs/s3-server/s3-server';

import { runLocalMigrate } from '../../server/scripts/run-local-postgres-migrate';
import { runLocalSeed } from '../../server/scripts/run-local-postgres-seed';
import { reservePort } from './free-port';
import type { StackOptions } from './stack-options';
import { startObservabilityStack } from './start-observability-stack';

export type InfraHandles = {
  readonly databaseUrl: string;
  readonly s3Endpoint: string | null;
  readonly mqttWssUrl: string | null;
  readonly mqttUrl: string | null;
  readonly observabilityCollectorUrl: string | null;
  readonly observabilityTraceDir: string | null;
  readonly observabilityTempoUrl: string | null;
  readonly observabilityGrafanaUrl: string | null;
  /** Environment the API instances need to reach all of the above. */
  readonly env: Readonly<Record<string, string>>;
  stop(): Promise<void>;
};

/** A port the kernel just handed out, free for the listener about to bind. */
async function freshPort(): Promise<number> {
  const reservation = reservePort();
  await reservation.release();
  return reservation.port;
}

/** Postgres, migrated and seeded: ready for the first API query. */
export async function startPostgres(args: {
  readonly port: number;
  readonly dataDir: string;
}): Promise<{
  readonly url: string;
  stop(): Promise<void>;
}> {
  const postgres = await startMockingbirdPostgres({
    port: args.port,
    dataDir: join(args.dataDir, 'postgres'),
  });
  try {
    await runLocalMigrate(postgres.url);
    await runLocalSeed(postgres.url);
  } catch (error) {
    await postgres.stop();
    throw error;
  }
  return { url: postgres.url, stop: () => postgres.stop() };
}

export async function startS3(args: { readonly port: number }): Promise<{
  readonly endpoint: string;
  stop(): Promise<void>;
}> {
  const s3 = await startS3Server({ port: args.port });
  return { endpoint: s3.endpoint, stop: s3.stop };
}

export async function startMqtt(args: {
  readonly mqttPort: number;
  readonly wsPort: number;
}): Promise<{
  readonly wssUrl: string;
  readonly mqttUrl: string;
  stop(): Promise<void>;
}> {
  const mqtt = await startAedesServer(args);
  return {
    wssUrl: mqtt.wsUrl,
    mqttUrl: mqtt.mqttUrl,
    stop: mqtt.stop,
  };
}

export function startOpenAi(args: { readonly port: number }) {
  return createOpenAiServer({ port: args.port });
}

/** Where each backing service answers; null for one this stack runs without. */
export type InfraAddresses = {
  readonly databaseUrl: string;
  readonly openAiUrl: string;
  readonly s3Endpoint: string | null;
  readonly mqtt: { readonly wssUrl: string; readonly mqttUrl: string } | null;
  readonly observability: {
    readonly collectorUrl: string;
    readonly logsUrl: string;
    readonly metricsUrl: string;
  } | null;
};

/** Environment the API instances need to reach the backing services. */
export function infraEnv(infra: InfraAddresses): Record<string, string> {
  return {
    LOCALHOST_STACK: '1',
    DATABASE_URL: infra.databaseUrl,
    OPENAI_API_KEY: DEFAULT_TOKEN,
    OPENAI_BASE_URL: infra.openAiUrl,
    ...objectStoreEnv(infra.s3Endpoint),
    ...(infra.mqtt === null
      ? {}
      : {
          EMQX_API_URL: infra.mqtt.wssUrl
            .replace(/^ws:/, 'http:')
            .replace(/\/mqtt$/, ''),
          EMQX_API_KEY: 'stack',
          EMQX_API_SECRET: 'stack',
          EMQX_JWT_SECRET: 'stack-jwt-secret',
          EMQX_WSS_URL: infra.mqtt.wssUrl,
          EMQX_MQTT_URL: infra.mqtt.mqttUrl,
          EMQX_MQTT_USER: 'stack',
          EMQX_MQTT_PASS: 'stack',
        }),
    ...(infra.observability === null
      ? {}
      : {
          OBSERVABILITY_COLLECTOR_URL: infra.observability.collectorUrl,
          OBSERVABILITY_LOGS_URL: infra.observability.logsUrl,
          OBSERVABILITY_METRICS_URL: infra.observability.metricsUrl,
        }),
  };
}

export async function bootInfra(args: {
  readonly options: StackOptions;
  readonly dataDir: string;
}): Promise<InfraHandles> {
  const postgres = await startPostgres({
    port: await freshPort(),
    dataDir: args.dataDir,
  });
  let openai: Awaited<ReturnType<typeof createOpenAiServer>> | null = null;
  let s3: Awaited<ReturnType<typeof startS3>> | null = null;
  let mqtt: Awaited<ReturnType<typeof startMqtt>> | null = null;
  let observability: Awaited<
    ReturnType<typeof startObservabilityStack>
  > | null = null;
  try {
    openai = await startOpenAi({ port: await freshPort() });
    s3 = args.options.withS3
      ? await startS3({ port: await freshPort() })
      : null;
    mqtt = args.options.withMqtt
      ? await startMqtt({
          mqttPort: await freshPort(),
          wsPort: await freshPort(),
        })
      : null;
    observability =
      args.options.observabilityBackend !== 'off'
        ? await startObservabilityStack({
            backend: args.options.observabilityBackend,
            dataDir: join(args.dataDir, 'observability'),
            instanceId: args.options.instanceId,
          })
        : null;
  } catch (error) {
    await Promise.allSettled([
      mqtt?.stop(),
      s3?.stop(),
      openai?.close(),
      postgres.stop(),
    ]);
    throw error;
  }

  return {
    databaseUrl: postgres.url,
    s3Endpoint: s3?.endpoint ?? null,
    mqttWssUrl: mqtt?.wssUrl ?? null,
    mqttUrl: mqtt?.mqttUrl ?? null,
    observabilityCollectorUrl: observability?.collectorUrl ?? null,
    observabilityTraceDir: observability?.traceDir ?? null,
    observabilityTempoUrl: observability?.tempoUrl ?? null,
    observabilityGrafanaUrl: observability?.grafanaUrl ?? null,
    env: infraEnv({
      databaseUrl: postgres.url,
      openAiUrl: openai.url,
      s3Endpoint: s3?.endpoint ?? null,
      mqtt,
      observability,
    }),
    async stop() {
      await observability?.stop();
      await mqtt?.stop();
      await s3?.stop();
      await openai?.close();
      await postgres.stop();
    },
  };
}

function objectStoreEnv(endpoint: string | null): Record<string, string> {
  if (endpoint === null) return {};
  return {
    S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY,
    S3_BUCKET,
    S3_REGION,
    S3_ENDPOINT: endpoint,
    REPORTS_BUCKET: S3_BUCKET,
    REPORTS_ENDPOINT: endpoint,
    REPORTS_ACCESS_KEY_ID: S3_ACCESS_KEY_ID,
    REPORTS_SECRET_ACCESS_KEY: S3_SECRET_ACCESS_KEY,
  };
}
