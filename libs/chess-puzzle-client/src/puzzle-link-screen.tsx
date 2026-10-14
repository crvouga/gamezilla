/**
 * What a puzzle link opens to: the puzzle on the person's board in their
 * space, or why not — puzzles need a connection, the puzzle is no longer
 * available, or the person cannot open another space.
 */

import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { SearchIcon, WifiOffIcon } from '@pkgs/ui-root-client/icons';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { type JSX, Match, Switch } from 'solid-js';
import { usePuzzleLinkOpening } from './use-puzzle-link-opening';

export function PuzzleLinkScreen(): JSX.Element {
  const params = useLocalSearchParams<{ puzzleId?: string | undefined }>();
  const opening = usePuzzleLinkOpening(() => params().puzzleId ?? '');
  return (
    <ContentScreen
      screenId="chess-puzzle-link"
      breadcrumbs={[{ name: <Trans>Puzzle</Trans> }]}
      dataSet={{ testid: Handles.chessPuzzleLinkScreen }}
    >
      <Switch fallback={<LoadingState />}>
        <Match when={opening().kind === 'offline'}>
          <EmptyState
            icon={WifiOffIcon}
            title={<Trans>You're offline</Trans>}
            body={
              <Trans>
                Puzzles need a connection. Reconnect and open the puzzle link
                again.
              </Trans>
            }
            dataSet={{ testid: Handles.chessPuzzleOffline }}
          />
        </Match>
        <Match when={opening().kind === 'unavailable'}>
          <EmptyState
            icon={SearchIcon}
            title={<Trans>This puzzle is no longer available</Trans>}
            body={
              <Trans>
                It was taken out of the puzzles, so its link no longer opens it.
              </Trans>
            }
            dataSet={{ testid: Handles.chessPuzzleLinkUnavailable }}
          />
        </Match>
        <Match
          when={(() => {
            const current = opening();
            return current.kind === 'spaceLimited' ? current : null;
          })()}
          keyed
        >
          {(limited) => <DenialSurface decision={limited.decision} />}
        </Match>
      </Switch>
    </ContentScreen>
  );
}
