/** @jsxImportSource solid-js */
import { Trans, useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock-client/solid';
import { Button } from '@pkgs/ui-root-client/button';
import { CopyIcon } from '@pkgs/ui-root-client/icons';
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';

export function CrashCopyButton(props: {
  readonly text: string;
  readonly copy: (text: string) => Promise<void>;
}): JSX.Element {
  const { t } = useLingui();
  const timers = useTimers();
  const [phase, setPhase] = createSignal<
    'idle' | 'pending' | 'copied' | 'error'
  >('idle');
  let mounted = true;
  onCleanup(() => {
    mounted = false;
  });
  createEffect(() => {
    if (phase() !== 'copied') return;
    const handle = timers.setTimeout(() => setPhase('idle'), 2000);
    onCleanup(() => timers.clearTimeout(handle));
  });
  const copy = async (): Promise<void> => {
    setPhase('pending');
    try {
      await props.copy(props.text);
      if (mounted) setPhase('copied');
    } catch {
      if (mounted) setPhase('error');
    }
  };
  return (
    <div class="box items-start gap-2" data-component="CrashCopyButton">
      <Button
        title={phase() === 'copied' ? t`Copied` : t`Copy error`}
        icon={CopyIcon}
        intent="neutral"
        variant="ghost"
        disabled={phase() === 'pending'}
        onClick={() => {
          void copy();
        }}
      />
      <p class="text textCaption" role="status" aria-live="polite">
        <Show when={phase() === 'error'}>
          <Trans>Couldn’t copy. Try again, or select the error details.</Trans>
        </Show>
        <Show when={phase() === 'copied'}>
          <Trans>Error details copied.</Trans>
        </Show>
      </p>
    </div>
  );
}
