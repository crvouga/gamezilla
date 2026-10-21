import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock-client/solid';
import { IconButton } from '@pkgs/ui-root-client/icon-button';
import {
  CircleCheckIcon,
  CopyIcon,
  ShuffleIcon,
} from '@pkgs/ui-root-client/icons';
import { PickerSection } from '@pkgs/ui-root-client/picker-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import type { JSX } from 'solid-js';
import { createEffect, createSignal, onCleanup } from 'solid-js';

export function AvatarEditorSeedField(props: {
  /**
   * The draft's own seed, not the effective one: empty while the person is
   * retyping it (the avatar falls back to their default look meanwhile).
   */
  seed: string;
  onSeedChange: (seed: string) => void;
  onRandomize: () => void;
  onCopy: () => Promise<void>;
  disabled?: boolean | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const timers = useTimers();
  const [copied, setCopied] = createSignal(false);

  createEffect(() => {
    if (!copied()) return;
    const id = timers.setTimeout(() => setCopied(false), 2000);
    onCleanup(() => timers.clearTimeout(id));
  });

  const handleCopy = () => {
    void props.onCopy().then(() => setCopied(true));
  };

  return (
    <PickerSection label={<Trans>Seed</Trans>}>
      <StackHorizontal gap="sm" align="end">
        <StackVertical grow>
          <TextInput
            value={props.seed}
            placeholder={t`Empty: your default look`}
            onChangeText={props.onSeedChange}
            aria-label={t`Seed`}
            autocapitalize="none"
            autocorrect="off"
            disabled={props.disabled === true}
            dataSet={{ testid: Handles.profileAvatarSeed }}
          />
        </StackVertical>
        <IconButton
          size={44}
          background="surface"
          onClick={props.onRandomize}
          disabled={props.disabled === true}
          label={t`Randomize`}
        >
          <ShuffleIcon size={20} />
        </IconButton>
        <IconButton
          size={44}
          background="surface"
          onClick={handleCopy}
          disabled={props.disabled === true}
          label={copied() ? t`Copied` : t`Copy seed`}
        >
          {copied() ? <CircleCheckIcon size={20} /> : <CopyIcon size={20} />}
        </IconButton>
      </StackHorizontal>
    </PickerSection>
  );
}
