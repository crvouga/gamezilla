/**
 * @pkgs/ui -- application-agnostic React Native design system.
 *
 * Usage:
 *   import { Box, Text, Stack, Button } from '@pkgs/ui';
 */

export {
  ActionBar,
  type ActionBarAlign,
  type ActionBarAvatarItem,
  type ActionBarIconItem,
  type ActionBarItem,
  type ActionBarOverflowMode,
  type ActionBarProps,
  type ActionBarTextAction,
  actionBarBudgetWidth,
  isActionBarAvatarItem,
  partitionActionBarItems,
  screenBaseActionToActionBarItem,
} from './action-bar';
// Foundation
export { AnimatedBox, type AnimatedBoxProps } from './animated-box';
// Brand
export { AppLogo, type AppLogoProps } from './app-logo';
export { AVATAR_BORDER_WIDTH, Avatar, type AvatarProps } from './avatar';
export { AvatarGroup, type AvatarGroupProps } from './avatar-group';
export {
  AvatarHero,
  type AvatarHeroAction,
  type AvatarHeroProps,
} from './avatar-hero';
export { BackIconButton, type BackIconButtonProps } from './back-icon-button';
export {
  Badge,
  type BadgeIntent,
  type BadgeProps,
  type BadgeTone,
} from './badge';
export {
  BottomActionBar,
  type BottomActionBarActionItem,
  type BottomActionBarButtonItem,
  type BottomActionBarItem,
  type BottomActionBarProps,
} from './bottom-action-bar';
export { Box, type BoxProps } from './box';
export {
  BrandIcon,
  type BrandIconName,
  type BrandIconProps,
} from './brand-icon';
// Inputs / Actions
export {
  Button,
  type ButtonFeedback,
  type ButtonIntent,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
  buttonForegroundColor,
  type MutationButtonLabels,
  type MutationFabProps,
  type UseMutationButtonParams,
  type UseMutationButtonResult,
  useMutationButton,
} from './button';
// Data Display
export { Card, type CardProps } from './card';
export {
  CatalogDetail,
  CatalogDetailNav,
  type CatalogDetailNavProps,
  type CatalogDetailProps,
  type CatalogGroup,
  type CatalogItem,
  CatalogList,
  type CatalogListProps,
  type CatalogNeighbor,
  filterCatalogItems,
  flattenCatalogItems,
  groupCatalogItems,
  resolveCatalogNeighbor,
} from './catalog';
export { Center, type CenterProps } from './center';
export { Checkbox, type CheckboxProps } from './checkbox';
export { Chip, type ChipProps } from './chip';
export {
  ChipGroup,
  type ChipGroupOption,
  type ChipGroupProps,
} from './chip-group';
export {
  CloseIconButton,
  type CloseIconButtonProps,
} from './close-icon-button';
// Disclosure
export { Collapsible, type CollapsibleProps } from './collapsible';
// Compound Inputs
export {
  Combobox,
  type ComboboxMultipleProps,
  type ComboboxOption,
  type ComboboxProps,
  type ComboboxSelectionMode,
  type ComboboxSingleProps,
} from './combobox';
// Command palette
export {
  type Command,
  type CommandId,
  CommandPalette,
  type CommandPaletteProps,
  CommandPaletteTrigger,
  type CommandPaletteTriggerProps,
  type CommandRegistryContextValue,
  CommandRegistryProvider,
  type CommandRegistryProviderProps,
  type CommandShortcut,
  RegisterCommand,
  type RegisterCommandProps,
  type RegisteredCommand,
  useCommand,
  useCommandPalette,
  useCommandRegistry,
  useCommandRegistryOptional,
} from './command-palette';
export {
  ComposeProviders,
  type ComposeProvidersProps,
} from './compose-providers';
export {
  CONTENT_EDGE_PADDING_STEP,
  type ContentEdgePadding,
  ContentEdgePaddingProvider,
  type ContentEdgePaddingProviderProps,
  type FlushEdgeStyles,
  resolveFlushEdgeStyles,
  SURFACE_BOTTOM_PADDING_STEP,
  useContentEdgePadding,
  useContentEdgePaddingStep,
} from './content-edge-padding';
export {
  CopyToClipboardField,
  type CopyToClipboardFieldProps,
} from './copy-to-clipboard-field';
export {
  createMemoryPageLoader,
  DataTable,
  type DataTableColumn,
  type DataTableColumnAlign,
  type DataTableDensity,
  type DataTableLoadPage,
  type DataTableLoadPageParams,
  type DataTableLoadPageResult,
  type DataTableOrderDir,
  type DataTableProps,
} from './data-table';
export {
  DismissibleBanner,
  DismissibleBannerPortalProvider,
  type DismissibleBannerPortalProviderProps,
  type DismissibleBannerPosition,
  type DismissibleBannerProps,
} from './dismissible-top-banner';
export { Divider, type DividerProps } from './divider';
export {
  EmptyState,
  type EmptyStateAction,
  type EmptyStateProps,
} from './empty-state';
export {
  ErrorState,
  type ErrorStateProps,
  type ErrorStateRetry,
} from './error-state';
export { FadeSwitch, type FadeSwitchProps } from './fade-switch';
export { FlatList, type FlatListProps } from './flat-list';
export {
  FloatingActionButton,
  type FloatingActionButtonProps,
} from './floating-action-button';
// Anchored overlay
export {
  FLOATING_MENU_DEFAULT_WIDTH,
  FloatingMenu,
  type FloatingMenuContent,
  type FloatingMenuContentRow,
  type FloatingMenuDividerRow,
  type FloatingMenuHeaderSpec,
  type FloatingMenuInsets,
  type FloatingMenuItemRow,
  type FloatingMenuProps,
  type FloatingMenuViewport,
} from './floating-menu';
export { FocusTrap, type FocusTrapProps } from './focus-trap';
export {
  FormActionsFooter,
  type FormActionsFooterProps,
  type FormCancelAction,
  type FormSubmitAction,
} from './form-actions-footer';
export { GradientBox, type GradientBoxProps } from './gradient-box';
export {
  HorizontalPicker,
  type HorizontalPickerProps,
} from './horizontal-picker';
export {
  ICON_BUTTON_AVATAR_BORDER_WIDTH,
  IconButton,
  type IconButtonProps,
  type IconButtonTooltipMode,
  type IconButtonVariant,
  iconButtonAvatarContentSize,
} from './icon-button';
// Icons
export * from './icons';
// Data inspection
export {
  classifyValue,
  collectAllContainerPaths,
  containerBrackets,
  containerCount,
  encodePath,
  entriesOf,
  formatContainerSummary,
  formatLeafPreview,
  formatPathLabel,
  isContainer,
  type JsonPath,
  type JsonValueKind,
  JsonView,
  type JsonViewProps,
  safeStringify,
} from './json-view';
export {
  KeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
} from './keyboard-avoiding-view';
export { List, ListItem, type ListItemProps, type ListProps } from './list';
export { LoadingState, type LoadingStateProps } from './loading-state';
export * from './main-menu-screen';
export {
  MenuList,
  type MenuListProps,
  MenuRow,
  type MenuRowProps,
} from './menu-row';
// Overlay
export {
  ConfirmationModal,
  type ConfirmationModalProps,
  ModalBackdrop,
  type ModalBackdropProps,
  ModalBody,
  type ModalBodyProps,
  ModalButton,
  type ModalButtonProps,
  ModalContent,
  type ModalContentProps,
  ModalFooter,
  ModalHeader,
  type ModalHeaderProps,
  ModalRoot,
  type ModalRootProps,
  type ModalSize,
} from './modal';
export {
  MultiSelectSwatchGrid,
  type MultiSelectSwatchGridProps,
} from './multi-select-swatch';
export {
  MutationModal,
  type MutationModalProps,
  type MutationPhase,
  MutationStateTransition,
  type UseMutationLifecycleParams,
  type UseMutationLifecycleResult,
  useMutationLifecycle,
} from './mutation-modal';
export { NAV_RAIL_DEFAULT_WIDTH, NavRail, type NavRailProps } from './nav-rail';
export { NumberStepper, type NumberStepperProps } from './number-stepper';
export * from './overflow-menu-button';
// Cross-stacking-context overlay portal
export * from './overlay-portal';
export * from './picker';
export { PickerSection, type PickerSectionProps } from './picker-section';
// Portal context bridge (ResponsiveSurface / bottom-sheet)
export * from './portal-content-bridge';
export {
  type PortalHostFrame,
  portalHostFramesEqual,
  subtractHostOrigin,
  windowRectToHostLocal,
  ZERO_PORTAL_HOST_FRAME,
} from './portal-host-frame';
export { Pressable, type PressableProps } from './pressable';
export { ProgressBar, type ProgressBarProps } from './progress-bar';
export {
  PullToRefreshControl,
  type PullToRefreshControlProps,
  type RefreshControlElement,
  type RefreshControlHostProps,
  type UsePullToRefreshResult,
  usePullToRefresh,
  useResolvedRefreshControl,
} from './pull-to-refresh';
export {
  RelativeTime,
  type RelativeTimeProps,
  useRelativeTimeLabel,
} from './relative-time';
export * from './responsive-surface';
export { SafeAreaView, type SafeAreaViewProps } from './safe-area-view';
export * from './screen-base';
export * from './screen-title';
export { ScrollView, type ScrollViewProps } from './scroll-view';
export { SectionCard, type SectionCardProps } from './section-card';
export {
  type Segment,
  SegmentedControl,
  type SegmentedControlProps,
} from './segmented-control';
export { Select, type SelectOption, type SelectProps } from './select';
export { Skeleton, type SkeletonProps } from './skeleton';
export {
  SocialSignInButton,
  type SocialSignInButtonAction,
  type SocialSignInButtonProps,
  type SocialSignInButtonShape,
  type SocialSignInButtonTheme,
  type SocialSignInProvider,
} from './social-sign-in-button';
export {
  SoundIndicator,
  type SoundIndicatorProps,
  type SoundIndicatorState,
} from './sound-indicator';
export { Spacer, type SpacerProps } from './spacer';
export { SpeakingAvatar, type SpeakingAvatarProps } from './speaking-avatar';
// Feedback
export {
  Spinner,
  SpinnerBox,
  type SpinnerBoxProps,
  type SpinnerProps,
  SpinnerProvider,
} from './spinner';
// Layout
export { Stack, type StackProps } from './stack';
export * from './state-block';
export * from './status-bar';
// Status
export {
  StatusDot,
  type StatusDotProps,
  type StatusDotStatus,
} from './status-dot';
export {
  SuccessState,
  type SuccessStateAction,
  type SuccessStateProps,
} from './success-state';
// Ordered modal / surface stack (monotonic z-index by open order)
export * from './surface-stack';
export { Switch, type SwitchProps } from './switch';
export {
  TabStrip as PillTabBar,
  TabStrip,
  type TabStripItem as PillTabItem,
  type TabStripItem,
  type TabStripProps as PillTabBarProps,
  type TabStripProps,
} from './tab-strip';
export { Text, type TextProps, type TextVariant } from './text';
export { TextInput, type TextInputProps } from './text-input';
export * from './tooltip';
// Navigation chrome
export * from './top-bar';
export { useBreadcrumbNav } from './use-breadcrumb-nav';
