import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

/**
 * `modules/pubsub/clone-environment.sh` runs as a `terraform_data`
 * provisioner mid-deploy, where a mistake costs a whole Deploy. It runs here
 * against a fake Railway GraphQL endpoint.
 *
 * regression: railway-empty-environment — `railway_environment` (provider
 * v0.6) made an empty environment, so `customDomainCreate` failed with
 * "ServiceInstance not found" on every Deploy since the shared Railway
 * project landed.
 */
const SCRIPT = join(
  import.meta.dirname,
  '../tofu/modules/pubsub/clone-environment.sh'
);

type FakeEnvironment = {
  id: string;
  name: string;
  instances: number;
  /** Listings that still show it after a delete (Railway deletes lazily). */
  lingers?: number;
};

type Fake = {
  readonly url: string;
  readonly environments: FakeEnvironment[];
  readonly mutations: { name: string; variables: Record<string, unknown> }[];
  readonly stop: () => void;
};

function startFakeRailway(initial: FakeEnvironment[]): Fake {
  const environments = [...initial];
  const mutations: Fake['mutations'] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const { query, variables } = (await req.json()) as {
        query: string;
        variables: Record<string, unknown>;
      };
      if (req.headers.get('authorization') !== 'Bearer test-token') {
        return Response.json({ errors: [{ message: 'Not Authorized' }] });
      }
      if (query.includes('project(id')) {
        for (const env of [...environments]) {
          if (env.lingers === undefined) continue;
          if (env.lingers-- <= 0)
            environments.splice(environments.indexOf(env), 1);
        }
        return Response.json({
          data: {
            project: {
              environments: {
                edges: environments.map((node) => ({
                  node: { id: node.id, name: node.name },
                })),
              },
            },
          },
        });
      }
      if (query.includes('serviceInstances')) {
        const env = environments.find((e) => e.id === variables['id']);
        return Response.json({
          data: {
            environment: {
              serviceInstances: {
                edges: Array.from({ length: env?.instances ?? 0 }, () => ({
                  node: { serviceId: 'svc' },
                })),
              },
            },
          },
        });
      }
      if (query.includes('environmentCreate')) {
        const input = variables['input'] as {
          name: string;
          sourceEnvironmentId: string;
        };
        mutations.push({ name: 'environmentCreate', variables });
        if (environments.some((e) => e.name === input.name)) {
          return Response.json({
            errors: [
              { message: 'An environment with that name already exists' },
            ],
          });
        }
        environments.push({
          id: `env-${input.name}`,
          name: input.name,
          instances: 1,
        });
        return Response.json({ data: { environmentCreate: { id: 'x' } } });
      }
      if (query.includes('environmentDelete')) {
        mutations.push({ name: 'environmentDelete', variables });
        const env = environments.find((e) => e.id === variables['id']);
        if (env !== undefined) env.lingers = 2;
        return Response.json({ data: { environmentDelete: true } });
      }
      return Response.json({ errors: [{ message: 'unknown query' }] });
    },
  });
  return {
    url: `http://127.0.0.1:${server.port}/graphql`,
    environments,
    mutations,
    stop: () => void server.stop(true),
  };
}

async function run(
  fake: Fake,
  action: 'create' | 'delete',
  overrides: Record<string, string> = {}
): Promise<{ code: number; out: string }> {
  const child = Bun.spawn(['bash', SCRIPT, action], {
    env: {
      PATH: process.env['PATH'] ?? '',
      RAILWAY_TOKEN: 'test-token',
      RAILWAY_GRAPHQL_URL: fake.url,
      PROJECT_ID: 'project-1',
      NAME: 'development',
      SOURCE: 'production',
      DELETE_POLL_SECONDS: '0',
      ...overrides,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { code, out: out + err };
}

const PRODUCTION: FakeEnvironment = {
  id: 'env-production',
  name: 'production',
  instances: 1,
};

describe('clone-environment.sh', () => {
  let fake: Fake;
  afterEach(() => fake.stop());

  describe('create', () => {
    beforeEach(() => {
      fake = startFakeRailway([PRODUCTION]);
    });

    test('duplicates the source environment by id', async () => {
      const { code, out } = await run(fake, 'create');
      expect(out).toContain('cloned from production');
      expect(code).toBe(0);
      expect(fake.mutations).toEqual([
        {
          name: 'environmentCreate',
          variables: {
            input: {
              projectId: 'project-1',
              name: 'development',
              sourceEnvironmentId: 'env-production',
            },
          },
        },
      ]);
    });

    test('a second run changes nothing', async () => {
      await run(fake, 'create');
      const again = await run(fake, 'create');
      expect(again.code).toBe(0);
      expect(fake.mutations).toHaveLength(1);
    });

    test('fails when the source environment is missing', async () => {
      const { code, out } = await run(fake, 'create', { SOURCE: 'nope' });
      expect(code).toBe(1);
      expect(out).toContain('clone source');
      expect(fake.mutations).toEqual([]);
    });

    test('surfaces a Railway API error instead of continuing', async () => {
      const { code, out } = await run(fake, 'create', {
        RAILWAY_TOKEN: 'wrong',
      });
      expect(code).toBe(1);
      expect(out).toContain('Not Authorized');
    });
  });

  // regression: railway-empty-environment-stuck — the empty environment the
  // provider had already made stayed behind, and create refused it, so every
  // Deploy stopped at dev's foundation until someone deleted it by hand.
  test('create replaces an existing environment with no service instance', async () => {
    fake = startFakeRailway([
      PRODUCTION,
      { id: 'env-empty', name: 'development', instances: 0 },
    ]);
    const { code, out } = await run(fake, 'create');
    expect(out).toContain('cloned from production');
    expect(code).toBe(0);
    expect(fake.mutations.map((m) => m.name)).toEqual([
      'environmentDelete',
      'environmentCreate',
    ]);
    expect(fake.mutations[0]?.variables).toEqual({ id: 'env-empty' });
    expect(fake.environments).toEqual([
      PRODUCTION,
      { id: 'env-development', name: 'development', instances: 1 },
    ]);
  });

  test('create never replaces production or the source', async () => {
    fake = startFakeRailway([
      { ...PRODUCTION, instances: 0 },
      { id: 'env-empty', name: 'development', instances: 0 },
    ]);
    for (const overrides of [
      { NAME: 'production', SOURCE: 'development' },
      { SOURCE: 'development' },
    ]) {
      const { code, out } = await run(fake, 'create', overrides);
      expect(code).toBe(1);
      expect(out).toContain('refusing to replace');
    }
    expect(fake.mutations).toEqual([]);
  });

  test('create fails when a deleted environment never leaves the listing', async () => {
    fake = startFakeRailway([
      PRODUCTION,
      { id: 'env-empty', name: 'development', instances: 0 },
    ]);
    const { code, out } = await run(fake, 'create', {
      DELETE_POLL_ATTEMPTS: '1',
    });
    expect(code).toBe(1);
    expect(out).toContain('still listed');
    expect(fake.mutations.map((m) => m.name)).toEqual(['environmentDelete']);
  });

  describe('delete', () => {
    beforeEach(() => {
      fake = startFakeRailway([
        PRODUCTION,
        { id: 'env-development', name: 'development', instances: 1 },
      ]);
    });

    test('deletes the clone and leaves the source', async () => {
      const { code } = await run(fake, 'delete');
      expect(code).toBe(0);
      expect(fake.environments.map((e) => e.name)).toEqual(['production']);
    });

    test('is a no-op once the environment is gone', async () => {
      await run(fake, 'delete');
      const again = await run(fake, 'delete');
      expect(again.code).toBe(0);
      expect(fake.mutations).toHaveLength(1);
    });

    test('never deletes production', async () => {
      const { code, out } = await run(fake, 'delete', { NAME: 'production' });
      expect(code).toBe(1);
      expect(out).toContain('refusing to delete');
      expect(fake.mutations).toEqual([]);
    });

    test('never deletes the source, whatever it is called', async () => {
      const { code, out } = await run(fake, 'delete', {
        SOURCE: 'development',
      });
      expect(code).toBe(1);
      expect(out).toContain('refusing to delete');
      expect(fake.mutations).toEqual([]);
    });
  });
});
