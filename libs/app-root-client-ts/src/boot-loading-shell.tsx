/** @jsxImportSource @solidjs/web */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';

/** Session progress for embedded apps and account changes. Browser openings
 * keep their interactive document until the selected route or recovery mounts. */
export function BootLoadingShell(): JSX.Element {
  return (
    <StackVertical
      grow
      align="center"
      justify="center"
      role="status"
      testId={Handles.bootLoading}
    >
      <P variant="caption">
        <Trans>Opening saved data…</Trans>
      </P>
    </StackVertical>
  );
}
