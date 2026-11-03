/** @jsxImportSource solid-js */
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CopyIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';

/** Where copying the crash details stands: waiting, done, or refused. */
export type CrashCopyPhase = 'idle' | 'pending' | 'copied' | 'error';

/** "Copy error" with its spoken outcome; the copying itself is the caller's. */
export function CrashCopyButton(props: {
  readonly phase: CrashCopyPhase;
  readonly onCopy: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical align="start" gap="sm">
      <Button
        title={props.phase === 'copied' ? t`Copied` : t`Copy error`}
        icon={CopyIcon}
        intent="neutral"
        variant="ghost"
        disabled={props.phase === 'pending'}
        onClick={() => props.onCopy()}
      />
      <P variant="caption" role="status" aria-live="polite">
        <Show when={props.phase === 'error'}>
          <Trans>Couldn’t copy. Try again, or select the error details.</Trans>
        </Show>
        <Show when={props.phase === 'copied'}>
          <Trans>Error details copied.</Trans>
        </Show>
      </P>
    </StackVertical>
  );
}
