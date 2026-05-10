/**
 * Per-entity-type chain compaction policy:
 * - `{ keepLatest: N }` — tail-N merge once the chain exceeds N + `compactionSlack`.
 * - `'never'` — append-only; never merged.
 *
 * This library ships with no application-specific map. Consumers wire their
 * own resolver via {@link PatchDbEngineOptions.compactionPolicy}.
 */
export type PatchDbCompactionPolicy = { keepLatest: number } | 'never';

/** Default used by engines when no resolver is configured. */
export const DEFAULT_PATCH_DB_COMPACTION_POLICY: PatchDbCompactionPolicy = {
  keepLatest: 2,
};

export type PatchDbCompactionPolicyResolver = (
  entityType: string
) => PatchDbCompactionPolicy;

/**
 * Registry-backed resolver. Apps register per-entity-type policies once at
 * startup and pass {@link resolve} to `PatchDbEngineOptions.compactionPolicy`.
 */
export class PatchDbCompactionPolicyRegistry {
  private readonly byEntityType = new Map<string, PatchDbCompactionPolicy>();
  private defaultPolicy: PatchDbCompactionPolicy =
    DEFAULT_PATCH_DB_COMPACTION_POLICY;

  register(entityType: string, policy: PatchDbCompactionPolicy): this {
    this.byEntityType.set(entityType, policy);
    return this;
  }

  registerAll(
    entries: Readonly<Record<string, PatchDbCompactionPolicy>>
  ): this {
    for (const [k, v] of Object.entries(entries)) {
      this.byEntityType.set(k, v);
    }
    return this;
  }

  /** Overrides the fallback policy used when an entity type is not registered. */
  setDefault(policy: PatchDbCompactionPolicy): this {
    this.defaultPolicy = policy;
    return this;
  }

  resolve: PatchDbCompactionPolicyResolver = (entityType) =>
    this.byEntityType.get(entityType) ?? this.defaultPolicy;
}
