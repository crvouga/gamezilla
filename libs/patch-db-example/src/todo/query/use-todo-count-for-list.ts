import { useQuery } from '@gamezilla/patch-db/react';

import { TODO_ENTITY_TYPE } from '../domain/todo-constants';
import {
  buildTodoWhereClause,
  type TodoFilter,
} from './todo-where-clauses';

/**
 * Count of non-deleted todos in `listId` matching `filter` (default `all`).
 */
export function useTodoCountForList(
  listId: string,
  filter: TodoFilter = 'all'
): number {
  const result = useQuery({
    entityType: TODO_ENTITY_TYPE,
    where: buildTodoWhereClause(listId, filter),
    limit: 0,
  });
  return result.total;
}
