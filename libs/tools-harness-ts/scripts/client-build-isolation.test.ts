import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../../..');

// regression: product-release-builds-admin-client
test('each release check builds only its own web client', () => {
  const query = `query {
    product: package(name: "@apps/product-ts") {
      tasks(filter: {equal: {field: NAME, value: "verify:worker-retirement"}}) {
        items { allDependencies { items { fullName } } }
      }
    }
    admin: package(name: "@apps/admin-api-ts") {
      tasks(filter: {equal: {field: NAME, value: "verify:worker-bundle"}}) {
        items { allDependencies { items { fullName } } }
      }
    }
  }`;
  const output = execFileSync(
    join(root, 'node_modules/.bin/turbo'),
    ['query', query],
    {
      cwd: root,
      encoding: 'utf8',
    }
  );
  type Release = {
    tasks: { items: { allDependencies: { items: { fullName: string }[] } }[] };
  };
  const graph = JSON.parse(output) as {
    data: { product: Release; admin: Release };
  };
  const dependencies = (release: Release) =>
    release.tasks.items.flatMap((task) =>
      task.allDependencies.items.map((item) => item.fullName)
    );
  expect(dependencies(graph.data.product)).toContain('@apps/product-ts#build');
  expect(dependencies(graph.data.product)).not.toContain(
    '@apps/admin-client-ts#build'
  );
  expect(dependencies(graph.data.admin)).toContain(
    '@apps/admin-client-ts#build'
  );
  expect(dependencies(graph.data.admin)).not.toContain(
    '@apps/product-ts#build'
  );
});
