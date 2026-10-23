/**
 * What the API fleet sent out of the simulation. An API instance has one
 * outbound HTTP port, and the simulated providers answer on it; a request to
 * anywhere else has nowhere to go and is answered `404`. Each such request
 * is kept here, so a scenario can say that nothing left for the outside
 * world — a mail service, say — while it ran.
 */

export type HarnessServerEgress = {
  /** URLs the fleet requested that no simulated provider serves. */
  readonly unanswered: () => readonly string[];
  readonly record: (href: string) => void;
};

export function createHarnessServerEgress(): HarnessServerEgress {
  const hrefs: string[] = [];
  return {
    unanswered: () => [...hrefs],
    record: (href) => {
      hrefs.push(href);
    },
  };
}
