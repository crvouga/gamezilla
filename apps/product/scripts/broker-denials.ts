import type { Denial } from '@pkgs/aedes-server/start';

/**
 * A browser's connection can be refused a topic for a reason a new token
 * cures: it still holds the token of the person it was before signing in, or
 * of the room it joined a moment ago. It then reconnects with a fresh token
 * and the topic is granted, and the broker marks the refusal cured. A room may
 * stay refused until the run ends (the membership is still uploading), so a
 * room is never held against the run. A person's topic is different: only its
 * owner is ever granted it, so a device that asks for one again and again,
 * with a new token each time, is subscribing to someone else's, which AWS IoT
 * turns into a reconnect loop. A topic that names no person and no room (every
 * token grants it or none does) fails the run at the first refusal.
 */
const ROOM = /^room:/;
const PERSON = /^user:/;
const PERSON_REFUSALS_BEFORE_A_LOOP = 3;

export type BrokerVerdict = {
  readonly ok: boolean;
  readonly violations: readonly string[];
};

export function brokerVerdict(denials: readonly Denial[]): BrokerVerdict {
  const never = new Map<string, number>();
  const standing = new Map<string, number>();
  for (const denial of denials) {
    const topic = denial.topic ?? '(connect)';
    if (denial.operation !== 'connect' && ROOM.test(topic)) continue;
    if (denial.operation !== 'connect' && PERSON.test(topic)) {
      if (denial.cured) continue;
      const key = `${denial.operation} ${topic} by ${denial.clientId}`;
      standing.set(key, (standing.get(key) ?? 0) + 1);
      continue;
    }
    const key = `${denial.operation} ${topic}`;
    never.set(key, (never.get(key) ?? 0) + 1);
  }
  const violations = [
    ...[...never].map(
      ([key, count]) =>
        `the broker refused "${key}" ${String(count)} time(s); no new token can grant it, so AWS IoT drops the session and the device reconnects forever. Grant it in the sub that owns it (pubsubTopics).`
    ),
    ...[...standing]
      .filter(([, count]) => count >= PERSON_REFUSALS_BEFORE_A_LOOP)
      .map(
        ([key, count]) =>
          `the broker refused "${key}" ${String(count)} time(s) and no new token ever granted it; the device asks again on every connect and AWS IoT drops its session each time. Do not subscribe to a topic this person is never granted.`
      ),
  ];
  return { ok: violations.length === 0, violations };
}
