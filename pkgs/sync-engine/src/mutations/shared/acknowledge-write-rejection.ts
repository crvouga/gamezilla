import { sql } from '@pkgs/sql';
import { z } from 'zod';
import { defineMutation } from '../core/define-mutation';

/** Mark a synced-down write rejection as acknowledged (dismissed) by this install. */
export const acknowledgeWriteRejectionMutation = defineMutation({
  name: 'acknowledgeWriteRejection',
  args: z.object({ rejectionId: z.string().min(1) }),
  writes: ['write_rejections'],
  async run({ tx, env }, { rejectionId }) {
    await tx.run(sql`
      UPDATE write_rejections
      SET acknowledged = ${1}
      WHERE id = ${rejectionId}
        AND client_id = ${env.deviceId}
        AND acknowledged = ${0}
    `);
  },
});

export const FRAMEWORK_MUTATIONS = [acknowledgeWriteRejectionMutation] as const;
