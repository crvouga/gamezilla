import { type SxProps, Text, type TextVariant } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { formatDeviceListCaption } from '../device-parsers';
import { useDeviceColumn } from '../use-device-column';

export type AccountDeviceListCaptionTextProps = {
  deviceId: string;
  variant?: TextVariant | undefined;
  numberOfLines?: number | undefined;
  sx?: SxProps | undefined;
};

/** Secondary line for device list rows (OS + last seen). */
export function AccountDeviceListCaptionText(
  props: AccountDeviceListCaptionTextProps
): JSX.Element {
  const osName = useDeviceColumn(props.deviceId, 'osName');
  const osVersion = useDeviceColumn(props.deviceId, 'osVersion');
  const lastSeenAt = useDeviceColumn(props.deviceId, 'lastSeenAt');
  const createdAt = useDeviceColumn(props.deviceId, 'createdAt');
  const label = createMemo(() =>
    formatDeviceListCaption({
      osName: osName(),
      osVersion: osVersion(),
      lastSeenAt: lastSeenAt(),
      createdAt: createdAt(),
    })
  );
  return (
    <Text
      variant={props.variant}
      numberOfLines={props.numberOfLines}
      sx={props.sx}
      label={label()}
    />
  );
}
