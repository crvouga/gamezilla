import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';

import type { SqlNotebookCell } from './notebook-doc';
import type { SqlCellRun } from './run-sql-cell';
import type { SqlDialect } from './sql-dialect';
import type { SchemaIndex } from './use-schema-index';

export type CellInsertApi = {
  insertAtCaret: (text: string) => void;
  setSql: (sql: string) => void;
};

export type SqlCellProps = {
  readonly cell: SqlNotebookCell;
  readonly index: number;
  readonly total: number;
  readonly sqlClient: SqlClient;
  readonly dialect: SqlDialect;
  readonly schema: SchemaIndex;
  readonly result: SqlCellRun | null;
  readonly focused: boolean;
  readonly onFocus: () => void;
  readonly onChangeSql: (sql: string) => void;
  readonly onToggleLive: () => void;
  readonly onRun: (run: SqlCellRun) => void;
  readonly onRunAndNext: (run: SqlCellRun) => void;
  readonly onAddBelow: () => void;
  readonly onRemove: () => void;
  readonly onMove: (dir: -1 | 1) => void;
  readonly onDuplicate: () => void;
  readonly onRegisterInsert: (api: CellInsertApi | null) => void;
};
