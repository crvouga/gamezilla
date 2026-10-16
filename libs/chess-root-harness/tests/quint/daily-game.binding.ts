import type { MultiplayerNoticeKind } from '@libs/chess-matchmaking-harness/multiplayer-notices';
import { openMultiplayerNotice } from '@libs/chess-matchmaking-harness/multiplayer-notices';
import { givenMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import { passMultiplayerDays } from '@libs/chess-matchmaking-harness/multiplayer-time';
import { prepareNamedFriend } from '@libs/friends-harness/setup-friend-request';
import { sendMultiplayerCommand } from '@libs/game-matchmaking-harness/multiplayer-commands';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness/multiplayer-connection';
import {
  awaitGameMatch,
  givenOpponentSearch,
} from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { multiplayerView } from '@libs/game-matchmaking-harness/multiplayer-reads';
import { dailyTimeControlId } from '@libs/game-matchmaking-shared/time-control';
import { accountIdOf } from '@libs/harness/identity';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import { DAILY_PEOPLE, observeDailyGame } from './daily-game-observe';
import { PLAY_LINES } from './multiplayer-world';

/** The model's `DAYS_PER_MOVE`. */
const DAYS_PER_MOVE = 3;
const DAY_MS = 86_400_000;

async function initDailyGame(w: QuintHarnessWorld) {
  const owners = new Map<string, string>();
  for (const person of DAILY_PEOPLE) {
    await prepareNamedFriend(w.s, person);
    await w.s.apply(givenMultiplayerSpace, person);
    owners.set((await w.s.read(accountIdOf, person))!, person);
  }
  w.memo.set('daily:owners', owners);
}

/** Alice and Bob both asked for three days per move; Alice is White. */
async function formDailyMatch(w: QuintHarnessWorld) {
  const [white, black] = DAILY_PEOPLE;
  const timeControl = dailyTimeControlId(DAYS_PER_MOVE);
  await w.s.apply(givenOpponentSearch, white, timeControl);
  await w.s.advanceTime(1);
  await w.s.apply(givenOpponentSearch, black, timeControl);
  await w.s.apply(awaitGameMatch, white, black, true);
}

/** A command on the game the person's device shows, as its screen sends it. */
async function command(
  w: QuintHarnessWorld,
  person: string,
  name: string,
  args: Record<string, unknown> = {}
) {
  const requests = Number(w.memo.get('daily:requests') ?? 0) + 1;
  w.memo.set('daily:requests', requests);
  const game = (await w.s.read(multiplayerView, person)).game;
  await w.s.apply(sendMultiplayerCommand, person, {
    name,
    args: {
      requestId: `daily-command-${String(requests)}`,
      gameId: game?.id ?? 'no-game',
      ...args,
    },
  });
}

/** The next move of the chosen history, for the board the device shows. */
async function playDailyMove(w: QuintHarnessWorld, picks: Picks) {
  const person = String(picks['movePerson']);
  const game = (await w.s.read(multiplayerView, person)).game;
  const revision = game?.revision ?? 0;
  await command(w, person, 'playMultiplayerMove', {
    revision,
    uci: PLAY_LINES[Number(picks['history'])]?.[revision] ?? 'a1a1',
  });
}

function onOwnGame(name: string) {
  return (w: QuintHarnessWorld, picks: Picks) =>
    command(w, String(picks['person']), name);
}

function openNotice(kind: MultiplayerNoticeKind) {
  return (w: QuintHarnessWorld, picks: Picks) =>
    w.s.apply(openMultiplayerNotice, String(picks['person']), kind);
}

async function connectDailyDevice(
  w: QuintHarnessWorld,
  picks: Picks,
  connected: boolean
) {
  const person = String(picks['person']);
  if (connected) w.memo.delete(`daily:offline:${person}`);
  else
    w.memo.set(
      `daily:offline:${person}`,
      await w.s.read((s) => s.harness.clock.now())
    );
  await w.s.apply(setMultiplayerConnection, person, connected);
}

bindQuintModel<QuintHarnessWorld>({
  model: 'daily-game',
  traces: 16,
  maxSteps: 24,
  timeoutMs: 300_000,
  actions: {
    init: initDailyGame,
    matchFormed: formDailyMatch,
    playMove: playDailyMove,
    resignPlay: onOwnGame('resignMultiplayer'),
    abortPlay: onOwnGame('abortMultiplayer'),
    multiplayerTimePasses: (w, picks) =>
      w.s.apply(passMultiplayerDays, Number(picks['days']) * DAY_MS),
    openTurnNotice: openNotice('turn'),
    openResultNotice: openNotice('result'),
    dismissResultNotice: onOwnGame('dismissMultiplayerResultNotice'),
    loseConnection: (w, picks) => connectDailyDevice(w, picks, false),
    comeBackOnline: (w, picks) => connectDailyDevice(w, picks, true),
  },
  observe: observeDailyGame,
});
