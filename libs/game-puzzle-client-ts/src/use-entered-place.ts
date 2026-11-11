import type {
  ScreenPlace,
  ScreenPlaces,
} from '@pkgs/turn-game-client-ts/screen-places';
import {
  type ScreenPlaceNavigation,
  useScreenPlace,
} from '@pkgs/turn-game-client-ts/use-screen-place';
import { type Accessor, createComputed, on } from 'solid-js';

/**
 * `useScreenPlace`, with every stage entered on its home: a place opened in
 * a stage is forgotten when the stage is left, so coming back to that stage
 * later (the next puzzle's result) never reopens it. Forgotten before the
 * new stage's screen is drawn.
 */
export function useEnteredPlace<
  Stage extends string,
  Place extends ScreenPlace,
>(
  places: ScreenPlaces<Stage, Place>,
  stage: Accessor<Stage>
): ScreenPlaceNavigation<Place> {
  const nav = useScreenPlace(places, stage);
  createComputed(on(stage, () => nav.home(), { defer: true }));
  return nav;
}
