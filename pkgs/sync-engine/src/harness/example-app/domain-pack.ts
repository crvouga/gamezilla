import { unsafe } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { HarnessDomainPack } from '../domain-pack';
import { exampleLocalSchema } from './client/local-schema';
import { checkAllClientsConverged } from './converge';
import { createHarnessMembershipChannels } from './membership-channels';
import {
  exampleMutationRegistry,
  exampleQueryRegistry,
} from './shared/registries';
import {
  exampleDefaultEntryChannel,
  exampleTopicMap,
} from './shared/topic-map';
import { NOTES_ALL_TOPIC } from './shared/topics';

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
