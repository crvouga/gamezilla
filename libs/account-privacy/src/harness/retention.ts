import { scenarioAction } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { sql } from '@pkgs/sql';
import { LegalPreservation } from '../public/legal-preservation';

function preservation(s: ProductHarness) {
  return new LegalPreservation(s.harness.serverSql.sqlClient, {
    clock: s.harness.clock,
    createId: s.session.ports.createId,
    contributions: s.harness.composition.app.accountPrivacy,
    rooms: s.harness.roomNode.services,
  });
}

export const preserveProfileForLegalObligation = scenarioAction({
  name: 'preserveProfileForLegalObligation',
  act: async (s, accountId: string) => {
    await preservation(s).preserve({
      accountId,
      category: 'profile',
      purpose: 'Evidence for the open account dispute',
      endCondition: 'The account dispute is finally resolved',
    });
  },
});

export const releaseLegalObligation = scenarioAction({
  name: 'releaseLegalObligation',
  act: async (s, accountId: string) => {
    await preservation(s).release(accountId);
  },
});

export function retainedForPurpose(
  s: ProductHarness,
  accountId: string,
  use: 'legal preservation' | 'ordinary account use' | 'product promotion'
) {
  return preservation(s).review(accountId, use);
}

/** Erasure evidence reads the actual ordinary content, including withdrawn rows. */
export async function ordinaryProfileData(
  s: ProductHarness,
  accountId: string
) {
  return s.harness.serverSql.sqlClient.query(
    sql<{
      username: string;
      avatar_config: string | null;
    }>`SELECT username, avatar_config FROM profile WHERE id = ${accountId}`
  );
}
