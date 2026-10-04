/**
 * Explorer entries: Data Display / Feedback / Disclosure / Overlay.
 * Split from `registry-entries-core.ts` to keep each file under the size cap.
 */

import type { ComponentEntry } from '@pkgs/ui-shared/component-entry';
import { entry } from '@pkgs/ui-shared/component-entry';
import AvatarExample from './avatar.example';
import AvatarGroupExample from './avatar-group.example';
import AvatarHeroExample from './avatar-hero.example';
import BadgeExample from './badge.example';
import ChipExample from './chip.example';
import CollapsibleExample from './collapsible.example';
import CommandPaletteExample from './command-palette.example';
import DismissibleBannerExample from './dismissible-top-banner.example';
import EmptyStateExample from './empty-state.example';
import ErrorStateExample from './error-state.example';
import ListExample from './list.example';
import LoadingStateExample from './loading-state.example';
import MenuRowExample from './menu-row.example';
import ModalExample from './modal.example';
import MutationModalExample from './mutation-modal.example';
import NoticeExample from './notice.example';
import PaginationControlsExample from './pagination-controls.example';
import ProgressBarExample from './progress-bar.example';
import ResponsiveSurfaceExample from './responsive-surface.example';
import SkeletonExample from './skeleton.example';
import SoundIndicatorExample from './sound-indicator.example';
import SpeakingAvatarExample from './speaking-avatar.example';
import SpinnerExample from './spinner.example';
import StatusDotExample from './status-dot.example';
import SuccessStateExample from './success-state.example';

const DATA_DISPLAY = 'Data Display';
const FEEDBACK = 'Feedback';
const DISCLOSURE = 'Disclosure';
const OVERLAY = 'Overlay';

export const DISPLAY_ENTRIES: readonly ComponentEntry[] = [
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
  entry('notice', 'Notice', FEEDBACK, NoticeExample),
  entry('success-state', 'SuccessState', FEEDBACK, SuccessStateExample),

  entry('collapsible', 'Collapsible', DISCLOSURE, CollapsibleExample),

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
