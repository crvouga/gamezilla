import type { ProductHarness } from '@libs/harness/harness';
import { nodeText, visible } from '@libs/harness/observations';
import { Handles } from '@libs/test-ids-shared/handles';

export function addPersonOffered(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  return visible(s, actor, [Handles.spaceAddTrigger]);
}

export function knownPersonOffered(
  s: ProductHarness,
  actor: string,
  personId: string
): Promise<boolean> {
  return visible(s, actor, [Handles.spaceAddPerson(personId)]);
}

export async function additionShown(
  s: ProductHarness,
  actor: string,
  name: string
): Promise<boolean> {
  return (
    (await nodeText(s, actor, [Handles.spaceAddSuccess]))?.includes(name) ===
    true
  );
}
