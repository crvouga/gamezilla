import type { PatchDbQueryWhereClause } from '../../interface';
import { QTodoList } from '../query-test-attrs';

export const DELETED_CLAUSE: PatchDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: QTodoList.deleted },
    { type: '=', attribute: QTodoList.deleted, value: false },
  ],
};
