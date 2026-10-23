export type Topic = string;

const TOPIC_PATTERN = /^[a-z0-9_-]+(:[A-Za-z0-9_-]+)*$/;
const TOPIC_MAX_LENGTH = 128;

export function assertValidTopic(t: string): asserts t is Topic {
  if (t.length === 0 || t.length > TOPIC_MAX_LENGTH) {
    throw new Error(
      `Invalid topic: length must be 1–${String(TOPIC_MAX_LENGTH)} (got ${String(t.length)})`
    );
  }
  if (t.includes('/') || t.includes('+') || t.includes('#')) {
    throw new Error(
      `Invalid topic: '/', '+', and '#' are not allowed (got ${JSON.stringify(t)})`
    );
  }
  if (!TOPIC_PATTERN.test(t)) {
    throw new Error(
      `Invalid topic: must match ${TOPIC_PATTERN.source} (got ${JSON.stringify(t)})`
    );
  }
}
