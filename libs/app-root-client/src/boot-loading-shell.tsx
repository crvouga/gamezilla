/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared/handles';
import { Layer } from '@pkgs/ui-root-client/layer';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { Surface } from '@pkgs/ui-root-client/surface';
import type { JSX } from 'solid-js';

/**
 * The one boot loading state: shown while identity binds or local SQLite
 * opens. Matches the static `.startup-shell` in `index.html` and stays pinned
 * to the viewport center, so the spinner never moves or changes as boot
 * stages hand off (header chrome may appear around it). Never a blank void on
 * a hung OPFS / worker open.
 */
export function BootLoadingShell(): JSX.Element {
  return (
    <Surface tone="background" grow testId={Handles.bootLoading}>
      <Layer inset="viewport" align="center" justify="center" passThrough>
        <LoadingState size="lg" dataSet={{ component: 'BootLoadingShell' }} />
      </Layer>
    </Surface>
  );
}
