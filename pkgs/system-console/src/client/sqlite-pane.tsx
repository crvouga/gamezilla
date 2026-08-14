import { Box, Text } from '@pkgs/ui';

import type { SimulationFrameDatabase } from '../types';
import type { FlatFrame } from './frames';
import { emptySx, paneSx } from './tokens';

/**
 * Native-safe SQLite browser fallback. The `@sqlite.org/sqlite-wasm` browser is
 * web-only; a `.web.tsx` variant reintroduces it via `./sql/frame-sqlite`.
 */
export function SqlitePane(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly nodeId: string | null;
}) {
  const dump = resolveDatabase(props.frame, props.nodeId);
  if (dump == null) {
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
      <Text sx={emptySx}>SQLite pane requires web.</Text>
    </Box>
  );
}

function resolveDatabase(
  frame: FlatFrame | null,
  nodeId: string | null
): SimulationFrameDatabase | null {
  if (frame == null || nodeId == null) return null;
  const fromDatabases = frame.databases?.find((d) => d.nodeId === nodeId);
  if (fromDatabases) return fromDatabases;
  const fromAttrs = frame.attributes?.find(
    (a) => a.kind === 'sqlite' && a.nodeId === nodeId
  );
  if (
    fromAttrs?.file == null ||
    fromAttrs.sha256 == null ||
    fromAttrs.byteLength == null
  ) {
    return null;
  }
  return {
    nodeId: fromAttrs.nodeId,
    file: fromAttrs.file,
    sha256: fromAttrs.sha256,
    byteLength: fromAttrs.byteLength,
  };
}
