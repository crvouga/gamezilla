import { useQuery } from '@gamezilla/patch-db/react';

import { TODO_LIST_ENTITY_TYPE } from '../domain/todo-constants';
import { todoListNotDeletedClause } from './todo-where-clauses';

export function useTodoListCount(): number {
  const result = useQuery({
    entityType: TODO_LIST_ENTITY_TYPE,
    where: todoListNotDeletedClause,
    limit: 0,
  });
  return result.total;
}
