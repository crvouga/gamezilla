import type { PatchDbQueryWhereClause } from '../../interface';
import { QTodoList } from '../query-test-attrs';

export const DELETED_CLAUSE: PatchDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: QTodoList.deleted.key },
    { type: '=', attribute: QTodoList.deleted.key, value: false },
  ],
};
