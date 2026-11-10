import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type {
  LiveActivity,
  LiveHeartbeat,
} from '@libs/synthetic-population-shared-ts/live-session';
import { placeOfRoute } from '@libs/synthetic-population-shared-ts/live-session';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { useLocation } from '@solidjs/router';
import { type Accessor, createMemo } from 'solid-js';

type ControlRow = { readonly time_control: string | null };

/** A game's display name from its time control, or `null` when unknown. */
function useGameName(): (control: string | null) => string | null {
  let rules: ReturnType<typeof useTurnGames> | null = null;
  let presentation: ReturnType<typeof useGamePresentation> | null = null;
  try {
    rules = useTurnGames();
    presentation = useGamePresentation();
  } catch {
    // An app without games still reports where it is.
  }
  return (control) => {
    if (rules === null || presentation === null) return null;
    try {
      return presentation(rules.forControl(control ?? '').initial()).name();
    } catch {
      return null;
    }
  };
}

/**
 * What this app is doing right now, as the person sees it: where in the app
 * it is (never the route itself), and whether it is looking for an opponent
 * or playing, and which game. Read from the app's own data.
 */
export function useLiveActivity(): Accessor<LiveHeartbeat> {
  const location = useLocation();
  const myId = useMyId();
  const gameName = useGameName();
  const searching = createQuery(
    () => sql<ControlRow>`SELECT time_control FROM chess_opponent_searches
      WHERE owner_id = ${myId()} AND standing = ${'waiting'} AND deleted_at IS NULL LIMIT 1`
  );
  const playing = createQuery(
    () => sql<ControlRow>`SELECT g.time_control FROM chess_multiplayer_games AS g
      JOIN chess_multiplayer_players AS p ON p.game_id = g.id
      WHERE p.owner_id = ${myId()} AND p.deleted_at IS NULL AND g.deleted_at IS NULL
        AND g.outcome = ${'ongoing'} LIMIT 1`
  );
  return createMemo(
    () => {
      const looking = searching.rows()[0];
      const game = playing.rows()[0];
      const activity: LiveActivity =
        game !== undefined
          ? 'playing'
          : looking !== undefined
            ? 'looking'
            : 'browsing';
      const control = game?.time_control ?? looking?.time_control ?? null;
      return {
        place: placeOfRoute(location.pathname),
        activity,
        game: activity === 'browsing' ? null : gameName(control),
      };
    },
    undefined,
    {
      equals: (a, b) =>
        a.place === b.place && a.activity === b.activity && a.game === b.game,
    }
  );
}
