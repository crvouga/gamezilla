// @io-wall-ok — AWS IoT custom authorizer entry. Verifies the app's HMAC
// token and returns a session policy. The app's topics use `:`; IoT topic
// ARNs split on `:`, so the wire topic uses `/`.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const MAX_DISCONNECT_SEC = 86400;

export function iotWireTopic(topic) {
  return topic.replaceAll(':', '/');
}

function b64url(input) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/') + pad;
  return Buffer.from(normalized, 'base64');
}

function tokenFromPassword(password) {
  const raw = String(password ?? '');
  if (raw.split('.').length === 3) return raw;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    if (decoded.split('.').length === 3) return decoded;
  } catch {
    return raw;
  }
  return raw;
}

export function verifyHs256(token, secret, nowSec) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  if (headerPart === undefined || payloadPart === undefined) return null;
  if (signaturePart === undefined) return null;
  let header;
  let payload;
  try {
    header = JSON.parse(b64url(headerPart).toString('utf8'));
    payload = JSON.parse(b64url(payloadPart).toString('utf8'));
  } catch {
    return null;
  }
  if (header.alg !== 'HS256') return null;
  const expected = hmacSha256(secret, `${headerPart}.${payloadPart}`);
  const got = b64url(signaturePart);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return null;
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
  return payload;
}

function hmacSha256(secret, message) {
  return createHmac('sha256', secret).update(message).digest();
}

function deny() {
  return { isAuthenticated: false };
}

function topicArn(region, accountId, kind, topic) {
  return `arn:aws:iot:${region}:${accountId}:${kind}/${topic}`;
}

/**
 * AWS IoT accepts at most this many session policy documents, each at most
 * this many characters (whitespace excluded). A connection whose policy
 * breaks either is terminated, so grants are packed into documents instead
 * of one that grows with every room a person is in.
 */
export const MAX_POLICY_DOCUMENTS = 10;
export const MAX_POLICY_CHARACTERS = 2048;

function renderDocument(draft) {
  const statements = [];
  if (draft.connect !== null) {
    statements.push({
      Effect: 'Allow',
      Action: 'iot:Connect',
      Resource: draft.connect,
    });
  }
  for (const [action, resource] of [
    ['iot:Subscribe', draft.subscribe],
    ['iot:Receive', draft.receive],
    ['iot:Publish', draft.publish],
  ]) {
    if (resource.length > 0) {
      statements.push({ Effect: 'Allow', Action: action, Resource: resource });
    }
  }
  return { Version: '2012-10-17', Statement: statements };
}

function documentSize(draft) {
  return JSON.stringify(renderDocument(draft)).replace(/\s/g, '').length;
}

function emptyDraft(connect) {
  return { connect, subscribe: [], receive: [], publish: [] };
}

function topicGrants(payload, region, accountId) {
  const grants = new Map();
  const rules = Array.isArray(payload.acl) ? payload.acl : [];
  for (const rule of rules) {
    if (rule?.permission !== 'allow' || typeof rule.topic !== 'string')
      continue;
    const wire = iotWireTopic(rule.topic);
    if (!/^[A-Za-z0-9_/-]+$/.test(wire)) continue;
    const grant = grants.get(wire) ?? { subscribe: false, publish: false };
    if (rule.action === 'subscribe' || rule.action === 'all')
      grant.subscribe = true;
    if (rule.action === 'publish' || rule.action === 'all')
      grant.publish = true;
    grants.set(wire, grant);
  }
  return [...grants].map(([wire, grant]) => ({
    filter: grant.subscribe
      ? topicArn(region, accountId, 'topicfilter', wire)
      : null,
    topic: topicArn(region, accountId, 'topic', wire),
    subscribe: grant.subscribe,
    publish: grant.publish,
  }));
}

/**
 * Every grant in token order, packed greedily. The first topics (the
 * actor's own, then the runtime config) are never the ones dropped; when the
 * documents run out, the rooms last in order lose their live updates and
 * are reported in `dropped`.
 */
function policyDocuments(payload, region, accountId, clientId) {
  const documents = [];
  let draft = emptyDraft(topicArn(region, accountId, 'client', clientId));
  let dropped = 0;
  for (const grant of topicGrants(payload, region, accountId)) {
    const add = (target) => {
      if (grant.subscribe) {
        target.subscribe.push(grant.filter);
        target.receive.push(grant.topic);
      }
      if (grant.publish) target.publish.push(grant.topic);
    };
    const grown = structuredClone(draft);
    add(grown);
    if (documentSize(grown) <= MAX_POLICY_CHARACTERS) {
      draft = grown;
      continue;
    }
    if (documents.length + 1 >= MAX_POLICY_DOCUMENTS) {
      dropped += 1;
      continue;
    }
    documents.push(renderDocument(draft));
    draft = emptyDraft(null);
    add(draft);
  }
  documents.push(renderDocument(draft));
  return { documents, dropped };
}

/**
 * @param {unknown} event
 * @param {{ tokenSecret: string, region: string, accountId: string, nowSec: number, warn?: (message: string) => void }} config
 */
export function authorize(event, config) {
  if (config.tokenSecret.length === 0) return deny();
  if (config.region.length === 0 || config.accountId.length === 0)
    return deny();
  const mqtt = event?.protocolData?.mqtt ?? {};
  const clientId = String(mqtt.clientId ?? '');
  if (
    clientId.length === 0 ||
    clientId.includes(':') ||
    clientId.includes('/')
  ) {
    return deny();
  }
  const token = tokenFromPassword(mqtt.password ?? event?.token ?? '');
  const payload = verifyHs256(token, config.tokenSecret, config.nowSec);
  if (payload === null) return deny();
  const remaining = payload.exp - config.nowSec;
  // IoT requires both lifetimes to be at least 300 seconds. Do not extend
  // authorization beyond the token's expiry just to satisfy that minimum.
  if (remaining < 300) return deny();
  const disconnectAfterInSeconds = Math.min(
    MAX_DISCONNECT_SEC,
    Math.floor(remaining)
  );
  const { documents, dropped } = policyDocuments(
    payload,
    config.region,
    config.accountId,
    clientId
  );
  if (dropped > 0) config.warn?.(`policy full: ${dropped} topics not granted`);
  return {
    isAuthenticated: true,
    // IoT accepts only alphanumeric principals (UUID hyphens are invalid).
    // Hash rather than strip punctuation so distinct subjects stay distinct.
    principalId: createHash('sha256').update(payload.sub).digest('hex'),
    disconnectAfterInSeconds,
    refreshAfterInSeconds: 300,
    policyDocuments: documents,
  };
}

export async function handler(event) {
  return authorize(event, {
    tokenSecret: process.env.TOKEN_SECRET ?? '',
    region: process.env.AWS_REGION ?? '',
    accountId: process.env.AWS_ACCOUNT_ID ?? '',
    nowSec: Math.floor(Date.now() / 1000),
    warn: console.warn,
  });
}
