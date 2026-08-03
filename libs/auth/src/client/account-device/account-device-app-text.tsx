import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useDeviceColumn } from '../use-device-column';
import { EM_DASH } from '../device-parsers';

export type AccountDeviceAppTextProps = {
  deviceId: string;
};

/** App version + build number. */
export function AccountDeviceAppText({
  deviceId,
}: AccountDeviceAppTextProps): ReactNode {
  const appVersion = useDeviceColumn(deviceId, 'appVersion');
  const appBuildNumber = useDeviceColumn(deviceId, 'appBuildNumber');
  const label =
    appVersion === null && appBuildNumber === null
      ? EM_DASH
      : [appVersion, appBuildNumber !== null ? `(${appBuildNumber})` : null]
          .filter((v) => v !== null)
          .join(' ');
  return <Text variant="body" numberOfLines={4} label={label} />;
}
