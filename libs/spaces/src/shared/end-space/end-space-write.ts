import { ok } from '@pkgs/write/shared/write-result';
import { defineWrite } from '@pkgs/write/shared/define-write';
import type { WriteResult } from '@pkgs/write/shared/write-result';

import {
  asObjectRecord,
  authorizeSpaceHost,
  requireNonEmptyString,
} from '../space-write-helpers';
import { executeEndSpace, type EndSpaceInput } from './execute-end-space';

export type { EndSpaceInput };

function parseEndSpaceInput(raw: unknown): WriteResult<EndSpaceInput> {
  const record = asObjectRecord(raw, 'end space input');
  if (!record.ok) return record;
  const spaceId = requireNonEmptyString(record.value['spaceId'], 'spaceId');
  if (!spaceId.ok) return spaceId;
  return ok({ spaceId: spaceId.value });
}

export const endSpaceWrite = defineWrite<EndSpaceInput, void>({
  name: 'spaces.end',
  parseInput: parseEndSpaceInput,
  authorize: async (ctx, input, db) =>
    authorizeSpaceHost(
      ctx,
      db,
      input.spaceId,
      'Only the host can end this space'
    ),
  execute: executeEndSpace,
});
