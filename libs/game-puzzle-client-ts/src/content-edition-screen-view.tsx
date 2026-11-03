import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';

/** The published edition, as the screen shows it. */
export type ContentEditionSummary = {
  readonly id: string;
  readonly documentId: string;
  readonly kind: ContentKind;
  readonly title: string;
  readonly difficulty: string;
  readonly description: string;
};

export type ContentEditionScreenViewProps = {
  /** Null when the edition has not reached this device. */
  readonly edition: ContentEditionSummary | null;
  /** False once the publication is withdrawn: saved attempts continue. */
  readonly available: boolean;
  /** The person may edit the document's working draft. */
  readonly canEdit: boolean;
  /** Set when the person may not play; replaces the preview. */
  readonly playDenial?: DenialView | undefined;
  /** Start or continue an attempt (puzzles). */
  readonly startAttempt?: JSX.Element;
  /** The puzzle's preview, or the pack's overview. */
  readonly body?: JSX.Element;
  readonly onEditWorkingDraft: () => void;
  readonly onReturnToLibrary: () => void;
};

/**
 * One published puzzle or pack, presentational: its title, difficulty and
 * description, a preview or the pack's puzzles, starting an attempt, and
 * editing for its owner — or withdrawn, denied and not-on-this-device
 * states. The start control and the body arrive as slots.
 */
export function ContentEditionScreenView(
  props: ContentEditionScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <Show
      when={props.edition}
      fallback={
        <ErrorState
          title={t`This edition is not available on this device`}
          body={t`Return to puzzles, reconnect and open it again. Saved attempts keep their original content.`}
          secondary={{
            label: t`Return to puzzles`,
            onClick: () => props.onReturnToLibrary(),
          }}
        />
      }
    >
      {(edition) => (
        <GameScreen
          screenId="puzzle-content-edition"
          dataSet={{
            testid: 'content-edition',
            revisionid: edition().id,
            documentid: edition().documentId,
          }}
          title={edition().title}
          subtitle={edition().difficulty}
        >
          <GameSessionLayout
            notices={
              <Show when={!props.available}>
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
                <Show when={props.canEdit}>
                  <Button
                    title={t`Edit working draft`}
                    variant="outline"
                    intent="neutral"
                    dataSet={{ testid: 'content-edit-working-draft' }}
                    onClick={() => props.onEditWorkingDraft()}
                  />
                </Show>
              </StackVertical>
            }
            actions={
              <Show when={edition().kind === 'puzzle'}>
                {props.startAttempt}
              </Show>
            }
          >
            <Show when={props.playDenial} fallback={props.body}>
              {(denial) => <DenialSurfaceView denial={denial()} />}
            </Show>
          </GameSessionLayout>
        </GameScreen>
      )}
    </Show>
  );
}
