import { expect, test } from 'bun:test';
import {
  databaseHttpOrigin,
  defaultSqlPort,
  LOCAL_API_ORIGIN,
  runTurboOnce,
  startTurboBackground,
  waitForHttpOk,
} from './harness';

test(
  'api server starts and GET /health returns ok',
  async () => {
    const sqlPort = defaultSqlPort();
    const databaseUrl = databaseHttpOrigin(sqlPort);

    await using db = startTurboBackground(
      ['preview', '--filter=@gamezilla/db'],
      {
        SQL_PORT: sqlPort,
      }
    );
    await waitForHttpOk(`${databaseUrl}/health`, {
      timeoutMs: 60_000,
      label: 'local db /health',
    });

    await runTurboOnce(['setup', '--filter=@gamezilla/api'], {
      LOCAL_DATABASE_URL: databaseUrl,
    });

    await using api = startTurboBackground(
      ['preview', '--filter=@gamezilla/api'],
      {
        LOCAL_DATABASE_URL: databaseUrl,
      }
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
