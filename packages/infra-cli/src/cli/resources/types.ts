import type { CiPlatform } from '../platform/platform';

export interface InfraContext {
  zoneId?: string;
  nameservers?: string[];
  pagesSubdomain?: string;
}

export interface Resource {
  readonly id: string;
  ensure(platform: CiPlatform, ctx: InfraContext): void | Promise<void>;
  destroy(platform: CiPlatform): void | Promise<void>;
}
