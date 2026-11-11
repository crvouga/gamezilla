/**
 * A game's menu as a machine: the choices are the home, how to play is one
 * step behind them, and Back from the choices leaves for the list of games.
 */
import { describe, expect, test } from 'bun:test';
import {
  GAME_MENU_PLACES,
  type GameMenuPlace,
  type GameMenuStage,
} from '@libs/game-menu-client-ts/game-menu-places';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  type OpenedPlace,
  placeBehind,
  placeIn,
  stageShows,
} from '@pkgs/turn-game-client-ts/screen-places';
import fc from 'fast-check';

const place = fc.constantFrom<GameMenuPlace>(
  { screen: 'menu' },
  { screen: 'how-to-play' }
);
type Step =
  | { readonly kind: 'open'; readonly place: GameMenuPlace }
  | { readonly kind: 'back' };
const step = fc.oneof(
  place.map((opened): Step => ({ kind: 'open', place: opened })),
  fc.constant<Step>({ kind: 'back' })
);

describe("a game's menu places", () => {
  test('any sequence of opens and backs shows a place of the menu', () => {
    assertProperty(
      'game menu: shown place belongs to the menu',
      fc.property(fc.array(step, { maxLength: 20 }), (steps) => {
        let opened: OpenedPlace<GameMenuStage, GameMenuPlace> | null = null;
        for (const next of steps) {
          const shown: GameMenuPlace = placeIn(
            GAME_MENU_PLACES,
            'open',
            opened
          );
          if (next.kind === 'open')
            opened = { stage: 'open', place: next.place };
          else {
            const behind: GameMenuPlace | null = placeBehind(
              GAME_MENU_PLACES,
              'open',
              shown
            );
            opened = behind === null ? null : { stage: 'open', place: behind };
          }
          expect(
            stageShows(
              GAME_MENU_PLACES,
              'open',
              placeIn(GAME_MENU_PLACES, 'open', opened)
            )
          ).toBe(true);
        }
      })
    );
  });

  test('how to play is one step behind the choices, which leave for the games', () => {
    const menu: GameMenuPlace = { screen: 'menu' };
    const rules: GameMenuPlace = { screen: 'how-to-play' };
    expect(placeIn(GAME_MENU_PLACES, 'open', null)).toEqual(menu);
    expect(placeBehind(GAME_MENU_PLACES, 'open', rules)).toEqual(menu);
    expect(placeBehind(GAME_MENU_PLACES, 'open', menu)).toBeNull();
  });
});
