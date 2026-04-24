import type { Entity } from '@gamezilla/patch-db/interface';
import { SHAPE_ATTR } from '@gamezilla/patch-db/sim/playground-shapes';
import { Box, IconButton, Stack, Text, useTheme } from '@gamezilla/lib/ui';
import Svg, { Polygon } from '@gamezilla/lib/ui/svg';
import { IconShuffle, IconTrash } from './icons';

function ReorderButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <IconButton size={22} onPress={onPress} disabled={disabled}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '600',
          color: theme.colors.textSecondary,
        }}
        label={label}
      />
    </IconButton>
  );
}

export function ShapeRow({
  entity,
  index,
  isFirst,
  isLast,
  busy,
  onRandomize,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  entity: Entity;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onRandomize: (entityId: string) => void;
  onDelete: (entityId: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const theme = useTheme();

  return (
    <Stack
      direction="horizontal"
      spacing={2}
      align="center"
      sx={{ px: 2, py: 1 }}
      style={{
        borderRadius: 10,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Stack spacing={0} align="center">
        <ReorderButton
          label="▲"
          disabled={busy || isFirst}
          onPress={onMoveUp}
        />
        <ReorderButton
          label="▼"
          disabled={busy || isLast}
          onPress={onMoveDown}
        />
      </Stack>

      <Text
        variant="mono"
        style={{
          width: 20,
          textAlign: 'center',
          fontSize: 10,
          color: theme.colors.textSecondary,
        }}
        label={String(entity.attributes[SHAPE_ATTR.order] ?? index)}
      />

      <Box
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg viewBox="0 0 100 100" width={36} height={36}>
          <Polygon
            points={String(entity.attributes[SHAPE_ATTR.points] ?? '')}
            fill={String(entity.attributes[SHAPE_ATTR.fill] ?? '#666')}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1}
          />
        </Svg>
      </Box>

      <Box style={{ flex: 1 }}>
        <Text
          variant="mono"
          numberOfLines={1}
          style={{ fontSize: 12, color: theme.colors.text }}
          label={String(entity.attributes[SHAPE_ATTR.kind] ?? '')}
        />
        <Text
          variant="mono"
          numberOfLines={1}
          style={{
            fontSize: 9,
            color: theme.colors.textSecondary,
            marginTop: 1,
          }}
          label={entity.entityId.slice(0, 12)}
        />
      </Box>

      <IconButton
        size={28}
        background={theme.colors.surface}
        disabled={busy}
        onPress={() => onRandomize(entity.entityId)}
      >
        <IconShuffle size={14} />
      </IconButton>

      <IconButton
        size={28}
        disabled={busy}
        onPress={() => onDelete(entity.entityId)}
      >
        <IconTrash size={14} />
      </IconButton>
    </Stack>
  );
}
