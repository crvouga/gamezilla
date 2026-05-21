import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

export type AccountDeviceMetaPairProps = {
  label: ReactNode;
  /** Atom that renders the value for this pair (e.g. `<AccountDeviceOsText>`). */
  valueAtom: ReactNode;
};

/** Pure layout cell — caption label above an atom-rendered value. */
export function AccountDeviceMetaPair({
  label,
  valueAtom,
}: AccountDeviceMetaPairProps): ReactNode {
  return (
    <Box sx={{ flex: 1, minWidth: 140, gap: 1 }}>
      <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
      {valueAtom}
    </Box>
  );
}
