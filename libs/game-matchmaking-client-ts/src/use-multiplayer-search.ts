import { timeControlOf } from '@libs/game-matchmaking-shared-ts/time-control';
import { createTimedValue } from '@pkgs/clock-client-ts/solid';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { type Accessor, createMemo } from 'solid-js';
import type { MultiplayerSearchView } from './multiplayer-waiting';
import { timeControlText } from './time-control-name';
import type { MultiplayerSearchRow } from './use-multiplayer-data';
import { useOfflineSince } from './use-offline-since';

/**
 * The search under way as `MultiplayerWaiting` shows it, ticking each
 * second it looks; `null` while there is no waiting search.
 */
export function useMultiplayerSearch(
  search: Accessor<MultiplayerSearchRow | null>
): Accessor<MultiplayerSearchView | null> {
  const offlineSince = useOfflineSince();
  const rules = useTurnGames();
  const presentation = useGamePresentation();
  const waiting = () => {
    const row = search();
    return row?.standing === 'waiting' ? row : null;
  };
  const joinedAt = () => waiting()?.joined_at_ms ?? null;
  const seconds = createTimedValue(
    (now) => {
      const at = offlineSince() ?? now;
      return Math.max(0, Math.floor((at - (joinedAt() ?? at)) / 1000));
    },
    (value) =>
      offlineSince() === null && waiting() !== null
        ? (joinedAt() ?? 0) + (value + 1) * 1000
        : null
  );
  return createMemo(() => {
    const row = waiting();
    if (row === null) return null;
    const game = rules.forControl(row.time_control ?? '');
    return {
      players: gameSides(game).length,
      gameName: presentation(game.initial()).name(),
      timeControl:
        timeControlOf(row.time_control) === null
          ? null
          : timeControlText(row.time_control),
      seconds: seconds(),
    };
  });
}
