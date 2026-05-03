import type { PatchDbQueryWhereClause } from '../../interface';

export const DELETED_CLAUSE: PatchDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: 'todoList/deleted' },
    { type: '=', attribute: 'todoList/deleted', value: false },
  ],
};
