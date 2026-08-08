import type { DatabaseSeeder, DatabaseSeederContext } from './database-seeder';

/**
 * Runs registered {@link DatabaseSeeder}s sequentially in registration order.
 */
export class ComposedDatabaseSeeder implements DatabaseSeeder {
  private readonly seeders: DatabaseSeeder[] = [];

  register(seeder: DatabaseSeeder): this {
    this.seeders.push(seeder);
    return this;
  }

  async seed(ctx: DatabaseSeederContext): Promise<void> {
    for (const seeder of this.seeders) {
      await seeder.seed(ctx);
    }
  }
}
