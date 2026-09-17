// @io-wall-ok — tools composition root.

/** The backing services an API instance shares with its peers. */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_JWT_SECRET,
  startEmqxServer,
} from '@pkgs/emqx-server';
import { startEmbeddedPostgres } from '@pkgs/postgres-embedded';
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  startS3Server,
} from '@pkgs/s3-server';

import { runLocalMigrate } from '../../../apps/server/scripts/run-local-postgres-migrate';
import { runLocalSeed } from '../../../apps/server/scripts/run-local-postgres-seed';
import { reservePort, waitForHttp } from './free-port';
import type { StackOptions } from './stack-options';

export type InfraHandles = {
  readonly databaseUrl: string;
  readonly s3Endpoint: string | null;
  readonly emqxWssUrl: string | null;
  readonly emqxApiUrl: string | null;
  /** Environment the API instances need to reach all of the above. */
  readonly env: Readonly<Record<string, string>>;
  stop(): Promise<void>;
};

async function bootPostgres(dataDir: string): Promise<{
  readonly url: string;
  stop(): Promise<void>;
}> {
  const reservation = reservePort();
  reservation.release();
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
  const s3 = await startS3Server({
    directory: mkdtempSync(join(tmpdir(), 's3-')),
  });
  return { endpoint: s3.endpoint, stop: s3.stop };
}

async function bootEmqx(
  dataDir: string,
  instanceId: string
): Promise<{
  readonly wssUrl: string;
  readonly apiUrl: string;
  stop(): void;
}> {
  const mqtt = reservePort();
  const ws = reservePort();
  const dashboard = reservePort();
  mqtt.release();
  ws.release();
  dashboard.release();
  const emqx = await startEmqxServer({
    mqttPort: mqtt.port,
    wsPort: ws.port,
    dashboardPort: dashboard.port,
    dataDir: join(dataDir, 'emqx'),
    // Distinct node names keep two brokers from fighting over one Erlang node.
    nodeName: `emqx-${instanceId}@127.0.0.1`,
  });
  const apiUrl = `http://127.0.0.1:${String(emqx.dashboardPort)}`;
  await waitForHttp(`${apiUrl}/status`, 90_000);
  return {
    wssUrl: `ws://127.0.0.1:${String(emqx.wsPort)}/mqtt`,
    apiUrl,
    stop: emqx.stop,
  };
}

export async function bootInfra(args: {
  readonly options: StackOptions;
  readonly dataDir: string;
}): Promise<InfraHandles> {
  const postgres = await bootPostgres(args.dataDir);
  const s3 = args.options.withS3 ? await bootS3() : null;
  const emqx = args.options.withEmqx
    ? await bootEmqx(args.dataDir, args.options.instanceId)
    : null;

  return {
    databaseUrl: postgres.url,
    s3Endpoint: s3?.endpoint ?? null,
    emqxWssUrl: emqx?.wssUrl ?? null,
    emqxApiUrl: emqx?.apiUrl ?? null,
    env: {
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
      ...(emqx === null
        ? {}
        : {
            EMQX_API_URL: emqx.apiUrl,
            EMQX_API_KEY,
            EMQX_API_SECRET,
            EMQX_JWT_SECRET,
            EMQX_WSS_URL: emqx.wssUrl,
          }),
    },
    async stop() {
      emqx?.stop();
      await s3?.stop();
      await postgres.stop();
    },
  };
}
