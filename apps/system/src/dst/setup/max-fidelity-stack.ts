/**
 * Process-wide Postgres + MinIO + EMQX for `openSim` fidelity `max`.
 * Default `test` never calls this.
 */
import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_DASHBOARD_PORT,
  EMQX_JWT_SECRET,
  EMQX_WS_PORT,
} from '@pkgs/emqx-server';
import {
  MINIO_BUCKET,
  MINIO_ENDPOINT,
  MINIO_REGION,
  MINIO_ROOT_PASSWORD,
  MINIO_ROOT_USER,
} from '@pkgs/minio-server';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-embedded/ports';

import { bootLocalStack } from '../../../../../tools/scripts/boot-local-stack';

let started: Promise<void> | undefined;

function applyEnv(): void {
  process.env['DATABASE_URL'] = LOCAL_DATABASE_URL;
  process.env['SIM_API_DATABASE_URL'] = LOCAL_DATABASE_URL;
  process.env['S3_ENDPOINT'] = MINIO_ENDPOINT;
  process.env['S3_BUCKET'] = MINIO_BUCKET;
  process.env['S3_REGION'] = MINIO_REGION;
  process.env['B2_APP_KEY_ID'] = MINIO_ROOT_USER;
  process.env['B2_APP_KEY'] = MINIO_ROOT_PASSWORD;
  process.env['EMQX_JWT_SECRET'] = EMQX_JWT_SECRET;
  process.env['EMQX_API_KEY'] = EMQX_API_KEY;
  process.env['EMQX_API_SECRET'] = EMQX_API_SECRET;
  process.env['EMQX_WS_PORT'] = String(EMQX_WS_PORT);
  process.env['EMQX_DASHBOARD_PORT'] = String(EMQX_DASHBOARD_PORT);
}

/** Boot sidecars once per Jest/Bun process. Does not stop them (CI job teardown). */
export function ensureMaxFidelityStack(): Promise<void> {
  started ??= (async () => {
    await bootLocalStack();
    applyEnv();
  })();
  return started;
}
