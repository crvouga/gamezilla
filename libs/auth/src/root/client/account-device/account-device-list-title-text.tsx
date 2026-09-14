import type { TextVariant } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { formatDeviceListTitle } from '../device-parsers';
import { useDeviceColumn } from '../use-device-column';

export type AccountDeviceListTitleTextProps = {
  deviceId: string;
  variant?: TextVariant | undefined;
  numberOfLines?: number | undefined;
  class?: string | undefined;
};

/** Primary label for a device row — name → model → "Device <id…>" fallback. */
export function AccountDeviceListTitleText(
  props: AccountDeviceListTitleTextProps
): JSX.Element {
  const deviceName = useDeviceColumn(() => props.deviceId, 'deviceName');
  const deviceBrand = useDeviceColumn(() => props.deviceId, 'deviceBrand');
  const deviceModelName = useDeviceColumn(
    () => props.deviceId,
    'deviceModelName'
  );
  const label = createMemo(() =>
    formatDeviceListTitle({
      deviceId: props.deviceId,
      deviceName: deviceName(),
      deviceBrand: deviceBrand(),
      deviceModelName: deviceModelName(),
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
