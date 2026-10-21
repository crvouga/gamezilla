import { assertCommitDateIso } from '@pkgs/git-shared-ts/git';

export function formatCommitDate(iso: string, locale: string): string {
  assertCommitDateIso(iso);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
}
