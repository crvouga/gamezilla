import { expect } from 'bun:test';
import {
  changeCustomGame,
  openCustomGame,
} from '@libs/chess/harness/custom-game-actions';
import { readCustomGameIdentity } from '@libs/chess/harness/custom-game-identity';
import { readCustomGameName } from '@libs/chess/harness/custom-game-names';
import { raceCustomGameChoices } from '@libs/chess/harness/custom-game-race';
import { readCustomGameProbe } from '@libs/chess/harness/custom-game-ui';
import {
  type Actor,
  Given,
  type HarnessWorld,
  Then,
  When,
} from '@libs/harness/spec/define';
import { otherDevice } from '@libs/harness/spec/steps/platform';
import {
  partition,
  restoreActorConnection,
} from '@libs/harness/system/actions';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
} from '@libs/harness/system/auth-actions';
import { joinViaLink } from '@libs/spaces/harness/space-actions';
import {
  customGame,
  customHost,
  customPeople,
  customPerson,
  customScreen,
} from './custom-game-world';
import { customSide } from './custom-game-choices.steps';

async function secondDevice(w: HarnessWorld, actor: Actor): Promise<string> {
  const device = otherDevice(actor);
  await w.s.apply(signInWithGoogleAsAccount, device, actor);
  await w.s.apply(returnToTabs, device);
  await w.s.apply(joinViaLink, device, String(w.memo.get('custom-link')));
  await w.s.apply(openCustomGame, device);
  const person = await w.s.read(readCustomGameIdentity, device);
  expect(person).toBe(customPerson(w, actor));
  customPeople(w).set(device, person);
  return device;
}
Given(
  '{actor} has the Custom Game open on another device',
  async (w, actor: Actor) => {
    await secondDevice(w, actor);
  }
);
Given(
  "{actor}'s other device is offline with the Custom Game open",
  async (w, actor: Actor) => {
    const device = await secondDevice(w, actor);
    await w.s.apply(partition, device);
    await w.s.advanceTime(1000);
    expect((await w.s.read(readCustomGameProbe, device))?.connected).toBe(
      false
    );
  }
);
When(
  '{actor} returns to the Custom Game on another device',
  async (w, actor: Actor) => {
    await secondDevice(w, actor);
  }
);
When(
  '{actor} plays e2-e4 on both devices at the same time',
  async (w, actor: Actor) => {
    const game = await customGame(w);
    const choice = {
      operation: 'move',
      uci: 'e2e4',
      ply: game.moves.length,
      gameId: game.id,
      revision: game.revision,
    } as const;
    await w.s.apply(raceCustomGameChoices, {
      spaceId: String(w.memo.get('custom-link')).split('/space/')[1] ?? '',
      choices: [
        { actor, choice },
        { actor: otherDevice(actor), choice },
      ],
    });
  }
);
When("{actor}'s other device returns online", async (w, actor: Actor) => {
  const device = otherDevice(actor);
  await w.s.apply(restoreActorConnection, device);
  await w.s.until(
    async () =>
      (await w.s.read(readCustomGameProbe, device))?.connected === true,
    { maxMs: 5000 }
  );
});
When(
  '{actor} plays e2-e4 on the offline other device',
  async (w, actor: Actor) => {
    const device = otherDevice(actor);
    const game = await customGame(w, device);
    await w.s.apply(changeCustomGame, device, {
      operation: 'move',
      uci: 'e2e4',
      ply: game.moves.length,
    });
  }
);
Then(
  "Black is to move on both of {actor}'s devices",
  async (w, actor: Actor) => {
    for (const device of [actor, otherDevice(actor)]) {
      const probe = await w.s.read(readCustomGameProbe, device);
      expect(probe?.current?.turn).toBe('black');
      expect(probe?.mySide).toBe('white');
    }
  }
);
Then(
  "Both of {actor}'s devices show the Custom Game move list with e4",
  async (w, actor: Actor) => {
    for (const device of [actor, otherDevice(actor)])
      expect(
        (await customGame(w, device)).moves.map((move) => move.san)
      ).toEqual(['e4']);
  }
);
Then('The Custom Game move list shows e4 once', async (w) =>
  expect((await customGame(w)).moves.map((move) => move.san)).toEqual(['e4'])
);
Then(
  "Both of {actor}'s devices show {actor}'s win by resignation",
  async (w, actor: Actor, winner: Actor) => {
    for (const device of [actor, otherDevice(actor)]) {
      const game = await customGame(w, device);
      expect(game.status).toBe('completed');
      expect(game.outcome).toBe(
        `${game.white.person === customPerson(w, winner) ? 'white' : 'black'} wins by resignation`
      );
    }
  }
);
Then(
  '{actor} is told Custom Games need a connection on the other device',
  async (w, actor: Actor) =>
    expect(
      (await w.s.read(readCustomGameProbe, otherDevice(actor)))?.error
    ).toBe('connection needed')
);
Then(
  '{word} in the Custom Game is named {username}',
  async (w, side: string, username: string) => {
    const actor = customHost(w);
    await customScreen(w, actor);
    expect(await w.s.read(readCustomGameName, actor, customSide(side))).toBe(
      username
    );
  }
);
