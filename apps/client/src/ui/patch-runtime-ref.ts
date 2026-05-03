import type { PatchDb } from '@gamezilla/patch-db/interface';
import type { SessionService } from '@gamezilla/client/auth/session-service';

export type PatchRuntimeHandles = {
  readonly getPatchDb: () => PatchDb;
  readonly getSessionService: () => SessionService;
};

let handles: PatchRuntimeHandles | null = null;

export function setPatchRuntimeHandles(next: PatchRuntimeHandles | null): void {
  handles = next;
}

export function getPatchDbForAuthWrites(): PatchDb {
  if (handles === null) {
    throw new Error('Patch runtime not ready');
  }
  return handles.getPatchDb();
}

export function getSessionServiceForAuth(): SessionService {
  if (handles === null) {
    throw new Error('Patch runtime not ready');
  }
  return handles.getSessionService();
}
