import { Box, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export function ChessPuzzleStatusBadge(props: {
  bg: string;
  fg: string;
  mark: JSX.Element;
}): JSX.Element {
  return (
    <Box
      sx={{
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: props.bg,
      }}
    >
      <Text
        sx={{
          fontSize: 12,
          fontWeight: '700',
          lineHeight: 14,
          color: props.fg,
        }}
        label={props.mark}
      />
    </Box>
  );
}
