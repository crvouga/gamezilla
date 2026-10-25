/**
 * The private-setup laws hold a game to keeping setups private rather than
 * to itself: each faulty copy of the test-only consumer below breaks one
 * law, and that law alone refuses it, while the sound consumer keeps them
 * all.
 */

import { expect, test } from 'bun:test';
import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import type {
  GameRules,
  PrivateSetupRules,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { refusals } from './faulty-game';
import {
  SECRET_PICK_CLIENT,
  SECRET_PICK_FIXTURES,
  SECRET_PICK_GAME,
  SECRET_PICK_TURN_GAME,
} from './secret-pick-game';
import { SECRET_PICK_RULES } from './secret-pick-rules';

const setup = SECRET_PICK_RULES.setup as PrivateSetupRules;

/** The consumer with `fault` in its rules, defined like any game. */
function faulty(fault: Partial<GameRules>): TurnHarnessGame {
  const rules = { ...SECRET_PICK_RULES, ...fault };
  const shared = defineGame({ ...SECRET_PICK_TURN_GAME, rules });
  return {
    ...SECRET_PICK_GAME,
    shared,
    client: defineGameClient({ ...SECRET_PICK_CLIENT, shared }),
    fixtures: SECRET_PICK_FIXTURES,
  };
}

function expectRefusedBy(game: TurnHarnessGame, law: string, reason: string) {
  const refused = refusals(game);
  expect([...refused.keys()]).toEqual([law]);
  expect(refused.get(law)).toContain(reason);
}

test('the sound private-setup consumer keeps every law', () => {
  expect([...refusals(SECRET_PICK_GAME).keys()]).toEqual([]);
});

test('a game drawing an incomplete setup is refused', () => {
  expectRefusedBy(
    faulty({ setup: { ...setup, random: () => 'n1' } }),
    'every random setup is one complete setup',
    'n1 is not one complete setup'
  );
});

test('a game whose answers spell out the hidden setup is refused', () => {
  const telling: PrivateSetupRules = {
    ...setup,
    resolve: (position, proposal, setups) => {
      const answer = setup.resolve(position, proposal, setups);
      return answer === null ? null : `${answer}:${setups.black}`;
    },
  };
  const rules = { ...SECRET_PICK_RULES, setup: telling };
  // The rules accept the telling answers, as a faulty game's would.
  const lenient = faulty({
    setup: telling,
    play: (position, action, history, actions) =>
      SECRET_PICK_RULES.play(
        position,
        action.replace(/:n[1-9]$/, ''),
        history,
        actions
      ) === null
        ? null
        : {
            ...SECRET_PICK_RULES.play(
              position,
              action.replace(/:n[1-9]$/, ''),
              history,
              actions
            )!,
            label: action,
          },
    legal: rules.legal,
  });
  expect(
    refusals(lenient).get('no position or label it shows spells out a setup')
  ).toContain('shows a setup');
});

test('a game resolving a proposal it never offers is refused', () => {
  const lenient = faulty({
    setup: {
      ...setup,
      resolve: (position, proposal, setups) =>
        setup.resolve(position, proposal.trim(), setups),
    },
  });
  const refused = refusals(lenient);
  // Resolving a stray spelling also lets the authority accept it.
  expect([...refused.keys()].sort()).toEqual([
    'only a legal action is accepted, and a finished game accepts none',
    'whatever the setups, every proposal offered resolves to a public action, and nothing else resolves',
  ]);
  expect(
    refused.get(
      'whatever the setups, every proposal offered resolves to a public action, and nothing else resolves'
    )
  ).toContain('which is not offered, resolved');
});
