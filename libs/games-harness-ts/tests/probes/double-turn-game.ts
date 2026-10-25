/**
 * Probe: turns that do not alternate. The first side moves twice, then the
 * second side once (first, first, second, first, first, second, …); who
 * counts to seven wins. Offers custom games only. Played twice: as written
 * (rotating turns, which the laws refuse) and declaring that its rules
 * decide the turn (`turnOrder: 'rules'`, which they accept).
 */

import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import type { TurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import type { TurnGameCapabilities } from '@pkgs/turn-game-shared-ts/game-rules';
import { countRules } from './count-rules';
import { probeAutomation, probePresentation } from './probe-parts';

export const DOUBLE_TURN_RULES = countRules({
  id: 'double-turn',
  steps: { one: 1, two: 2 },
  finish: 7,
  // After counts 2 and 5 the second side moves; otherwise the first.
  next: (count) => (count % 3 === 2 ? 'black' : 'white'),
  ending: (mover) => ({ winner: mover, reason: 'counted to seven' }),
});

const CAPABILITIES = {
  'custom-games': {
    bots: {
      difficulties: [],
      choose: (position) => DOUBLE_TURN_RULES.legal(position)[0] ?? null,
    },
  },
} satisfies TurnGameCapabilities;

const SHARED = defineGame({
  rules: DOUBLE_TURN_RULES,
  capabilities: CAPABILITIES,
  turnAutomation: probeAutomation(DOUBLE_TURN_RULES),
});

const BY_RULES = defineGame({
  rules: { ...DOUBLE_TURN_RULES, turnOrder: 'rules' },
  capabilities: CAPABILITIES,
  turnAutomation: probeAutomation(DOUBLE_TURN_RULES),
});

function clientOf(shared: typeof SHARED) {
  return defineGameClient({
    shared,
    title: 'Double turn',
    caption: 'Two counts, then one',
    subtitle: () => 'The first side counts twice in a row.',
    presentation: probePresentation(DOUBLE_TURN_RULES, {
      name: 'Double turn',
      sides: { white: 'Doubles', black: 'Singles' },
      endings: { 'counted to seven': 'Counted to seven first.' },
    }),
  });
}

/**
 * The adapter, unchecked: `assertHarnessGame` takes it (it checks fixtures,
 * not turn order), and the rules laws then refuse it
 * (`turn-order.test.ts`).
 */
export const DOUBLE_TURN_GAME: TurnHarnessGame<typeof CAPABILITIES> = {
  label: 'double turn',
  shared: SHARED,
  client: clientOf(SHARED),
  fixtures: {
    // Movers: first, first, second, first, first, second, first.
    firstSideVictory: ['one', 'one', 'one', 'one', 'one', 'one', 'one'],
    firstSideVictoryLabels: [1, 2, 3, 4, 5, 6, 7].map(
      (count) => `one to ${String(count)}`
    ),
    refusedOpenings: ['three', ''],
  },
};

/** The same game, declaring that its rules name the side to move. */
export const DOUBLE_TURN_BY_RULES_GAME: TurnHarnessGame<typeof CAPABILITIES> = {
  ...DOUBLE_TURN_GAME,
  label: 'double turn by rules',
  shared: BY_RULES,
  client: clientOf(BY_RULES),
};
