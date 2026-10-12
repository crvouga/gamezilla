import {
  closeMultiplayerApp,
  reopenMultiplayerApp,
} from '@libs/chess-matchmaking-harness/multiplayer-app';
import { passMultiplayerDays } from '@libs/chess-matchmaking-harness/multiplayer-time';
import { Given, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { pairOf } from './multiplayer-world';

const DAY_MS = 86_400_000;

/**
 * The person's app is closed. Nobody looks at that device meanwhile, so
 * what "both people see" is read on their multiplayer opponent's device
 * until they reopen it.
 */
export async function closeApp(w: HarnessWorld, actor: string) {
  await w.s.apply(closeMultiplayerApp, actor);
  const opponent = pairOf(w).find((person) => person !== actor);
  if (opponent !== undefined)
    w.memo.set(`multiplayer:viewer:${actor}`, opponent);
}

export async function reopenApp(w: HarnessWorld, actor: string) {
  w.memo.delete(`multiplayer:viewer:${actor}`);
  await w.s.apply(reopenMultiplayerApp, actor);
}

Given('{actor} has closed the app', closeApp);
Given(
  '{actor} closed the app {int} day(s) ago',
  async (w, actor: Actor, days: number) => {
    await w.s.apply(closeMultiplayerApp, actor);
    await w.s.apply(passMultiplayerDays, days * DAY_MS);
  }
);
When('{actor} reopens the app', reopenApp);
