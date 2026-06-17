import { expect, test } from 'bun:test';
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

    await runPackageScriptOnce('@apps/api', 'kill', {});
    await runPackageScriptOnce('@apps/api', 'setup', {});

    await using api = startPackageScriptBackground('@apps/api', 'preview', {});
    await waitForHttpOk(`${LOCAL_API_ORIGIN}/api/health`, {
      timeoutMs: 120_000,
      label: 'api /api/health',
      process: api,
    });

    const res = await fetch(`${LOCAL_API_ORIGIN}/api/health`);
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ status: 'ok' });
  },
  { timeout: 240_000 }
);
