/**
 * Single import boundary for Lucide icons. Every other file must import
 * named icons from `@pkgs/ui`, never from `lucide-react-native` directly.
 */

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Code,
  Copy,
  Database,
  DoorOpen,
  Ellipsis,
  Gamepad2,
  Heart,
  Bell,
  House,
  Lightbulb,
  ListChecks,
  LogIn,
  LogOut,
  Menu,
  Paintbrush,
  Plus,
  Search,
  Send,
  Settings,
  Share,
  Shuffle,
  SquarePen,
  User,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react-native';

import { createIcon } from './create-icon';

export { createIcon, type IconComponent, type IconProps } from './create-icon';

export const HouseIcon = createIcon(House);
export const Gamepad2Icon = createIcon(Gamepad2);
export const UserIcon = createIcon(User);
export const PlusIcon = createIcon(Plus);
export const SendIcon = createIcon(Send);
export const CodeIcon = createIcon(Code);
export const ChevronRightIcon = createIcon(ChevronRight);
export const ChevronLeftIcon = createIcon(ChevronLeft);
export const ChevronDownIcon = createIcon(ChevronDown);
export const LightbulbIcon = createIcon(Lightbulb);
export const ListChecksIcon = createIcon(ListChecks);
export const PaintbrushIcon = createIcon(Paintbrush);
export const EllipsisIcon = createIcon(Ellipsis);
export const SettingsIcon = createIcon(Settings);
export const WifiIcon = createIcon(Wifi);
export const LogInIcon = createIcon(LogIn);
export const LogOutIcon = createIcon(LogOut);
export const MenuIcon = createIcon(Menu);
export const DatabaseIcon = createIcon(Database);
export const DoorOpenIcon = createIcon(DoorOpen);
export const CopyIcon = createIcon(Copy);
export const CircleCheckIcon = createIcon(CircleCheck);
export const XIcon = createIcon(X);
export const Volume2Icon = createIcon(Volume2);
export const VolumeXIcon = createIcon(VolumeX);
export const SearchIcon = createIcon(Search);
export const ShareIcon = createIcon(Share);
export const ShuffleIcon = createIcon(Shuffle);
export const SquarePenIcon = createIcon(SquarePen);
export const HeartIcon = createIcon(Heart);
export const BellIcon = createIcon(Bell);
