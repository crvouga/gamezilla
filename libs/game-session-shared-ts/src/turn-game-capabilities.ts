import { puzzleLineLayout } from '@pkgs/turn-game-shared-ts/game-puzzles';
import type { TurnGameCapabilities } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  BOT_DIFFICULTIES,
  GAME_CAPABILITIES,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';

/** Refuse capabilities the platform does not offer, and placeholders. */
function assertKeys(id: string, capabilities: object): void {
  for (const [key, value] of Object.entries(capabilities)) {
    if (!(GAME_CAPABILITIES as readonly string[]).includes(key))
      throw new Error(
        `${id}: "${key}" is not a capability the platform offers (${GAME_CAPABILITIES.join(', ')})`
      );
    if (value === undefined || value === null)
      throw new Error(
        `${id}: capabilities.${key} is a placeholder — leave out a capability the game does not offer`
      );
  }
}

function assertFunctions(
  id: string,
  capability: string,
  functions: Readonly<Record<string, unknown>>
): void {
  for (const [name, value] of Object.entries(functions))
    if (typeof value !== 'function')
      throw new Error(
        `${id}: offering ${capability} needs capabilities.${capability}.${name} — supply its implementation`
      );
}

function assertBots(
  id: string,
  capabilities: TurnGameCapabilities,
  simulation?: RegisteredSimulation
): void {
  const custom = capabilities['custom-games'];
  if (custom === undefined) return;
  if (
    custom.localPlayers !== undefined &&
    (custom.localPlayers !== true || simulation === undefined)
  )
    throw new Error(`${id}: local players require simulation inputs`);
  if (simulation === undefined)
    assertFunctions(id, 'custom-games', { 'bots.choose': custom.bots?.choose });
  else if (simulation.bots === undefined)
    throw new Error(`${id}: custom games need simulation bot inputs`);
  const difficulties = custom.bots?.difficulties;
  if (
    !Array.isArray(difficulties) ||
    difficulties.some((difficulty) => !BOT_DIFFICULTIES.includes(difficulty))
  )
    throw new Error(
      `${id}: capabilities.custom-games.bots.difficulties must be an array of ${BOT_DIFFICULTIES.join(', ')} (empty for a single bot)`
    );
  if (new Set(difficulties).size !== difficulties.length)
    throw new Error(`${id}: a bot difficulty is offered twice`);
}

/** Validate every advertised implementation before installing its sessions. */
export function assertTurnGameCapabilities(
  id: string,
  capabilities: TurnGameCapabilities,
  simulation?: RegisteredSimulation
): void {
  assertKeys(id, capabilities);
  assertBots(id, capabilities, simulation);
  if (capabilities.history !== undefined)
    assertFunctions(id, 'history', { record: capabilities.history.record });
  const matched = capabilities.matchmaking;
  if (matched !== undefined) {
    if (matched.clockChoices === true)
      assertFunctions(id, 'matchmaking', {
        'notice.timeoutDraw': matched.notice?.timeoutDraw,
      });
    assertFunctions(id, 'matchmaking', {
      'notice.side': matched.notice?.side,
      'notice.ending': matched.notice?.ending,
    });
    if (matched.clockChoices !== undefined && matched.clockChoices !== true)
      throw new Error(
        `${id}: matchmaking.clockChoices is true when turn clocks are offered, otherwise leave it out`
      );
    if (typeof matched.namespace !== 'string')
      throw new Error(
        `${id}: offering matchmaking needs capabilities.matchmaking.namespace ("${id}/")`
      );
  }
  const puzzles = capabilities.puzzles;
  if (puzzles === undefined) return;
  puzzleLineLayout(puzzles);
  assertFunctions(id, 'puzzles', {
    'content.validate': puzzles.content?.validate,
    marks: puzzles.marks,
    isCell: puzzles.isCell,
  });
  if (typeof puzzles.namespace !== 'string')
    throw new Error(
      `${id}: offering puzzles needs capabilities.puzzles.namespace ("${id}/")`
    );
}
