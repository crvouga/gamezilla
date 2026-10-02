import { expect, test } from 'bun:test';
import { quintBinding, quintWorld } from '@pkgs/quint/registry';
import './quint/index';

test('username binding establishes the named initial accounts', async () => {
  // regression: username-model-initial-name
  const model = 'username-changes';
  const world = quintWorld();
  const binding = quintBinding(model);
  const w = await world.create({
    packageName: '@libs/profile',
    specUri: 'specs/profile/username-changes.qnt',
    model,
    trace: 1,
    seed: '0x67932',
    testId: 'username-model-initial-name',
    title: 'Username model initialization',
  });
  try {
    const init = binding.actions['init'];
    if (init === undefined) throw new Error('username binding has no init');
    await init(w, {});
    const observed = await binding.observe(w);
    const expected = new Map([
      ['alice', 'alice'],
      ['bob', 'bob'],
      ['carol', 'generated'],
    ]);
    expect(observed['username']).toEqual(expected);
    expect(observed['usernameOnDevice']).toEqual(expected);
  } finally {
    await world.dispose(w);
  }
});
