import type { ModerationAction, StaticModerationCheck } from './check';
import { predicateCheck } from './check';

const SCHEME = /\b[a-z][a-z0-9+.-]*:\/\//i;
const WWW = /\bwww\s*\./i;
/** `name.tld` / `name dot tld` for common and abused top-level domains. */
const DOMAIN =
  /\b[a-z0-9-]+\s*(?:\.|\(dot\)|\[dot\])\s*(?:com|net|org|io|gg|xyz|ru|ly|me|co|tk|app|dev|link|site|online|shop|top|info|biz|tv|cc)\b/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;

/** True when `text` carries a link, domain or email address. */
export function containsLink(text: string): boolean {
  return (
    SCHEME.test(text) || WWW.test(text) || DOMAIN.test(text) || EMAIL.test(text)
  );
}

/** Refuses links, bare domains and email addresses (spam, phishing). */
export function linkCheck(options: {
  readonly id: string;
  readonly version: number;
  readonly action?: ModerationAction | undefined;
}): StaticModerationCheck {
  return predicateCheck({ ...options, code: 'link', matches: containsLink });
}
