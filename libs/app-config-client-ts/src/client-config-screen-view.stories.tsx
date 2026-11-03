import { DEFAULT_CLIENT_RUNTIME_CONFIG } from '@libs/app-config-shared-ts/parse-client-config';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ClientConfigScreenView } from './client-config-screen-view';

const CONFIGURED = {
  ...DEFAULT_CLIENT_RUNTIME_CONFIG,
  google_enabled: true,
  google_web_client_id: '123456789012-abcdefghijklmnop.apps.example.test',
  billing_enabled: true,
  tts_enabled: true,
  emqx_wss_url: 'wss://mqtt.example.test:8084/mqtt',
};

const ROWS = [
  { id: 'google_enabled', value: true, deleted_at: null },
  {
    id: 'google_web_client_id',
    value: CONFIGURED.google_web_client_id,
    deleted_at: null,
  },
  { id: 'billing_enabled', value: true, deleted_at: null },
  { id: 'tts_enabled', value: true, deleted_at: null },
  { id: 'emqx_wss_url', value: CONFIGURED.emqx_wss_url, deleted_at: null },
];

const meta = {
  id: 'screens-settings-client-config',
  title: 'Screens/Settings/Client config',
  component: ClientConfigScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['config', 'rows'] } },
  args: { status: 'ready', config: CONFIGURED, rows: ROWS },
} satisfies Meta<typeof ClientConfigScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Config has synced: sign-in, features, infrastructure and the raw snapshot. */
export const Synced: Story = {};

/** Local SQLite has not hydrated; an empty snapshot is not "all off". */
export const Loading: Story = {
  args: { status: 'loading', config: DEFAULT_CLIENT_RUNTIME_CONFIG, rows: [] },
};

/** Hydrated with no rows yet: every feature reads off, EMQX not set. */
export const NothingSynced: Story = {
  args: { config: DEFAULT_CLIENT_RUNTIME_CONFIG, rows: [] },
};
