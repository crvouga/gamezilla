import { Move, StartMatch } from '@pkgs/room-root-harness-ts/game-room';
import { interruptedMatchChoice } from '../interrupted-match';
import { openRoom } from './room.steps';
import { Given, room } from './world';

Given(
  'White and Black started a match as the room became unavailable',
  async (w) => {
    const s = await openRoom(w, ['white', 'black']);
    await interruptedMatchChoice(
      s,
      'white',
      StartMatch({ whiteMs: 4000, blackMs: 4000 })
    );
  }
);

Given('White has moved as the room became unavailable', async (w) => {
  await interruptedMatchChoice(room(w), 'white', Move({}));
});
