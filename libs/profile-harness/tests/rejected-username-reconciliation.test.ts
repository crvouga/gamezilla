import { expect, test } from 'bun:test';
import { quintBinding, quintWorld } from '@pkgs/quint-shared/registry';
import './quint/index';

// regression: rejected-username-retains-optimistic-name
test(
  'a refused duplicate username restores the saved name on the device',
  async () => {
    const model = 'username-changes';
    const world = quintWorld();
    const binding = quintBinding(model);
    const w = await world.create({
      packageName: '@libs/profile',
      specUri: 'specs/profile/username-changes.qnt',
      model,
      trace: 3,
      seed: '0x67932',
      testId: 'rejected-username-retains-optimistic-name',
      title: 'Refused username reconciliation',
    });
    try {
      await binding.actions['init']!(w, {});
      await binding.actions['renameTwice']!(w, {
        person: 'bob',
        typed: 'official_support',
        retyped: 'alice',
        name: 'alice',
      });
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
  },
  quintBinding('username-changes').timeoutMs
);
