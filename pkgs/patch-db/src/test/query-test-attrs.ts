/**
 * Attribute tags for PatchDB tests and examples (validated {@link Keyword} keys).
 */
import { createAttrNamespace } from '@pkgs/attribute';

const looseString = (v: unknown): string =>
  typeof v === 'string' ? v : String(v ?? '');
const looseNum = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : Number(v ?? 0);
const looseBool = (v: unknown): boolean => v === true || v === 1;

const taskNs = createAttrNamespace('task');
export const QTask = {
  title: taskNs.text('title', looseString),
  status: taskNs.text('status', looseString),
  done: taskNs.boolean('done', looseBool),
  score: taskNs.number('score', looseNum),
  name: taskNs.text('name', looseString),
};

const itemNs = createAttrNamespace('item');
export const QItem = {
  tag: itemNs.text('tag', looseString),
  score: itemNs.number('score', looseNum),
  name: itemNs.text('name', looseString),
};

const todoListNs = createAttrNamespace('todo-list');
export const QTodoList = {
  name: todoListNs.text('name', looseString),
  order: todoListNs.number('order', looseNum),
  createdAt: todoListNs.timestamp('created-at', looseString),
  deleted: todoListNs.boolean('deleted', looseBool),
};

const gameSessionNs = createAttrNamespace('game', 'session');
export const QGameSession = {
  score: gameSessionNs.number('score', looseNum),
};
