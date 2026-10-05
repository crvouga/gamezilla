import type { PubSub, PubSubStatus } from '@pkgs/pubsub-root-shared/interface';
import { encodePayload } from '@pkgs/pubsub-root-shared/payload';
import { PubSubClosedError } from '@pkgs/pubsub-root-shared/pubsub-closed-error';
import { PubSubNotSupportedError } from '@pkgs/pubsub-root-shared/pubsub-not-supported-error';
import { PubSubPublishError } from '@pkgs/pubsub-root-shared/pubsub-publish-error';
import type { Topic } from '@pkgs/pubsub-root-shared/topic';
import { assertValidTopic } from '@pkgs/pubsub-root-shared/topic';

export type EmqxHttpPubSubOptions = {
  apiBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  fetchImpl?: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>;
};

function basicAuthHeader(apiKey: string, apiSecret: string): string {
  const token = btoa(`${apiKey}:${apiSecret}`);
  return `Basic ${token}`;
}

/**
 * Publish-only PubSub via EMQX HTTP API (`POST /api/v5/publish`).
 * Workers-safe: uses injected or global `fetch` only.
 */
export function createEmqxHttpPubSub(options: EmqxHttpPubSubOptions): PubSub {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.apiBaseUrl.replace(/\/$/, '');
  const auth = basicAuthHeader(options.apiKey, options.apiSecret);
  let closed = false;

  return {
    async publish(topic: Topic, data: unknown): Promise<void> {
      if (closed) throw new PubSubClosedError();
      assertValidTopic(topic);
      const payload = encodePayload(data);
      const res = await fetchImpl(`${base}/api/v5/publish`, {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          topic,
          payload,
          qos: 1,
          retain: false,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new PubSubPublishError(
          `EMQX publish failed: ${String(res.status)}`,
          res.status,
          body
        );
      }
    },

    subscribe(_topic: Topic, _handler: (data: unknown) => void): () => void {
      throw new PubSubNotSupportedError(
        'createEmqxHttpPubSub does not support subscribe'
      );
    },

    status(): PubSubStatus {
      return closed ? 'down' : 'connected';
    },

    onStatus(_cb: (s: PubSubStatus) => void): () => void {
      return () => undefined;
    },

    close(): void {
      closed = true;
    },
  };
}
