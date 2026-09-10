import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { EM_DASH } from '../device-parsers';
import { useDeviceColumn } from '../use-device-column';

export type AccountDeviceAppTextProps = {
  deviceId: string;
};

/** App version + build number. */
export function AccountDeviceAppText(
  props: AccountDeviceAppTextProps
): JSX.Element {
  const appVersion = useDeviceColumn(props.deviceId, 'appVersion');
  const appBuildNumber = useDeviceColumn(props.deviceId, 'appBuildNumber');
  const label = createMemo(() => {
    const version = appVersion();
    const build = appBuildNumber();
    return version === null && build === null
      ? EM_DASH
      : [version, build !== null ? `(${build})` : null]
          .filter((v) => v !== null)
          .join(' ');
  });
  return <p class="text line-clamp-4">{label()}</p>;
}
