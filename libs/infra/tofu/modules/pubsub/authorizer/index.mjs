// @io-wall-ok — AWS IoT custom authorizer entry. Verifies the app's HMAC
// token and returns a session policy. The app's topics use `:`; IoT topic
// ARNs split on `:`, so the wire topic uses `/`.
import { createHmac, timingSafeEqual } from 'node:crypto';

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

function policyDocument(payload, region, accountId, clientId) {
  const subscribe = [];
  const receive = [];
  const publish = [];
  const rules = Array.isArray(payload.acl) ? payload.acl : [];
  for (const rule of rules) {
    if (rule?.permission !== 'allow' || typeof rule.topic !== 'string') continue;
    const wire = iotWireTopic(rule.topic);
    if (!/^[A-Za-z0-9_/-]+$/.test(wire)) continue;
    const filter = topicArn(region, accountId, 'topicfilter', wire);
    const topic = topicArn(region, accountId, 'topic', wire);
    if (rule.action === 'subscribe' || rule.action === 'all') {
      subscribe.push(filter);
      receive.push(topic);
    }
    if (rule.action === 'publish' || rule.action === 'all') publish.push(topic);
  }
  const statements = [
    {
      Effect: 'Allow',
      Action: 'iot:Connect',
      Resource: topicArn(region, accountId, 'client', clientId),
    },
  ];
  if (subscribe.length > 0) {
    statements.push({
      Effect: 'Allow',
      Action: 'iot:Subscribe',
      Resource: subscribe,
    });
  }
  if (receive.length > 0) {
    statements.push({
      Effect: 'Allow',
      Action: 'iot:Receive',
      Resource: receive,
    });
  }
  if (publish.length > 0) {
    statements.push({
      Effect: 'Allow',
      Action: 'iot:Publish',
      Resource: publish,
    });
  }
  return { Version: '2012-10-17', Statement: statements };
}

/**
 * @param {unknown} event
 * @param {{ tokenSecret: string, region: string, accountId: string, nowSec: number }} config
 */
export function authorize(event, config) {
  if (config.tokenSecret.length === 0) return deny();
  if (config.region.length === 0 || config.accountId.length === 0) return deny();
  const mqtt = event?.protocolData?.mqtt ?? {};
  const clientId = String(mqtt.clientId ?? '');
  if (clientId.length === 0 || clientId.includes(':') || clientId.includes('/')) {
    return deny();
  }
  const token = tokenFromPassword(mqtt.password ?? event?.token ?? '');
  const payload = verifyHs256(token, config.tokenSecret, config.nowSec);
  if (payload === null) return deny();
  const remaining = payload.exp - config.nowSec;
  const disconnectAfterInSeconds = Math.min(
    MAX_DISCONNECT_SEC,
    Math.max(1, remaining),
  );
  const refreshAfterInSeconds = Math.max(
    1,
    Math.min(300, disconnectAfterInSeconds - 1),
  );
  return {
    isAuthenticated: true,
    principalId: payload.sub,
    disconnectAfterInSeconds,
    refreshAfterInSeconds,
    policyDocuments: [
      policyDocument(payload, config.region, config.accountId, clientId),
    ],
  };
}

export async function handler(event) {
  return authorize(event, {
    tokenSecret: process.env.TOKEN_SECRET ?? '',
    region: process.env.AWS_REGION ?? '',
    accountId: process.env.AWS_ACCOUNT_ID ?? '',
    nowSec: Math.floor(Date.now() / 1000),
  });
}
