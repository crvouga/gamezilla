import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ClientSqlScreenView } from './client-sql-screen-view';
import { StorySqlNotebook } from './client-sql-story.example';

const meta = {
  id: 'screens-inspector-client-sql',
  title: 'Screens/Inspector/Client SQL',
  component: ClientSqlScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['notebook'] } },
} satisfies Meta<typeof ClientSqlScreenView>;
export default meta;
type Story = StoryObj<typeof ClientSqlScreenView>;

/** A synced device: the notebook lists the local tables it can query. */
export const WithTables: Story = {
  render: () => (
    <ClientSqlScreenView
      notebook={
        <StorySqlNotebook
          tables={[
            'client_config',
            'friends',
            'spaces',
            'sync_engine_mutations',
          ]}
        />
      }
    />
  ),
};

/** A fresh local database with nothing in it yet. */
export const EmptyDatabase: Story = {
  render: () => (
    <ClientSqlScreenView notebook={<StorySqlNotebook tables={[]} />} />
  ),
};
