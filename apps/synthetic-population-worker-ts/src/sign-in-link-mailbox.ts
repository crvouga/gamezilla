/**
 * The application realm's side of reading its Synthetic User's mail. The
 * realm holds no control-plane credential: it asks the process that holds
 * the lease, which takes the newest sign-in link from the internal inbox and
 * hands it over. Every link seen here is remembered only to be redacted.
 */
export class SignInLinkMailbox {
  private waiting: ((link: string | null) => void) | null = null;
  private readonly seen: string[] = [];

  /** Ask once and wait for the answer; `null` when no link waits. */
  take(request: () => void): Promise<string | null> {
    this.waiting?.(null);
    return new Promise((resolve) => {
      this.waiting = resolve;
      request();
    });
  }

  deliver(link: string | null): void {
    if (link !== null) this.seen.push(...linkSecrets(link));
    const waiting = this.waiting;
    this.waiting = null;
    waiting?.(link);
  }

  /** Each link, and the one-time values it carries. */
  secrets(): readonly string[] {
    return this.seen;
  }
}

/** A link is secret as a whole and in each value it carries. */
function linkSecrets(link: string): string[] {
  try {
    const values = [...new URL(link).searchParams.values()];
    return [link, ...values.filter((value) => value.length >= 8)];
  } catch {
    return [link];
  }
}
