import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import type { JSX } from 'solid-js';

export type AccountDeviceMetaPairProps = {
  label: JSX.Element;
  /** Atom that renders the value for this pair (e.g. `<AccountDeviceOsText>`). */
  valueAtom: JSX.Element;
};

/** Long values (timestamps, versions) wrap instead of ending at one line. */
const VALUE_LINES = 4;

/** Detail row — label on the left, atom-rendered value right-aligned. */
export function AccountDeviceMetaPair(
  props: AccountDeviceMetaPairProps
): JSX.Element {
  return (
    <MenuRow
      title={props.label}
      value={props.valueAtom}
      valueLines={VALUE_LINES}
    />
  );
}
