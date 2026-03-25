import type { PatchesDbQueryWhereClause } from '../../interface';

export const DELETED_CLAUSE: PatchesDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: 'todoList/deleted' },
    { type: '=', attribute: 'todoList/deleted', value: false },
  ],
};
