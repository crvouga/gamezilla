import { useQueryEntityIds } from '@pkgs/patch-db/react';

import { TODO_LIST_ITEM_ENTITY_TYPE } from '../domain/todo-constants';
import {
  buildTodoWhereClause,
  todoDefaultOrderBy,
  type TodoFilter,
} from './todo-where-clauses';

export function useTodoIdsInList(listId: string, filter: TodoFilter): string[] {
  return useQueryEntityIds({
    entityType: TODO_LIST_ITEM_ENTITY_TYPE,
    where: buildTodoWhereClause(listId, filter),
    orderBy: todoDefaultOrderBy,
  });
}
