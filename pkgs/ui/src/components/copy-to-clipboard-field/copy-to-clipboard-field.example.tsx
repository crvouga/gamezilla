import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Text } from '../text';
import { CopyToClipboardField } from './copy-to-clipboard-field';
import { ExampleRoot } from '../explorer/example-root';

export default function CopyToClipboardFieldExample() {
  return (
    <ExampleRoot sx={{ gap: 6 }}>
      <Text variant="heading" label={<Trans>CopyToClipboardField</Trans>} />

      <CopyToClipboardField
        label={<Trans>Commit hash</Trans>}
        helperText={t`Tap the field or icon to copy`}
        value="a1b2c3d4e5f6789012345678901234567890abcd"
        copiedResetMs={2200}
      />

      <CopyToClipboardField
        label={<Trans>API origin (no helper)</Trans>}
        value="https://api.example.com"
        selectable
      />
    </ExampleRoot>
  );
}
