import { TodoAttr, TodoListAttr } from './todo-attrs';

/** Synthetic id for todos with no `todo/listId` (inbox). */
export const INBOX_LIST_ID = '__inbox__';

export const TODO_ENTITY_TYPE = 'todo';
/** @deprecated Entity type string is `'todoList'`; kept for accidental imports. */
export const TODO_LIST_ENTITY_TYPE = 'todoList';

export { TodoAttr, TodoListAttr };

/** @deprecated Prefer `TodoAttr.*.key`. */
export const TODO_ATTR = {
  TITLE: TodoAttr.title.key,
  COMPLETED: TodoAttr.completed.key,
  LIST_ID: TodoAttr.listId.key,
} as const;

/** @deprecated Prefer `TodoListAttr.*.key`. */
export const TODO_LIST_ATTR = {
  NAME: TodoListAttr.name.key,
} as const;
