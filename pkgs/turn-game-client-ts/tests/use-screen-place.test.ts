import { expect, test } from 'bun:test';
import { defineScreenPlaces } from '@pkgs/turn-game-client-ts/screen-places';
import { useScreenPlace } from '@pkgs/turn-game-client-ts/use-screen-place';
import { createRoot, createSignal } from 'solid-js';

type Stage = 'play' | 'over';
type Place = { readonly screen: 'board' | 'menu' | 'result' };

const PLACES = defineScreenPlaces<Stage, Place>({
  home: { play: { screen: 'board' }, over: { screen: 'result' } },
  screens: { play: ['board', 'menu'], over: ['result'] },
  parent: () => null,
});

test('a place opened in a stage is forgotten once the stage changes, even when the stage comes back', () => {
  createRoot((dispose) => {
    const [stage, setStage] = createSignal<Stage>('play');
    const navigation = useScreenPlace(PLACES, stage);
    navigation.open({ screen: 'menu' });
    expect(navigation.place()).toEqual({ screen: 'menu' });
    setStage('over');
    expect(navigation.place()).toEqual({ screen: 'result' });
    // The next game: its board, not the menu left open in the last one.
    setStage('play');
    expect(navigation.place()).toEqual({ screen: 'board' });
    dispose();
  });
});

test('Back steps to the home, then reports there is nowhere further', () => {
  createRoot((dispose) => {
    const [stage] = createSignal<Stage>('play');
    const navigation = useScreenPlace(PLACES, stage);
    navigation.open({ screen: 'menu' });
    expect(navigation.back()).toBe(true);
    expect(navigation.place()).toEqual({ screen: 'board' });
    expect(navigation.back()).toBe(false);
    dispose();
  });
});

// regression: screen-place-reset-by-unchanged-stage
test('the data behind the stage changing leaves the opened place when the stage is the same', () => {
  createRoot((dispose) => {
    const [game, setGame] = createSignal({ stage: 'play' as Stage, moves: 0 });
    const navigation = useScreenPlace(PLACES, () => game().stage);
    navigation.open({ screen: 'menu' });
    // A move arrives: the game is new data, its stage is not.
    setGame({ stage: 'play', moves: 1 });
    expect(navigation.place()).toEqual({ screen: 'menu' });
    setGame({ stage: 'over', moves: 1 });
    expect(navigation.place()).toEqual({ screen: 'result' });
    dispose();
  });
});
