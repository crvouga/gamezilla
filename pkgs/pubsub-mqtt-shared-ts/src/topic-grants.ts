/**
 * Which wanted topics a session may subscribe to, given the topics its
 * credentials grant.
 *
 * A broker that refuses one subscription can end the whole session (AWS IoT
 * disconnects on an unauthorized subscribe), so asking for a topic the
 * credentials do not grant takes every other topic down with it, and
 * reconnecting with the same answer does it again forever. Instead:
 *
 * - a topic the credentials grant is subscribed;
 * - a topic wanted when the credentials were fetched, and not granted by
 *   them, is refused: the fresh answer was no, so it is left out and the
 *   session stays up;
 * - a topic wanted only after the credentials were fetched, and not granted,
 *   asks for fresh credentials once (a newly joined room arrives that way).
 *
 * Interest dropped and taken up again earns one more fresh answer.
 * Credentials that name no topics grant everything (a broker without topic
 * grants), as before.
 */
import type { Topic } from '@pkgs/pubsub-root-shared-ts/topic';

/** What to do with a topic wanted while a session is up. */
export type TopicDecision = 'subscribe' | 'withhold' | 'reauthorize';

export class TopicGrants {
  private granted: ReadonlySet<Topic> | null = null;
  private readonly refused = new Set<Topic>();

  /**
   * Fresh credentials arrived. `wantedAtFetch` is what was wanted when they
   * were asked for; each of those they do not grant is refused.
   */
  afterAuthorization(
    granted: readonly Topic[] | undefined,
    wantedAtFetch: readonly Topic[]
  ): void {
    this.granted = granted === undefined ? null : new Set(granted);
    this.refused.clear();
    for (const topic of wantedAtFetch) {
      if (!this.isGranted(topic)) this.refused.add(topic);
    }
  }

  isGranted(topic: Topic): boolean {
    return this.granted === null || this.granted.has(topic);
  }

  /** Topics wanted now and granted, to subscribe on connect. */
  subscribable(wanted: readonly Topic[]): Topic[] {
    return wanted.filter((topic) => this.isGranted(topic));
  }

  /** Topics wanted now that the current credentials were never asked about. */
  unasked(wanted: readonly Topic[]): Topic[] {
    return wanted.filter(
      (topic) => !this.isGranted(topic) && !this.refused.has(topic)
    );
  }

  /** Topics wanted now that fresh credentials did not grant. */
  withheld(wanted: readonly Topic[]): Topic[] {
    return wanted.filter((topic) => this.refused.has(topic));
  }

  decide(topic: Topic): TopicDecision {
    if (this.isGranted(topic)) return 'subscribe';
    return this.refused.has(topic) ? 'withhold' : 'reauthorize';
  }

  /** Nothing wants `topic` any more; wanting it again asks afresh. */
  forget(topic: Topic): void {
    this.refused.delete(topic);
  }
}
