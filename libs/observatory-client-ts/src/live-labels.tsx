import type {
  LiveActivity,
  LiveKind,
  LivePlace,
} from '@libs/observatory-shared-ts/live-session';
import { useLingui } from '@lingui/solid/macro';

/** What a row of those online now says about one of them. */
export type LiveDescription = {
  readonly kind: LiveKind;
  readonly place: LivePlace;
  readonly activity: LiveActivity;
  readonly game: string | null;
};

/** The words for someone online now: who they are and what they are doing. */
export function useLiveLabels() {
  const { t } = useLingui();
  const places: Record<LivePlace, () => string> = {
    spaces: () => t`Spaces`,
    space: () => t`In a space`,
    'people-search': () => t`People search`,
    'sign-in-methods': () => t`Sign-in methods`,
    settings: () => t`Settings`,
    profile: () => t`Profile`,
    notifications: () => t`Notifications`,
    observatory: () => t`User Observatory`,
    other: () => t`Elsewhere in the app`,
  };
  const place = (value: LivePlace) => places[value]();
  const kind = (value: LiveKind) =>
    value === 'synthetic' ? t`Synthetic User` : t`Person`;
  const activity = (value: LiveDescription) => {
    const game = value.game;
    if (value.activity === 'looking')
      return game === null
        ? t`Looking for a multiplayer opponent`
        : t`Looking for a multiplayer opponent for ${game}`;
    if (value.activity === 'playing')
      return game === null ? t`Playing a game` : t`Playing ${game}`;
    return t`Browsing`;
  };
  return { place, kind, activity };
}
