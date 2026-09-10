/**
 * Explorer entries: Data Display / Feedback / Disclosure / Overlay.
 * Split from `registry-entries-core.ts` to keep each file under the size cap.
 */
import AvatarExample from '../avatar/avatar.example';
import AvatarGroupExample from '../avatar-group/avatar-group.example';
import AvatarHeroExample from '../avatar-hero/avatar-hero.example';
import BadgeExample from '../badge/badge.example';
import ChipExample from '../chip/chip.example';
import CollapsibleExample from '../collapsible/collapsible.example';
import CommandPaletteExample from '../command-palette/command-palette.example';
import DataTableExample from '../data-table/data-table.example';
import DismissibleBannerExample from '../dismissible-top-banner/dismissible-top-banner.example';
import EmptyStateExample from '../empty-state/empty-state.example';
import ErrorStateExample from '../error-state/error-state.example';
import JsonViewExample from '../json-view/json-view.example';
import ListExample from '../list/list.example';
import LoadingStateExample from '../loading-state/loading-state.example';
import MenuRowExample from '../menu-row/menu-row.example';
import ModalExample from '../modal/modal.example';
import MutationModalExample from '../mutation-modal/mutation-modal.example';
import PaginationControlsExample from '../pagination-controls/pagination-controls.example';
import ProgressBarExample from '../progress-bar/progress-bar.example';
import ResponsiveSurfaceExample from '../responsive-surface/responsive-surface.example';
import SectionCardExample from '../section-card/section-card.example';
import SkeletonExample from '../skeleton/skeleton.example';
import SoundIndicatorExample from '../sound-indicator/sound-indicator.example';
import SpeakingAvatarExample from '../speaking-avatar/speaking-avatar.example';
import SpinnerExample from '../spinner/spinner.example';
import StatusDotExample from '../status-dot/status-dot.example';
import SuccessStateExample from '../success-state/success-state.example';
import { type ComponentEntry, entry } from './component-entry';

const DATA_DISPLAY = 'Data Display';
const FEEDBACK = 'Feedback';
const DISCLOSURE = 'Disclosure';
const OVERLAY = 'Overlay';

export const DISPLAY_ENTRIES: readonly ComponentEntry[] = [
  entry('data-table', 'DataTable', DATA_DISPLAY, DataTableExample),
  entry(
    'pagination-controls',
    'PaginationControls',
    DATA_DISPLAY,
    PaginationControlsExample
  ),
  entry('avatar', 'Avatar', DATA_DISPLAY, AvatarExample),
  entry('avatar-hero', 'AvatarHero', DATA_DISPLAY, AvatarHeroExample),
  entry('avatar-group', 'AvatarGroup', DATA_DISPLAY, AvatarGroupExample),
  entry('badge', 'Badge', DATA_DISPLAY, BadgeExample),
  entry('chip', 'Chip', DATA_DISPLAY, ChipExample),
  entry('list', 'List', DATA_DISPLAY, ListExample),
  entry('menu-row', 'MenuRow', DATA_DISPLAY, MenuRowExample),
  entry('json-view', 'JsonView', DATA_DISPLAY, JsonViewExample),
  entry('status-dot', 'StatusDot', DATA_DISPLAY, StatusDotExample),

  entry('spinner', 'Spinner', FEEDBACK, SpinnerExample),
  entry('skeleton', 'Skeleton', FEEDBACK, SkeletonExample),
  entry('progress-bar', 'ProgressBar', FEEDBACK, ProgressBarExample),
  entry(
    'dismissible-top-banner',
    'DismissibleBanner',
    FEEDBACK,
    DismissibleBannerExample
  ),
  entry('sound-indicator', 'SoundIndicator', FEEDBACK, SoundIndicatorExample),
  entry('speaking-avatar', 'SpeakingAvatar', FEEDBACK, SpeakingAvatarExample),
  entry('loading-state', 'LoadingState', FEEDBACK, LoadingStateExample),
  entry('empty-state', 'EmptyState', FEEDBACK, EmptyStateExample),
  entry('error-state', 'ErrorState', FEEDBACK, ErrorStateExample),
  entry('success-state', 'SuccessState', FEEDBACK, SuccessStateExample),

  entry('collapsible', 'Collapsible', DISCLOSURE, CollapsibleExample),
  entry('section-card', 'SectionCard', DISCLOSURE, SectionCardExample),

  entry('modal', 'Modal', OVERLAY, ModalExample),
  entry('mutation-modal', 'MutationModal', OVERLAY, MutationModalExample),
  entry('command-palette', 'CommandPalette', OVERLAY, CommandPaletteExample),
  entry(
    'responsive-surface',
    'ResponsiveSurface',
    OVERLAY,
    ResponsiveSurfaceExample
  ),
];
