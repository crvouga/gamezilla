import { expect, test } from 'bun:test';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { loginProject } from '@pkgs/secret-provider-server-ts/login-project';

async function projectStore(projectId: string, endpoint: string) {
  const store = new ObjectStoreImplInMemory();
  await writeUtf8(
    store,
    '.secrets.json',
    JSON.stringify({ projectId, endpoint }),
    'application/json'
  );
  return store;
}

// regression: infisical-project-session-isolation
test('concurrent project logins bind each worktree without selecting a global default', async () => {
  const stores = await Promise.all([
    projectStore(
      '26137c60-8dea-4d95-a8a3-30901615b026',
      'https://app.infisical.com'
    ),
    projectStore('another-project', 'https://secrets.example.com'),
  ]);
  const calls: string[][] = [];
  const inherited = {
    INFISICAL_PROFILE: 'geviti',
    INFISICAL_ORG: 'geviti',
    INFISICAL_TOKEN: 'unrelated-token',
  };
  const codes = await Promise.all(
    stores.map((store, i) =>
      loginProject(store, `/worktree-${i}`, {
        env: inherited,
        run: (args, env) => {
          expect(env['INFISICAL_PROFILE']).toBeUndefined();
          expect(env['INFISICAL_ORG']).toBeUndefined();
          expect(env['INFISICAL_TOKEN']).toBeUndefined();
          calls.push([...args]);
          return 0;
        },
      })
    )
  );
  expect(codes).toEqual([0, 0]);
  const logins = calls.filter((args) => args[0] === 'login');
  const bindings = calls.filter((args) => args[1] === 'bind');
  expect(logins).toHaveLength(2);
  expect(logins[0]![4]).not.toBe(logins[1]![4]);
  expect(bindings.map((args) => args[3]).sort()).toEqual([
    '/worktree-0',
    '/worktree-1',
  ]);
  expect(calls.some((args) => args.includes('use'))).toBe(false);
  expect(inherited.INFISICAL_PROFILE).toBe('geviti');
});

test('a cancelled login preserves the existing checkout binding', async () => {
  const store = await projectStore('project-a', 'https://app.infisical.com');
  let count = 0;
  const result = await loginProject(store, '/worktree', {
    env: {},
    run: () => {
      count++;
      return 130;
    },
  });
  expect(result).toBe(130);
  expect(count).toBe(1);
});
