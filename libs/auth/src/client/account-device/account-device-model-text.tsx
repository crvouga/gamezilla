import { Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useDeviceColumn } from '../use-device-column';
import { EM_DASH } from '../device-parsers';

export type AccountDeviceModelTextProps = {
  deviceId: string;
};

/** Device model name. */
export function AccountDeviceModelText({
  deviceId,
}: AccountDeviceModelTextProps): ReactNode {
  const model = useDeviceColumn(deviceId, 'deviceModelName');
  return <Text variant="body" numberOfLines={4} label={model ?? EM_DASH} />;
}
