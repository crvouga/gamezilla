import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import type {
  PubSub,
  PubSubStatus,
} from '@pkgs/pubsub-root-shared-ts/interface';
import { encodePayload } from '@pkgs/pubsub-root-shared-ts/payload';
import { PubSubClosedError } from '@pkgs/pubsub-root-shared-ts/pubsub-closed-error';
import { PubSubNotSupportedError } from '@pkgs/pubsub-root-shared-ts/pubsub-not-supported-error';
import { PubSubPublishError } from '@pkgs/pubsub-root-shared-ts/pubsub-publish-error';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import { assertValidTopic } from '@pkgs/pubsub-root-shared-ts/topic';

export type EmqxHttpPubSubOptions = {
  apiBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  http: HttpClient;
};

function basicAuthHeader(apiKey: string, apiSecret: string): string {
  const token = btoa(`${apiKey}:${apiSecret}`);
  return `Basic ${token}`;
}

/**
 * Publish-only PubSub via EMQX HTTP API (`POST /api/v5/publish`).
 * HTTP is injected by the composition root.
 */
export function createEmqxHttpPubSub(options: EmqxHttpPubSubOptions): PubSub {
  const base = options.apiBaseUrl.replace(/\/$/, '');
  const auth = basicAuthHeader(options.apiKey, options.apiSecret);
  let closed = false;

  return {
    async publish(topic: Topic, data: unknown): Promise<void> {
      if (closed) throw new PubSubClosedError();
      assertValidTopic(topic);
      const payload = encodePayload(data);
      const res = await options.http.fetch(`${base}/api/v5/publish`, {
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
      await res.body?.cancel();
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
