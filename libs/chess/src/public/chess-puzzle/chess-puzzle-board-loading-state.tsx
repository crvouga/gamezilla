import { Box, Spinner } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export type ChessPuzzleBoardLoadingStateProps = {
  size?: number;
};

export function ChessPuzzleBoardLoadingState(
  props: ChessPuzzleBoardLoadingStateProps = {}
): JSX.Element {
  const dimensionSx =
    props.size !== undefined
      ? { width: props.size, height: props.size }
      : { width: '100%' as const, aspectRatio: 1 };
  return (
    <Box
      sx={[
        {
          alignSelf: 'center',
          background: 'surface',
          alignItems: 'center',
          justifyContent: 'center',
        },
        dimensionSx,
      ]}
    >
      <Spinner size="large" />
    </Box>
  );
}
