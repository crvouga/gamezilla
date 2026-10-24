import { Trans, useLingui } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import type { useContentAttemptChange } from './use-content-attempt-change';

export function ContentAttemptNotices(props: {
  writer: ReturnType<typeof useContentAttemptChange>;
  playtest: boolean;
  complete: boolean;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <P
        role="status"
        variant="caption"
        tone="secondary"
        dataSet={{ testid: 'content-position-save-status' }}
      >
        {props.writer.pending()
          ? t`Saving your position…`
          : t`Progress saved on this device. Changes share when connected.`}
      </P>
      <Show when={props.playtest}>
        <Notice>
          <Trans>
            Playtest: this uses the real puzzle rules. It does not count toward
            personal or pack completion.
          </Trans>
        </Notice>
      </Show>
      <Show when={props.writer.change.error()}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`Your change was not saved`}
            body={error().message}
            retry={{ onClick: props.writer.retry }}
          />
        )}
      </Show>
      <Show when={props.complete}>
        <SuccessState
          variant="compact"
          dataSet={{ testid: 'content-attempt-complete' }}
          title={props.playtest ? t`Playtest solved` : t`Puzzle completed`}
          body={
            props.playtest
              ? t`Return to the builder to validate and publish this puzzle.`
              : t`Your completion is saved. You can keep playing or choose another puzzle.`
          }
        />
      </Show>
    </>
  );
}
