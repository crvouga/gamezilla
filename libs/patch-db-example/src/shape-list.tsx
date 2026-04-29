import type { Entity } from '@gamezilla/patch-db/interface';
import { Box, Button, Stack, Text } from '@gamezilla/lib/ui';
import { useTheme } from '@gamezilla/lib/ui/theme';
import { useLingui } from '@lingui/react/macro';
import { IconPlus } from './icons';
import { ShapeRow } from './shape-row';
import { useReorder } from './use-drag-reorder';

function EmptyShapesPlaceholder() {
  const { t } = useLingui();
  const theme = useTheme();
  return (
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
        label={t`No shapes yet`}
      />
    </Box>
  );
}

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
        <EmptyShapesPlaceholder />
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
        variant="ghost"
        size="sm"
        disabled={busy}
        startIcon={<IconPlus size={14} />}
        onPress={onCreate}
      />

      {note ? <ShapeNote note={note} /> : null}
    </Stack>
  );
}
