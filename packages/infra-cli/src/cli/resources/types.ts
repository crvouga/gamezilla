import type { CiPlatform } from '../platform/platform';

export interface Resource {
  readonly id: string;
  destroy(platform: CiPlatform): void | Promise<void>;
}
