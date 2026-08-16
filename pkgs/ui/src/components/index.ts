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
export {
  BellIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  CodeIcon,
  CopyIcon,
  createIcon,
  DatabaseIcon,
  DoorOpenIcon,
  EllipsisIcon,
  Gamepad2Icon,
  HeartIcon,
  HistoryIcon,
  HouseIcon,
  type IconComponent,
  type IconProps,
  LightbulbIcon,
  ListChecksIcon,
  LogInIcon,
  LogOutIcon,
  MailIcon,
  MenuIcon,
  MonitorIcon,
  PaintbrushIcon,
  PlayIcon,
  PlusIcon,
  RadioIcon,
  RotateCcwIcon,
  SaveIcon,
  ScrollTextIcon,
  SearchIcon,
  SendIcon,
  ServerIcon,
  SettingsIcon,
  ShareIcon,
  ShuffleIcon,
  SquarePenIcon,
  TerminalIcon,
  Trash2Icon,
  UserIcon,
  Volume2Icon,
  VolumeXIcon,
  WifiIcon,
  XIcon,
} from './icons';
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
export {
  MAIN_MENU_SCREEN_MAX_WIDTH,
  type MainMenuItem,
  MainMenuScreen,
  MainMenuScreenHeader,
  type MainMenuScreenHeaderProps,
  type MainMenuScreenProps,
} from './main-menu-screen';
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
export {
  type AnchoredMenuController,
  type OverflowMenuAction,
  OverflowMenuButton,
  type OverflowMenuButtonProps,
  type OverflowMenuHeader,
  useAnchoredMenu,
} from './overflow-menu-button';
// Cross-stacking-context overlay portal
export {
  type OverlayPortalApi,
  OverlayPortalProvider,
  type OverlayPortalProviderProps,
  useOverlayPortal,
  useOverlayPortalSlot,
} from './overlay-portal';
export {
  Picker,
  type PickerOption,
  type PickerProps,
  type PickerSize,
} from './picker';
export { PickerSection, type PickerSectionProps } from './picker-section';
// Portal context bridge (ResponsiveSurface / bottom-sheet)
export {
  PortalContentBridgeProvider,
  type PortalContentBridgeProviderProps,
  type PortalContentWrap,
  usePortalContentWrap,
} from './portal-content-bridge';
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
  ResponsiveSurface,
  ResponsiveSurfaceHeader,
  type ResponsiveSurfaceHeaderProps,
  type ResponsiveSurfacePresentation,
  type ResponsiveSurfaceProps,
} from './responsive-surface';
export { SafeAreaView, type SafeAreaViewProps } from './safe-area-view';
export {
  type BodyContentProps,
  SCREEN_BODY_PADDING_STEP,
  ScreenBase,
  type ScreenBaseAction,
  type ScreenBaseActionType,
  type ScreenBaseBreadcrumb,
  ScreenBaseHeader,
  type ScreenBaseHeaderProps,
  type ScreenBasePrimaryAction,
  type ScreenBaseProps,
  ScreenBodyFlatList,
  type ScreenBodyFlatListProps,
  ScreenBodyScrollView,
  type ScreenBodyScrollViewProps,
} from './screen-base';
export {
  SCREEN_TITLE_REVEAL_OFFSET,
  ScreenLargeTitle,
  type ScreenLargeTitleProps,
  type ScreenTitleContextValue,
  ScreenTitleProvider,
  type ScreenTitleProviderProps,
  type ScreenTitleScrollProps,
  shouldShowTopBarTitle,
  useScreenTitleContext,
  useScreenTitleScroll,
} from './screen-title';
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
export {
  StateBlock,
  type StateBlockProps,
  type StateBlockVariant,
} from './state-block';
export {
  compareStatusBarItems,
  isStatusBarItemVisible,
  type RegisteredStatusBarItem,
  RegisterStatusBarItem,
  type RegisterStatusBarItemProps,
  STATUS_BAR_BODY_HEIGHT,
  StatusBar,
  type StatusBarItem,
  type StatusBarItemId,
  StatusBarPanel,
  type StatusBarPanelProps,
  type StatusBarProps,
  type StatusBarRegistryContextValue,
  StatusBarRegistryPortalBridge,
  type StatusBarRegistryPortalBridgeProps,
  StatusBarRegistryProvider,
  type StatusBarRegistryProviderProps,
  StatusBarRegistryStore,
  StatusBarStrip,
  type StatusBarStripProps,
  StatusBarTile,
  type StatusBarTileProps,
  statusBarItemOrder,
  useStatusBar,
  useStatusBarPushHeight,
  useStatusBarRegistry,
  useStatusBarRegistryOptional,
} from './status-bar';
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
export {
  SURFACE_STACK_BASE,
  SURFACE_STACK_STEP,
  type SurfaceStackApi,
  SurfaceStackProvider,
  type SurfaceStackProviderProps,
  useIsTopSurface,
  useSurfaceStack,
  useSurfaceStackOptional,
  useSurfaceStackSlot,
} from './surface-stack';
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
export {
  Tooltip,
  type TooltipPlacement,
  type TooltipProps,
  useTooltipTrigger,
} from './tooltip';
// Navigation chrome
export {
  TOP_BAR_CONTENT_HEIGHT,
  TopBar,
  type TopBarCenterAlign,
  type TopBarProps,
  TopBarTitle,
  type TopBarTitleProps,
} from './top-bar';
export { useBreadcrumbNav } from './use-breadcrumb-nav';
