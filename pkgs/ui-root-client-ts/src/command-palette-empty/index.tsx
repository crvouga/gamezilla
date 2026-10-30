/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
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
