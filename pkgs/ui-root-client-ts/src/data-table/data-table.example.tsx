/** @jsxImportSource solid-js */

import { asLocalized } from '@pkgs/i18n-shared-ts/localized-string';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import {
  DataTable,
  type DataTableProps,
} from '@pkgs/ui-root-client-ts/data-table';
import { PauseIcon, PlayIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import type { TableColumn } from '@pkgs/ui-root-client-ts/table';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, type JSX } from 'solid-js';

/** Story-only DataTable fixtures: a small club's players. */

export type Player = {
  readonly id: string;
  readonly name: string;
  readonly status: 'online' | 'away';
  readonly game: string;
  readonly rating: number;
};

export const PLAYERS: readonly Player[] = [
  { id: 'p1', name: 'maria_k', status: 'online', game: 'Chess', rating: 1640 },
  {
    id: 'p2',
    name: 'nightowl_88',
    status: 'away',
    game: 'Connect Four',
    rating: 1325,
  },
  {
    id: 'p3',
    name: 'Tobi_plays',
    status: 'online',
    game: 'Quoridor',
    rating: 1180,
  },
  { id: 'p4', name: 'KofiGG', status: 'online', game: 'Hearts', rating: 1512 },
  { id: 'p5', name: 'Lucia_m', status: 'away', game: 'Chess', rating: 1777 },
];

export const PLAYER_COLUMNS: readonly TableColumn<Player>[] = [
  {
    key: 'name',
    header: 'Player',
    primary: true,
    sortValue: (player) => player.name,
    render: (player) => <P variant="rowTitle">{player.name}</P>,
  },
  {
    key: 'status',
    header: 'Status',
    width: 'min',
    sortValue: (player) => player.status,
    render: (player) => (
      <StackHorizontal gap="xs">
        <Badge
          label={player.status === 'online' ? 'Online' : 'Away'}
          intent={player.status === 'online' ? 'success' : 'neutral'}
          size="sm"
        />
      </StackHorizontal>
    ),
  },
  {
    key: 'game',
    header: 'Game',
    sortValue: (player) => player.game,
    render: (player) => player.game,
  },
  {
    key: 'rating',
    header: 'Rating',
    align: 'end',
    width: 'min',
    sortValue: (player) => player.rating,
    render: (player) => String(player.rating),
  },
];

export type PlayerTableProps = DataTableProps<Player, 'everyone' | 'online'>;

/** The players table in its ready state; stories override one state each. */
export const PLAYER_TABLE: PlayerTableProps = {
  caption: 'Players',
  count: '5 players',
  columns: PLAYER_COLUMNS,
  rows: PLAYERS,
  rowKey: (player) => player.id,
  rowLabel: (player) => `Open ${player.name}`,
  onRowPress: () => undefined,
  defaultSort: { key: 'name', direction: 'ascending' },
  loading: false,
  loadingLabel: 'Reading players…',
  empty: {
    title: 'No players yet',
    body: 'Players appear here once they join the club.',
  },
  search: {
    value: '',
    onChange: () => undefined,
    label: asLocalized('Find players'),
    placeholder: asLocalized('Name or game'),
  },
  filter: {
    label: 'Show players',
    options: [
      { key: 'everyone', label: 'Everyone' },
      { key: 'online', label: 'Online' },
    ],
    selected: 'everyone',
    onSelect: () => undefined,
  },
  actions: [
    { label: 'Pause every player', icon: PauseIcon, onPress: () => undefined },
    { label: 'Resume every player', icon: PlayIcon, onPress: () => undefined },
  ],
  facts: [
    { label: 'Members', value: '5' },
    { label: 'Online', value: '3' },
  ],
  testId: 'players',
};

/** A working table: search and the filter narrow the rows as typed. */
export function LivePlayerTable(props: Partial<PlayerTableProps>): JSX.Element {
  const [query, setQuery] = createSignal('');
  const [shown, setShown] = createSignal<'everyone' | 'online'>('everyone');
  const [opened, setOpened] = createSignal('none');
  const rows = () =>
    PLAYERS.filter(
      (player) =>
        (shown() === 'everyone' || player.status === 'online') &&
        `${player.name} ${player.game}`
          .toLowerCase()
          .includes(query().toLowerCase())
    );
  return (
    <>
      <DataTable
        {...PLAYER_TABLE}
        {...props}
        rows={rows()}
        count={`${rows().length} players`}
        onRowPress={(player) => setOpened(player.name)}
        search={{
          value: query(),
          onChange: setQuery,
          label: asLocalized('Find players'),
          placeholder: asLocalized('Name or game'),
        }}
        filter={{
          label: 'Show players',
          options: [
            { key: 'everyone', label: 'Everyone' },
            { key: 'online', label: 'Online' },
          ],
          selected: shown(),
          onSelect: setShown,
        }}
      />
      <P variant="caption">{`Opened: ${opened()}`}</P>
    </>
  );
}
