import type { PatchDbQueryWhereClause } from '@pkgs/patch-db/interface';

import {
  INBOX_LIST_ID,
  TodoListAttr,
  TodoListItemAttr,
} from '../domain/todo-constants';

/** Todo-list-items that are not soft-deleted. */
export const todoNotDeletedClause: PatchDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: TodoListItemAttr.deleted.key },
    { type: '=', attribute: TodoListItemAttr.deleted.key, value: false },
  ],
};

/** Todo-list-items that are not completed (missing attr or false). */
export const todoActiveClause: PatchDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: TodoListItemAttr.completed.key },
    { type: '=', attribute: TodoListItemAttr.completed.key, value: false },
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
 * Where clause for todo-list-items belonging to `listId` (inbox = no / empty listId).
 */
export function buildTodoListWhereClause(
  listId: string
): PatchDbQueryWhereClause {
  if (listId === INBOX_LIST_ID) {
    return {
      type: 'or',
      clauses: [
        { type: 'not_exists', attribute: TodoListItemAttr.listId.key },
        { type: '=', attribute: TodoListItemAttr.listId.key, value: null },
        { type: '=', attribute: TodoListItemAttr.listId.key, value: '' },
      ],
    };
  }
  return { type: '=', attribute: TodoListItemAttr.listId.key, value: listId };
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
      { type: '=', attribute: TodoListItemAttr.completed.key, value: true },
    ],
  };
}

export const todoDefaultOrderBy = [
  { attribute: TodoListItemAttr.order.key, direction: 'asc' as const },
  { attribute: TodoListItemAttr.createdAt.key, direction: 'asc' as const },
];

export const todoListDefaultOrderBy = [
  { attribute: TodoListAttr.order.key, direction: 'asc' as const },
  { attribute: TodoListAttr.createdAt.key, direction: 'asc' as const },
  { attribute: TodoListAttr.id.key, direction: 'asc' as const },
];
