import { expect, test } from 'bun:test';
import { multiplayerFingerprint } from '@libs/chess/harness/multiplayer-fingerprint';
import { assertProperty, fc } from '@pkgs/property';
import snapshots from './fixtures/multiplayer-replay-snapshots.json';

type Snapshot = Parameters<typeof multiplayerFingerprint>[0];
const snapshot = snapshots.once as Snapshot;
const owners = new Map([
  ['eda97a60-80fa-462b-9bff-0f8fea010019', 'alice'],
  ['f2487fa3-48fe-499f-adc0-f8b5223c698a', 'bob'],
  ['bbfc0749-feb9-4096-9eee-75e5188ed2e6', 'carol'],
]);

function rename(ids: readonly string[]) {
  const people = new Map(
    ids.map((id, index) => [id, ['alice', 'bob', 'carol'][index]!])
  );
  const replacements = new Map(
    [...owners.keys()].map((id, index) => [id, ids[index]!])
  );
  const person = (id: string) => replacements.get(id) ?? id;
  return {
    people,
    next: {
      games: snapshot.games.map((game) => ({
        ...game,
        white_id: person(game.white_id),
        black_id: person(game.black_id),
        turn: person(game.turn),
      })),
      current: snapshot.current
        .map((row) => ({ ...row, owner_id: person(row.owner_id) }))
        .reverse(),
    },
  };
}

// regression: chess-replay-opaque-account-ids
test('CI trace 1 compares the same people despite different account ids and SQL order', () => {
  const people = new Map([
    ['86b078ed-ac9a-41d6-ac04-594aef178186', 'alice'],
    ['45346015-f3b7-47f9-a2aa-b8c991067af9', 'bob'],
    ['130a6fa4-400b-499e-b23e-f01558961aac', 'carol'],
  ]);
  expect(multiplayerFingerprint(snapshots.twice as Snapshot, people)).toBe(
    multiplayerFingerprint(snapshot, owners)
  );
});

test('renaming opaque ids preserves state while a different turn remains different', () => {
  assertProperty(
    'fingerprints retain participant identity across opaque id renaming',
    fc.property(
      fc.uniqueArray(fc.uuid(), { minLength: 3, maxLength: 3 }),
      (ids) => {
        const { next, people } = rename(ids);
        const fingerprint = multiplayerFingerprint(next, people);
        expect(fingerprint).toBe(multiplayerFingerprint(snapshot, owners));
        expect(
          multiplayerFingerprint(
            {
              ...next,
              games: next.games.map((game) => ({
                ...game,
                turn: game.white_id,
              })),
            },
            people
          )
        ).not.toBe(fingerprint);
        expect(
          multiplayerFingerprint(
            { ...next, current: next.current.slice(1) },
            people
          )
        ).not.toBe(fingerprint);
      }
    )
  );
});
