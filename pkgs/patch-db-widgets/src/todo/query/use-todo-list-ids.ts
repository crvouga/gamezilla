import { useQueryEntityIds } from '@pkgs/patch-db/react';

import { TODO_LIST_ENTITY_TYPE } from '../domain/todo-constants';
import {
  todoListDefaultOrderBy,
  todoListNotDeletedClause,
} from './todo-where-clauses';

export function useTodoListIds(): string[] {
  return useQueryEntityIds({
    entityType: TODO_LIST_ENTITY_TYPE,
    where: todoListNotDeletedClause,
    orderBy: todoListDefaultOrderBy,
  });
}
