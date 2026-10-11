/**
 * An in-memory inbox for tests and local stacks: it accepts sign-in links
 * the way a mail service would and keeps them to be read back. Nothing is
 * ever sent anywhere.
 */

import type { EmailLinkDelivery, EmailLinkMail } from './email-link-delivery';
import { normalizeEmailAddress } from './email-link-delivery';

export type EmailInboxEmulator = {
  /** Hand this to the auth app as its `emailLinks`. */
  readonly delivery: EmailLinkDelivery;
  /** The newest link mailed to `email`, or `null` when it was never mailed. */
  latest(email: string): EmailLinkMail | null;
  /** Every link mailed, oldest first. */
  all(): readonly EmailLinkMail[];
};

export function createEmailInboxEmulator(options?: {
  /** Addresses the inbox serves (default: all of them). */
  readonly accepts?: (email: string) => boolean;
}): EmailInboxEmulator {
  const mails: EmailLinkMail[] = [];
  const accepts = options?.accepts ?? (() => true);
  return {
    delivery: {
      accepts,
      deliver: async (mail) => {
        mails.push(mail);
      },
    },
    latest(email) {
      const address = normalizeEmailAddress(email);
      return mails.findLast((mail) => mail.email === address) ?? null;
    },
    all: () => [...mails],
  };
}
