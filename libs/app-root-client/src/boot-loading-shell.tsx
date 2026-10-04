/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import type { JSX } from 'solid-js';

/**
 * Full-bleed themed loading canvas while identity binds or local SQLite opens.
 * Replaces the old blank shell so a hung OPFS / worker open is never a white
 * void with no feedback.
 */
export function BootLoadingShell(): JSX.Element {
  const { t } = useLingui();
  return (
    <div
      class="box flex-1 min-h-0 items-center justify-center bg-background"
      data-component="BootLoadingShell"
      data-testid={Handles.bootLoading}
    >
      <LoadingState size="large" caption={t`Starting…`} />
    </div>
  );
}
