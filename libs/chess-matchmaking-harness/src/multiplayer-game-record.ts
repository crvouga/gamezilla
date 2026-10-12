import { multiplayerBoard } from '@libs/chess-matchmaking-shared/game-state';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import type { RecordingClipboard } from '@pkgs/device-shared/clipboard';
import { hostLimit } from '@pkgs/gherkin-shared/registry';
import { openMultiplayerChess } from './multiplayer-actions';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const DAY_SECONDS = 86_400;

async function clipboardOf(
  s: ProductHarness,
  actor: string
): Promise<RecordingClipboard> {
  const env = await s.harness.client(actor);
  const clipboard = env.clipboard as Partial<RecordingClipboard>;
  if (typeof clipboard.last !== 'function')
    throw hostLimit('this host does not show what a person copied');
  return clipboard as RecordingClipboard;
}

/** What a person's multiplayer screen offers them to copy. */
export async function gameRecordOffered(
  s: ProductHarness,
  actor: string
): Promise<{ readonly gameRecord: boolean; readonly finalPosition: boolean }> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  return {
    gameRecord: await ui.get('multiplayer-copy-game-record').isVisible(),
    finalPosition: await ui.get('multiplayer-copy-final-position').isVisible(),
  };
}

function copying(name: string, control: string) {
  return scenarioAction({
    name,
    act: async (s, actor: string) => {
      await Promise.resolve(openMultiplayerChess.act(s, actor));
      const clipboard = await clipboardOf(s, actor);
      const before = clipboard.writes.length;
      await (await actorUi(s, actor)).get(control).tap();
      await pollUntil(
        s,
        async () => (clipboard.writes.length > before ? true : null),
        { maxMs: 5000, stepMs: 1, description: `${name}: the copy` }
      );
    },
  });
}

/** The person copies the game record their multiplayer screen offers. */
export const copyGameRecord = copying(
  'copyGameRecord',
  'multiplayer-copy-game-record'
);
/** The person copies the final position their multiplayer screen offers. */
export const copyFinalPosition = copying(
  'copyFinalPosition',
  'multiplayer-copy-final-position'
);

/** What the person last copied on this device; null before anything was. */
export async function copiedMultiplayerText(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  return (await clipboardOf(s, actor)).last();
}

/** A game record as another chess program reads it. */
export type CopiedGameRecord = {
  readonly white: string | null;
  readonly black: string | null;
  /** `1-0`, `0-1` or `1/2-1/2`. */
  readonly result: string | null;
  /** The time control as multiplayer chess names it: `5+0`, `3d`. */
  readonly timeControl: string | null;
  /** The moves in algebraic notation, without the result: `1. e4 e5`. */
  readonly moves: string;
  /** A chess program loads it and plays every move through. */
  readonly opens: boolean;
};

/** Portable Game Notation's time control, in multiplayer chess's words. */
function namedTimeControl(tag: string | undefined): string | null {
  if (tag === undefined) return null;
  const timed = /^(\d+)\+(\d+)$/.exec(tag);
  if (timed !== null)
    return `${String(Number(timed[1]) / 60)}+${String(Number(timed[2]))}`;
  const daily = /^1\/(\d+)$/.exec(tag);
  return daily === null ? tag : `${String(Number(daily[1]) / DAY_SECONDS)}d`;
}

function opens(record: string, moves: string): boolean {
  try {
    const played = multiplayerBoard({ fen: START, pgn: record }).history();
    return played.length > 0 && played.every((move) => moves.includes(move));
  } catch {
    return false;
  }
}

/** The game record a person last copied; null when they copied none. */
export async function copiedGameRecord(
  s: ProductHarness,
  actor: string
): Promise<CopiedGameRecord | null> {
  const record = await copiedMultiplayerText(s, actor);
  if (record === null || !record.startsWith('[')) return null;
  const lines = record.split('\n').map((line) => line.trim());
  const tags = new Map<string, string>();
  for (const line of lines) {
    const tag = /^\[(\w+) "(.*)"\]$/.exec(line);
    if (tag !== null) tags.set(tag[1] ?? '', tag[2] ?? '');
  }
  const result = tags.get('Result') ?? null;
  const text = lines.filter((line) => !line.startsWith('[')).join(' ');
  const moves =
    result !== null && text.trim().endsWith(result)
      ? text.trim().slice(0, -result.length).trim()
      : text.trim();
  return {
    white: tags.get('White') ?? null,
    black: tags.get('Black') ?? null,
    result,
    timeControl: namedTimeControl(tags.get('TimeControl')),
    moves,
    opens: moves !== text.trim() && opens(record, moves),
  };
}
