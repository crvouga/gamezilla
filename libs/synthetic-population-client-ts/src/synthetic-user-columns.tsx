import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { TableColumn } from '@pkgs/ui-root-client-ts/table';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Show } from 'solid-js';
import { useGameName } from './game-names';
import type { SyntheticPopulationDirectoryPage } from './synthetic-population-api';
import { SyntheticUserAvatar } from './synthetic-user-identity';
import { AvailabilityBadge, useActivityLabel } from './synthetic-user-labels';
import { useSkillLabel } from './synthetic-user-persona';

/** One Synthetic User as the directory lists it. */
export type DirectoryUser = SyntheticPopulationDirectoryPage['users'][number];

/** Its face and name: the column that names the row. */
function UserCell(props: { user: DirectoryUser }): JSX.Element {
  return (
    <StackHorizontal gap="sm" align="center">
      <SyntheticUserAvatar user={props.user} size={32} />
      <P variant="rowTitle" wrap="break">
        {props.user.username}
      </P>
    </StackHorizontal>
  );
}

/** Paused or available, and recovering when it is. */
function StatusCell(props: { user: DirectoryUser }): JSX.Element {
  const { t } = useLingui();
  return (
    <StackHorizontal gap="xs" wrap>
      <AvailabilityBadge paused={props.user.paused} />
      <Show when={props.user.activity === 'recovering'}>
        <Badge label={t`Recovering`} intent="warning" size="sm" />
      </Show>
    </StackHorizontal>
  );
}

/** The persona's favorite games, each its own tag, by their known names. */
function FavoriteGamesCell(props: { user: DirectoryUser }): JSX.Element {
  const gameName = useGameName();
  const games = () => props.user.persona?.favoriteGames ?? [];
  return (
    <StackHorizontal gap="xs" wrap testId="synthetic-user-favorite-games">
      <For
        each={games()}
        fallback={
          <Text variant="caption">
            <Trans>None recorded</Trans>
          </Text>
        }
      >
        {(game) => <Badge label={gameName(game)} intent="neutral" size="sm" />}
      </For>
    </StackHorizontal>
  );
}

/**
 * The Synthetic Users table's columns: who, whether paused, what it is
 * doing, its skill level, home region and favorite games, and the worker
 * that runs it. The server orders and pages the directory, so no column
 * reorders a page.
 */
export function useSyntheticUserColumns(): () => readonly TableColumn<DirectoryUser>[] {
  const { t } = useLingui();
  const activity = useActivityLabel();
  const skill = useSkillLabel();
  return () => [
    {
      key: 'user',
      header: t`Synthetic User`,
      primary: true,
      render: (user) => <UserCell user={user} />,
    },
    {
      key: 'status',
      header: t`Status`,
      width: 'min',
      render: (user) => <StatusCell user={user} />,
    },
    {
      key: 'activity',
      header: t`Activity`,
      render: (user) => activity(user.activity),
    },
    {
      key: 'skill',
      header: t`Skill level`,
      render: (user) =>
        user.persona === null
          ? t`Not recorded`
          : skill(user.persona.skillLevel),
    },
    {
      key: 'region',
      header: t`Home region`,
      render: (user) => user.persona?.homeRegion ?? user.region,
    },
    {
      key: 'games',
      header: t`Favorite games`,
      render: (user) => <FavoriteGamesCell user={user} />,
    },
    {
      key: 'worker',
      header: t`Worker`,
      width: 'min',
      render: (user) =>
        user.worker_id === null ? t`Unassigned` : user.worker_id.slice(0, 8),
    },
  ];
}
