/**
 * The one case where the URL, not the markup, has the last word: a step URL
 * whose `request_id` is not the screen the server rendered. Everything else
 * starts from the boot state, so there is no fetch and no flash.
 */

import {
  type IdpScreenOutcome,
  type IdpScreenState,
  requestIdOf,
} from '../../src/shared/screen-state';
import type { IdpRpcClient } from './rpc';

export async function syncScreenFromUrl(args: {
  readonly urlRequestId: string | null;
  readonly current: IdpScreenState;
  readonly client: IdpRpcClient;
  readonly apply: (outcome: IdpScreenOutcome) => void;
  readonly setBusy: (busy: boolean) => void;
}): Promise<void> {
  if (
    args.urlRequestId === null ||
    args.urlRequestId === requestIdOf(args.current)
  ) {
    return;
  }
  args.setBusy(true);
  try {
    const response = await args.client.rpc.screen.$get({
      query: { request_id: args.urlRequestId },
    });
    args.apply((await response.json()) as IdpScreenOutcome);
  } finally {
    args.setBusy(false);
  }
}
