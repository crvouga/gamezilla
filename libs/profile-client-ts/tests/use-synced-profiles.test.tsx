/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { profilesByIds } from '@libs/profile-shared-ts/profiles-by-ids-query';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { createSignal } from 'solid-js';
import { mountProfileSubscriptions } from './profile-subscription-probe';

function profileIds(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `person-${String(index).padStart(4, '0')}`
  );
}

test('keeps the 201st requested profile subscribed', async () => {
  // regression: profile-subscriptions-truncate-large-lists
  const wanted = profileIds(201);
  const probe = mountProfileSubscriptions(() => wanted);
  try {
    expect(probe.activeIds()).toEqual(wanted);
    const schema = profilesByIds.params;
    if (schema === undefined) throw new Error('Missing profile query schema');
    for (const subscription of probe.subscriptions) {
      const result = await schema['~standard'].validate(subscription.params);
      expect(result.issues).toBeUndefined();
    }
  } finally {
    probe.unmount();
  }
  expect(probe.activeIds()).toEqual([]);
});

test('updates the complete set and releases every former subscription', () => {
  const initial = profileIds(401);
  const [wanted, setWanted] = createSignal<readonly string[]>(initial);
  const probe = mountProfileSubscriptions(wanted);
  try {
    expect(probe.activeIds()).toEqual(initial);
    const count = probe.subscriptions.length;
    setWanted([...initial.toReversed(), initial[0] ?? '', '']);
    expect(probe.subscriptions).toHaveLength(count);
    setWanted(['person-0400', 'person-0401', 'person-0401', '']);
    expect(probe.activeIds()).toEqual(['person-0400', 'person-0401']);
    expect(probe.subscriptions.slice(0, count).every((sub) => sub.closed)).toBe(
      true
    );
    setWanted([]);
    expect(probe.activeIds()).toEqual([]);
  } finally {
    probe.unmount();
  }
});

test('retains every distinct requested profile within the existing query bound', async () => {
  await assertProperty(
    'profile subscriptions cover all requested identifiers',
    fc.asyncProperty(
      fc.array(fc.integer({ min: 0, max: 9999 }), {
        minLength: 180,
        maxLength: 450,
      }),
      async (values) => {
        const ids = values.map((value) => `person-${value}`);
        const wanted = [...new Set(ids)].sort();
        const probe = mountProfileSubscriptions(() => ids);
        try {
          expect(probe.activeIds()).toEqual(wanted);
          const schema = profilesByIds.params;
          if (schema === undefined)
            throw new Error('Missing profile query schema');
          for (const subscription of probe.subscriptions) {
            const result = await schema['~standard'].validate(
              subscription.params
            );
            expect(result.issues).toBeUndefined();
          }
        } finally {
          probe.unmount();
        }
        expect(probe.activeIds()).toEqual([]);
      }
    )
  );
});
