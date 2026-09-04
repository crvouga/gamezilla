import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { SimDomainPack } from '../../../sim/domain-pack';
import { acmeLocalSchema } from './client/local-schema';
import { checkAllClientsConverged } from './converge';
import { createSimMembershipChannels } from './membership-channels';
import { acmeMutationRegistry, acmeQueryRegistry } from './shared/registries';
import { acmeDefaultEntryChannel, acmeTopicMap } from './shared/topic-map';
import { NOTES_ALL_TOPIC } from './shared/topics';

async function tamperDomainRow(db: SqlClient): Promise<void> {
  await db.run(
    unsafe(
      `UPDATE notes SET body = 'sim-tampered' WHERE deleted_at IS NULL LIMIT 1`
    )
  );
}

export const acmeDomainPack: SimDomainPack = {
  localSchema: acmeLocalSchema,
  mutationRegistry: acmeMutationRegistry,
  queryRegistry: acmeQueryRegistry,
  sessionQuery: { name: 'notesAll', params: {} },
  checkAllConverged: checkAllClientsConverged,
  createPushChannels: createSimMembershipChannels,
  topicMap: acmeTopicMap,
  defaultEntryChannel: acmeDefaultEntryChannel,
  tamperDomainRow,
  fuzzDropTopic: NOTES_ALL_TOPIC,
};
