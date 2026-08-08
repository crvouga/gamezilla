import type { SimDomainPack } from '../../sim/domain-pack';
import { notesLocalSchema } from './client/local-schema';
import { checkAllClientsConverged } from './converge';
import { createSimMembershipChannels } from './membership-channels';
import { notesMutationRegistry, notesQueryRegistry } from './shared/registries';
import { notesDefaultEntryChannel, notesTopicMap } from './shared/topic-map';

export const notesDomainPack: SimDomainPack = {
  localSchema: notesLocalSchema,
  mutationRegistry: notesMutationRegistry,
  queryRegistry: notesQueryRegistry,
  sessionQuery: { name: 'notesWorld', params: {} },
  checkAllConverged: checkAllClientsConverged,
  createPushChannels: createSimMembershipChannels,
  topicMap: notesTopicMap,
  defaultEntryChannel: notesDefaultEntryChannel,
};
