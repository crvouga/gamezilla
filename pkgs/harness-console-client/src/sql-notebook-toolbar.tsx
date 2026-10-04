import { asLocalized } from '@pkgs/i18n-shared/localized-string';
import { IconButton } from '@pkgs/ui-client/icon-button';
import { OverflowMenuButton } from '@pkgs/ui-client/overflow-menu-button';
import { PlayIcon, PlusIcon } from '@pkgs/ui-client/icons';
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
  const {
    dialect,
    onRunAll,
    onAddCell,
    onClearResults,
    onClearNotebook,
    onExport,
  } = props;
  return (
    <div class="box flex-row items-center gap-1 px-2 py-1 border-b border-outline bg-surface">
      <p class="text textCaption text-text-secondary flex-1">{`SQL notebook · ${dialect()} · debug writes bypass sync mutations`}</p>
      <IconButton label="Run all" size={28} tooltip="hover" onClick={onRunAll}>
        <PlayIcon size={14} color="icon" />
      </IconButton>
      <IconButton
        label="Add cell"
        size={28}
        tooltip="hover"
        onClick={onAddCell}
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
            onClick: onClearResults,
          },
          {
            id: 'clear-notebook',
            label: 'Clear notebook',
            onClick: onClearNotebook,
            endsGroup: true,
          },
          {
            id: 'export',
            label: 'Copy notebook JSON',
            onClick: onExport,
          },
        ]}
      />
    </div>
  );
}
