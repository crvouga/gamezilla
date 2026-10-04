import { describe, expect, test } from 'bun:test';
import { planSharedReconcile } from '@libs/secrets-shared/shared-reconcile';

const envs = (
  entries: Record<string, Record<string, string>>
): ReadonlyMap<string, ReadonlyMap<string, string>> =>
  new Map(
    Object.entries(entries).map(([env, own]) => [
      env,
      new Map(Object.entries(own)),
    ])
  );

describe('shared secrets reconcile', () => {
  test('unanimous copies are promoted, then removed from every environment', () => {
    const plan = planSharedReconcile({
      names: ['TOKEN'],
      shared: new Map(),
      envs: envs({ dev: { TOKEN: 'a' }, prd: { TOKEN: 'a' } }),
    });
    expect(plan).toEqual({
      promote: [{ name: 'TOKEN', value: 'a' }],
      remove: [
        { env: 'dev', name: 'TOKEN' },
        { env: 'prd', name: 'TOKEN' },
      ],
      conflicts: [],
    });
  });

  test('a copy equal to the shared value is removed; nothing is promoted', () => {
    const plan = planSharedReconcile({
      names: ['TOKEN'],
      shared: new Map([['TOKEN', 'a']]),
      envs: envs({ dev: { TOKEN: 'a' }, prd: {} }),
    });
    expect(plan.promote).toEqual([]);
    expect(plan.remove).toEqual([{ env: 'dev', name: 'TOKEN' }]);
  });

  test('a disagreeing copy is a conflict and nothing changes for that name', () => {
    const plan = planSharedReconcile({
      names: ['TOKEN', 'OTHER'],
      shared: new Map([['TOKEN', 'a']]),
      envs: envs({ dev: { TOKEN: 'b', OTHER: 'x' }, prd: { TOKEN: 'a' } }),
    });
    expect(plan.remove).toEqual([{ env: 'dev', name: 'OTHER' }]);
    expect(plan.promote).toEqual([{ name: 'OTHER', value: 'x' }]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toContain('TOKEN: dev');
    expect(plan.conflicts[0]).not.toContain('b');
  });

  test('converged: nothing to do', () => {
    expect(
      planSharedReconcile({
        names: ['TOKEN'],
        shared: new Map([['TOKEN', 'a']]),
        envs: envs({ dev: {}, prd: {} }),
      })
    ).toEqual({ promote: [], remove: [], conflicts: [] });
  });
});
