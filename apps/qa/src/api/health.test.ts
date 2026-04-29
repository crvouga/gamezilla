import { expect, test } from 'bun:test';
import {
  databaseHttpOrigin,
  defaultSqlPort,
  resolveLocalApiOrigin,
  runTurboOnce,
  startTurboBackground,
  waitForHttpOk,
} from './harness';

test(
  'api server starts and GET /health returns ok',
  async () => {
    const LOCAL_API_ORIGIN = await resolveLocalApiOrigin();
    const sqlPort = defaultSqlPort();
    const databaseUrl = databaseHttpOrigin(sqlPort);

    await using db = startTurboBackground(
      ['preview', '--filter=@gamezilla/db'],
      {}
    );
    await waitForHttpOk(`${databaseUrl}/health`, {
      timeoutMs: 60_000,
      label: 'local db /health',
    });

    await runTurboOnce(['setup', '--filter=@gamezilla/api'], {});

    await using api = startTurboBackground(
      ['preview', '--filter=@gamezilla/api'],
      {}
    );
    await waitForHttpOk(`${LOCAL_API_ORIGIN}/health`, {
      timeoutMs: 120_000,
      label: 'api /health',
    });

    const res = await fetch(`${LOCAL_API_ORIGIN}/health`);
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ status: 'ok' });
  },
  { timeout: 240_000 }
);
