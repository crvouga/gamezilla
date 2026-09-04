import { describe, expect, test } from 'bun:test';
import { schemaAt } from './schemas';
import {
  advance,
  clientIds,
  clientVersions,
  forbidden,
  SCHEMA_SERVER_ID,
  schema,
  serverPlanKinds,
  serverVersion,
} from './system';

describe('db-schema framework system', () => {
  test('compatible schema chain + mixed clients + forbidden refuse', async () => {
    const report = await schema.explore({
      episodes: 6,
      steps: 10,
      seed: 1,
      stopOnViolation: true,
    });
    expect(report.ok).toBe(true);
  }, 120_000);

  test('scripted: server ahead of lagging client stays valid', async () => {
    await using s = await schema.script({ seed: 42, args: { clients: 2 } });
    await s.apply(advance, { target: SCHEMA_SERVER_ID, to: 2 });
    await s.apply(advance, { target: 'client-0', to: 1 });
    await s.apply(advance, { target: 'client-1', to: 2 });
    expect(await s.observe(serverVersion)).toBe(2);
    // client-0 was capped at requested `to: 1` (lagging is allowed until caught up)
    expect(await s.observe(clientVersions)).toEqual([1, 2]);
    await s.apply(advance, { target: 'client-0', to: 2 });
    expect(await s.observe(clientVersions)).toEqual([2, 2]);
  }, 60_000);

  test('forbidden in-place type change is refused without plan drift', async () => {
    await using s = await schema.script({ seed: 7, args: { clients: 1 } });
    await s.apply(advance, { target: SCHEMA_SERVER_ID, to: 1 });
    await s.apply(forbidden);
    expect(await s.observe(serverPlanKinds)).toEqual(['v1']);
  }, 60_000);

  test('nodes boot at v0 with server + client roles', async () => {
    await using s = await schema.script({ seed: 3, args: { clients: 3 } });
    expect(await s.observe(serverVersion)).toBe(0);
    expect(await s.observe(clientIds)).toEqual([
      'client-0',
      'client-1',
      'client-2',
    ]);
    expect(await s.observe(clientVersions)).toEqual([0, 0, 0]);
  }, 60_000);

  test('surface coverage: schema snapshot exports checks/views/enums arrays', () => {
    const snap = schemaAt(4).snapshot();
    expect(Array.isArray(snap.checks)).toBe(true);
    expect(Array.isArray(snap.views)).toBe(true);
    expect(Array.isArray(snap.enums)).toBe(true);
    expect(Object.keys(snap.tables['items']!).includes('score')).toBe(true);
  });
});
