import { Box, Text } from '@pkgs/ui';

import type { FlatFrame } from './frames';
import { resolveSnapshotFile } from './frames';
import { emptySx, paneSx } from './tokens';

/**
 * SQLite dump browser placeholder. Interactive SQL browse is not wired;
 * report playback uses HTML / JSON frames.
 */
export function SqlitePane(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly nodeId: string | null;
}) {
  const file = resolveSnapshotFile(props.frame, {
    name: 'sqlite',
    nodeId: props.nodeId,
  });
  if (file == null) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>
          No SQLite dump for node `{props.nodeId ?? '—'}` on this frame.
        </Text>
      </Box>
    );
  }
  return (
    <Box sx={paneSx}>
      <Text sx={emptySx}>SQLite pane requires web (`{file}`).</Text>
    </Box>
  );
}
