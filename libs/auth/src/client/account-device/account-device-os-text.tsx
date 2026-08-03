import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useDeviceColumn } from '../use-device-column';
import { EM_DASH } from '../device-parsers';

export type AccountDeviceOsTextProps = {
  deviceId: string;
};

/** OS name + version. */
export function AccountDeviceOsText({
  deviceId,
}: AccountDeviceOsTextProps): ReactNode {
  const osName = useDeviceColumn(deviceId, 'osName');
  const osVersion = useDeviceColumn(deviceId, 'osVersion');
  const label =
    osName === null && osVersion === null
      ? EM_DASH
      : [osName, osVersion].filter((v) => v !== null).join(' ');
  return <Text variant="body" numberOfLines={4} label={label} />;
}
