import { expect, test } from 'bun:test';
import {
  firstMultiplayerArrival,
  multiplayerArrivalIsTerminal,
} from '@libs/chess-matchmaking-harness/multiplayer-navigation';
import { Handles } from '@libs/test-ids-shared/handles';

// regression: ended-space-multiplayer-show
test('an ended space is the arrival, even though Back is also on screen', () => {
  const visible = new Set([
    Handles.navBack,
    'status-current-user',
    Handles.spaceEnded,
  ]);
  expect(firstMultiplayerArrival(visible)).toBe(Handles.spaceEnded);
  expect(multiplayerArrivalIsTerminal(Handles.spaceEnded)).toBe(true);
  expect(multiplayerArrivalIsTerminal(Handles.spaceNotFound)).toBe(true);
  expect(firstMultiplayerArrival(new Set([Handles.navBack]))).toBe(
    Handles.navBack
  );
  expect(firstMultiplayerArrival(new Set(['game-menu-chess']))).toBe(
    'game-menu-chess'
  );
});
