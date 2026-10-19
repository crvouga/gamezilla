import type { Denial } from '@pkgs/aedes-server/start';

/**
 * A browser's connection can be refused a topic for a reason a new token
 * cures: it still holds the token of the person it was before signing in, or
 * of the room it joined a moment ago. It then reconnects with a fresh token
 * and the topic is granted. A topic that names no person and no room has
 * nothing to wait for: either every token grants it or none does, so a
 * refusal is a defect that AWS IoT would turn into a reconnect loop.
 */
const CURABLE = /^(user|room):/;

export type BrokerVerdict = {
  readonly ok: boolean;
  readonly violations: readonly string[];
};

export function brokerVerdict(denials: readonly Denial[]): BrokerVerdict {
  const never = new Map<string, number>();
  for (const denial of denials) {
    const topic = denial.topic ?? '(connect)';
    if (denial.operation !== 'connect' && CURABLE.test(topic)) continue;
    const key = `${denial.operation} ${topic}`;
    never.set(key, (never.get(key) ?? 0) + 1);
  }
  const violations = [...never].map(
    ([key, count]) =>
      `the broker refused "${key}" ${String(count)} time(s); no new token can grant it, so AWS IoT drops the session and the device reconnects forever. Grant it in the sub that owns it (pubsubTopics).`
  );
  return { ok: violations.length === 0, violations };
}
