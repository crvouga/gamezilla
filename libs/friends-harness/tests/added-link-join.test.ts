import { expect, test } from 'bun:test';
import { variant } from '@pkgs/quint-shared/itf';
import { quintBinding, quintWorld } from '@pkgs/quint-shared/registry';
import './quint/index';

test(
  'an added person explicitly joins the public link after the host grants access',
  async () => {
    // regression: space-added-link-join-sees-false-host-offline
    const model = 'adding-people';
    const world = quintWorld();
    const binding = quintBinding(model);
    const w = await world.create({
      packageName: '@libs/friends',
      specUri: 'specs/spaces/adding-people.qnt',
      model,
      trace: 20,
      seed: '0x67932',
      testId: 'added-link-join',
      title: 'Added person explicitly joins the public link',
    });
    try {
      for (const action of ['init', 'addPerson', 'join']) {
        const apply = binding.actions[action];
        if (apply === undefined) throw new Error(`No action ${action}`);
        await apply(w, { person: 'alice' });
      }
      const observed = await binding.observe(w);
      expect(observed['whereabouts']).toEqual(
        new Map([
          ['alice', variant('InSpace')],
          ['bob', variant('InSpace')],
        ])
      );
    } finally {
      await world.dispose(w);
    }
  },
  quintBinding('adding-people').timeoutMs
);
