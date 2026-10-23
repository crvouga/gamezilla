import { requireInMutation } from '@libs/permissions-shared-ts/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';

import { decodePuzzleFeedConfig, encodePuzzleFeedConfig } from './feed-config';
import { isPuzzleNamespace, puzzleOwnerKey } from './puzzle-namespace';

/** Generous bound on the encoded config (every theme fits many times). */
const MAX_CONFIG_LENGTH = 4_000;

/**
 * Save the player's puzzle feed choices for one game. One row per account
 * and game, keyed by the account id in the game's puzzle namespace (the
 * durable game's row is the account id itself), replaced whole on every save; the stored text is
 * re-encoded, so every device holds byte-identical choices. Customizing the
 * feed is for accounts: a guest is refused with `requires_account`.
 */
export const savePuzzleFeedSettingsMutation = defineMutation({
  name: 'savePuzzleFeedSettings',
  args: z.object({
    config: z.string().min(2).max(MAX_CONFIG_LENGTH),
    /** The game's puzzle namespace; the durable game's `''` when left out. */
    namespace: z
      .string()
      .refine(isPuzzleNamespace, 'not a puzzle namespace')
      .default(''),
  }),
  async run({ tx, env }, args) {
    await requireInMutation({ tx, env }, PERMISSION.puzzlesCustomizeFeed);
    const config = decodePuzzleFeedConfig(args.config);
    if (config === undefined) {
      throw new MutationError(
        'CHESS_FEED_SETTINGS_INVALID',
        'These feed settings could not be read.'
      );
    }
    await tx.run(sql`
      INSERT INTO chess_puzzle_feed_settings (id, owner_id, config)
      VALUES (${puzzleOwnerKey(args.namespace, env.actorId)}, ${env.actorId}, ${encodePuzzleFeedConfig(config)})
      ON CONFLICT (id) DO UPDATE SET config = excluded.config
    `);
  },
});
