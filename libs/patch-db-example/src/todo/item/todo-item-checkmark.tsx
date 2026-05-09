import { Text, useTheme } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

import {
  TODO_LIST_ITEM_ENTITY_TYPE,
  TodoListItemAttr,
} from '../domain/todo-constants';

export type TodoItemCheckmarkProps = {
  entityId: string;
};

export function TodoItemCheckmark({
  entityId,
}: TodoItemCheckmarkProps): ReactNode {
  const theme = useTheme();
  const completed = useQueryAttribute({
    entityType: TODO_LIST_ITEM_ENTITY_TYPE,
    entityId,
    attribute: TodoListItemAttr.completed,
  });
  return (
    <Text
      style={[
        theme.sx({ fontSize: 20 }),
        completed &&
          theme.sx({ textDecorationLine: 'line-through', opacity: 0.6 }),
      ]}
      label={completed ? '✓' : '○'}
    />
  );
}
