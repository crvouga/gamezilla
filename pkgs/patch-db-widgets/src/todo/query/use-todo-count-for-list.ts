import { useQuery } from '@pkgs/patch-db/react';

import { TODO_LIST_ITEM_ENTITY_TYPE } from '../domain/todo-constants';
import { buildTodoWhereClause, type TodoFilter } from './todo-where-clauses';

/**
 * Count of non-deleted todo-list-items in `listId` matching `filter` (default `all`).
 */
export function useTodoCountForList(
  listId: string,
  filter: TodoFilter = 'all'
): number {
  const result = useQuery({
    entityType: TODO_LIST_ITEM_ENTITY_TYPE,
    where: buildTodoWhereClause(listId, filter),
    limit: 0,
  });
  return result.total;
}
