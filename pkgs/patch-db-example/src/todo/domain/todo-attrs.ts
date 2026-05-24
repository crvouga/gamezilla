import { createAttrNamespace } from '@pkgs/attribute';

const todoListItemNs = createAttrNamespace('todo-list-item');
const todoListNs = createAttrNamespace('todo-list');

/** Attribute tags for `entityType: 'todo-list-item'`. */
export const TodoListItemAttr = {
  deleted: todoListItemNs.boolean(
    'deleted',
    (v: unknown): boolean => v === true
  ),
  completed: todoListItemNs.boolean(
    'completed',
    (v: unknown): boolean => v === true
  ),
  title: todoListItemNs.text('title', (v: unknown): string =>
    typeof v === 'string' ? v : ''
  ),
  listId: todoListItemNs.textOrNull('list-id', (v: unknown): string | null => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'string') return v;
    return null;
  }),
  order: todoListItemNs.number('order', (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0
  ),
  createdAt: todoListItemNs.timestamp('created-at', (v: unknown): string =>
    typeof v === 'string' ? v : ''
  ),
} as const;

const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Attribute tags for `entityType: 'todo-list'`. */
export const TodoListAttr = {
  deleted: todoListNs.boolean('deleted', (v: unknown): boolean => v === true),
  name: todoListNs.text('name', (v: unknown): string =>
    typeof v === 'string' ? v : ''
  ),
  order: todoListNs.number('order', (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0
  ),
  createdAt: todoListNs.timestampOrNull(
    'created-at',
    (v: unknown): string | null => {
      if (typeof v === 'string' && ISO_8601.test(v)) return v;
      return null;
    }
  ),
  id: todoListNs.text('id', (v: unknown): string =>
    typeof v === 'string' ? v : ''
  ),
} as const;
