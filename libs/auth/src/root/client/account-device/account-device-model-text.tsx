import { Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import { EM_DASH } from '../device-parsers';
import { useDeviceColumn } from '../use-device-column';

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
