// @io-wall-ok — tools composition root.

/** The backing services an API instance shares with its peers. */

import { join } from 'node:path';
import { startAedesServer } from '@pkgs/aedes-server';
import { startEmbeddedPostgres } from '@pkgs/postgres-embedded';
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  startS3Server,
} from '@pkgs/s3-server';

import { runLocalMigrate } from '../../../server/scripts/run-local-postgres-migrate';
import { runLocalSeed } from '../../../server/scripts/run-local-postgres-seed';
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

async function bootPostgres(dataDir: string): Promise<{
  readonly url: string;
  stop(): Promise<void>;
}> {
  const reservation = reservePort();
  await reservation.release();
  const postgres = await startEmbeddedPostgres({
    port: reservation.port,
    dataDir: join(dataDir, 'postgres'),
  });
  await runLocalMigrate(postgres.url);
  await runLocalSeed(postgres.url);
  return { url: postgres.url, stop: () => postgres.stop() };
}

async function bootS3(): Promise<{
  readonly endpoint: string;
  stop(): Promise<void>;
}> {
  const s3 = await startS3Server();
  return { endpoint: s3.endpoint, stop: s3.stop };
}

async function bootMqtt(): Promise<{
  readonly wssUrl: string;
  readonly mqttUrl: string;
  stop(): Promise<void>;
}> {
  const mqtt = await startAedesServer();
  return {
    wssUrl: mqtt.wsUrl,
    mqttUrl: mqtt.mqttUrl,
    stop: mqtt.stop,
  };
}

export async function bootInfra(args: {
  readonly options: StackOptions;
  readonly dataDir: string;
}): Promise<InfraHandles> {
  const postgres = await bootPostgres(args.dataDir);
  const s3 = args.options.withS3 ? await bootS3() : null;
  const mqtt = args.options.withMqtt ? await bootMqtt() : null;
  let observability: Awaited<
    ReturnType<typeof startObservabilityStack>
  > | null = null;
  try {
    observability =
      args.options.observabilityBackend !== 'off'
        ? await startObservabilityStack({
            backend: args.options.observabilityBackend,
            dataDir: join(args.dataDir, 'observability'),
            instanceId: args.options.instanceId,
          })
        : null;
  } catch (error) {
    await mqtt?.stop();
    await s3?.stop();
    await postgres.stop();
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
    env: {
      LOCALHOST_STACK: '1',
      DATABASE_URL: postgres.url,
      ...(s3 === null
        ? {}
        : {
            S3_ACCESS_KEY_ID,
            S3_SECRET_ACCESS_KEY,
            S3_BUCKET,
            S3_ENDPOINT: s3.endpoint,
            S3_REGION,
          }),
      ...(mqtt === null
        ? {}
        : {
            EMQX_API_URL: mqtt.wssUrl
              .replace(/^ws:/, 'http:')
              .replace(/\/mqtt$/, ''),
            EMQX_API_KEY: 'stack',
            EMQX_API_SECRET: 'stack',
            EMQX_JWT_SECRET: 'stack-jwt-secret',
            EMQX_WSS_URL: mqtt.wssUrl,
            EMQX_MQTT_URL: mqtt.mqttUrl,
            EMQX_MQTT_USER: 'stack',
            EMQX_MQTT_PASS: 'stack',
          }),
      ...(observability === null
        ? {}
        : {
            OBSERVABILITY_COLLECTOR_URL: observability.collectorUrl,
          }),
    },
    async stop() {
      await observability?.stop();
      await mqtt?.stop();
      await s3?.stop();
      await postgres.stop();
    },
  };
}
