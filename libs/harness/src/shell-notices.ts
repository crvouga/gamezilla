/**
 * Notices the app shell shows above every screen: a change that was refused
 * and undone, and a device signed out from elsewhere.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { ElementNotFoundError } from '@pkgs/ui-testing-root-shared/element-not-found-error';
import type { ProductHarness } from './harness';
import { visible } from './observations';
import { nodeAt } from './ui-nodes';

async function attributeOf(
  s: ProductHarness,
  actorId: string,
  testId: string,
  name: string
): Promise<string | null> {
  const node = nodeAt(s, actorId, [testId]);
  if (node === null || !(await node.isVisible())) return null;
  try {
    return await node.attribute(name);
  } catch (err) {
    if (err instanceof ElementNotFoundError) return null;
    throw err;
  }
}

/** The refused change the app is telling the person about, if any. */
export async function refusedChangeShown(
  s: ProductHarness,
  actorId: string
): Promise<{ readonly change: string; readonly reason: string } | null> {
  const change = await attributeOf(
    s,
    actorId,
    Handles.refusedChange,
    'data-mutation'
  );
  const reason = await attributeOf(
    s,
    actorId,
    Handles.refusedChange,
    'data-code'
  );
  if (change === null || reason === null) return null;
  return { change, reason };
}

/**
 * What the device says about being signed out from elsewhere: `null` when it
 * says nothing, otherwise whether it adds that unshared changes were not kept.
 */
export async function signedOutNoticeShown(
  s: ProductHarness,
  actorId: string
): Promise<{ readonly unsharedNotKept: boolean } | null> {
  const unshared = await attributeOf(
    s,
    actorId,
    Handles.signedOutNotice,
    'data-unshared'
  );
  if (unshared === null) return null;
  return { unsharedNotKept: unshared === 'not-kept' };
}

/** The signed-out notice offers the way to sign in again. */
export function signInAgainOffered(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  return visible(s, actorId, [Handles.signedOutNoticeSignIn]);
}
