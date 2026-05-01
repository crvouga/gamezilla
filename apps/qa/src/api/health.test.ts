import { expect, test } from 'bun:test';
import {
  databaseHttpOrigin,
  defaultSqlPort,
  resolveLocalApiOrigin,
  runPackageScriptOnce,
  startPackageScriptBackground,
  waitForHttpOk,
} from './harness';

test(
  'api server starts and GET /health returns ok',
  async () => {
    const LOCAL_API_ORIGIN = await resolveLocalApiOrigin();
    const sqlPort = defaultSqlPort();
    const databaseUrl = databaseHttpOrigin(sqlPort);

    await runPackageScriptOnce('@gamezilla/db', 'kill', {});
    await using db = startPackageScriptBackground('@gamezilla/db', 'preview', {});
    await waitForHttpOk(`${databaseUrl}/health`, {
      timeoutMs: 60_000,
      label: 'local db /health',
      process: db,
    });

    await runPackageScriptOnce('@gamezilla/api', 'kill', {});
    await runPackageScriptOnce('@gamezilla/api', 'setup', {});

    await using api = startPackageScriptBackground('@gamezilla/api', 'preview', {});
    await waitForHttpOk(`${LOCAL_API_ORIGIN}/health`, {
      timeoutMs: 120_000,
      label: 'api /health',
      process: api,
    });

    const res = await fetch(`${LOCAL_API_ORIGIN}/health`);
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ status: 'ok' });
  },
  { timeout: 240_000 }
);
