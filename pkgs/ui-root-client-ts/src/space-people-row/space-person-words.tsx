import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type {
  SpacePerson,
  SpacePersonData,
  SpacePersonStatus,
} from '../space-types';

/** How one entry of the people row is said: its name, role, status and data. */
export type SpacePersonWords = {
  /** "You" for the viewer, the name otherwise. */
  name: (person: SpacePerson) => string;
  role: (person: SpacePerson) => string;
  status: (status: SpacePersonStatus) => string;
  /** Role, status, data and mute in words, joined: the badges spelled out. */
  summary: (
    person: SpacePerson,
    status: SpacePersonStatus | undefined,
    data: SpacePersonData | undefined
  ) => readonly string[];
};

/** The localized words for the people row and the person menu. */
export function useSpacePersonWords(): SpacePersonWords {
  const { t } = useLingui();
  const status = (value: SpacePersonStatus): string => {
    const words: Readonly<Record<SpacePersonStatus, string>> = {
      choosing: t`Choosing a game`,
      watching: t`Watching`,
      settingUp: t`Setting up`,
      notReady: t`Not ready`,
      ready: t`Ready`,
      turn: t`Playing now`,
      away: t`Away`,
    };
    return words[value];
  };
  const role = (person: SpacePerson): string => {
    if (person.kind === 'openSeat') return t`Open seat`;
    if (person.kind === 'bot') return t`Bot`;
    if (person.kind === 'remote') return t`Opponent`;
    return person.host === true ? t`Host` : t`Guest`;
  };
  return {
    name: (person) => (person.you === true ? t`You` : person.name),
    role,
    status,
    summary: (person, value, data) => [
      role(person),
      ...(value === undefined ? [] : [status(value)]),
      ...(data?.description === undefined ? [] : [data.description]),
      ...(person.muted === true ? [t`Muted`] : []),
    ],
  };
}
