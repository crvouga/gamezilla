import type { PatchDbQueryWhereClause } from '@gamezilla/patch-db/interface';

import {
  INBOX_LIST_ID,
  TodoAttr,
  TodoListAttr,
} from '../domain/todo-constants';

/** Todos that are not soft-deleted. */
export const todoNotDeletedClause: PatchDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: TodoAttr.deleted.key },
    { type: '=', attribute: TodoAttr.deleted.key, value: false },
  ],
};

/** Todos that are not completed (missing attr or false). */
export const todoActiveClause: PatchDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: TodoAttr.completed.key },
    { type: '=', attribute: TodoAttr.completed.key, value: false },
  ],
};

/** Todo lists that are not soft-deleted. */
export const todoListNotDeletedClause: PatchDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: TodoListAttr.deleted.key },
    { type: '=', attribute: TodoListAttr.deleted.key, value: false },
  ],
};

export type TodoFilter = 'all' | 'active' | 'completed';

/**
 * Where clause for todos belonging to `listId` (inbox = no / empty listId).
 */
export function buildTodoListWhereClause(
  listId: string
): PatchDbQueryWhereClause {
  if (listId === INBOX_LIST_ID) {
    return {
      type: 'or',
      clauses: [
        { type: 'not_exists', attribute: TodoAttr.listId.key },
        { type: '=', attribute: TodoAttr.listId.key, value: null },
        { type: '=', attribute: TodoAttr.listId.key, value: '' },
      ],
    };
  }
  return { type: '=', attribute: TodoAttr.listId.key, value: listId };
}

export function buildTodoWhereClause(
  listId: string,
  filter: TodoFilter
): PatchDbQueryWhereClause {
  const listClause = buildTodoListWhereClause(listId);
  if (filter === 'all') {
    return { type: 'and', clauses: [todoNotDeletedClause, listClause] };
  }
  if (filter === 'active') {
    return {
      type: 'and',
      clauses: [todoNotDeletedClause, listClause, todoActiveClause],
    };
  }
  return {
    type: 'and',
    clauses: [
      todoNotDeletedClause,
      listClause,
      { type: '=', attribute: TodoAttr.completed.key, value: true },
    ],
  };
}

export const todoDefaultOrderBy = [
  { attribute: TodoAttr.order.key, direction: 'asc' as const },
  { attribute: TodoAttr.createdAt.key, direction: 'asc' as const },
];

export const todoListDefaultOrderBy = [
  { attribute: TodoListAttr.order.key, direction: 'asc' as const },
  { attribute: TodoListAttr.createdAt.key, direction: 'asc' as const },
  { attribute: TodoListAttr.id.key, direction: 'asc' as const },
];
