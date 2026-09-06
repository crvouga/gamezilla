/** @jsxImportSource solid-js */
/**
 * `CommandPaletteEmpty` -- shown when no command matches the query.
 */

import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { EmptyState } from '../empty-state';

export type CommandPaletteEmptyProps = {
  title?: JSX.Element | undefined;
};

export function CommandPaletteEmpty(
  props: CommandPaletteEmptyProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <EmptyState
      variant="compact"
      title={props.title ?? t`No matching commands`}
      dataSet={{ component: 'CommandPaletteEmpty' }}
    />
  );
}
