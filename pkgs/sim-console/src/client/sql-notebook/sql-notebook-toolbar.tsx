import { asLocalized } from '@pkgs/i18n';
import {
  Box,
  IconButton,
  OverflowMenuButton,
  PlayIcon,
  PlusIcon,
  Text,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

import type { SqlDialect } from './sql-dialect';

export function SqlNotebookToolbar(props: {
  readonly dialect: SqlDialect;
  readonly onRunAll: () => void;
  readonly onAddCell: () => void;
  readonly onClearResults: () => void;
  readonly onClearNotebook: () => void;
  readonly onExport: () => void;
}): ReactNode {
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
        label={`SQL notebook · ${dialect} · debug writes bypass sync mutations`}
      />
      <IconButton label="Run all" size={28} tooltip="hover" onPress={onRunAll}>
        <PlayIcon size={14} />
      </IconButton>
      <IconButton
        label="Add cell"
        size={28}
        tooltip="hover"
        onPress={onAddCell}
      >
        <PlusIcon size={14} />
      </IconButton>
      <OverflowMenuButton
        size={28}
        header={{ title: 'Notebook' }}
        accessibilityLabel={asLocalized('Notebook menu')}
        actions={[
          {
            id: 'clear-results',
            label: 'Clear results',
            onPress: onClearResults,
          },
          {
            id: 'clear-notebook',
            label: 'Clear notebook',
            onPress: onClearNotebook,
            endsGroup: true,
          },
          {
            id: 'export',
            label: 'Copy notebook JSON',
            onPress: onExport,
          },
        ]}
      />
    </Box>
  );
}
