import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
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
  /** Set when the person may not play; replaces the picture and the start. */
  readonly playDenial?: DenialView | undefined;
  /** Continue the saved attempt, or start a new one (puzzles). */
  readonly startAttempt?: JSX.Element;
  /** The puzzle's picture, or the pack's progress and puzzles. */
  readonly body?: JSX.Element;
  readonly onEditWorkingDraft: () => void;
  readonly onReturnToLibrary: () => void;
};

/** What the owner can do with their own publication. */
function OwnerRows(props: ContentEditionScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.canEdit}>
      <MenuSection title={<Trans>Yours</Trans>}>
        <MenuRow
          title={t`Edit working draft`}
          caption={t`Published editions stay as they are`}
          onClick={() => props.onEditWorkingDraft()}
          dataSet={{ testid: 'content-edit-working-draft' }}
        />
      </MenuSection>
    </Show>
  );
}

/**
 * One published puzzle or pack, presentational, as one small screen: what
 * it is (its title, difficulty, description and picture), continuing or
 * starting an attempt (a pack: its progress, the next puzzle and its
 * puzzles), and editing the working draft for its owner — or withdrawn,
 * denied and not-on-this-device states. The start control and the body
 * arrive as slots.
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
        <EmbeddedScreen
          screenId="puzzle-content-edition"
          dataSet={{
            testid: 'content-edition',
            revisionid: edition().id,
            documentid: edition().documentId,
          }}
          title={edition().title}
          subtitle={edition().difficulty || undefined}
        >
          <Show when={!props.available}>
            <Notice dataSet={{ testid: 'content-edition-withdrawn' }}>
              <Trans>
                This publication is withdrawn. You can continue saved attempts
                from your library.
              </Trans>
            </Notice>
          </Show>
          <Show when={edition().description}>
            {(description) => <P>{description()}</P>}
          </Show>
          <Show
            when={props.playDenial}
            fallback={
              <>
                {props.body}
                <Show when={edition().kind === 'puzzle'}>
                  {props.startAttempt}
                </Show>
              </>
            }
          >
            {(denial) => <DenialSurfaceView denial={denial()} />}
          </Show>
          <OwnerRows {...props} />
        </EmbeddedScreen>
      )}
    </Show>
  );
}
