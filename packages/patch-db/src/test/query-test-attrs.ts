/**
 * Namespaced attribute keys for PatchDB tests and examples.
 */
export const QTask = {
  title: 'task/title' as const,
  status: 'task/status' as const,
  done: 'task/done' as const,
  score: 'task/score' as const,
  name: 'task/name' as const,
};

export const QItem = {
  tag: 'item/tag' as const,
  score: 'item/score' as const,
  name: 'item/name' as const,
};

export const QTodoList = {
  deleted: 'todo-list/deleted' as const,
};

export const QGameSession = {
  score: 'game.session/score' as const,
};
