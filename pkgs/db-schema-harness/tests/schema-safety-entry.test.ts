import { expect, test } from 'bun:test';
import { quintBinding, quintWorld } from '@pkgs/quint-shared/registry';

// regression: db-schema-quint-entry-missing
test('the spec entry registers the schema safety world and binding', async () => {
  await import('./quint/index');
  const binding = quintBinding('schema-safety');
  const world = await quintWorld().create({
    packageName: '@pkgs/db-schema',
    specUri: 'pkgs/db-schema-harness/tests/quint/schema-safety.qnt',
    model: 'schema-safety',
    trace: 1,
    seed: '424242',
    testId: 'schema-safety.trace-1',
    title: 'Schema safety registration',
  });
  await binding.actions['init']!(world, {});
  expect(await binding.observe(world)).toEqual({
    shared: new Map([
      ['a', 'absent'],
      ['b', 'absent'],
    ]),
    device: new Map([
      ['a', 'absent'],
      ['b', 'absent'],
    ]),
    online: true,
  });
  await quintWorld().dispose(world);
});
