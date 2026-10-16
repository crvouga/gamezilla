import { expect, test } from 'bun:test';
import { isSyntheticMonitor } from '@pkgs/auth-inhouse-server/synthetic-monitor';
import { requestSyntheticMonitorRedirect } from '@pkgs/auth-inhouse-shared/synthetic-monitor';
import {
  API,
  boot,
  CALLBACK,
  exchange,
  monitorUserRows,
  PREFIX,
  TOKEN,
} from './synthetic-monitor-fixture';

// regression: synthetic-monitor-ratings-leak-between-journeys
test('consecutive multiplayer journeys get disjoint pairs of monitoring accounts', async () => {
  const booted = await boot(TOKEN);
  const ids = new Set<string>();
  for (const peer of [false, true, false, true]) {
    const redirect = await requestSyntheticMonitorRedirect({
      http: booted.http,
      apiOrigin: API,
      apiPathPrefix: PREFIX,
      token: TOKEN,
      callbackUrl: CALLBACK,
      peer,
    });
    const response = await exchange(booted, redirect);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { id: string } };
    expect(isSyntheticMonitor(body.user.id)).toBe(true);
    ids.add(body.user.id);
  }
  expect(ids.size).toBe(4);
  expect(await monitorUserRows(booted)).toBe(4);
});
