import type { Entity } from '@gamezilla/patch-db/interface';
import { SHAPE_ATTR } from '@gamezilla/patch-db/sim/playground-shapes';
import Svg, { Polygon } from 'react-native-svg';
import { Box, Button, Stack, Text } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui';

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
      spacing={1}
      align="center"
      sx={{ px: 1, py: 0.5 }}
      style={{
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'transparent',
      }}
    >
      <Stack spacing={0}>
        <Button
          title="▲"
          variant="text"
          size="sm"
          disabled={busy || isFirst}
          onPress={onMoveUp}
        />
        <Button
          title="▼"
          variant="text"
          size="sm"
          disabled={busy || isLast}
          onPress={onMoveDown}
        />
      </Stack>

      <Text variant="mono" style={{ width: 24, textAlign: 'center', fontSize: 10, color: theme.colors.textSecondary }}>
        {String(entity.attributes[SHAPE_ATTR.order] ?? index)}
      </Text>

      <Box
        style={{
          width: 28,
          height: 28,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          overflow: 'hidden',
        }}
      >
        <Svg viewBox="0 0 100 100" width={26} height={26}>
          <Polygon
            points={String(entity.attributes[SHAPE_ATTR.points] ?? '')}
            fill={String(entity.attributes[SHAPE_ATTR.fill] ?? '#666')}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={0.5}
          />
        </Svg>
      </Box>

      <Text
        variant="mono"
        numberOfLines={1}
        style={{ flex: 1, fontSize: 11, color: theme.colors.textSecondary }}
      >
        {String(entity.attributes[SHAPE_ATTR.kind] ?? '')}
      </Text>

      <Button
        title="Rand"
        variant="text"
        size="sm"
        disabled={busy}
        onPress={() => onRandomize(entity.entityId)}
      />
      <Button
        title="Del"
        variant="text"
        size="sm"
        color="destructive"
        disabled={busy}
        onPress={() => onDelete(entity.entityId)}
      />
    </Stack>
  );
}
