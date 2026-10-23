/**
 * Emailed sign-in links, as the host sees them: the auth app mints a link and
 * hands it over; the host decides whom it mails and how the mail leaves.
 */

export type EmailLinkMail = {
  /** The address the link signs in, lowercased. */
  readonly email: string;
  /** What the person opens: the caller's callback URL carrying the token. */
  readonly link: string;
  /** The link's one-time secret, for hosts that render their own link. */
  readonly token: string;
  /** Epoch milliseconds after which the link no longer works. */
  readonly expiresAt: number;
};

/** Where sign-in links go. The host decides which addresses it serves and how mail leaves. */
export type EmailLinkDelivery = {
  /** Addresses this host signs in by link; any other address is silently not mailed. */
  readonly accepts: (email: string) => boolean;
  /** Send one link. A delivery that throws fails the request that asked for it. */
  readonly deliver: (mail: EmailLinkMail) => Promise<void>;
};

const ADDRESS_MAX_LENGTH = 254;
const ADDRESS_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The one spelling an address is stored and matched under, or `null` when malformed. */
export function normalizeEmailAddress(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length > ADDRESS_MAX_LENGTH || !ADDRESS_SHAPE.test(email)) {
    return null;
  }
  return email;
}
