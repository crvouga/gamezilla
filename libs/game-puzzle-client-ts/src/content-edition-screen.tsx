import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, type JSX, Show } from 'solid-js';
import { contentEditionAvailable } from './content-availability';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';
import { ContentPackOverview } from './content-pack-overview';
import { ContentPreview } from './content-preview';
import { ContentStartAttempt } from './content-start-attempt';

export function ContentEditionScreen(props: {
  revisionId: string;
  packRevisionId: string | null;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const revision = createMemo(() =>
    data.content().revisions.find((entry) => entry.id === props.revisionId)
  );
  const document = createMemo(() =>
    data
      .content()
      .documents.find((entry) => entry.id === revision()?.document_id)
  );
  const available = () =>
    contentEditionAvailable(
      data.content(),
      props.revisionId,
      props.packRevisionId
    );
  const edit = useDecision(PERMISSION.puzzlesEditContent, () => ({
    puzzleOwnerId: document()?.owner_id ?? '',
  }));
  const play = useDecision(PERMISSION.puzzlesPlay);
  return (
    <Show
      when={revision()}
      fallback={
        <ErrorState
          title={t`This edition is not available on this device`}
          body={t`Return to puzzles, reconnect and open it again. Saved attempts keep their original content.`}
          secondary={{
            label: t`Return to puzzles`,
            onClick: () => game.open({ kind: 'library' }),
          }}
        />
      }
    >
      {(edition) => (
        <GameScreen
          screenId="puzzle-content-edition"
          title={edition().title}
          subtitle={edition().difficulty}
        >
          <GameSessionLayout
            notices={
              <Show when={!available()}>
                <Notice>
                  <Trans>
                    This publication is withdrawn. You can continue saved
                    attempts from your library.
                  </Trans>
                </Notice>
              </Show>
            }
            aside={
              <StackVertical gap="md">
                <P>{edition().description}</P>
                <Show when={edit().allowed}>
                  <Button
                    title={t`Edit working draft`}
                    variant="outline"
                    intent="neutral"
                    onClick={() =>
                      game.open({
                        kind: 'edit',
                        documentId: edition().document_id,
                      })
                    }
                  />
                </Show>
              </StackVertical>
            }
            actions={
              <Show when={edition().kind === 'puzzle'}>
                <ContentStartAttempt
                  revisionId={edition().id}
                  packRevisionId={props.packRevisionId}
                  disabled={!available()}
                />
              </Show>
            }
          >
            <Show
              when={play().allowed}
              fallback={<DenialSurface decision={play()} />}
            >
              <Show
                when={edition().kind === 'pack'}
                fallback={<ContentPreview definition={edition().definition} />}
              >
                <ContentPackOverview revisionId={edition().id} />
              </Show>
            </Show>
          </GameSessionLayout>
        </GameScreen>
      )}
    </Show>
  );
}
