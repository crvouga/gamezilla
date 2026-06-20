import { useQuery } from '@pkgs/patch-db/react';

import { TODO_LIST_ENTITY_TYPE } from '../domain/todo-constants';
import { todoListNotDeletedClause } from './todo-where-clauses';

/** Stub until patch-db aggregation queries exist. */
export function useTodoListCount(): number {
  void useQuery({
    entityType: TODO_LIST_ENTITY_TYPE,
    where: todoListNotDeletedClause,
    limit: 0,
  });
  return 0;
}
