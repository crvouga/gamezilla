import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { AboutScreenView } from './about-screen-view';

const PROVENANCE = {
  fullHash: 'c0c716f284dc1e872b1ffa0cc00fbfab7ae5cbfd',
  shortHash: 'c0c716f',
  committedAt: 'Nov 2, 2026, 11:50 PM PST',
};

const meta = {
  id: 'screens-settings-about',
  title: 'Screens/Settings/About',
  component: AboutScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['provenance', 'copy'] },
  },
  args: {
    version: '1.0.0',
    buildMode: 'production',
    provenance: PROVENANCE,
    securityContact: 'security@example.test',
    copy: fn(() => Promise.resolve()),
  },
} satisfies Meta<typeof AboutScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A released build: its commit, commit date and a copyable full hash. */
export const Production: Story = {};

/** A local development build is labelled so, so reports can be told apart. */
export const Development: Story = { args: { buildMode: 'development' } };

/** A build without commit information says the commit is unavailable. */
export const WithoutProvenance: Story = { args: { provenance: null } };
