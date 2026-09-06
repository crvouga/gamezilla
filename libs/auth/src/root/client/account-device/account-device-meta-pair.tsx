import { Box, MenuRow } from '@pkgs/ui';
import type { ReactNode } from 'react';

export type AccountDeviceMetaPairProps = {
  label: ReactNode;
  /** Atom that renders the value for this pair (e.g. `<AccountDeviceOsText>`). */
  valueAtom: ReactNode;
};

/** Cap so a long value never crowds the label out of the row. */
const VALUE_MAX_WIDTH = '55%';

/** Detail row — label on the left, atom-rendered value right-aligned. */
export function AccountDeviceMetaPair({
  label,
  valueAtom,
}: AccountDeviceMetaPairProps): ReactNode {
  return (
    <MenuRow
      title={label}
      trailing={
        <Box sx={{ maxWidth: VALUE_MAX_WIDTH, alignItems: 'flex-end' }}>
          {valueAtom}
        </Box>
      }
    />
  );
}
