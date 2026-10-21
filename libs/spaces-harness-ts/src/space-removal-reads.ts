import type { ProductHarness } from '@libs/harness-ts/harness';
import { nodeText, visible } from '@libs/harness-ts/observations';
import { Handles } from '@libs/test-ids-shared-ts/handles';

export async function removalShown(
  s: ProductHarness,
  actor: string,
  personName: string
): Promise<boolean> {
  const text = await nodeText(s, actor, [Handles.spaceRemoveSuccess]);
  return text?.includes(personName) === true;
}

export function removePersonOffered(
  s: ProductHarness,
  actor: string,
  memberId: string
): Promise<boolean> {
  return visible(s, actor, [Handles.spaceRemovePerson(memberId)]);
}
