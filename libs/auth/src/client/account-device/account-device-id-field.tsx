import { CopyToClipboardField } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type AccountDeviceIdFieldProps = {
  deviceId: string;
};

/** Copy-to-clipboard field for the device id. */
export function AccountDeviceIdField({
  deviceId,
}: AccountDeviceIdFieldProps): ReactNode {
  const { t } = useLingui();
  return (
    <CopyToClipboardField
      label={<Trans>Device ID</Trans>}
      helperText={t`Stable per-device identifier; tap to copy`}
      value={deviceId}
    />
  );
}
