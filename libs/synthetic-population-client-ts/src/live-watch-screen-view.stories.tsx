import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { LiveWatchScreenView } from './live-watch-screen-view';
import {
  FRAME_HTML,
  ONLINE_NOW,
  onlineEntry,
  SPACES_FRAME_HTML,
} from './online-now.example';
import { face, OBSERVED_AT } from './synthetic-population.example';

/** nightowl_88, a person in Settings. */
const NIGHTOWL = ONLINE_NOW[1]!;
/** LenaPlays, a Synthetic User browsing Spaces. */
const LENA = ONLINE_NOW[2]!;
const FRAME = { html: FRAME_HTML, capturedAtMs: Date.parse(OBSERVED_AT) };
const SPACES_FRAME = {
  html: SPACES_FRAME_HTML,
  capturedAtMs: Date.parse(OBSERVED_AT),
};

const meta = {
  id: 'screens-admin-live-watch',
  title: 'Screens/Admin/Live watch',
  component: LiveWatchScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['state', 'denial'] },
  },
  args: {
    state: { kind: 'watching', entry: NIGHTOWL, frame: FRAME },
    canControl: true,
    onControlPanel: fn(),
    onRetry: fn(),
    onBack: fn(),
  },
} satisfies Meta<typeof LiveWatchScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Watching a person live: who, where, what, and their screen as they see it. */
export const Watching: Story = {};

/** Watching a Synthetic User: its screen as it browses Spaces, and its control panel. */
export const WatchingSyntheticUser: Story = {
  args: { state: { kind: 'watching', entry: LENA, frame: SPACES_FRAME } },
};

/** A viewer who may watch but not control: no control panel is offered. */
export const ViewOnly: Story = {
  args: {
    canControl: false,
    state: { kind: 'watching', entry: LENA, frame: SPACES_FRAME },
  },
};

/** The watch has started; the first picture of their screen is on its way. */
export const WaitingForScreen: Story = {
  args: { state: { kind: 'watching', entry: NIGHTOWL, frame: null } },
};

/** Opening the watch: nothing is known yet. */
export const Loading: Story = { args: { state: { kind: 'loading' } } };

/** The watch could not be read; try again is offered. */
export const Failed: Story = { args: { state: { kind: 'failed' } } };

/** The one watched closed the app: watching stopped, and the way back. */
export const UserWentOffline: Story = {
  args: { state: { kind: 'offline', username: 'nightowl_88' } },
};

/** Long names and game names wrap instead of breaking the screen. */
export const LongContent: Story = {
  args: {
    state: {
      kind: 'watching',
      entry: onlineEntry(9, 'the_grand_strategist_of_rainy_tuesday_evenings', {
        kind: 'synthetic',
        syntheticUserId: LENA.syntheticUserId,
        avatarConfig: face('thumbs', 'a7c31e90d2b4'),
        place: 'space',
        activity: 'playing',
        game: 'Battleship: Salvo with extended fleets and fog of war',
      }),
      frame: FRAME,
    },
  },
};

/** A person without permission to watch: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    state: { kind: 'loading' },
    canControl: false,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: {
        testid: 'synthetic-population-watch-denied',
        reason: 'not_granted',
      },
    },
  },
};
