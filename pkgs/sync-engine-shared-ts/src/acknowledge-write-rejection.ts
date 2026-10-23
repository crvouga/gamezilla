import sql from '@pkgs/sql-root-shared-ts/sql';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { defineMutation } from './define-mutation';

type AcknowledgeArgs = { readonly mutationId: string };

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
      const mutationId = (value as Record<string, unknown>)['mutationId'];
      if (typeof mutationId !== 'string' || mutationId.length < 1) {
        return {
          issues: [
            {
              message: 'mutationId must be a non-empty string',
              path: ['mutationId'],
            },
          ],
        };
      }
      return { value: { mutationId } };
    },
  },
};

/**
 * Mark the write rejection of the refused mutation `mutationId` as
 * acknowledged (dismissed) by this install. It matches the refused mutation,
 * not a rejection row's id: the device and the server each mint their own
 * row for one refusal, and the server prunes only the rows this
 * acknowledgement marks when it replays.
 */
export const acknowledgeWriteRejectionMutation = defineMutation({
  name: 'acknowledgeWriteRejection',
  args: acknowledgeArgsSchema,
  async run({ tx, env }, { mutationId }) {
    const updatedAt = env.now().toISOString();
    await tx.run(sql`
      UPDATE sync_engine_write_rejections
      SET acknowledged = ${1}, updated_at = ${updatedAt}
      WHERE mutation_id = ${mutationId}
        AND client_id = ${env.deviceId}
        AND acknowledged = ${0}
        AND deleted_at IS NULL
    `);
  },
});

export const FRAMEWORK_MUTATIONS = [acknowledgeWriteRejectionMutation] as const;
