import type { ContentDraft } from '@libs/game-puzzle-shared-ts/content-types';
import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import { useContentGame } from './content-game-context';
import { ContentPublicationStatus } from './content-publication-status';
import { ContentWithdraw } from './content-withdraw';
import {
  type ContentPublicationProps,
  useContentPublication,
} from './use-content-publication';

function validationMessage(draft: ContentDraft | undefined): string {
  if (draft?.validation_status !== 'invalid') return '';
  try {
    const issues: unknown = JSON.parse(draft.validation_issues);
    return Array.isArray(issues)
      ? issues
          .flatMap((issue) =>
            typeof issue === 'object' &&
            issue !== null &&
            'message' in issue &&
            typeof issue.message === 'string'
              ? [issue.message]
              : []
          )
          .join(' ')
      : '';
  } catch {
    return '';
  }
}

export function ContentPublicationControls(
  props: ContentPublicationProps
): JSX.Element {
  const { t } = useLingui();
  const tools = useContentPublication(props);
  const game = useContentGame();
  const decision = useDecision(PERMISSION.puzzlesPublishContent, () => ({
    puzzleOwnerId: props.document.owner_id,
  }));
  return (
    <StackVertical gap="md">
      <ContentPublicationStatus documentId={props.document.id} />
      <Show when={tools.draft()?.validation_status === 'valid'}>
        <Notice
          tone="success"
          dataSet={{ testid: 'content-validation-passed' }}
        >
          <Trans>
            This draft passed validation. Publication checks it again.
          </Trans>
        </Notice>
      </Show>
      <Show when={tools.draft()?.validation_status === 'invalid'}>
        <Notice tone="error">
          {validationMessage(tools.draft()) ||
            t`Complete the required details and validate again.`}
        </Notice>
      </Show>
      <StackHorizontal gap="sm" wrap>
        <Button
          {...tools.validate.buttonProps}
          dataSet={{ testid: 'content-validate' }}
        />
        <Show
          when={decision().allowed}
          fallback={<DenialSurface decision={decision()} variant="compact" />}
        >
          <Button
            {...tools.publish.buttonProps}
            dataSet={{ testid: 'content-publish' }}
          />
        </Show>
      </StackHorizontal>
      <Show when={tools.validate.error() ?? tools.publish.error()}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`The draft needs your attention`}
            body={error().message}
            retry={{
              onClick: () => {
                void (tools.publish.error()
                  ? tools.publish.run()
                  : tools.validate.run());
              },
            }}
          />
        )}
      </Show>
      <Show
        when={
          decision().allowed && props.document.published_revision_id !== null
        }
      >
        <Button
          title={t`View published edition`}
          intent="neutral"
          variant="outline"
          onClick={() => {
            const revisionId = props.document.published_revision_id;
            if (revisionId !== null)
              game.open({ kind: 'edition', revisionId, packRevisionId: null });
          }}
          dataSet={{ testid: 'content-view-publication' }}
        />
        <ContentWithdraw
          documentId={props.document.id}
          disabled={props.disabled}
        />
      </Show>
    </StackVertical>
  );
}
