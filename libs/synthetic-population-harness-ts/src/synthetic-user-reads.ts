/** What the scenario's Synthetic Users show on their own devices. */
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import {
  type Persona,
  parsePersona,
} from '@libs/synthetic-population-shared-ts/persona';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { syntheticGameView } from './synthetic-game-actions';
import { syntheticUserActor } from './synthetic-sign-in-actions';

/** The game the named Synthetic User's device shows. */
export async function syntheticBoardOf(s: ProductHarness, name: string) {
  const actor = syntheticUserActor(name);
  await bringToFront(s, actor);
  return syntheticGameView(s, actor);
}

/** The named Synthetic User's persona, as the Synthetic Population keeps it. */
export async function syntheticPersonaOf(
  s: ProductHarness,
  name: string
): Promise<Persona | null> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      personality: unknown;
    }>`SELECT personality FROM population_users WHERE username = ${name} AND deleted_at IS NULL`
  );
  if (rows[0] === undefined)
    throw new Error(`No Synthetic User is called ${name}`);
  const raw = rows[0].personality;
  return parsePersona(typeof raw === 'string' ? JSON.parse(raw) : raw);
}
