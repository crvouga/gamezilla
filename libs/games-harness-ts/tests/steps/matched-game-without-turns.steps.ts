import { expect } from 'bun:test';
import {
  abortedByFirst,
  resignation,
} from '@libs/game-matchmaking-harness-ts/matched-game-world';
import { multiplayerEndingView } from '@libs/game-matchmaking-harness-ts/multiplayer-ending-view';
import { waitForMatchedPlay } from '@libs/game-matchmaking-harness-ts/multiplayer-simulation-actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { gameOf } from './game-world';
import { pairedAt } from './matched-game';
import { deviceOffline } from './matched-game-connection';

async function underWay(w: HarnessWorld) {
  await w.s.apply(waitForMatchedPlay, 'alice', gameOf(w).shared.id);
}

Given('the game plays without turns', (w) => {
  expect(gameOf(w).shared.turnGame).toBeUndefined();
});
Given(
  '{actor} has the first side against {actor} in a matched game under way without turns',
  async (w, first: string, second: string) => {
    await pairedAt(w, first, second);
    await underWay(w);
  }
);
Given(
  "{actor}'s matched game with {actor} was aborted before it was under way",
  async (w, first: string, second: string) => {
    await pairedAt(w, first, second);
    await abortedByFirst(w);
  }
);
Given(
  "{actor}'s matched game with {actor} was won by {actor} after {actor} resigned",
  async (
    w,
    ...[first, second, , opponent]: [string, string, string, string]
  ) => {
    await pairedAt(w, first, second);
    await underWay(w);
    expect((await resignation(w, opponent)).result.ok).toBe(true);
  }
);
Given(
  "{actor}'s phone was offline when {actor} resigned the matched game after it was under way",
  async (w, offline: string, opponent: string) => {
    await pairedAt(w, 'alice', 'bob');
    await underWay(w);
    await deviceOffline(w, offline);
    expect((await resignation(w, opponent)).result.ok).toBe(true);
  }
);
When('the matched game gets under way', underWay);
Then('both people are offered resigning the matched game', async (w) => {
  for (const actor of ['alice', 'bob']) {
    const view = await w.s.until((s) => multiplayerEndingView(s, actor), {
      pred: (shown) => shown.resignOffered,
    });
    expect(view.resignOffered).toBe(true);
  }
});
Then(
  'neither person is offered aborting the matched game because it is under way',
  async (w) => {
    for (const actor of ['alice', 'bob']) {
      const view = await w.s.read(multiplayerEndingView, actor);
      expect(view.result).toBe('unfinished');
      expect(view.abortOffered).toBe(false);
    }
  }
);
Then(
  '{actor} still sees the last known unfinished matched game',
  async (w, actor: string) => {
    expect((await w.s.read(multiplayerEndingView, actor)).result).toBe(
      'unfinished'
    );
  }
);
