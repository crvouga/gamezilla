import { createAttrNamespace } from '@gamezilla/lib/attribute';

const todoNs = createAttrNamespace('todo');
const todoListNs = createAttrNamespace('todoList');

/** Attribute tags for `entityType: 'todo'`. */
export const TodoAttr = {
  deleted: todoNs('deleted', (v: unknown): boolean => v === true),
  completed: todoNs('completed', (v: unknown): boolean => v === true),
  title: todoNs('title', (v: unknown): string =>
    typeof v === 'string' ? v : ''
  ),
  listId: todoNs('listId', (v: unknown): string | null => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'string') return v;
    return null;
  }),
  order: todoNs('order', (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0
  ),
  createdAt: todoNs('createdAt', (v: unknown): string =>
    typeof v === 'string' ? v : ''
  ),
} as const;

/** Attribute tags for `entityType: 'todoList'`. */
export const TodoListAttr = {
  deleted: todoListNs('deleted', (v: unknown): boolean => v === true),
  name: todoListNs('name', (v: unknown): string =>
    typeof v === 'string' ? v : ''
  ),
  order: todoListNs('order', (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : 0
  ),
  createdAt: todoListNs('createdAt', (v: unknown): string | null => {
    if (typeof v === 'string') {
      // Simple ISO 8601 check (YYYY-MM-DDTHH:MM:SS(.sss)?Z or with offset)
      const iso8601 =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[\+\-]\d{2}:\d{2})$/;
      if (iso8601.test(v)) return v;
    }
    return null;
  }),
  id: todoListNs('id', (v: unknown): string =>
    typeof v === 'string' ? v : ''
  ),
} as const;
