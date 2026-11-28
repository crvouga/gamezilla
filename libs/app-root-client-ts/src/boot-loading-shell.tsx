/** @jsxImportSource @solidjs/web */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from '@solidjs/web';

/** Session progress for embedded apps and account changes. Browser openings
 * keep their interactive document until the selected route or recovery mounts. */
export function BootLoadingShell(): JSX.Element {
  return (
    <Surface
      tone="background"
      grow
      align="center"
      justify="center"
      role="status"
      testId={Handles.bootLoading}
      dataSet={{ component: 'BootLoadingShell' }}
    >
      <P variant="caption">
        <Trans>Opening saved data…</Trans>
      </P>
    </Surface>
  );
}
