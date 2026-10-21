import { prepareNamedFriend } from '@libs/friends-harness-ts/setup-friend-request';
import { sendMultiplayerCommand } from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness-ts/multiplayer-connection';
import {
  awaitGameMatch,
  givenOpponentSearch,
} from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import type { MultiplayerNoticeKind } from '@libs/game-matchmaking-harness-ts/multiplayer-notices';
import { openMultiplayerNotice } from '@libs/game-matchmaking-harness-ts/multiplayer-notices';
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { passMultiplayerDays } from '@libs/game-matchmaking-harness-ts/multiplayer-time';
import { givenGameSpace } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { dailyTimeControlId } from '@libs/game-matchmaking-shared-ts/time-control';
import { accountIdOf } from '@libs/harness-ts/identity';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import type { Picks } from '@pkgs/quint-shared-ts/registry';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import { productClockChoice } from './matched-game-clock';
import { DAILY_PEOPLE, observeDailyGame } from './matched-game-daily-observe';
import { modelGameOf, refusedMoveOf, victoryOf } from './model-game';

/** The model's `DAYS_PER_MOVE`. */
const DAYS_PER_MOVE = 3;
const DAY_MS = 86_400_000;

async function initDailyGame(w: QuintHarnessWorld) {
  const owners = new Map<string, string>();
  for (const person of DAILY_PEOPLE) {
    await prepareNamedFriend(w.s, person);
    await w.s.apply(givenGameSpace, person);
    owners.set((await w.s.read(accountIdOf, person))!, person);
  }
  w.memo.set('daily:owners', owners);
}

/** Alice and Bob both asked for three days per move; Alice has the first side. */
async function pairDailyGame(w: QuintHarnessWorld) {
  const [first, second] = DAILY_PEOPLE;
  const timeControl = productClockChoice(w, dailyTimeControlId(DAYS_PER_MOVE));
  await w.s.apply(givenOpponentSearch, first, timeControl);
  await w.s.advanceTime(1);
  await w.s.apply(givenOpponentSearch, second, timeControl);
  await w.s.apply(awaitGameMatch, first, second, true);
}

/** A command on the daily game the person's device shows, as its screen sends it. */
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

/** The victory's next move, for the board the device shows. */
async function playDailyMove(w: QuintHarnessWorld, picks: Picks) {
  const person = String(picks['movePerson']);
  const game = (await w.s.read(multiplayerView, person)).game;
  const revision = game?.revision ?? 0;
  await command(w, person, 'playMultiplayerMove', {
    revision,
    uci: victoryOf(modelGameOf(w))[revision] ?? refusedMoveOf(w),
  });
}

function onOwnGame(name: string) {
  return (w: QuintHarnessWorld, picks: Picks) =>
    command(w, String(picks['person']), name);
}

/** The person offers a draw and the other person accepts it at once. */
async function drawByAgreement(w: QuintHarnessWorld, picks: Picks) {
  const person = String(picks['person']);
  const [first, second] = DAILY_PEOPLE;
  await command(w, person, 'offerMultiplayerDraw');
  await command(w, person === first ? second : first, 'acceptMultiplayerDraw');
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
  model: 'matched-game-daily',
  traces: 16,
  maxSteps: 24,
  timeoutMs: 300_000,
  actions: {
    init: initDailyGame,
    pairPeopleUp: pairDailyGame,
    playMove: playDailyMove,
    resignGame: onOwnGame('resignMultiplayer'),
    abortGame: onOwnGame('abortMultiplayer'),
    drawByAgreement,
    daysPass: (w, picks) =>
      w.s.apply(passMultiplayerDays, Number(picks['days']) * DAY_MS),
    openTurnNotice: openNotice('turn'),
    openResultNotice: openNotice('result'),
    dismissResultNotice: onOwnGame('dismissMultiplayerResultNotice'),
    loseConnection: (w, picks) => connectDailyDevice(w, picks, false),
    comeBackOnline: (w, picks) => connectDailyDevice(w, picks, true),
  },
  observe: observeDailyGame,
});
