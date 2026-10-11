import type { ShownMultiplayerNotice } from '@libs/chess-matchmaking-harness/multiplayer-notices';
import { heldMultiplayerNotices } from '@libs/chess-matchmaking-harness/multiplayer-notices';
import type { multiplayerView } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { multiplayerDeviceViews } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { clockLeftMs } from '@libs/chess-matchmaking-shared/multiplayer-clock';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { variant } from '@pkgs/quint-shared/itf';

/** The model's two people; each uses the one device named after them. */
export const DAILY_PEOPLE = ['alice', 'bob'] as const;

const DAY_MS = 86_400_000;

type View = Awaited<ReturnType<typeof multiplayerView>>;

export function dailyOwners(w: QuintHarnessWorld): Map<string, string> {
  return w.memo.get('daily:owners') as Map<string, string>;
}

function personOf(w: QuintHarnessWorld, owner: string): string {
  return dailyOwners(w).get(owner) ?? 'nobody';
}

function outcomeOf(w: QuintHarnessWorld, game: MultiplayerGame | null) {
  if (game === null) return variant('NoPlay');
  if (game.outcome === 'ongoing') return variant('OngoingPlay');
  if (game.outcome === 'draw') return variant('DrawnPlay');
  if (game.outcome === 'aborted') return variant('AbortedPlay');
  return variant(
    'WonPlay',
    personOf(w, game.outcome === 'white' ? game.white_id : game.black_id)
  );
}

/** Whole days a clock shows, rounded up as the clock face shows them. */
function shownDays(
  game: MultiplayerGame | null,
  side: 'white' | 'black',
  nowMs: number
): number {
  if (game === null) return 0;
  return Math.ceil(clockLeftMs(game, side, nowMs) / DAY_MS);
}

/** What one person's device shows, in the model's words. */
function shown(
  w: QuintHarnessWorld,
  seen: {
    readonly view: View;
    readonly notices: readonly ShownMultiplayerNotice[];
  },
  nowMs: number
): Record<string, QuintValue> {
  const game = seen.view.game;
  const turn = seen.notices.find((notice) => notice.kind === 'turn');
  const result = seen.notices.find((notice) => notice.kind === 'result');
  return {
    moveCount: game?.revision ?? 0,
    turn: game?.outcome === 'ongoing' ? personOf(w, game.turn) : 'nobody',
    playOutcome: outcomeOf(w, game),
    whiteClock: shownDays(game, 'white', nowMs),
    blackClock: shownDays(game, 'black', nowMs),
    turnNotice: turn === undefined ? 'none' : turn.unread ? 'unread' : 'opened',
    resultNotice: result?.result ?? 'none',
  };
}

export async function observeDailyGame(
  w: QuintHarnessWorld
): Promise<Record<string, QuintValue>> {
  const views = await w.quiet.read(multiplayerDeviceViews, DAILY_PEOPLE);
  const nowMs = await w.quiet.read((s) => s.harness.clock.now());
  const out: Record<string, Map<QuintValue, QuintValue>> = {};
  for (const person of DAILY_PEOPLE) {
    // An offline device keeps showing its clocks from when it lost its connection.
    const offlineAt = w.memo.get(`daily:offline:${person}`);
    const values = shown(
      w,
      {
        view: views.get(person)!,
        notices: await w.quiet.read(heldMultiplayerNotices, person),
      },
      typeof offlineAt === 'number' ? offlineAt : nowMs
    );
    for (const [name, value] of Object.entries(values)) {
      out[name] ??= new Map();
      out[name].set(person, value);
    }
  }
  return out;
}
