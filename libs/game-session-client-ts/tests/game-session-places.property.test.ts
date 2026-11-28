import { describe, expect, test } from 'bun:test';
import type { FramePhase } from '@libs/game-session-client-ts/game-frame-view-types';
import {
  GAME_SESSION_PLACES,
  type GameSessionPlace,
} from '@libs/game-session-client-ts/game-session-places';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  type OpenedPlace,
  placeBehind,
  placeIn,
  stageShows,
} from '@pkgs/turn-game-client-ts/screen-places';
import fc from 'fast-check';

const PHASES: readonly FramePhase[] = [
  'none',
  'configuring',
  'active',
  'completed',
  'cancelled',
];

const phase = fc.constantFrom(...PHASES);
const side = fc.constantFrom('white', 'black', 'red', 'blue' as const);
const place: fc.Arbitrary<GameSessionPlace> = fc.oneof(
  fc
    .constantFrom(
      'home',
      'setup',
      'options',
      'clock',
      'private-setup',
      'stage',
      'commands',
      'moves',
      'result' as const
    )
    .map((screen): GameSessionPlace => ({ screen })),
  fc
    .tuple(fc.constantFrom('seat', 'invite' as const), side)
    .map(([screen, seat]): GameSessionPlace => ({ screen, side: seat }))
);

type Step =
  | { readonly kind: 'open'; readonly place: GameSessionPlace }
  | { readonly kind: 'back' }
  | { readonly kind: 'phase'; readonly phase: FramePhase };

const step: fc.Arbitrary<Step> = fc.oneof(
  place.map((opened): Step => ({ kind: 'open', place: opened })),
  fc.constant<Step>({ kind: 'back' }),
  phase.map((next): Step => ({ kind: 'phase', phase: next }))
);

describe('the game session places', () => {
  test('any walk of opens, backs and phase changes shows a place its phase allows', () => {
    assertProperty(
      'the shown place belongs to the phase',
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        let at: FramePhase = 'none';
        let opened: OpenedPlace<FramePhase, GameSessionPlace> | null = null;
        for (const next of steps) {
          if (next.kind === 'phase') at = next.phase;
          if (next.kind === 'open') opened = { stage: at, place: next.place };
          if (next.kind === 'back') {
            const behind: GameSessionPlace | null = placeBehind(
              GAME_SESSION_PLACES,
              at,
              placeIn(GAME_SESSION_PLACES, at, opened)
            );
            opened = behind === null ? null : { stage: at, place: behind };
          }
          const shown = placeIn(GAME_SESSION_PLACES, at, opened);
          expect(stageShows(GAME_SESSION_PLACES, at, shown)).toBe(true);
        }
      })
    );
  });

  test('a phase change always lands on the new phase home', () => {
    assertProperty(
      'no place survives its phase',
      fc.property(phase, place, phase, (from, opened, to) => {
        fc.pre(from !== to);
        expect(
          placeIn(GAME_SESSION_PLACES, to, { stage: from, place: opened })
        ).toEqual(GAME_SESSION_PLACES.home[to]);
      })
    );
  });

  test('Back reaches the phase home in at most two steps, then leaves', () => {
    assertProperty(
      'back is bounded',
      fc.property(phase, place, (at, opened) => {
        let shown: GameSessionPlace | null = placeIn(GAME_SESSION_PLACES, at, {
          stage: at,
          place: opened,
        });
        let steps = 0;
        while (shown !== null && steps < 4) {
          shown = placeBehind(GAME_SESSION_PLACES, at, shown);
          steps += 1;
        }
        expect(shown).toBeNull();
        expect(steps).toBeLessThanOrEqual(3);
      })
    );
  });

  test('each phase opens on its own home', () => {
    expect(GAME_SESSION_PLACES.home).toEqual({
      none: { screen: 'home' },
      configuring: { screen: 'setup' },
      active: { screen: 'stage' },
      completed: { screen: 'result' },
      cancelled: { screen: 'result' },
    });
  });

  test('inviting is behind its seat, and the seat behind the lobby', () => {
    const invite: GameSessionPlace = { screen: 'invite', side: 'black' };
    expect(placeBehind(GAME_SESSION_PLACES, 'configuring', invite)).toEqual({
      screen: 'seat',
      side: 'black',
    });
    expect(
      placeBehind(GAME_SESSION_PLACES, 'configuring', {
        screen: 'seat',
        side: 'black',
      })
    ).toEqual({ screen: 'setup' });
  });

  test('the moves are reachable while a game is played and once it is over, never before', () => {
    const moves: GameSessionPlace = { screen: 'moves' };
    for (const at of PHASES)
      expect(stageShows(GAME_SESSION_PLACES, at, moves)).toBe(
        at === 'active' || at === 'completed' || at === 'cancelled'
      );
  });
});
