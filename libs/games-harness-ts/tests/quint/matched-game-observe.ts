import type { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { multiplayerDeviceViews } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { clockLeftMs } from '@libs/game-matchmaking-shared-ts/multiplayer-clock';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import { variant } from '@pkgs/quint-shared-ts/itf';
import { modelClockChoice, productSpeed } from './matched-game-clock';
import type { PlayDevice, PlayTrace } from './matched-game-model-world';
import {
  deviceActor,
  PLAY_PEOPLE,
  PLAY_PLACES,
  playNumberOf,
  playOwner,
  playPerson,
} from './matched-game-model-world';

type View = Awaited<ReturnType<typeof multiplayerView>>;

/** The speeds the model stands four clock choices for. */
const MODEL_SPEEDS = ['bullet', 'blitz', 'rapid'] as const;

function outcomeOf(w: PlayTrace, game: MultiplayerGame | null): QuintValue {
  if (game === null) return variant('NoPlay');
  if (game.outcome === 'ongoing') return variant('OngoingPlay');
  if (game.outcome === 'draw') return variant('DrawnPlay');
  if (game.outcome === 'aborted') return variant('AbortedPlay');
  return variant(
    'WonPlay',
    playPerson(w, game.outcome === 'white' ? game.white_id : game.black_id)
  );
}

function offerOf(w: PlayTrace, by: string | null | undefined): string {
  return by ? playPerson(w, by) : 'nobody';
}

/** Whole seconds a clock shows, rounded up as the clock face shows them. */
function shownSeconds(
  game: MultiplayerGame | null,
  side: 'white' | 'black',
  nowMs: number
): number {
  if (game === null) return 0;
  return Math.ceil(clockLeftMs(game, side, nowMs) / 1000);
}

/** What one device shows, in the model's words. */
function shown(w: PlayTrace, d: PlayDevice, view: View, nowMs: number) {
  const game = view.game;
  const looking = view.search?.standing === 'waiting';
  const joined = Number(view.search?.joined_at_ms ?? nowMs);
  return {
    playNumber: game === null ? 0 : playNumberOf(w, game.id),
    playSide:
      game === null
        ? 'none'
        : game.white_id === playOwner(w, d.person)
          ? 'first'
          : 'second',
    moveCount: game?.revision ?? 0,
    turn: game?.outcome === 'ongoing' ? playPerson(w, game.turn) : 'nobody',
    playOutcome: outcomeOf(w, game),
    seeking: looking,
    seekingSeconds: looking ? Math.floor((nowMs - joined) / 1000) : 0,
    clockChoice: modelClockChoice(
      w,
      looking ? view.search?.time_control : game?.time_control
    ),
    firstSideClock: shownSeconds(game, 'white', nowMs),
    secondSideClock: shownSeconds(game, 'black', nowMs),
    drawOffer: offerOf(w, game?.draw_offer_by),
    rematchOffer: offerOf(w, game?.rematch_offer_by),
    ratedGames: new Map<QuintValue, QuintValue>(
      MODEL_SPEEDS.map((speed) => [
        speed,
        view.ratings.find((r) => r.speed === productSpeed(w, speed))?.games ??
          0,
      ])
    ),
  };
}

export async function observePlay(
  w: PlayTrace
): Promise<Record<string, QuintValue>> {
  const devices = PLAY_PEOPLE.flatMap((person) =>
    PLAY_PLACES.map((place) => ({ person, place }))
  );
  const views = await w.quiet.read(
    multiplayerDeviceViews,
    devices.map(deviceActor)
  );
  const nowMs = await w.quiet.read((s) => s.harness.clock.now());
  const out: Record<string, Map<QuintValue, QuintValue>> = {};
  for (const d of devices) {
    const offlineAt = w.memo.get(`play:offline:${deviceActor(d)}`);
    const values = shown(
      w,
      d,
      views.get(deviceActor(d))!,
      typeof offlineAt === 'number' ? offlineAt : nowMs
    );
    for (const [name, value] of Object.entries(values)) {
      out[name] ??= new Map();
      out[name].set(d, value);
    }
  }
  return out;
}
