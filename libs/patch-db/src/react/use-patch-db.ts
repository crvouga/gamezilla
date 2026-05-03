import { assert } from '@gamezilla/lib/assert';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import type { PatchDb } from '../interface';
import { PatchDbToken } from './tokens';

export function usePatchDb(): PatchDb {
  const db = useDependency(PatchDbToken);
  assert.defined(db, 'PatchDb not found');
  return db;
}
