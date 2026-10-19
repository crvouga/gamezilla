import type { Denial } from '@pkgs/aedes-server/start';

/**
 * A browser's connection can be refused a topic for a reason a new token
 * cures: it still holds the token of the person it was before signing in, or
 * of the room it joined a moment ago. It then reconnects with a fresh token
 * and the topic is granted, and the broker marks the refusal cured. A
 * refusal no new token cured is a defect AWS IoT turns into a reconnect loop:
 * either it names no person and no room (every token grants it or none
 * does), or the device asks for it again and again (another person's topic,
 * which no token of this person ever grants). One refusal still standing when
 * the run ends may only be the last stale token, so a person's or room's topic
 * fails the run from the second.
 */
const CURABLE = /^(user|room):/;
const REFUSALS_BEFORE_A_LOOP = 2;

export type BrokerVerdict = {
  readonly ok: boolean;
  readonly violations: readonly string[];
};

export function brokerVerdict(denials: readonly Denial[]): BrokerVerdict {
  const never = new Map<string, number>();
  const standing = new Map<string, number>();
  for (const denial of denials) {
    const topic = denial.topic ?? '(connect)';
    if (denial.operation !== 'connect' && CURABLE.test(topic)) {
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
      .filter(([, count]) => count >= REFUSALS_BEFORE_A_LOOP)
      .map(
        ([key, count]) =>
          `the broker refused "${key}" ${String(count)} time(s) and no new token ever granted it; the device asks again on every connect and AWS IoT drops its session each time. Do not subscribe to a topic this person is never granted.`
      ),
  ];
  return { ok: violations.length === 0, violations };
}
