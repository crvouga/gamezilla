import { ok } from '../lib/fmt';
import type { CiPlatform } from '../platform/platform';
import type { InfraContext, Resource } from './types';

export class DatabaseResource implements Resource {
  readonly id = 'database';

  async ensure(_platform: CiPlatform, _ctx: InfraContext): Promise<void> {
    ok('Database (PlanetScale)', 'manually managed — skipping');
  }

  async destroy(): Promise<void> {
    ok('Database (PlanetScale)', 'manually managed — skipping');
  }
}
