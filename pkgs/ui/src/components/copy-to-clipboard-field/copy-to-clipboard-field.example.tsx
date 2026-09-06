/** @jsxImportSource solid-js */
/**
 * The field takes an injected `copy` sink. The explorer has no clipboard
 * access, so this demo records the last copied value in local state instead.
 */
import { Trans, useLingui } from '@lingui/solid/macro';
import { createSignal, type JSX, Show } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { CopyToClipboardField } from './copy-to-clipboard-field';

export default function CopyToClipboardFieldExample(): JSX.Element {
  const { t } = useLingui();
  const [lastCopied, setLastCopied] = createSignal<string | null>(null);
  const copy = (text: string): Promise<void> => {
    setLastCopied(text);
    return Promise.resolve();
  };
  return (
    <ExampleRoot sx={{ gap: 6 }}>
      <CopyToClipboardField
        label={<Trans>Commit hash</Trans>}
        helperText={t`Tap the field or icon to copy`}
        value="a1b2c3d4e5f6789012345678901234567890abcd"
        copiedResetMs={2200}
        copy={copy}
      />

      <CopyToClipboardField
        label={<Trans>API origin (no helper)</Trans>}
        value="https://api.example.com"
        selectable
        copy={copy}
      />

      <Show when={lastCopied()}>
        {(text) => (
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={`Last copied: ${text()}`}
          />
        )}
      </Show>
    </ExampleRoot>
  );
}
