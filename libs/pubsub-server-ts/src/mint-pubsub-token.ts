import { clientConfigTopic } from '@libs/app-config-shared-ts/sync-topics';
import { userTopic } from '@libs/sub-shared-ts/sync';
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';
import { SignJWT } from 'jose';

const TOKEN_TTL_SEC = 15 * 60;

export type EmqxAclRule = {
  readonly permission: 'allow' | 'deny';
  readonly action: 'publish' | 'subscribe' | 'all';
  readonly topic: string;
};

/** Subscribe + publish on the same actor topic set (mutation fanout). */
export function buildSubscribeAcl(topics: readonly Topic[]): EmqxAclRule[] {
  const rules: EmqxAclRule[] = [];
  for (const topic of topics) {
    rules.push({
      permission: 'allow',
      action: 'subscribe',
      topic,
    });
    rules.push({
      permission: 'allow',
      action: 'publish',
      topic,
    });
  }
  return rules;
}

/**
 * What every actor may subscribe to whatever the app was composed from: their
 * own rows and the runtime config. Anything else — a room, a channel — is a
 * sub's to grant, and arrives as `featureTopics`.
 */
export function pubsubTopicsForActor(
  actorId: string,
  featureTopics: readonly Topic[]
): Topic[] {
  return [userTopic(actorId), clientConfigTopic(), ...featureTopics];
}

export async function mintPubSubToken(args: {
  readonly secret: string;
  readonly actorId: string;
  /** Topics the composed subs granted this actor. */
  readonly featureTopics: readonly Topic[];
  /** Epoch ms — callers pass env.clock.now or a harness clock. */
  readonly now: () => number;
}): Promise<{
  readonly token: string;
  readonly expiresAt: number;
  /** Every topic the token grants, so a client asks for nothing else. */
  readonly topics: readonly Topic[];
}> {
  const nowMs = args.now();
  const issuedAt = Math.floor(nowMs / 1000);
  const expiresAt = issuedAt + TOKEN_TTL_SEC;
  const topics = pubsubTopicsForActor(args.actorId, args.featureTopics);
  const acl = buildSubscribeAcl(topics);
  const token = await new SignJWT({
    acl,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(args.actorId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(args.secret));
  return { token, expiresAt, topics };
}
