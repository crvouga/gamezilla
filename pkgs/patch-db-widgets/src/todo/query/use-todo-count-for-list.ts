import { useQuery } from '@pkgs/patch-db/react';

import { TODO_LIST_ITEM_ENTITY_TYPE } from '../domain/todo-constants';
import { buildTodoWhereClause, type TodoFilter } from './todo-where-clauses';

/**
 * Stub until patch-db aggregation queries exist.
 * Count of non-deleted todo-list-items in `listId` matching `filter`.
 */
export function useTodoCountForList(
  listId: string,
  filter: TodoFilter = 'all'
): number {
  void useQuery({
    entityType: TODO_LIST_ITEM_ENTITY_TYPE,
    where: buildTodoWhereClause(listId, filter),
    limit: 0,
  });
  return 0;
}
