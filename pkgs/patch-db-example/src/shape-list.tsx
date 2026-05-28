import { Box, Button, EmptyState, Stack, Text } from '@pkgs/ui';
import { useTheme } from '@pkgs/ui/theme';
import type { Entity } from '@pkgs/patch-db/interface';
import { useLingui } from '@lingui/react/macro';
import { IconPlus } from './icons';
import { ShapeRow } from './shape-row';
import { useReorder } from './use-drag-reorder';

function ShapeNote({ note }: { note: string }) {
  const theme = useTheme();
  return (
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
  );
}

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
  const { t } = useLingui();
  const { moveUp, moveDown } = useReorder(entities, onReorder);

  return (
    <Stack spacing={2}>
      {entities.length === 0 ? (
        <EmptyState variant="compact" title={t`No shapes yet`} />
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
        title={t`Add Shape`}
        intent="neutral"
        size="sm"
        disabled={busy}
        startIcon={<IconPlus size={14} />}
        onPress={onCreate}
      />

      {note ? <ShapeNote note={note} /> : null}
    </Stack>
  );
}
