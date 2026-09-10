import { Match, Switch } from 'solid-js';

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
  const file = () =>
    resolveSnapshotFile(props.frame, {
      name: 'sqlite',
      nodeId: props.nodeId,
    });
  return (
    <Switch>
      <Match when={file() == null}>
        <div class="box" style={paneSx}>
          <p class="text" style={emptySx}>
            No SQLite dump for node `{props.nodeId ?? '—'}` on this frame.
          </p>
        </div>
      </Match>
      <Match when={true}>
        <div class="box" style={paneSx}>
          <p class="text" style={emptySx}>
            SQLite pane requires web (`{file()}`).
          </p>
        </div>
      </Match>
    </Switch>
  );
}
