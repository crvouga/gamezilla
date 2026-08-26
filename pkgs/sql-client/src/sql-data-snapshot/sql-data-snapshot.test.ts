import { describe } from 'bun:test';
import { SqlClientImplSqliteMem } from '../sqlite/impl-sqlite-mem';
import { runSqlDataSnapshotContractTests } from './contract';

describe('SqlDataSnapshot sqlite-mem', () => {
  runSqlDataSnapshotContractTests(() => SqlClientImplSqliteMem.open());
});
