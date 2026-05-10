import { EM_DASH } from './device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '../shared';
import { Text } from '@gamezilla/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type AccountDevicePlatformTextProps = {
  deviceId: string;
};

/** `device/platform` value, with em-dash fallback. */
export function AccountDevicePlatformText({
  deviceId,
}: AccountDevicePlatformTextProps): ReactNode {
  const platform = useQueryAttribute({
    entityType: DEVICE_ENTITY_TYPE,
    entityId: deviceId,
    attribute: DeviceAttr.platform,
  });
  return <Text variant="body" numberOfLines={4} label={platform ?? EM_DASH} />;
}
