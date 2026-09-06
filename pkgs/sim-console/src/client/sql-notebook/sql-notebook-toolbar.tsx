import { asLocalized } from '@pkgs/i18n';
import {
  Box,
  IconButton,
  OverflowMenuButton,
  PlayIcon,
  PlusIcon,
  Text,
} from '@pkgs/ui';
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
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderBottomWidth: 1,
        borderColor: 'outline',
        background: 'surface',
      }}
    >
      <Text
        sx={{ fontSize: 11, color: 'textSecondary', flex: 1 }}
        label={`SQL notebook · ${dialect()} · debug writes bypass sync mutations`}
      />
      <IconButton label="Run all" size={28} tooltip="hover" onClick={onRunAll}>
        <PlayIcon size={14} />
      </IconButton>
      <IconButton
        label="Add cell"
        size={28}
        tooltip="hover"
        onClick={onAddCell}
      >
        <PlusIcon size={14} />
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
    </Box>
  );
}
