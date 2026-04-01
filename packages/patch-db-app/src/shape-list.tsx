import type { Entity } from '@gamezilla/patch-db/interface';
import { Box, Button, Stack, Text } from '@gamezilla/shared/ui';
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

  return (
    <Stack spacing={1}>
      {entities.length === 0 ? (
        <Text variant="caption" style={{ textAlign: 'center', paddingVertical: 8 }}>
          No shapes
        </Text>
      ) : (
        <Box style={{ maxHeight: 200 }}>
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
        </Box>
      )}

      <Button
        title="Create shape"
        variant="outlined"
        size="sm"
        disabled={busy}
        startIcon={<IconPlus size={14} />}
        onPress={onCreate}
      />

      {note ? (
        <Text variant="caption" style={{ color: '#e8b931' }}>
          {note}
        </Text>
      ) : null}
    </Stack>
  );
}
