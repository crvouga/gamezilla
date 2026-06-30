/** Span attribute keys for patch-db sync-host instrumentation. */
export const PatchDbSemconv = {
  queryCount: 'patch_db.query_count',
  patchCount: 'patch_db.patch_count',
  entityTypes: 'patch_db.entity_types',
  acceptedCount: 'patch_db.accepted_count',
  rejectedCount: 'patch_db.rejected_count',
} as const;
