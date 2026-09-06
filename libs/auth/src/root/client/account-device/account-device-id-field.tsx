import { Trans, useLingui } from '@lingui/solid/macro';
import { useClipboard } from '@pkgs/device/solid';
import { CopyToClipboardField } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export type AccountDeviceIdFieldProps = {
  deviceId: string;
};

/** Copy-to-clipboard field for the device id. */
export function AccountDeviceIdField(
  props: AccountDeviceIdFieldProps
): JSX.Element {
  const { t } = useLingui();
  const clipboard = useClipboard();
  return (
    <CopyToClipboardField
      label={<Trans>Device ID</Trans>}
      helperText={t`Stable per-device identifier; tap to copy`}
      value={props.deviceId}
      copy={(text) => clipboard.writeText(text)}
    />
  );
}
