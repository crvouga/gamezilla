import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import type { JSX } from 'solid-js';

export type AccountDeviceMetaPairProps = {
  label: JSX.Element;
  /** Atom that renders the value for this pair (e.g. `<AccountDeviceOsText>`). */
  valueAtom: JSX.Element;
};

/** Cap so a long value never crowds the label out of the row. */
const VALUE_MAX_WIDTH = '55%';

/** Detail row — label on the left, atom-rendered value right-aligned. */
export function AccountDeviceMetaPair(
  props: AccountDeviceMetaPairProps
): JSX.Element {
  return (
    <MenuRow
      title={props.label}
      trailing={
        <div
          class="box items-end"
          style={{ 'max-width': `${VALUE_MAX_WIDTH}px` }}
        >
          {props.valueAtom}
        </div>
      }
    />
  );
}
