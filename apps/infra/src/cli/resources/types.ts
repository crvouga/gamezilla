import type { CiPlatform } from '../platform/platform';

export interface InfraContext {
  zoneId?: string;
  nameservers?: string[];
  pagesSubdomain?: string;
}

export interface Resource {
  readonly id: string;
  /** Ids of resources that must run before this one (derived from `needs`). */
  dependencyIds(): readonly string[];
  /** Declare upstream resources by reference; call from the registry only. */
  needs(...deps: Resource[]): Resource;
  provision(platform: CiPlatform, ctx: InfraContext): void | Promise<void>;
  deploy?(platform: CiPlatform, ctx: InfraContext): void | Promise<void>;
  destroy(platform: CiPlatform): void | Promise<void>;
}

export abstract class ResourceBase implements Resource {
  private deps: Resource[] = [];

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
