import type { SimDomainPack } from '../../../sim/domain-pack';
import { acmeLocalSchema } from './client/local-schema';
import { checkAllClientsConverged } from './converge';
import { createSimMembershipChannels } from './membership-channels';
import { acmeMutationRegistry, acmeQueryRegistry } from './shared/registries';
import { acmeDefaultEntryChannel, acmeTopicMap } from './shared/topic-map';

export const acmeDomainPack: SimDomainPack = {
  localSchema: acmeLocalSchema,
  mutationRegistry: acmeMutationRegistry,
  queryRegistry: acmeQueryRegistry,
  sessionQuery: { name: 'notesAll', params: {} },
  checkAllConverged: checkAllClientsConverged,
  createPushChannels: createSimMembershipChannels,
  topicMap: acmeTopicMap,
  defaultEntryChannel: acmeDefaultEntryChannel,
};
