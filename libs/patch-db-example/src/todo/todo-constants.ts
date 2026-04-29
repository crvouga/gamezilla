/** Synthetic id for todos with no `todo/listId` (inbox). */
export const INBOX_LIST_ID = '__inbox__';

export const TODO_ENTITY_TYPE = 'todo';
export const TODO_LIST_ENTITY_TYPE = 'todo-list';

export const TODO_ATTR = {
  TITLE: 'todo/title',
  COMPLETED: 'todo/completed',
  LIST_ID: 'todo/listId',
} as const;

export const TODO_LIST_ATTR = {
  NAME: 'todo-list/name',
} as const;
