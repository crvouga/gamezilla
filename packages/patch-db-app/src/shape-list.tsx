import type { Entity } from '@gamezilla/patch-db/interface';
import { Box, Button, Stack, Text } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui/theme';
import { IconPlus } from './icons';
import { ShapeRow } from './shape-row';
import { useReorder } from './use-drag-reorder';

export function ShapeList({
  entities,
  busy,
  note,
  onRandomize,
  onDelete,
  onCreate,
  onReorder,
}: {
  entities: Entity[];
  busy: boolean;
  note?: string | null;
  onRandomize: (entityId: string) => void;
  onDelete: (entityId: string) => void;
  onCreate: () => void;
  onReorder: (entityIds: string[]) => void;
}) {
  const { moveUp, moveDown } = useReorder(entities, onReorder);
  const theme = useTheme();

  return (
    <Stack spacing={2}>
      {entities.length === 0 ? (
        <Box
          sx={{ py: 4, alignItems: 'center' }}
          style={{
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderStyle: 'dashed',
          }}
        >
          <Text
            variant="caption"
            style={{ color: theme.colors.textSecondary }}
            label="No shapes yet"
          />
        </Box>
      ) : (
        <Stack spacing={1}>
          {entities.map((e, i) => (
            <ShapeRow
              key={e.entityId}
              entity={e}
              index={i}
              isFirst={i === 0}
              isLast={i === entities.length - 1}
              busy={busy}
              onRandomize={onRandomize}
              onDelete={onDelete}
              onMoveUp={() => moveUp(i)}
              onMoveDown={() => moveDown(i)}
            />
          ))}
        </Stack>
      )}

      <Button
        title="Add Shape"
        variant="ghost"
        size="sm"
        disabled={busy}
        startIcon={<IconPlus size={14} />}
        onPressIn={onCreate}
      />

      {note ? (
        <Box
          sx={{ px: 3, py: 2 }}
          style={{
            borderRadius: 8,
            backgroundColor: theme.colors.warning + '18',
          }}
        >
          <Text
            variant="caption"
            style={{ color: theme.colors.warning }}
            label={note}
          />
        </Box>
      ) : null}
    </Stack>
  );
}
