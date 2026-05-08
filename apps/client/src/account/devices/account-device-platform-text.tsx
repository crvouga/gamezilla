import {
  EM_DASH,
  parseTrimmedStringAttr,
} from '@gamezilla/client/account/device-parsers';
import { DEVICE_ENTITY_TYPE, DeviceAttr } from '@gamezilla/domain/auth';
import { Text } from '@gamezilla/lib/ui';
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
    attributeKey: DeviceAttr.platform,
    attributeValue: parseTrimmedStringAttr,
  });
  return <Text variant="body" numberOfLines={4} label={platform ?? EM_DASH} />;
}
