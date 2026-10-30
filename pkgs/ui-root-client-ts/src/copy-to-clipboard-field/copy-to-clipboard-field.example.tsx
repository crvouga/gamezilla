/** @jsxImportSource solid-js */
/**
 * The injected `copy` sink records payloads in native Storybook Actions.
 */
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  type ClipboardCopy,
  CopyToClipboardField,
} from '@pkgs/ui-root-client-ts/copy-to-clipboard-field';
import type { JSX } from 'solid-js';
import { fn } from 'storybook/test';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export default function CopyToClipboardFieldExample(): JSX.Element {
  const { t } = useLingui();
  const copy = fn<ClipboardCopy>()
    .mockName('copy')
    .mockResolvedValue(undefined);
  return (
    <ExampleRoot gap="xl">
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
    </ExampleRoot>
  );
}
