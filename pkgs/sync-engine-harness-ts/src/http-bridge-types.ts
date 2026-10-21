import type { EndpointId } from '@pkgs/harness-root-shared-ts/network-state';
import type {
  MutationUploadResult,
  MutationUploadRow,
} from '@pkgs/sync-engine-client-ts/mutation-upload-queue';
import type { QueryRequest } from '@pkgs/sync-engine-client-ts/subscription-runtime';
import type { QueryResponse } from '@pkgs/sync-engine-shared-ts/v2';

/** Request body without routing metadata (client fills `replyTo`). */
export type HarnessHttpRequestBody =
  | {
      readonly kind: 'query';
      readonly correlationId: string;
      readonly requests: readonly QueryRequest[];
    }
  | {
      readonly kind: 'mutations';
      readonly correlationId: string;
      readonly mutations: readonly MutationUploadRow[];
    };

export type HarnessHttpRequest = HarnessHttpRequestBody & {
  readonly replyTo: EndpointId;
};

export type HarnessHttpResponse =
  | {
      readonly kind: 'query';
      readonly correlationId: string;
      readonly ok: true;
      readonly body: readonly QueryResponse[];
    }
  | {
      readonly kind: 'mutations';
      readonly correlationId: string;
      readonly ok: true;
      readonly body: MutationUploadResult;
    }
  | {
      readonly kind: 'error';
      readonly correlationId: string;
      readonly ok: false;
      readonly message: string;
      readonly retryAfterMs?: number;
    };

export type HarnessHandleMutationsOpts = {
  /** Throw infra error inside the batch txn after this many mutations (0-based index). */
  readonly failInsideTxnAfter?: number;
  /** Called when the in-txn fault arm is consumed. */
  readonly onArmed?: () => void;
};

export type HarnessHttpServerHandlers = {
  readonly handleQuery: (
    requests: readonly QueryRequest[],
    clientNode?: string
  ) => Promise<readonly QueryResponse[]>;
  readonly handleMutations: (
    mutations: readonly MutationUploadRow[],
    opts?: HarnessHandleMutationsOpts
  ) => Promise<MutationUploadResult>;
};
