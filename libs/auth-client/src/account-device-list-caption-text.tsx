import type { TextVariant } from '@pkgs/ui-client/text';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { formatDeviceListCaption } from './device-parsers';
import { useDeviceColumn } from './use-device-column';

export type AccountDeviceListCaptionTextProps = {
  deviceId: string;
  variant?: TextVariant | undefined;
  numberOfLines?: number | undefined;
  class?: string | undefined;
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
    <p
      class="text"
      classList={{
        textBodyBold: String(props.variant) === 'bodyBold',
        textCaption: String(props.variant) === 'caption',
        textLabel: String(props.variant) === 'label',
        textTitle: String(props.variant) === 'title',
        textSubtitle: String(props.variant) === 'subtitle',
        textHeading: String(props.variant) === 'heading',
        textNavigationTitle: String(props.variant) === 'navigationTitle',
        textLink: String(props.variant) === 'link',
        textMono: String(props.variant) === 'mono',
        [String(props.class)]: true,
      }}
      style={{
        display: '-webkit-box',
        '-webkit-box-orient': 'vertical',
        '-webkit-line-clamp': props.numberOfLines,
        overflow: 'hidden',
      }}
    >
      {label()}
    </p>
  );
}
