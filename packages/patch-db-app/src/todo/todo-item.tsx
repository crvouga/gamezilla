import { useEntity } from '@gamezilla/patch-db/react';
import { useTheme } from '@gamezilla/shared/theme';
import { Box, Pressable, Text } from '@gamezilla/shared/ui';

export function TodoItem({
  entityId,
  onToggle,
  onDelete,
}: {
  entityId: string;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const entity = useEntity({ entityId, entityType: 'todo' });
  const completed = entity?.attributes['todo/completed'] === true;
  const titleRaw = entity?.attributes['todo/title'];
  const title = typeof titleRaw === 'string' ? titleRaw : '';

  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        py: 3,
        px: 0,
        gap: 3,
        borderBottomWidth: 'hairline',
        borderColor: 'border',
        userSelect: 'none',
      }}
    >
      <Pressable
        onPress={onToggle}
        style={theme.sx({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
        })}
      >
        <Text
          style={[
            theme.sx({ fontSize: 20 }),
            completed &&
              theme.sx({ textDecorationLine: 'line-through', opacity: 0.6 }),
          ]}
        >
          {completed ? '✓' : '○'}
        </Text>
        <Text
          style={[
            theme.sx({ flex: 1, fontSize: 16 }),
            completed &&
              theme.sx({ textDecorationLine: 'line-through', opacity: 0.6 }),
          ]}
          numberOfLines={1}
        >
          {title || '(untitled)'}
        </Text>
      </Pressable>
      <Pressable onPress={onDelete} style={theme.sx({ p: 1 })} hitSlop={8}>
        <Text
          style={[theme.sx({ fontSize: 14 }), { color: theme.colors.tint }]}
        >
          Delete
        </Text>
      </Pressable>
    </Box>
  );
}
