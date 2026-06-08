import type { CiPlatform } from '../platform/platform';

export interface InfraContext {
  zoneId?: string;
  nameservers?: string[];
}

/**
 * Desired-state flag used by the routine provision / dry-run / deploy phases:
 *
 * - `'created'` (default): resource participates in every routine phase.
 * - `'destroyed'`: resource is excluded from routine `provision` / `dryRun` /
 *   `deploy`, but stays in the registry. The tail phase of `infra deploy`
 *   walks `'destroyed'` resources in reverse-topo order and calls
 *   `destroy()` on each so the cloud converges on the registry's intent.
 *   Flipping `routineStatus` back to `'created'` is the only thing
 *   required to re-provision the stack.
 *
 * Every `destroy()` implementation must therefore be idempotent: it runs
 * on every production deploy for every `'destroyed'` resource, so
 * already-gone resources need to no-op rather than fail.
 */
export type ResourceRoutineStatus = 'created' | 'destroyed';

export interface Resource {
  readonly id: string;
  /** When `'destroyed'`, excluded from aggregate provision / dry-run / deploy. */
  readonly routineStatus: ResourceRoutineStatus;
  /** Ids of resources that must run before this one (derived from `needs`). */
  dependencyIds(): readonly string[];
  /** Declare upstream resources by reference; call from the registry only. */
  needs(...deps: Resource[]): Resource;
  provision(platform: CiPlatform, ctx: InfraContext): void | Promise<void>;
  /**
   * Dry-run the deploy: validate everything we can *without* mutating infra
   * or uploading artifacts. The `deploy` command runs every resource's
   * `dryRun` up-front and aborts the whole pipeline on the first failure, so
   * a bad Worker bundle or broken secret never results in a half-deployed
   * stack (e.g. client shipped but api-worker failed mid-deploy).
   *
   * NOTE: `wrangler deploy --dry-run` only validates locally (bundle,
   * bindings, migration syntax). It does NOT contact the Cloudflare API, so
   * server-side errors (account-plan restrictions, CF error 10097, route
   * conflicts) still surface at real `deploy` time.
   */
  dryRun?(platform: CiPlatform, ctx: InfraContext): void | Promise<void>;
  deploy?(platform: CiPlatform, ctx: InfraContext): void | Promise<void>;
  /**
   * Idempotent teardown. Used both by `infra destroy` (full stack) and by
   * `infra deploy`'s `'destroyed'`-resource tail phase, so already-absent
   * resources must be treated as success.
   */
  destroy(platform: CiPlatform): void | Promise<void>;
}

export abstract class ResourceBase implements Resource {
  private deps: Resource[] = [];

  readonly routineStatus: ResourceRoutineStatus = 'created';

  dependencyIds(): readonly string[] {
    return this.deps.map((d) => d.id);
  }

  needs(...deps: Resource[]): this {
    this.deps = deps;
    return this;
  }

  abstract readonly id: string;
  abstract provision(
    platform: CiPlatform,
    ctx: InfraContext
  ): void | Promise<void>;
  abstract destroy(platform: CiPlatform): void | Promise<void>;
}
