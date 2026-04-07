import { ok } from '../lib/fmt';
import type { Resource } from './types';

export class DatabaseResource implements Resource {
  readonly id = 'database';

  async destroy(): Promise<void> {
    ok('Database (PlanetScale)', 'manually managed — skipping');
  }
}
