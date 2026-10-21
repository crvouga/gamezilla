import { P, type TextProps } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { formatDeviceListCaption } from './device-parsers';
import { useDeviceColumn } from './use-device-column';

export type AccountDeviceListCaptionTextProps = {
  deviceId: string;
  /** Clamp to this many lines; the surrounding row sets the type. */
  lines?: TextProps['lines'];
};

/** Secondary line for device list rows (OS + last seen). */
export function AccountDeviceListCaptionText(
  props: AccountDeviceListCaptionTextProps
): JSX.Element {
  const osName = useDeviceColumn(() => props.deviceId, 'osName');
  const osVersion = useDeviceColumn(() => props.deviceId, 'osVersion');
  const lastSeenAt = useDeviceColumn(() => props.deviceId, 'lastSeenAt');
  const createdAt = useDeviceColumn(() => props.deviceId, 'createdAt');
  const label = createMemo(() =>
    formatDeviceListCaption({
      osName: osName(),
      osVersion: osVersion(),
      lastSeenAt: lastSeenAt(),
      createdAt: createdAt(),
    })
  );
  return (
    <P variant="inherit" lines={props.lines}>
      {label()}
    </P>
  );
}
