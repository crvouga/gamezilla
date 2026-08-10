import { Trans, useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import {
  Box,
  CircleCheckIcon,
  CopyIcon,
  IconButton,
  PickerSection,
  ShuffleIcon,
  TextInput,
} from '@pkgs/ui';
import { useCallback, useEffect, useState } from 'react';

export function AvatarEditorSeedField({
  seed,
  onSeedChange,
  onRandomize,
  onCopy,
  disabled,
}: {
  seed: string;
  onSeedChange: (seed: string) => void;
  onRandomize: () => void;
  onCopy: () => Promise<void>;
  disabled?: boolean;
}) {
  const { t } = useLingui();
  const timers = useTimers();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = timers.setTimeout(() => setCopied(false), 2000);
    return () => timers.clearTimeout(id);
  }, [copied, timers]);

  const handleCopy = useCallback(() => {
    void onCopy().then(() => setCopied(true));
  }, [onCopy]);

  return (
    <PickerSection label={<Trans>Seed</Trans>}>
      <Box sx={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>
        <Box sx={{ flex: 1 }}>
          <TextInput
            value={seed}
            onChangeText={onSeedChange}
            autoCapitalize="none"
            autoCorrect={false}
            editable={disabled !== true}
          />
        </Box>
        <IconButton
          size={44}
          background="surface"
          onPress={onRandomize}
          disabled={disabled === true}
          label={t`Randomize`}
          accessibilityLabel={t`Randomize`}
        >
          <ShuffleIcon size={20} />
        </IconButton>
        <IconButton
          size={44}
          background="surface"
          onPress={handleCopy}
          disabled={disabled === true}
          label={copied ? t`Copied` : t`Copy seed`}
          accessibilityLabel={copied ? t`Copied` : t`Copy seed`}
        >
          {copied ? <CircleCheckIcon size={20} /> : <CopyIcon size={20} />}
        </IconButton>
      </Box>
    </PickerSection>
  );
}
