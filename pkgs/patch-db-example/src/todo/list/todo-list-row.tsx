import { Box, Pressable, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { TodoListRowCountText } from './todo-list-row-count-text';
import { TodoListRowDeleteButton } from './todo-list-row-delete-button';
import { TodoListRowNameText } from './todo-list-row-name-text';

export type TodoListRowProps = {
  listId: string;
  onOpen: () => void;
};

export function TodoListRow({ listId, onOpen }: TodoListRowProps): ReactNode {
  const theme = useTheme();
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        py: 3.5,
        px: 3,
        borderRadius: 8,
        mb: 1,
      }}
    >
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [
          theme.sx({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }),
          pressed && theme.sx({ opacity: 0.7 }),
        ]}
      >
        <TodoListRowNameText
          listId={listId}
          style={theme.sx({ fontSize: 17, fontWeight: '500' })}
        />
        <TodoListRowCountText
          listId={listId}
          style={theme.sx({ fontSize: 15, opacity: 0.6 })}
        />
      </Pressable>
      <TodoListRowDeleteButton listId={listId} />
    </Box>
  );
}
