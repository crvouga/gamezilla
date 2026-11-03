import { Trans, useLingui } from '@lingui/solid/macro';
import type { ClipboardCopy } from '@pkgs/ui-root-client-ts/copy-to-clipboard-field';
import { CopyToClipboardField } from '@pkgs/ui-root-client-ts/copy-to-clipboard-field';
import type { JSX } from 'solid-js';

export type AccountDeviceIdFieldProps = {
  readonly deviceId: string;
  /** Writes the id to the clipboard. */
  readonly copy: ClipboardCopy;
};

/** Copy-to-clipboard field for the device id. */
export function AccountDeviceIdField(
  props: AccountDeviceIdFieldProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <CopyToClipboardField
      label={<Trans>Device ID</Trans>}
      helperText={t`Stable per-device identifier; tap to copy`}
      value={props.deviceId}
      copy={(text) => props.copy(text)}
    />
  );
}
