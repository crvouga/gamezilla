import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { JSX } from 'solid-js';
import { SHARED_GAME_SCREEN } from './shared-game-screens';

export type GameHistoryHubScreenViewProps = {
  /** Opens one of the looks back by its key in the space. */
  readonly onOpen: (screen: string) => void;
};

/**
 * History and stats for a game offering both played games and puzzles,
 * presentational: a hub whose rows lead to the games' history and to the
 * puzzle stats, each a screen of its own. Each row names its control like
 * a menu choice (`game-choice-<screen>`).
 */
export function GameHistoryHubScreenView(
  props: GameHistoryHubScreenViewProps
): JSX.Element {
  return (
    <EmbeddedScreen
      screenId="game-history-hub"
      title={<Trans>History and stats</Trans>}
      subtitle={<Trans>Look back at your games and puzzles.</Trans>}
      dataSet={{ testid: 'game-history-hub' }}
    >
      <MenuSection>
        <MenuRow
          title={<Trans>Game history</Trans>}
          caption={<Trans>Review your games, wins and draws</Trans>}
          onClick={() => props.onOpen(SHARED_GAME_SCREEN.gameHistory)}
          dataSet={{
            testid: Handles.gameChoice(SHARED_GAME_SCREEN.gameHistory),
          }}
        />
        <MenuRow
          title={<Trans>Puzzle stats</Trans>}
          caption={<Trans>Puzzle rating trend and game log</Trans>}
          onClick={() => props.onOpen(SHARED_GAME_SCREEN.puzzleStats)}
          dataSet={{
            testid: Handles.gameChoice(SHARED_GAME_SCREEN.puzzleStats),
          }}
        />
      </MenuSection>
    </EmbeddedScreen>
  );
}
