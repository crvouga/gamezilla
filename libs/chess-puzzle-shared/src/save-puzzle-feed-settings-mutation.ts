import { requireInMutation } from '@libs/permissions-shared/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import sql from '@pkgs/sql-root-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';

import {
  decodeChessPuzzleFeedConfig,
  encodeChessPuzzleFeedConfig,
} from './chess-puzzle-feed-config';

/** Generous bound on the encoded config (every theme fits many times). */
const MAX_CONFIG_LENGTH = 4_000;

/**
 * Save the player's puzzle feed choices. One row per account, keyed by the
 * account id and replaced whole on every save; the stored text is
 * re-encoded, so every device holds byte-identical choices. Customizing the
 * feed is for accounts: a guest is refused with `requires_account`.
 */
export const savePuzzleFeedSettingsMutation = defineMutation({
  name: 'savePuzzleFeedSettings',
  args: z.object({ config: z.string().min(2).max(MAX_CONFIG_LENGTH) }),
  async run({ tx, env }, args) {
    await requireInMutation({ tx, env }, PERMISSION.puzzlesCustomizeFeed);
    const config = decodeChessPuzzleFeedConfig(args.config);
    if (config === undefined) {
      throw new MutationError(
        'CHESS_FEED_SETTINGS_INVALID',
        'These feed settings could not be read.'
      );
    }
    await tx.run(sql`
      INSERT INTO chess_puzzle_feed_settings (id, owner_id, config)
      VALUES (${env.actorId}, ${env.actorId}, ${encodeChessPuzzleFeedConfig(config)})
      ON CONFLICT (id) DO UPDATE SET config = excluded.config
    `);
  },
});
