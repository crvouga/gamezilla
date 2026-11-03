import { Trans } from '@lingui/solid/macro';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { AccountDeviceMetaPair } from './account-device-meta-pair';
import type { AccountDeviceView } from './account-device-view';
import { EM_DASH, formatOsLine, formatTimestamp } from './device-parsers';

export type AccountDeviceMetaGridProps = {
  readonly device: AccountDeviceView;
};

/** App version, then its build number in parentheses. */
function appLabel(device: AccountDeviceView): string {
  const version = device.appVersion;
  const build = device.appBuildNumber;
  return version === null && build === null
    ? EM_DASH
    : [version, build !== null ? `(${build})` : null]
        .filter((v) => v !== null)
        .join(' ');
}

function MetaPair(props: {
  readonly label: JSX.Element;
  readonly value: string;
}): JSX.Element {
  return (
    <AccountDeviceMetaPair
      label={props.label}
      valueAtom={<Text variant="inherit">{props.value}</Text>}
    />
  );
}

/** Detail rows for a device's meta attributes. */
export function AccountDeviceMetaGrid(
  props: AccountDeviceMetaGridProps
): JSX.Element {
  return (
    <>
      <MenuSection title={<Trans>Device</Trans>}>
        <MetaPair
          label={<Trans>Platform</Trans>}
          value={props.device.platform ?? EM_DASH}
        />
        <MetaPair
          label={<Trans>OS</Trans>}
          value={formatOsLine(props.device.osName, props.device.osVersion)}
        />
        <MetaPair
          label={<Trans>Device name</Trans>}
          value={props.device.deviceName ?? EM_DASH}
        />
        <MetaPair
          label={<Trans>Model</Trans>}
          value={props.device.deviceModelName ?? EM_DASH}
        />
        <MetaPair label={<Trans>App</Trans>} value={appLabel(props.device)} />
      </MenuSection>
      <MenuSection title={<Trans>Activity</Trans>}>
        <MetaPair
          label={<Trans>First seen</Trans>}
          value={formatTimestamp(props.device.firstSeenAt)}
        />
        <MetaPair
          label={<Trans>Last seen</Trans>}
          value={formatTimestamp(props.device.lastSeenAt)}
        />
        <MetaPair
          label={<Trans>Created</Trans>}
          value={formatTimestamp(props.device.createdAt)}
        />
      </MenuSection>
    </>
  );
}
