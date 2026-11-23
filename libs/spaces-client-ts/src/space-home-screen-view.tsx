import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import {
  GAME_TILE_MOTIFS,
  type GameTileMotif,
} from '@pkgs/ui-root-client-ts/game-tile';
import {
  SpaceLauncher,
  type SpaceLauncherGame,
} from '@pkgs/ui-root-client-ts/space-launcher';
import { SpaceStageTemplate } from '@pkgs/ui-root-client-ts/space-stage-template';
import type { SpacePerson } from '@pkgs/ui-root-client-ts/space-types';
import { createMemo, type JSX } from 'solid-js';
import { SpaceScreenNotice, useSpaceScreenChrome } from './space-screen-chrome';
import { ClaimSpaceShell } from './space-shell-claim';

/** One game the space can play, as its registration describes it. */
export type SpaceHomeGame = {
  readonly id: string;
  readonly title: string;
  /** How many play one game; a game with none declared is played alone. */
  readonly players?: number | undefined;
  /** Bots can fill the seats nobody here takes. */
  readonly bots: boolean;
  /** The name of the game's `GameTile` motif. */
  readonly motif: string;
  /** The family its modes share; a game with one mode is its own. */
  readonly family?: string | undefined;
  /** For one of several modes: the game's name, offered once. */
  readonly mode?: { readonly game: string } | undefined;
};

export type SpaceHomeScreenViewProps = {
  readonly games: readonly SpaceHomeGame[];
  /** The host picks the game; guests see what the host can pick. */
  readonly canSelectGame: boolean;
  readonly onSelectGame: (gameId: string) => void;
};

function tileMotif(game: SpaceHomeGame): GameTileMotif {
  const motif = GAME_TILE_MOTIFS.find((each) => each === game.motif);
  if (motif === undefined)
    throw new Error(`${game.id}: "${game.motif}" is not a game tile motif`);
  return motif;
}

/**
 * Each registered game as a launcher tile, in the order registered: one
 * tile per game, whatever its modes. A game with several modes is named
 * once, fits every head count its modes seat, and opens the mode whose id
 * is its family; its mode is then chosen among its choices.
 */
export function spaceLauncherGames(
  games: readonly SpaceHomeGame[]
): readonly SpaceLauncherGame[] {
  const families = Map.groupBy(games, (game) => game.family ?? game.id);
  return [...families].map(([family, modes]) => {
    const opens = modes.find((mode) => mode.id === family) ?? modes[0]!;
    const counts = [...new Set(modes.map((mode) => mode.players ?? 1))].sort(
      (a, b) => a - b
    );
    return {
      key: opens.id,
      name: opens.mode?.game ?? opens.title,
      motif: tileMotif(opens),
      players: { counts, bots: modes.some((mode) => mode.bots) },
      testId: Handles.gameMenu(opens.id),
    };
  });
}

/**
 * The people row while a game is chosen: the host is choosing and everyone
 * else watches; someone gone quiet stays away.
 */
export function spaceHomePeople(
  people: readonly SpacePerson[]
): readonly SpacePerson[] {
  return people.map((person) => ({
    ...person,
    status: person.status ?? (person.host === true ? 'choosing' : 'watching'),
  }));
}

/**
 * `/space/:id` while no game is chosen: the space's stage template with
 * the game launcher as its page, as `Templates/Space/SpaceLauncher` in the catalogue. The
 * host picks a game; a guest sees the same games and that the host is
 * choosing. Everything the space supplies comes from
 * `useSpaceScreenChrome`; `GamesMainMenu` wires the games and the choice.
 */
export function SpaceHomeScreenView(
  props: SpaceHomeScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  const chrome = useSpaceScreenChrome();
  const people = createMemo(() => spaceHomePeople(chrome.people));
  const games = createMemo(() => spaceLauncherGames(props.games));
  return (
    <>
      <ClaimSpaceShell />
      <SpaceStageTemplate
        spaceName={chrome.spaceName}
        title={t`Choose game`}
        role={chrome.role}
        onBack={chrome.onBack}
        backLabel={chrome.backLabel}
        menu={chrome.menu}
        onLeave={chrome.onLeave}
        onEnd={chrome.onEnd}
        onInvite={chrome.onInvite}
        onPersonAction={chrome.onPersonAction}
        personCapabilities={chrome.personCapabilities}
        notice={<SpaceScreenNotice />}
        testIds={chrome.testIds}
      >
        <SpaceLauncher
          role={props.canSelectGame ? 'host' : 'guest'}
          hostName={chrome.hostName}
          present={Math.max(1, people().length)}
          games={games()}
          onChoose={(key) => props.onSelectGame(key)}
          testIds={{
            status: props.canSelectGame
              ? undefined
              : Handles.spaceHostChoosesGame,
          }}
        />
      </SpaceStageTemplate>
    </>
  );
}
