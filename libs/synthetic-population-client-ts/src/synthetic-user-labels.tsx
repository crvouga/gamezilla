import { useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import type { JSX } from 'solid-js';

/** An activity a Synthetic User reports, as people say it; unknown ones show as recorded. */
export function useActivityLabel(): (activity: string) => string {
  const { t } = useLingui();
  const labels: Readonly<Record<string, () => string>> = {
    browsing: () => t`Browsing`,
    matchmaking: () => t`Looking for an opponent`,
    playing: () => t`Playing`,
    recovering: () => t`Recovering`,
    offline: () => t`Offline`,
  };
  return (activity) => labels[activity]?.() ?? activity;
}

/**
 * An instant as the reader reads it, in their locale and time zone
 * ("Mar 14, 2026, 11:30 AM"); an unreadable one shows as recorded.
 */
export function useMomentLabel(): (at: string | number) => string {
  const { i18n } = useLingui();
  return (at) => {
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return String(at);
    return new Intl.DateTimeFormat(i18n().locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };
}

/**
 * Whether a Synthetic User is paused, as a tag: a paused one is named in the
 * warning hue, an available one in the success hue.
 */
export function AvailabilityBadge(props: { paused: boolean }): JSX.Element {
  const { t } = useLingui();
  return (
    <Badge
      label={props.paused ? t`Paused` : t`Available`}
      intent={props.paused ? 'warning' : 'success'}
      size="sm"
    />
  );
}
