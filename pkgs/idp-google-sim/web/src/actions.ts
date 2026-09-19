/** The browser app's implementation of {@link ScreenActions}, over `/rpc/*`. */

import type {
  IdpScreenOutcome,
  ScreenActions,
} from '../../src/shared/screen-state';
import type { IdpRpcClient } from './rpc';

type Args = {
  readonly client: IdpRpcClient;
  /** The parked request the current screen belongs to. */
  readonly requestId: () => string;
  readonly apply: (outcome: IdpScreenOutcome) => void;
  readonly setBusy: (busy: boolean) => void;
  /** A real document navigation — the host decides what loading one means. */
  readonly openDocument: (url: string) => void;
};

type JsonResponse = { json(): Promise<unknown> };

/** Every step is "one call, one outcome", with the submit locked meanwhile. */
async function run(
  args: Args,
  call: () => Promise<JsonResponse>
): Promise<void> {
  args.setBusy(true);
  try {
    const response = await call();
    args.apply((await response.json()) as IdpScreenOutcome);
  } finally {
    args.setBusy(false);
  }
}

export function createScreenActions(args: Args): ScreenActions {
  const id = args.requestId;
  const post = (call: () => Promise<JsonResponse>): Promise<void> =>
    run(args, call);
  return {
    submitIdentifier: (email) =>
      post(() =>
        args.client.rpc.identifier.$post({
          json: { request_id: id(), email },
        })
      ),
    submitPassword: (password) =>
      post(() =>
        args.client.rpc.password.$post({
          json: { request_id: id(), password },
        })
      ),
    submitChoose: (sub) =>
      post(() =>
        args.client.rpc.choose.$post({ json: { request_id: id(), sub } })
      ),
    submitCreateAccount: (name, email) =>
      post(() =>
        args.client.rpc['create-account'].$post({
          json: { request_id: id(), name, email },
        })
      ),
    submitConsent: (decision) =>
      post(() =>
        args.client.rpc.consent.$post({
          json: { request_id: id(), decision },
        })
      ),
    openDocument: args.openDocument,
  };
}
