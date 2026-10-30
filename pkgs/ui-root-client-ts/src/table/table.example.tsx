/** @jsxImportSource solid-js */

import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import type { TableColumn } from '@pkgs/ui-root-client-ts/table';
import { Table } from '@pkgs/ui-root-client-ts/table';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

type Game = {
  readonly id: string;
  readonly opponent: string;
  readonly result: string;
  readonly moves: number;
};

const GAMES: readonly Game[] = [
  { id: 'g1', opponent: 'Ada', result: 'Won', moves: 34 },
  { id: 'g2', opponent: 'Grace', result: 'Lost', moves: 51 },
  { id: 'g3', opponent: 'Linus', result: 'Draw', moves: 72 },
];

const COLUMNS: readonly TableColumn<Game>[] = [
  { key: 'opponent', header: 'Opponent', render: (game) => game.opponent },
  {
    key: 'result',
    header: 'Result',
    width: 'min',
    render: (game) => game.result,
  },
  {
    key: 'moves',
    header: 'Moves',
    align: 'end',
    render: (game) => String(game.moves),
  },
];

function PressableTable(): JSX.Element {
  const [opened, setOpened] = createSignal('none');
  return (
    <>
      <Table
        caption="Recent games"
        columns={COLUMNS}
        rows={GAMES}
        rowKey={(game) => game.id}
        onRowPress={(game) => setOpened(game.opponent)}
        rowLabel={(game) => `Open game against ${game.opponent}`}
      />
      <P variant="caption">{`Opened: ${opened()}`}</P>
    </>
  );
}

export default function TableExample(): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Read-only, with caption (a list of fields on phones)">
        <Table
          caption="Standings"
          columns={COLUMNS}
          rows={GAMES}
          rowKey={(game) => game.id}
        />
      </ExampleSection>
      <ExampleSection title="Pressable rows">
        <PressableTable />
      </ExampleSection>
      <ExampleSection title="Centered column, no caption">
        <Table
          columns={[
            {
              key: 'opponent',
              header: 'Opponent',
              render: (game: Game) => game.opponent,
            },
            {
              key: 'moves',
              header: 'Moves',
              align: 'center',
              render: (game: Game) => String(game.moves),
            },
          ]}
          rows={GAMES}
          rowKey={(game) => game.id}
        />
      </ExampleSection>
      <ExampleSection title="Empty">
        <Table
          caption="Archived games"
          columns={COLUMNS}
          rows={[]}
          rowKey={(game) => game.id}
          empty={
            <EmptyState
              variant="compact"
              title="No archived games"
              body="Games you archive show up here."
            />
          }
        />
      </ExampleSection>
    </ExampleRoot>
  );
}
