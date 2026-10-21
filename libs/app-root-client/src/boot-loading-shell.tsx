/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared/handles';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
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
    <div
      class="box flex-1 min-h-0 bg-background"
      data-component="BootLoadingShell"
      data-testid={Handles.bootLoading}
    >
      <div class="box fixed inset-0 items-center justify-center pointer-events-none">
        <LoadingState size="lg" />
      </div>
    </div>
  );
}
