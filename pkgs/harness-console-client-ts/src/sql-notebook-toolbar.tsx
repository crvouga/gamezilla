import { asLocalized } from '@pkgs/i18n-shared-ts/localized-string';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { PlayIcon, PlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { OverflowMenuButton } from '@pkgs/ui-root-client-ts/overflow-menu-button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { Toolbar } from '@pkgs/ui-root-client-ts/toolbar';
import type { Accessor, JSX } from 'solid-js';

import type { SqlDialect } from './sql-dialect';

export function SqlNotebookToolbar(props: {
  readonly dialect: Accessor<SqlDialect>;
  readonly onRunAll: () => void;
  readonly onAddCell: () => void;
  readonly onClearResults: () => void;
  readonly onClearNotebook: () => void;
  readonly onExport: () => void;
}): JSX.Element {
  return (
    <Toolbar tone="surface" aria-label="SQL notebook">
      <StackHorizontal grow>
        <P variant="footnote" lines={1}>
          {`SQL notebook · ${props.dialect()} · debug writes bypass sync mutations`}
        </P>
      </StackHorizontal>
      <IconButton
        label="Run all"
        size={28}
        tooltip="hover"
        onClick={() => props.onRunAll()}
      >
        <PlayIcon size={14} color="icon" />
      </IconButton>
      <IconButton
        label="Add cell"
        size={28}
        tooltip="hover"
        onClick={() => props.onAddCell()}
      >
        <PlusIcon size={14} color="icon" />
      </IconButton>
      <OverflowMenuButton
        size={28}
        header={{ title: 'Notebook' }}
        aria-label={asLocalized('Notebook menu')}
        actions={[
          {
            id: 'clear-results',
            label: 'Clear results',
            onClick: () => props.onClearResults(),
          },
          {
            id: 'clear-notebook',
            label: 'Clear notebook',
            onClick: () => props.onClearNotebook(),
            endsGroup: true,
          },
          {
            id: 'export',
            label: 'Copy notebook JSON',
            onClick: () => props.onExport(),
          },
        ]}
      />
    </Toolbar>
  );
}
