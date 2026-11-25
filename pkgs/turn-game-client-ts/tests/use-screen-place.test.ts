import { expect, test } from 'bun:test';
import { defineScreenPlaces } from '@pkgs/turn-game-client-ts/screen-places';
import { useScreenPlace } from '@pkgs/turn-game-client-ts/use-screen-place';
import { type Accessor, createRoot, createSignal, flush } from 'solid-js';

type Stage = 'play' | 'over';
type Place = { readonly screen: 'board' | 'menu' | 'result' };

const PLACES = defineScreenPlaces<Stage, Place>({
  home: { play: { screen: 'board' }, over: { screen: 'result' } },
  screens: { play: ['board', 'menu'], over: ['result'] },
  parent: () => null,
});

function mounted(stage: Accessor<Stage>) {
  return createRoot((dispose) => ({
    navigation: useScreenPlace(PLACES, stage),
    dispose,
  }));
}

test('a place opened in a stage is forgotten once the stage changes, even when the stage comes back', () => {
  const [stage, setStage] = createSignal<Stage>('play');
  const { navigation, dispose } = mounted(stage);
  navigation.open({ screen: 'menu' });
  flush();
  expect(navigation.place()).toEqual({ screen: 'menu' });
  setStage('over');
  flush();
  expect(navigation.place()).toEqual({ screen: 'result' });
  // The next game: its board, not the menu left open in the last one.
  setStage('play');
  flush();
  expect(navigation.place()).toEqual({ screen: 'board' });
  dispose();
});

test('Back steps to the home, then reports there is nowhere further', () => {
  const [stage] = createSignal<Stage>('play');
  const { navigation, dispose } = mounted(stage);
  navigation.open({ screen: 'menu' });
  flush();
  expect(navigation.back()).toBe(true);
  flush();
  expect(navigation.place()).toEqual({ screen: 'board' });
  expect(navigation.back()).toBe(false);
  dispose();
});

// regression: screen-place-reset-by-unchanged-stage
test('the data behind the stage changing leaves the opened place when the stage is the same', () => {
  const [game, setGame] = createSignal({ stage: 'play' as Stage, moves: 0 });
  const { navigation, dispose } = mounted(() => game().stage);
  navigation.open({ screen: 'menu' });
  flush();
  // A move arrives: the game is new data, its stage is not.
  setGame({ stage: 'play', moves: 1 });
  flush();
  expect(navigation.place()).toEqual({ screen: 'menu' });
  setGame({ stage: 'over', moves: 1 });
  flush();
  expect(navigation.place()).toEqual({ screen: 'result' });
  dispose();
});

// regression: screen-place-move-returned-as-effect-cleanup
test('a move made from an effect leaves the effect nothing to clean up with', () => {
  const [stage] = createSignal<Stage>('play');
  const { navigation, dispose } = mounted(stage);
  // An effect that opens a place returns what the move returns: anything but
  // undefined would be taken for its cleanup.
  expect(navigation.open({ screen: 'menu' }) as unknown).toBeUndefined();
  expect(navigation.home() as unknown).toBeUndefined();
  dispose();
});
