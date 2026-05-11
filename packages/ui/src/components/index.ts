/**
 * @gamezilla/ui -- application-agnostic React Native design system.
 *
 * Usage:
 *   import { Box, Text, Stack, Button } from '@gamezilla/ui';
 */

// Foundation
export { Box, type BoxProps } from './box';
export { GradientBox, type GradientBoxProps } from './gradient-box';
export { Text, type TextProps, type TextVariant } from './text';
export { Pressable, type PressableProps } from './pressable';

// Layout
export { Stack, type StackProps } from './stack';
export { Center, type CenterProps } from './center';
export { Divider, type DividerProps } from './divider';
export { Spacer } from './spacer';
export { ScrollView, type ScrollViewProps } from './scroll-view';
export { SafeAreaView, type SafeAreaViewProps } from './safe-area-view';
export { FlatList, type FlatListProps } from './flat-list';
export {
  KeyboardAvoidingView,
  type KeyboardAvoidingViewProps,
} from './keyboard-avoiding-view';

// Icons
export {
  IconSymbol,
  type IconSymbolProps,
  type IconSymbolName,
} from './symbol-icon';
export {
  BrandIcon,
  type BrandIconProps,
  type BrandIconName,
} from './brand-icon';

// Inputs / Actions
export {
  Button,
  type ButtonProps,
  type ButtonIntent,
  type ButtonSize,
} from './button';
export {
  SocialSignInButton,
  type SocialSignInButtonProps,
  type SocialSignInProvider,
  type SocialSignInButtonTheme,
  type SocialSignInButtonShape,
  type SocialSignInButtonAction,
} from './social-sign-in-button';
export { IconButton, type IconButtonProps } from './icon-button';
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
export { AvatarGroup, type AvatarGroupProps } from './avatar-group';
export { Badge, type BadgeProps } from './badge';
export { Chip, type ChipProps } from './chip';
export { List, ListItem, type ListProps, type ListItemProps } from './list';

// Feedback
export { Spinner, type SpinnerProps } from './spinner';
export { Skeleton, type SkeletonProps } from './skeleton';
export { ProgressBar, type ProgressBarProps } from './progress-bar';
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
} from './modal';

export {
  ResponsiveSurface,
  ResponsiveSurfaceHeader,
  type ResponsiveSurfaceProps,
  type ResponsiveSurfaceHeaderProps,
} from './responsive-surface';

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

export { MenuRow, type MenuRowProps } from './menu-row';

export {
  MainMenuScreen,
  type MainMenuItem,
  type MainMenuScreenProps,
} from './main-menu-screen';

export {
  ScreenBase,
  ScreenBaseHeader,
  partitionScreenActions,
  type BodyContentProps,
  type ScreenBaseAction,
  type ScreenBaseActionType,
  type ScreenBaseBreadcrumb,
  type ScreenBaseHeaderProps,
  type ScreenBaseProps,
} from './screen-base';
