import { Trans, useLingui } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import type { useContentDraftSave } from './use-content-draft-save';

export function ContentAuthorStatus(props: {
  writer: ReturnType<typeof useContentDraftSave>;
  conflicted: boolean;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <P role="status" variant="caption" tone="secondary">
        {props.writer.saving()
          ? t`Saving your draft…`
          : props.writer.dirty()
            ? t`Your changes still need to be saved.`
            : t`Saved on this device. Changes share when connected.`}
      </P>
      <Show when={props.writer.error()}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`Your changes are still here`}
            body={error()}
            retry={{
              label: t`Save again`,
              onClick: () => {
                void props.writer.save();
              },
            }}
          />
        )}
      </Show>
      <Show when={props.conflicted}>
        <Notice tone="warning">
          <Trans>
            A different working copy was kept. Choose the copy you want below
            before publishing.
          </Trans>
        </Notice>
      </Show>
    </>
  );
}
