/** @jsxImportSource solid-js */
import { useTimers } from '@pkgs/clock-client/solid';
import { Button } from '@pkgs/ui-root-client/button';
import { CopyIcon } from '@pkgs/ui-root-client/icons';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
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
    <StackVertical align="start" gap="sm">
      <Button
        title={phase() === 'copied' ? 'Copied' : 'Copy error'}
        icon={CopyIcon}
        intent="neutral"
        variant="ghost"
        disabled={phase() === 'pending'}
        onClick={() => {
          void copy();
        }}
      />
      <P variant="caption" role="status" aria-live="polite">
        <Show when={phase() === 'error'}>
          Couldn’t copy. Try again, or select the error details.
        </Show>
        <Show when={phase() === 'copied'}>Error details copied.</Show>
      </P>
    </StackVertical>
  );
}
