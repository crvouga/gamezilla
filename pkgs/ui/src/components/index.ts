/**
 * @pkgs/ui -- application-agnostic React Native design system.
 *
 * Usage:
 *   import { Box, Text, Stack, Button } from '@pkgs/ui';
 */

// Foundation
export { Box, type BoxProps } from './box';
export { GradientBox, type GradientBoxProps } from './gradient-box';
export { Text, type TextProps, type TextVariant } from './text';
export { Pressable, type PressableProps } from './pressable';

// Brand
export { AppLogo, type AppLogoProps } from './app-logo';

// Layout
export { Stack, type StackProps } from './stack';
export { Center, type CenterProps } from './center';
export { Divider, type DividerProps } from './divider';
export { Spacer } from './spacer';
export {
  ComposeProviders,
  type ComposeProvidersProps,
} from './compose-providers';
export { ScrollView, type ScrollViewProps } from './scroll-view';
export { SafeAreaView, type SafeAreaViewProps } from './safe-area-view';
export { FlatList, type FlatListProps } from './flat-list';
export {
  KeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
} from './keyboard-avoiding-view';

// Icons
export {
  CircleCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeIcon,
  CopyIcon,
  DatabaseIcon,
  DoorOpenIcon,
  EllipsisIcon,
  Gamepad2Icon,
  HeartIcon,
  BellIcon,
  HouseIcon,
  LightbulbIcon,
  ListChecksIcon,
  LogInIcon,
  LogOutIcon,
  MenuIcon,
  PaintbrushIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  ShareIcon,
  ShuffleIcon,
  SquarePenIcon,
  UserIcon,
  Volume2Icon,
  VolumeXIcon,
  WifiIcon,
  XIcon,
  createIcon,
  type IconComponent,
  type IconProps,
} from './icons';
export {
  BrandIcon,
  type BrandIconProps,
  type BrandIconName,
} from './brand-icon';

// Inputs / Actions
export {
  Button,
  buttonForegroundColor,
  useMutationButton,
  type ButtonProps,
  type ButtonIntent,
  type ButtonSize,
  type ButtonVariant,
  type ButtonFeedback,
  type UseMutationButtonParams,
  type UseMutationButtonResult,
  type MutationButtonLabels,
  type MutationFabProps,
} from './button';
export {
  FloatingActionButton,
  type FloatingActionButtonProps,
} from './floating-action-button';
export {
  SocialSignInButton,
  type SocialSignInButtonProps,
  type SocialSignInProvider,
  type SocialSignInButtonTheme,
  type SocialSignInButtonShape,
  type SocialSignInButtonAction,
} from './social-sign-in-button';
export {
  ICON_BUTTON_AVATAR_BORDER_WIDTH,
  IconButton,
  iconButtonAvatarContentSize,
  type IconButtonProps,
  type IconButtonVariant,
} from './icon-button';
export { BackIconButton, type BackIconButtonProps } from './back-icon-button';
export {
  ActionBar,
  actionBarBudgetWidth,
  isActionBarAvatarItem,
  partitionActionBarItems,
  screenBaseActionToActionBarItem,
  type ActionBarAlign,
  type ActionBarAvatarItem,
  type ActionBarIconItem,
  type ActionBarItem,
  type ActionBarOverflowMode,
  type ActionBarProps,
  type ActionBarTextAction,
} from './action-bar';
export {
  Tooltip,
  useTooltipTrigger,
  type TooltipPlacement,
  type TooltipProps,
} from './tooltip';
export { TextInput, type TextInputProps } from './text-input';
export {
  CopyToClipboardField,
  type CopyToClipboardFieldProps,
} from './copy-to-clipboard-field';
export { Switch, type SwitchProps } from './switch';
export { Checkbox, type CheckboxProps } from './checkbox';

// Data Display
export { Card, type CardProps } from './card';
export { Avatar, type AvatarProps } from './avatar';
export {
  AvatarHero,
  type AvatarHeroAction,
  type AvatarHeroProps,
} from './avatar-hero';
export { AvatarGroup, type AvatarGroupProps } from './avatar-group';
export {
  Badge,
  type BadgeProps,
  type BadgeIntent,
  type BadgeTone,
} from './badge';
export { Chip, type ChipProps } from './chip';
export { List, ListItem, type ListProps, type ListItemProps } from './list';

// Feedback
export {
  Spinner,
  SpinnerBox,
  SpinnerProvider,
  type SpinnerBoxProps,
  type SpinnerProps,
} from './spinner';
export { Skeleton, type SkeletonProps } from './skeleton';
export { ProgressBar, type ProgressBarProps } from './progress-bar';
export { LoadingState, type LoadingStateProps } from './loading-state';
export {
  EmptyState,
  type EmptyStateProps,
  type EmptyStateAction,
} from './empty-state';
export {
  ErrorState,
  type ErrorStateProps,
  type ErrorStateRetry,
} from './error-state';
export {
  SuccessState,
  type SuccessStateProps,
  type SuccessStateAction,
} from './success-state';
export {
  StateBlock,
  type StateBlockProps,
  type StateBlockVariant,
} from './state-block';
export {
  SoundIndicator,
  type SoundIndicatorProps,
  type SoundIndicatorState,
} from './sound-indicator';
export { SpeakingAvatar, type SpeakingAvatarProps } from './speaking-avatar';
export {
  DismissibleBanner,
  DismissibleBannerPortalProvider,
  type DismissibleBannerPortalProviderProps,
  type DismissibleBannerPosition,
  type DismissibleBannerProps,
} from './dismissible-top-banner';

// Cross-stacking-context overlay portal
export {
  OverlayPortalProvider,
  useOverlayPortal,
  useOverlayPortalSlot,
  type OverlayPortalApi,
  type OverlayPortalProviderProps,
} from './overlay-portal';

// Portal context bridge (ResponsiveSurface / bottom-sheet)
export {
  PortalContentBridgeProvider,
  usePortalContentWrap,
  type PortalContentBridgeProviderProps,
  type PortalContentWrap,
} from './portal-content-bridge';

// Disclosure
export { Collapsible, type CollapsibleProps } from './collapsible';

// Data inspection
export {
  JsonView,
  type JsonViewProps,
  type JsonPath,
  type JsonValueKind,
  classifyValue,
  containerBrackets,
  containerCount,
  encodePath,
  entriesOf,
  formatContainerSummary,
  formatLeafPreview,
  formatPathLabel,
  isContainer,
  safeStringify,
  collectAllContainerPaths,
} from './json-view';

// Anchored overlay
export {
  FloatingMenu,
  FLOATING_MENU_DEFAULT_WIDTH,
  type FloatingMenuProps,
  type FloatingMenuContent,
  type FloatingMenuContentRow,
  type FloatingMenuDividerRow,
  type FloatingMenuHeaderSpec,
  type FloatingMenuItemRow,
  type FloatingMenuInsets,
} from './floating-menu';

// Compound Inputs
export { Select, type SelectProps, type SelectOption } from './select';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type Segment,
} from './segmented-control';

// Status
export {
  StatusDot,
  type StatusDotProps,
  type StatusDotStatus,
} from './status-dot';

// Command palette
export {
  CommandRegistryProvider,
  CommandPalette,
  RegisterCommand,
  CommandPaletteTrigger,
  useCommandPalette,
  useCommand,
  useCommandRegistry,
  useCommandRegistryOptional,
  type CommandRegistryProviderProps,
  type CommandRegistryContextValue,
  type CommandPaletteProps,
  type RegisterCommandProps,
  type CommandPaletteTriggerProps,
  type Command,
  type CommandId,
  type CommandShortcut,
  type RegisteredCommand,
} from './command-palette';

// Overlay
export {
  ModalRoot,
  ModalBackdrop,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalButton,
  ConfirmationModal,
  type ModalRootProps,
  type ModalBackdropProps,
  type ModalContentProps,
  type ModalHeaderProps,
  type ModalBodyProps,
  type ModalButtonProps,
  type ConfirmationModalProps,
  type ModalSize,
} from './modal';

export {
  ResponsiveSurface,
  ResponsiveSurfaceHeader,
  type ResponsiveSurfaceProps,
  type ResponsiveSurfaceHeaderProps,
} from './responsive-surface';

export {
  MutationModal,
  MutationStateTransition,
  useMutationLifecycle,
  type MutationModalProps,
  type MutationPhase,
  type UseMutationLifecycleParams,
  type UseMutationLifecycleResult,
} from './mutation-modal';

export { FadeSwitch, type FadeSwitchProps } from './fade-switch';

export { Picker, type PickerProps, type PickerOption } from './picker';

export {
  HorizontalPicker,
  type HorizontalPickerProps,
  type HorizontalPickerRandomItem,
} from './horizontal-picker';

export {
  ChipGroup,
  type ChipGroupProps,
  type ChipGroupOption,
} from './chip-group';

export { NumberStepper, type NumberStepperProps } from './number-stepper';

export {
  MultiSelectSwatchGrid,
  type MultiSelectSwatchGridProps,
} from './multi-select-swatch';

export { SectionCard, type SectionCardProps } from './section-card';

export { PickerSection, type PickerSectionProps } from './picker-section';

export { MenuRow, type MenuRowProps } from './menu-row';

export {
  MainMenuScreen,
  type MainMenuItem,
  type MainMenuScreenProps,
} from './main-menu-screen';

export {
  ScreenBase,
  ScreenBaseHeader,
  type BodyContentProps,
  type ScreenBaseAction,
  type ScreenBaseActionType,
  type ScreenBaseBreadcrumb,
  type ScreenBaseHeaderProps,
  type ScreenBasePrimaryAction,
  type ScreenBaseProps,
} from './screen-base';
export {
  FormActionsFooter,
  type FormActionsFooterProps,
  type FormSubmitAction,
  type FormCancelAction,
} from './form-actions-footer';

// Navigation chrome
export {
  TopBar,
  TopBarTitle,
  TOP_BAR_CONTENT_HEIGHT,
  type TopBarProps,
  type TopBarCenterAlign,
  type TopBarTitleProps,
} from './top-bar';

export { NavRail, NAV_RAIL_DEFAULT_WIDTH, type NavRailProps } from './nav-rail';

export {
  OverflowMenuButton,
  useAnchoredMenu,
  type OverflowMenuButtonProps,
  type OverflowMenuAction,
  type OverflowMenuHeader,
  type AnchoredMenuController,
} from './overflow-menu-button';
