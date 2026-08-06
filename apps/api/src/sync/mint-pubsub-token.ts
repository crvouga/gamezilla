import { SignJWT } from 'jose';
import type { Topic } from '@pkgs/pubsub/interface';
import {
  clientConfigTopic,
  roomTopic,
  userTopic,
} from '@libs/db/shared/sync-topics';

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

export function pubsubTopicsForActor(
  actorId: string,
  spaceIds: readonly string[]
): Topic[] {
  return [
    userTopic(actorId),
    clientConfigTopic(),
    ...spaceIds.map((id) => roomTopic(id)),
  ];
}

export async function mintPubSubToken(args: {
  readonly secret: string;
  readonly actorId: string;
  readonly spaceIds: readonly string[];
  readonly now?: () => Date;
}): Promise<{ readonly token: string; readonly expiresAt: number }> {
  const now = args.now?.() ?? new Date();
  const expiresAt = Math.floor(now.getTime() / 1000) + TOKEN_TTL_SEC;
  const topics = pubsubTopicsForActor(args.actorId, args.spaceIds);
  const acl = buildSubscribeAcl(topics);
  const token = await new SignJWT({
    acl,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(args.actorId)
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(args.secret));
  return { token, expiresAt };
}
