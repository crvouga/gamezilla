/**
 * Auth server helpers — re-export the sync-engine managed-column bag so
 * REST / ensure paths match mutation wrap semantics.
 */
export {
  type ManagedInsertColumns,
  managedInsertColumns,
  managedUpdatedAtIso,
} from '@pkgs/sync-engine/shared';
