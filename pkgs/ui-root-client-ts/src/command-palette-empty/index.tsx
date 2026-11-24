/** @jsxImportSource @solidjs/web */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { JSX } from '@solidjs/web';
import { EmptyState } from '../empty-state/index';

export type CommandPaletteEmptyProps = {
  title?: JSX.Element | undefined;
};

/**
 * `CommandPaletteEmpty` -- shown when no command matches the query.
 */
export function CommandPaletteEmpty(
  props: CommandPaletteEmptyProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <EmptyState
      variant="compact"
      title={props.title ?? t`No matching commands`}
      body={t`Try a different search.`}
      dataSet={{ component: 'CommandPaletteEmpty' }}
    />
  );
}
