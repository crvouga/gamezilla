import { Box, Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

/** Circular outcome badge: semantic fill + contrast-safe mark. */
export function ChessPuzzleStatusBadge({
  bg,
  fg,
  mark,
}: {
  bg: string;
  fg: string;
  mark: ReactNode;
}): ReactNode {
  return (
    <Box
      sx={{
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
      }}
    >
      <Text
        sx={{ fontSize: 12, fontWeight: '700', lineHeight: 14, color: fg }}
        label={mark}
      />
    </Box>
  );
}
