import { sql } from '@pkgs/sql';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { defineMutation } from '../core/define-mutation';

type AcknowledgeArgs = { readonly rejectionId: string };

const acknowledgeArgsSchema: StandardSchemaV1<
  AcknowledgeArgs,
  AcknowledgeArgs
> = {
  '~standard': {
    version: 1,
    vendor: 'sync-engine',
    validate(value) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return { issues: [{ message: 'Expected an object' }] };
      }
      const rejectionId = (value as Record<string, unknown>)['rejectionId'];
      if (typeof rejectionId !== 'string' || rejectionId.length < 1) {
        return {
          issues: [
            {
              message: 'rejectionId must be a non-empty string',
              path: ['rejectionId'],
            },
          ],
        };
      }
      return { value: { rejectionId } };
    },
  },
};

/** Mark a synced-down write rejection as acknowledged (dismissed) by this install. */
export const acknowledgeWriteRejectionMutation = defineMutation({
  name: 'acknowledgeWriteRejection',
  args: acknowledgeArgsSchema,
  async run({ tx, env }, { rejectionId }) {
    const updatedAt = env.now().toISOString();
    await tx.run(sql`
      UPDATE sync_engine_write_rejections
      SET acknowledged = ${1}, updated_at = ${updatedAt}
      WHERE id = ${rejectionId}
        AND client_id = ${env.deviceId}
        AND acknowledged = ${0}
        AND deleted_at IS NULL
    `);
  },
});

export const FRAMEWORK_MUTATIONS = [acknowledgeWriteRejectionMutation] as const;
