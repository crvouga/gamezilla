import { expect, test } from 'bun:test';
import {
  previewStackEnv,
  waitForEmbeddedPostgres,
} from '../constants/embedded-postgres';
import {
  resolveLocalApiOrigin,
  runPackageScriptOnce,
  startPackageScriptBackground,
  waitForHttpOk,
} from './harness';

test(
  'api server starts and GET /health returns ok',
  async () => {
    const LOCAL_API_ORIGIN = await resolveLocalApiOrigin();
    const env = previewStackEnv();

    await runPackageScriptOnce('@pkgs/postgres', 'kill', {});
    await runPackageScriptOnce('@apps/api', 'kill', {});
    await runPackageScriptOnce('@apps/api', 'setup', {});

    await using _pg = startPackageScriptBackground(
      '@pkgs/postgres',
      'preview',
      env
    );
    await waitForEmbeddedPostgres(120_000);

    await using api = startPackageScriptBackground('@apps/api', 'preview', env);
    await waitForHttpOk(`${LOCAL_API_ORIGIN}/api/health`, {
      timeoutMs: 120_000,
      label: 'api /api/health',
      process: api,
    });

    const res = await fetch(`${LOCAL_API_ORIGIN}/api/health`);
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ status: 'ok' });
  },
  { timeout: 300_000 }
);
