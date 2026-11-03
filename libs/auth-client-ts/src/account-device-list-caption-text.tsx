import { P, type TextProps } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import type { AccountDeviceView } from './account-device-view';
import { formatDeviceListCaption } from './device-parsers';

export type AccountDeviceListCaptionTextProps = {
  readonly device: AccountDeviceView;
  /** Clamp to this many lines; the surrounding row sets the type. */
  readonly lines?: TextProps['lines'];
};

/** Secondary line for device list rows (OS + last seen). */
export function AccountDeviceListCaptionText(
  props: AccountDeviceListCaptionTextProps
): JSX.Element {
  const label = createMemo(() =>
    formatDeviceListCaption({
      osName: props.device.osName,
      osVersion: props.device.osVersion,
      lastSeenAt: props.device.lastSeenAt,
      createdAt: props.device.createdAt,
    })
  );
  return (
    <P variant="inherit" lines={props.lines}>
      {label()}
    </P>
  );
}
