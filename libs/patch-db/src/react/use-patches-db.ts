import { assert } from '@gamezilla/lib/assert';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import type { PatchesDb } from '../interface';
import { PatchesDbToken } from './tokens';

export function usePatchesDb(): PatchesDb {
  const db = useDependency(PatchesDbToken);
  assert.defined(db, 'PatchesDb not found');
  return db;
}
