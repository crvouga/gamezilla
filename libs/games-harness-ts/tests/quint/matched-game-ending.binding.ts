import { pairGamePlayers } from '@libs/game-matchmaking-harness-ts/matched-game-fixtures';
import { sendMultiplayerCommand } from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import { setMultiplayerConnection } from '@libs/game-matchmaking-harness-ts/multiplayer-connection';
import {
  multiplayerEndings,
  multiplayerEndingView,
} from '@libs/game-matchmaking-harness-ts/multiplayer-ending-view';
import { waitForMatchedPlay } from '@libs/game-matchmaking-harness-ts/multiplayer-simulation-actions';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import { conformanceGameOf } from '../conformance-world';
import ownNameTrace from './fixtures/matched-ending-own-name-concatenation.itf.json';
import beforePlayTrace from './fixtures/simulation-revision-is-not-a-first-move.itf.json';

function gameId(w: QuintHarnessWorld) {
  return conformanceGameOf(w.ctx.variant, w.ctx.title).shared.id;
}

async function endingCommand(
  w: QuintHarnessWorld,
  actor: string,
  name: string
) {
  const game = await w.s.read(multiplayerEndingView, actor);
  const sequence = Number(w.memo.get('ending:sequence') ?? 0) + 1;
  w.memo.set('ending:sequence', sequence);
  await w.s.apply(sendMultiplayerCommand, actor, {
    name,
    args: { gameId: game.gameId, requestId: `ending-${sequence}` },
  });
}

bindQuintModel<QuintHarnessWorld>({
  model: 'matched-game-ending',
  traces: 16,
  maxSteps: 8,
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: matched-ending-own-name-concatenation
      id: 'matched-ending-own-name-concatenation',
      title: 'Adjacent own-seat labels still identify the displayed winner',
      seed: '0x67932',
      itf: ownNameTrace,
    },
    {
      // regression: simulation-revision-is-not-a-first-move
      id: 'simulation-revision-is-not-a-first-move',
      title: 'A room revision does not offer resignation before play begins',
      seed: '0x67932',
      itf: beforePlayTrace,
    },
  ],
  actions: {
    init: (w) => w.s.apply(pairGamePlayers, gameId(w), 'alice', 'bob'),
    playBegins: (w) => w.s.apply(waitForMatchedPlay, 'alice', gameId(w)),
    abortGame: (w, picks) =>
      endingCommand(w, String(picks['person']), 'abortMultiplayer'),
    resignGame: (w, picks) =>
      endingCommand(w, String(picks['person']), 'resignMultiplayer'),
    loseConnection: (w, picks) =>
      w.s.apply(setMultiplayerConnection, String(picks['person']), false),
    connectionReturns: (w, picks) =>
      w.s.apply(setMultiplayerConnection, String(picks['person']), true),
  },
  observe: (w) => w.quiet.read(multiplayerEndings),
});
