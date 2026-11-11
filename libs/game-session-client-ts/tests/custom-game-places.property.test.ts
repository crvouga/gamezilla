import { describe, expect, test } from 'bun:test';
import {
  CUSTOM_GAME_PLACES,
  type CustomGamePlace,
} from '@libs/game-session-client-ts/custom-game-places';
import type { FramePhase } from '@libs/game-session-client-ts/game-frame-view-types';
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
const place: fc.Arbitrary<CustomGamePlace> = fc.oneof(
  fc
    .constantFrom(
      'start',
      'lobby',
      'options',
      'clock',
      'private-setup',
      'play',
      'commands',
      'moves',
      'result' as const
    )
    .map((screen): CustomGamePlace => ({ screen })),
  fc
    .tuple(fc.constantFrom('seat', 'invite' as const), side)
    .map(([screen, seat]): CustomGamePlace => ({ screen, side: seat }))
);

type Step =
  | { readonly kind: 'open'; readonly place: CustomGamePlace }
  | { readonly kind: 'back' }
  | { readonly kind: 'phase'; readonly phase: FramePhase };

const step: fc.Arbitrary<Step> = fc.oneof(
  place.map((opened): Step => ({ kind: 'open', place: opened })),
  fc.constant<Step>({ kind: 'back' }),
  phase.map((next): Step => ({ kind: 'phase', phase: next }))
);

describe('the custom game places', () => {
  test('any walk of opens, backs and phase changes shows a place its phase allows', () => {
    assertProperty(
      'the shown place belongs to the phase',
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        let at: FramePhase = 'none';
        let opened: OpenedPlace<FramePhase, CustomGamePlace> | null = null;
        for (const next of steps) {
          if (next.kind === 'phase') at = next.phase;
          if (next.kind === 'open') opened = { stage: at, place: next.place };
          if (next.kind === 'back') {
            const behind: CustomGamePlace | null = placeBehind(
              CUSTOM_GAME_PLACES,
              at,
              placeIn(CUSTOM_GAME_PLACES, at, opened)
            );
            opened = behind === null ? null : { stage: at, place: behind };
          }
          const shown = placeIn(CUSTOM_GAME_PLACES, at, opened);
          expect(stageShows(CUSTOM_GAME_PLACES, at, shown)).toBe(true);
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
          placeIn(CUSTOM_GAME_PLACES, to, { stage: from, place: opened })
        ).toEqual(CUSTOM_GAME_PLACES.home[to]);
      })
    );
  });

  test('Back reaches the phase home in at most two steps, then leaves', () => {
    assertProperty(
      'back is bounded',
      fc.property(phase, place, (at, opened) => {
        let shown: CustomGamePlace | null = placeIn(CUSTOM_GAME_PLACES, at, {
          stage: at,
          place: opened,
        });
        let steps = 0;
        while (shown !== null && steps < 4) {
          shown = placeBehind(CUSTOM_GAME_PLACES, at, shown);
          steps += 1;
        }
        expect(shown).toBeNull();
        expect(steps).toBeLessThanOrEqual(3);
      })
    );
  });

  test('each phase opens on its own home', () => {
    expect(CUSTOM_GAME_PLACES.home).toEqual({
      none: { screen: 'start' },
      configuring: { screen: 'lobby' },
      active: { screen: 'play' },
      completed: { screen: 'result' },
      cancelled: { screen: 'result' },
    });
  });

  test('inviting is behind its seat, and the seat behind the lobby', () => {
    const invite: CustomGamePlace = { screen: 'invite', side: 'black' };
    expect(placeBehind(CUSTOM_GAME_PLACES, 'configuring', invite)).toEqual({
      screen: 'seat',
      side: 'black',
    });
    expect(
      placeBehind(CUSTOM_GAME_PLACES, 'configuring', {
        screen: 'seat',
        side: 'black',
      })
    ).toEqual({ screen: 'lobby' });
  });

  test('the moves are reachable while a game is played and once it is over, never before', () => {
    const moves: CustomGamePlace = { screen: 'moves' };
    for (const at of PHASES)
      expect(stageShows(CUSTOM_GAME_PLACES, at, moves)).toBe(
        at === 'active' || at === 'completed' || at === 'cancelled'
      );
  });
});
