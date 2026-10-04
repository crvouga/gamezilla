import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { unsafe } from '@pkgs/sql-shared/sql';
import { checkAllClientsConverged } from './converge';
import type { HarnessDomainPack } from './harness-domain-pack';
import { exampleLocalSchema } from './local-schema';
import { createHarnessMembershipChannels } from './membership-channels';
import { exampleMutationRegistry, exampleQueryRegistry } from './registries';
import { exampleDefaultEntryChannel, exampleTopicMap } from './topic-map';
import { NOTES_ALL_TOPIC } from './topics';

async function tamperDomainRow(db: SqlClient): Promise<void> {
  await db.run(
    unsafe(
      `UPDATE notes SET body = 'harness-tampered' WHERE deleted_at IS NULL LIMIT 1`
    )
  );
}

export const exampleDomainPack: HarnessDomainPack = {
  localSchema: exampleLocalSchema,
  mutationRegistry: exampleMutationRegistry,
  queryRegistry: exampleQueryRegistry,
  sessionQuery: { name: 'notesAll', params: {} },
  checkAllInSync: checkAllClientsConverged,
  createPushChannels: createHarnessMembershipChannels,
  topicMap: exampleTopicMap,
  defaultEntryChannel: exampleDefaultEntryChannel,
  tamperDomainRow,
  fuzzDropTopic: NOTES_ALL_TOPIC,
};
