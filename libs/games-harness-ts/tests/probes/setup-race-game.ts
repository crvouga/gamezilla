/**
 * Probe: a setup phase before play. Each side first picks its stride
 * (`pick-1` or `pick-2`, the first side first); then each in turn runs its
 * own counter on by its stride, and who reaches three wins. The setup is
 * ordinary actions in ordinary positions. Offers custom games only.
 *
 * A position is `setup-race:<first stride><second stride>:<first><second><w|b>`,
 * an unpicked stride `_` (`setup-race:__:00w` at the start).
 */

import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import type { GameFixtures } from '@libs/game-session-harness-ts/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import type {
  GameRules,
  GameSide,
  PlayedPosition,
  TurnGameCapabilities,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { otherSide } from './count-rules';
import { probeAutomation, probePresentation } from './probe-parts';

const HOME = 3;
const POSITION = /^setup-race:([_12])([_12]):([0-3])([0-3])([wb])$/;
const INITIAL = 'setup-race:__:00w';

type Race = {
  readonly stride: Record<GameSide, number | null>;
  readonly count: Record<GameSide, number>;
  readonly mover: GameSide;
};

function parse(position: string): Race | null {
  const m = POSITION.exec(position);
  if (m === null) return null;
  const stride = (s: string | undefined) => (s === '_' ? null : Number(s));
  return {
    stride: { white: stride(m[1]), black: stride(m[2]) },
    count: { white: Number(m[3]), black: Number(m[4]) },
    mover: m[5] === 'w' ? 'white' : 'black',
  };
}

const show = (race: Race) =>
  `setup-race:${race.stride.white ?? '_'}${race.stride.black ?? '_'}:${String(race.count.white)}${String(race.count.black)}${race.mover === 'white' ? 'w' : 'b'}`;

function legal(position: string): readonly string[] {
  const race = parse(position);
  if (race === null || race.count.white === HOME || race.count.black === HOME)
    return [];
  return race.stride[race.mover] === null ? ['pick-1', 'pick-2'] : ['run'];
}

function play(
  position: string,
  action: string,
  history: string
): PlayedPosition | null {
  const race = parse(position);
  if (race === null || !legal(position).includes(action)) return null;
  const mover = race.mover;
  const picked = action === 'run' ? null : Number(action.slice(5));
  const count =
    picked === null
      ? Math.min(HOME, race.count[mover] + (race.stride[mover] ?? 0))
      : race.count[mover];
  const next: Race = {
    stride: { ...race.stride, [mover]: picked ?? race.stride[mover] },
    count: { ...race.count, [mover]: count },
    mover: otherSide(mover),
  };
  const home = count === HOME;
  return {
    position: show(next),
    history: history === '' ? action : `${history} ${action}`,
    turn: next.mover,
    label:
      picked === null ? `run to ${String(count)}` : `stride ${String(picked)}`,
    winner: home ? mover : null,
    reason: home ? 'ran home' : null,
  };
}

function trail(actions: readonly string[]): readonly PlayedPosition[] {
  const played: PlayedPosition[] = [];
  for (const action of actions) {
    const next = play(played.at(-1)?.position ?? INITIAL, action, '');
    if (next === null) throw new Error(`setup-race: ${action} is refused`);
    played.push(next);
  }
  return played;
}

export const SETUP_RACE_RULES: GameRules = {
  id: 'setup-race',
  recognizes: (position) => parse(position) !== null,
  initial: () => INITIAL,
  play: (position, action, history) => play(position, action, history),
  replay: (actions, ply) =>
    trail(actions.slice(0, ply)).at(-1)?.position ?? INITIAL,
  legal,
  canWin: () => true,
  moves: (_position, _history, actions) =>
    trail(actions).map((played, ply, all) => ({
      label: played.label,
      before: all[ply - 1]?.position ?? INITIAL,
      after: played.position,
    })),
};

const CAPABILITIES = {
  'custom-games': {
    bots: {
      difficulties: [],
      choose: (position) => legal(position)[0] ?? null,
    },
  },
} satisfies TurnGameCapabilities;

const SHARED = defineGame({
  rules: SETUP_RACE_RULES,
  capabilities: CAPABILITIES,
  turnAutomation: probeAutomation(SETUP_RACE_RULES),
});

/** Both pick a stride of one; the first side runs home on its third run. */
const FIXTURES: GameFixtures<typeof CAPABILITIES> = {
  firstSideVictory: ['pick-1', 'pick-1', 'run', 'run', 'run', 'run', 'run'],
  firstSideVictoryLabels: [
    'stride 1',
    'stride 1',
    'run to 1',
    'run to 1',
    'run to 2',
    'run to 2',
    'run to 3',
  ],
  refusedOpenings: ['run', 'pick-3', ''],
};

export const SETUP_RACE_GAME = assertHarnessGame({
  label: 'setup race',
  shared: SHARED,
  client: defineGameClient({
    shared: SHARED,
    title: 'Setup race',
    caption: 'Pick a stride, then run',
    subtitle: () => 'Each side picks its stride before the race.',
    presentation: probePresentation(SETUP_RACE_RULES, {
      name: 'Setup race',
      sides: { white: 'Hares', black: 'Hounds' },
      endings: { 'ran home': 'Ran home first.' },
    }),
  }),
  fixtures: FIXTURES,
});
