import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { gen } from '@pkgs/dst/fast-check';
import { check } from '@pkgs/dst/pbt';
import { schemaAt } from './schemas';
import {
  advance,
  arbSchemaKnobs,
  clientIds,
  clientVersions,
  forbidden,
  SCHEMA_ACTIONS,
  SCHEMA_PROPERTIES,
  SCHEMA_SERVER_ID,
  schema,
  serverPlanKinds,
  serverVersion,
} from './system';

describe('db-schema framework system', () => {
  test('compatible schema chain + mixed clients + forbidden refuse', async () => {
    const report = await check(schema, {
      properties: SCHEMA_PROPERTIES,
      actions: SCHEMA_ACTIONS,
      knobs: gen(arbSchemaKnobs()),
      episodes: 6,
      steps: 10,
      seed: 1,
      stopOnViolation: true,
    });
    expect(report.ok).toBe(true);
  }, 120_000);

  test('scripted: server ahead of lagging client stays valid', async () => {
    await using run = await start(schema, {
      seed: 42,
      knobs: { clients: 2 },
      properties: SCHEMA_PROPERTIES,
    });
    await run.apply(advance, { target: SCHEMA_SERVER_ID, to: 2 });
    await run.apply(advance, { target: 'client-0', to: 1 });
    await run.apply(advance, { target: 'client-1', to: 2 });
    expect(await run.observe(serverVersion)).toBe(2);
    // client-0 was capped at requested `to: 1` (lagging is allowed until caught up)
    expect(await run.observe(clientVersions)).toEqual([1, 2]);
    await run.apply(advance, { target: 'client-0', to: 2 });
    expect(await run.observe(clientVersions)).toEqual([2, 2]);
  }, 60_000);

  test('forbidden in-place type change is refused without plan drift', async () => {
    await using run = await start(schema, {
      seed: 7,
      knobs: { clients: 1 },
      properties: SCHEMA_PROPERTIES,
    });
    await run.apply(advance, { target: SCHEMA_SERVER_ID, to: 1 });
    await run.apply(forbidden);
    expect(await run.observe(serverPlanKinds)).toEqual(['v1']);
  }, 60_000);

  test('nodes boot at v0 with server + client roles', async () => {
    await using run = await start(schema, {
      seed: 3,
      knobs: { clients: 3 },
      properties: SCHEMA_PROPERTIES,
    });
    expect(await run.observe(serverVersion)).toBe(0);
    expect(await run.observe(clientIds)).toEqual([
      'client-0',
      'client-1',
      'client-2',
    ]);
    expect(await run.observe(clientVersions)).toEqual([0, 0, 0]);
  }, 60_000);

  test('surface coverage: schema snapshot exports checks/views/enums arrays', () => {
    const snap = schemaAt(4).snapshot();
    expect(Array.isArray(snap.checks)).toBe(true);
    expect(Array.isArray(snap.views)).toBe(true);
    expect(Array.isArray(snap.enums)).toBe(true);
    expect(Object.keys(snap.tables['items']!).includes('score')).toBe(true);
  });
});
