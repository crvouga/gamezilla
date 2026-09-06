import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock/solid';
import {
  Box,
  CircleCheckIcon,
  CopyIcon,
  IconButton,
  PickerSection,
  ShuffleIcon,
  TextInput,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createEffect, createSignal, onCleanup } from 'solid-js';

export function AvatarEditorSeedField(props: {
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
      <Box sx={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>
        <Box sx={{ flex: 1 }}>
          <TextInput
            value={props.seed}
            onChangeText={props.onSeedChange}
            aria-label={t`Seed`}
            autocapitalize="none"
            autocorrect="off"
            disabled={props.disabled === true}
            dataSet={{ testid: Handles.profileAvatarSeed }}
          />
        </Box>
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
      </Box>
    </PickerSection>
  );
}
