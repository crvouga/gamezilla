import type { PatchDb } from '../interface';
import { usePatchDbStack } from './patch-db-stack-context';

export function usePatchDb(): PatchDb {
  return usePatchDbStack().db;
}
