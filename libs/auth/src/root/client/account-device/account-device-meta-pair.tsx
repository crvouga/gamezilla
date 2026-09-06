import { Box, MenuRow } from '@pkgs/ui';
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
        <Box sx={{ maxWidth: VALUE_MAX_WIDTH, alignItems: 'flex-end' }}>
          {props.valueAtom}
        </Box>
      }
    />
  );
}
