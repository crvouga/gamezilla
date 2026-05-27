/**
 * `UIAdapter` -- the port contract for `@pkgs/ui`.
 *
 * Every swappable UI implementation (in-house, HeroUI, etc.) implements this
 * interface. The `adapter-registry.ts` `switch` chooses one at boot and
 * `index.ts` re-exports component identities from the chosen adapter.
 *
 * Slot types are derived via `typeof` from the in-house implementations so
 * both adapters share the same prop contracts without duplicating types.
 * Alternative adapters (e.g. `heroui`) must produce functions with matching
 * signatures or TypeScript will reject them.
 *
 * Note: `typeof` is a TS-only construct -- at runtime `ports/` does not
 * depend on `components/`. This file purely defines the contract.
 */

import type * as Inhouse from '../components';

export interface UIAdapter {
  Box: typeof Inhouse.Box;
  GradientBox: typeof Inhouse.GradientBox;
  Text: typeof Inhouse.Text;
  Pressable: typeof Inhouse.Pressable;

  Stack: typeof Inhouse.Stack;
  Center: typeof Inhouse.Center;
  Divider: typeof Inhouse.Divider;
  Spacer: typeof Inhouse.Spacer;
  ScrollView: typeof Inhouse.ScrollView;
  SafeAreaView: typeof Inhouse.SafeAreaView;
  FlatList: typeof Inhouse.FlatList;
  KeyboardAvoidingView: typeof Inhouse.KeyboardAvoidingView;

  IconSymbol: typeof Inhouse.IconSymbol;
  BrandIcon: typeof Inhouse.BrandIcon;

  Button: typeof Inhouse.Button;
  SocialSignInButton: typeof Inhouse.SocialSignInButton;
  IconButton: typeof Inhouse.IconButton;
  BackIconButton: typeof Inhouse.BackIconButton;
  TextInput: typeof Inhouse.TextInput;
  CopyToClipboardField: typeof Inhouse.CopyToClipboardField;
  Switch: typeof Inhouse.Switch;
  Checkbox: typeof Inhouse.Checkbox;

  Card: typeof Inhouse.Card;
  Avatar: typeof Inhouse.Avatar;
  AvatarGroup: typeof Inhouse.AvatarGroup;
  Badge: typeof Inhouse.Badge;
  Chip: typeof Inhouse.Chip;
  List: typeof Inhouse.List;
  ListItem: typeof Inhouse.ListItem;

  Spinner: typeof Inhouse.Spinner;
  SpinnerBox: typeof Inhouse.SpinnerBox;
  SpinnerProvider: typeof Inhouse.SpinnerProvider;
  Skeleton: typeof Inhouse.Skeleton;
  ProgressBar: typeof Inhouse.ProgressBar;
  SoundIndicator: typeof Inhouse.SoundIndicator;
  SpeakingAvatar: typeof Inhouse.SpeakingAvatar;
  DismissibleBanner: typeof Inhouse.DismissibleBanner;
  DismissibleBannerPortalProvider: typeof Inhouse.DismissibleBannerPortalProvider;

  OverlayPortalProvider: typeof Inhouse.OverlayPortalProvider;

  Collapsible: typeof Inhouse.Collapsible;

  JsonView: typeof Inhouse.JsonView;

  FloatingMenu: typeof Inhouse.FloatingMenu;

  Select: typeof Inhouse.Select;
  SegmentedControl: typeof Inhouse.SegmentedControl;

  StatusDot: typeof Inhouse.StatusDot;

  CommandRegistryProvider: typeof Inhouse.CommandRegistryProvider;
  CommandPalette: typeof Inhouse.CommandPalette;
  RegisterCommand: typeof Inhouse.RegisterCommand;
  CommandPaletteTrigger: typeof Inhouse.CommandPaletteTrigger;

  ModalRoot: typeof Inhouse.ModalRoot;
  ModalBackdrop: typeof Inhouse.ModalBackdrop;
  ModalContent: typeof Inhouse.ModalContent;
  ModalHeader: typeof Inhouse.ModalHeader;
  ModalBody: typeof Inhouse.ModalBody;
  ModalFooter: typeof Inhouse.ModalFooter;
  ModalButton: typeof Inhouse.ModalButton;
  ConfirmationModal: typeof Inhouse.ConfirmationModal;

  ResponsiveSurface: typeof Inhouse.ResponsiveSurface;
  ResponsiveSurfaceHeader: typeof Inhouse.ResponsiveSurfaceHeader;

  Picker: typeof Inhouse.Picker;
  HorizontalPicker: typeof Inhouse.HorizontalPicker;
  ChipGroup: typeof Inhouse.ChipGroup;
  NumberStepper: typeof Inhouse.NumberStepper;
  MultiSelectSwatchGrid: typeof Inhouse.MultiSelectSwatchGrid;
  SectionCard: typeof Inhouse.SectionCard;
  MenuRow: typeof Inhouse.MenuRow;
  MainMenuScreen: typeof Inhouse.MainMenuScreen;

  ScreenBase: typeof Inhouse.ScreenBase;
  ScreenBaseHeader: typeof Inhouse.ScreenBaseHeader;

  TopBar: typeof Inhouse.TopBar;
  NavRail: typeof Inhouse.NavRail;
  OverflowMenuButton: typeof Inhouse.OverflowMenuButton;
}

/**
 * Identifier for each registered UI adapter. The boot-time switch in
 * `adapter-registry.ts` dispatches on this union.
 */
export type UiImpl = 'inhouse' | 'heroui';
