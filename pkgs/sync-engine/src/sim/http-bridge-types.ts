import type {
  MutationUploadResult,
  MutationUploadRow,
} from '../client/mutation-upload-queue';
import type { QueryRequest } from '../client/subscription-fetch';
import type { QueryResponse } from '../queries/core/types';
import type { SimEndpointId } from './network';

/** Request body without routing metadata (client fills `replyTo`). */
export type SimHttpRequestBody =
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

export type SimHttpRequest = SimHttpRequestBody & {
  readonly replyTo: SimEndpointId;
};

export type SimHttpResponse =
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
    };

export type SimHttpServerHandlers = {
  readonly handleQuery: (
    requests: readonly QueryRequest[]
  ) => Promise<readonly QueryResponse[]>;
  readonly handleMutations: (
    mutations: readonly MutationUploadRow[]
  ) => Promise<MutationUploadResult>;
};
