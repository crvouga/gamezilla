/**
 * @gamezilla/shared/ui -- application-agnostic React Native design system.
 *
 * Usage:
 *   import { Box, Text, Stack, Button } from '@gamezilla/shared/ui';
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

// Inputs / Actions
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from './button';
export { IconButton, type IconButtonProps } from './icon-button';
export { TextInput, type TextInputProps } from './text-input';
export { Switch, type SwitchProps } from './switch';
export { Checkbox, type CheckboxProps } from './checkbox';

// Data Display
export { Card, type CardProps } from './card';
export { Avatar, type AvatarProps } from './avatar';
export { Badge, type BadgeProps } from './badge';
export { Chip, type ChipProps } from './chip';
export { List, ListItem, type ListProps, type ListItemProps } from './list';

// Feedback
export { Spinner, type SpinnerProps } from './spinner';
export { Skeleton, type SkeletonProps } from './skeleton';
export { ProgressBar, type ProgressBarProps } from './progress-bar';

// Disclosure
export { Collapsible, type CollapsibleProps } from './collapsible';

// Compound Inputs
export { Select, type SelectProps, type SelectOption } from './select';
export { SegmentedControl, type SegmentedControlProps, type Segment } from './segmented-control';

// Status
export { StatusDot, type StatusDotProps, type StatusDotStatus } from './status-dot';

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
