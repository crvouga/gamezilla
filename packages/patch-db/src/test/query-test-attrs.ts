/**
 * Attribute tags for PatchDB tests and examples (validated {@link Keyword} keys).
 */
import { createAttrNamespace } from '@gamezilla/lib/attribute';

const looseString = (v: unknown): string =>
  typeof v === 'string' ? v : String(v ?? '');
const looseNum = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : Number(v ?? 0);
const looseBool = (v: unknown): boolean => v === true || v === 1;

const taskNs = createAttrNamespace('task');
export const QTask = {
  title: taskNs('title', looseString),
  status: taskNs('status', looseString),
  done: taskNs('done', looseBool),
  score: taskNs('score', looseNum),
  name: taskNs('name', looseString),
};

const itemNs = createAttrNamespace('item');
export const QItem = {
  tag: itemNs('tag', looseString),
  score: itemNs('score', looseNum),
  name: itemNs('name', looseString),
};

const todoListNs = createAttrNamespace('todo-list');
export const QTodoList = {
  name: todoListNs('name', looseString),
  order: todoListNs('order', looseNum),
  createdAt: todoListNs('created-at', looseString),
  deleted: todoListNs('deleted', looseBool),
};

const gameSessionNs = createAttrNamespace('game', 'session');
export const QGameSession = {
  score: gameSessionNs('score', looseNum),
};
