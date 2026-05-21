import { Box, Pressable, Text, useTheme } from '@pkgs/ui';
import { usePatchDb, useQueryAttribute } from '@pkgs/patch-db/react';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import {
  TODO_LIST_ITEM_ENTITY_TYPE,
  TodoListItemAttr,
} from '../domain/todo-constants';
import { TodoItemCheckmark } from './todo-item-checkmark';
import { TodoItemTitleText } from './todo-item-title-text';

export type TodoItemRowProps = {
  entityId: string;
};

export function TodoItemRow({ entityId }: TodoItemRowProps): ReactNode {
  const { t } = useLingui();
  const theme = useTheme();
  const db = usePatchDb();
  const completed = useQueryAttribute({
    entityType: TODO_LIST_ITEM_ENTITY_TYPE,
    entityId,
    attribute: TodoListItemAttr.completed,
  });

  const toggle = async () => {
    await db.write([
      {
        entityId,
        entityType: TODO_LIST_ITEM_ENTITY_TYPE,
        attributes: TodoListItemAttr.completed(!completed),
      },
    ]);
  };

  const remove = async () => {
    await db.write([
      {
        entityId,
        entityType: TODO_LIST_ITEM_ENTITY_TYPE,
        attributes: TodoListItemAttr.deleted(true),
      },
    ]);
  };

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
        onPress={() => void toggle()}
        style={theme.sx({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
        })}
      >
        <TodoItemCheckmark entityId={entityId} />
        <TodoItemTitleText entityId={entityId} />
      </Pressable>
      <Pressable
        onPress={() => void remove()}
        style={theme.sx({ p: 1 })}
        hitSlop={8}
      >
        <Text
          style={[theme.sx({ fontSize: 14 }), { color: theme.colors.tint }]}
          label={t`Delete`}
        />
      </Pressable>
    </Box>
  );
}
