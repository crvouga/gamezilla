import type { PuzzleContentClient } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import type {
  GameFrame,
  GameOptionGroup,
  GamePlayers,
} from '@pkgs/turn-game-shared-ts/game-frame';
import { FRAME_SEAT_LIMIT } from '@pkgs/turn-game-shared-ts/game-frame';
import type {
  GamePositionRules,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { GAME_SIDES, gameSides } from '@pkgs/turn-game-shared-ts/game-rules';

/**
 * What `defineGameClient` checks of a game's frame before the game is
 * offered: a player count its rules seat, a mode named for every other
 * count it offers, options whose defaults its rules accept and read back,
 * and seats told apart.
 */

const isSeatCount = (count: unknown): count is number =>
  typeof count === 'number' &&
  Number.isInteger(count) &&
  count >= 1 &&
  count <= FRAME_SEAT_LIMIT;

function assertModes(id: string, players: GamePlayers): void {
  const modes = players.modes ?? {};
  const named = Object.entries(modes);
  for (const [count, mode] of named) {
    const seats = Number(count);
    if (!isSeatCount(seats) || seats < players.min || seats > players.max)
      throw new Error(
        `${id}: frame.players.modes names a mode for ${count} players, outside ${String(players.min)} to ${String(players.max)}`
      );
    if (typeof mode !== 'string' || mode === '')
      throw new Error(`${id}: frame.players.modes[${count}] names no game`);
  }
  if (new Set(named.map(([, mode]) => mode)).size !== named.length)
    throw new Error(`${id}: frame.players.modes names one game twice`);
  const own = modes[players.default];
  if (own !== undefined && own !== id)
    throw new Error(
      `${id}: frame.players.modes names ${own} for its own count, ${String(players.default)} — name this game`
    );
  for (let count = players.min; count <= players.max; count += 1)
    if (count !== players.default && modes[count as 1] === undefined)
      throw new Error(
        `${id}: frame.players offers ${String(count)} players but names no mode for them — its rules seat ${String(players.default)}; name the mode registered for ${String(count)} in frame.players.modes`
      );
}

function assertPlayers(id: string, players: GamePlayers, seated: number): void {
  const { min, max } = players;
  const fallback = players.default;
  if (![min, max, fallback].every(isSeatCount))
    throw new Error(
      `${id}: frame.players counts are whole numbers from 1 to ${String(FRAME_SEAT_LIMIT)}`
    );
  if (!(min <= fallback && fallback <= max))
    throw new Error(
      `${id}: frame.players needs min ≤ default ≤ max, not ${String(min)}, ${String(fallback)}, ${String(max)}`
    );
  if (max > GAME_SIDES.length)
    throw new Error(
      `${id}: frame.players.max is ${String(max)}, but a game seats at most ${String(GAME_SIDES.length)}`
    );
  if (fallback !== seated)
    throw new Error(
      `${id}: frame.players.default is ${String(fallback)}, but its rules seat ${String(seated)}`
    );
  assertModes(id, players);
}

/** The values an option offers, for checking each against the rules. */
function optionValues(option: GameOptionGroup): readonly unknown[] {
  if (option.kind === 'choice') return option.options.map(({ value }) => value);
  return [option.min, option.default, option.max];
}

function assertOptionShape(id: string, option: GameOptionGroup): void {
  const where = `${id}: frame option ${option.id}`;
  if (option.kind === 'count') {
    if (
      ![option.min, option.default, option.max].every(Number.isInteger) ||
      !(option.min <= option.default && option.default <= option.max)
    )
      throw new Error(`${where} needs whole numbers min ≤ default ≤ max`);
    return;
  }
  const values = option.options.map(({ value }) => value);
  if (values.length < 2 || new Set(values).size !== values.length)
    throw new Error(`${where} needs two or more distinct choices`);
  if (!values.includes(option.default))
    throw new Error(`${where}'s default is not one of its choices`);
}

/** Each value the option offers is accepted by the rules and read back. */
function assertOptionRoundTrip(
  id: string,
  option: GameOptionGroup,
  rules: GamePositionRules
): void {
  const where = `${id}: frame option ${option.id}`;
  const configuration = rules.configuration;
  if (configuration === undefined)
    throw new Error(
      `${where} needs rules.configuration to apply it before play`
    );
  const initial = rules.initial();
  if (option.read(initial) !== option.default)
    throw new Error(`${where} does not read its default in a new game`);
  for (const value of optionValues(option)) {
    const encoded =
      option.kind === 'choice'
        ? option.encode(value as string)
        : option.encode(value as number);
    const configured = configuration.apply(initial, encoded);
    if (configured === null || option.read(configured) !== value)
      throw new Error(
        `${where}: its rules refuse or lose the value ${String(value)}`
      );
  }
}

function assertOptions(
  id: string,
  options: readonly GameOptionGroup[],
  rules: GamePositionRules
): void {
  const ids = options.map((option) => option.id);
  if (ids.some((option) => option === '') || new Set(ids).size !== ids.length)
    throw new Error(`${id}: frame options need distinct ids`);
  for (const option of options) {
    assertOptionShape(id, option);
    assertOptionRoundTrip(id, option, rules);
  }
}

function assertLooks(
  id: string,
  look: (side: GameSide) => unknown,
  sides: readonly GameSide[]
): void {
  const keys = sides.map((side) => {
    const seat = look(side) as { color?: unknown; mark?: unknown };
    const color = seat.color === undefined ? null : seat.color;
    const mark = seat.mark === undefined ? null : seat.mark;
    if (color === null && (typeof mark !== 'string' || mark.trim() === ''))
      throw new Error(`${id}: the ${side} seat has neither a color nor a mark`);
    if (color !== null && !isSeatCount(color))
      throw new Error(
        `${id}: the ${side} seat's color is player1 to player${String(FRAME_SEAT_LIMIT)}`
      );
    return JSON.stringify([color, mark]);
  });
  if (new Set(keys).size !== keys.length)
    throw new Error(`${id}: two seats share one look — give each its own`);
}

/** A game's frame agrees with its rules (see above). */
export function assertFrame(
  id: string,
  rules: GamePositionRules,
  frame: GameFrame<unknown> | undefined
): void {
  if (frame === undefined)
    throw new Error(
      `${id}: its presentation has no frame — the shared screens show every game in one frame`
    );
  const sides = gameSides(rules);
  assertPlayers(id, frame.players, sides.length);
  assertOptions(id, frame.options, rules);
  assertLooks(id, frame.seats.look, sides);
}

/** Puzzle content names each figure the frame shows beside the player. */
export function assertContentFrame(
  id: string,
  content: PuzzleContentClient
): void {
  const frame = content.frame as PuzzleContentClient['frame'] | undefined;
  if (frame === undefined || typeof frame.turnStatus !== 'function')
    throw new Error(
      `${id}: puzzleContent.frame needs its turnStatus (null for none) and stats`
    );
  for (const [key, label] of Object.entries(frame.stats))
    if (typeof label !== 'function')
      throw new Error(`${id}: puzzleContent.frame.stats.${key} is not a label`);
  if (frame.controls !== undefined && typeof frame.controls !== 'function')
    throw new Error(`${id}: puzzleContent.frame.controls must be a component`);
}

/** What the registry check reads of one client. */
type ModeClient = {
  readonly id: string;
  readonly family?: string;
  readonly presentation?: { readonly frame: GameFrame<unknown> };
};

/**
 * Every mode a game names for a player count is a registered game of the
 * same family that seats that count and names the same modes.
 */
export function assertGameModes(
  registry: string,
  clients: readonly ModeClient[]
): void {
  const byId = new Map(clients.map((client) => [client.id, client]));
  for (const client of clients) {
    const players = client.presentation?.frame.players;
    for (const [count, id] of Object.entries(players?.modes ?? {})) {
      const mode = byId.get(id);
      const where = `${registry}: ${client.id} names ${id} for ${count} players`;
      if (mode === undefined) throw new Error(`${where}, which is not listed`);
      if (mode.family !== client.family)
        throw new Error(`${where}, a game of another family`);
      const theirs = mode.presentation?.frame.players;
      if (String(theirs?.default) !== count)
        throw new Error(`${where}, which seats ${String(theirs?.default)}`);
      if (
        theirs?.min !== players?.min ||
        theirs?.max !== players?.max ||
        JSON.stringify(theirs?.modes) !== JSON.stringify(players?.modes)
      )
        throw new Error(`${where}, which offers other player counts`);
    }
  }
}
