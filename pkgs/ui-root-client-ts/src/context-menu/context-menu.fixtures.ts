import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BugIcon,
  ClipboardPasteIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  ImageIcon,
  LinkIcon,
  PrinterIcon,
  RedoIcon,
  RefreshCwIcon,
  ScissorsIcon,
  SearchIcon,
  TextCursorInputIcon,
  UndoIcon,
} from '../icons';
import type { ContextMenuGroup, ContextMenuItem } from './index';

const none = (): void => undefined;

function item(
  id: string,
  label: string,
  icon: ContextMenuItem['icon'],
  extra: Partial<ContextMenuItem> = {}
): ContextMenuItem {
  return { id, label, icon, onSelect: none, ...extra };
}

const REPORT: ContextMenuGroup = {
  id: 'report',
  items: [
    item('report-bug', 'Report a bug about this', BugIcon, {
      shortcut: 'mod+shift+b',
    }),
  ],
};

const PAGE: ContextMenuGroup = {
  id: 'page',
  items: [
    item('back', 'Back', ArrowLeftIcon),
    item('forward', 'Forward', ArrowRightIcon, { disabled: true }),
    item('reload', 'Reload', RefreshCwIcon),
    item('copy-page-link', 'Copy page link', LinkIcon),
    item('print', 'Print…', PrinterIcon),
  ],
};

/** A right-click on the page itself. */
export const PAGE_MENU: readonly ContextMenuGroup[] = [PAGE, REPORT];

/** A right-click on selected words. */
export const SELECTION_MENU: readonly ContextMenuGroup[] = [
  {
    id: 'selection',
    items: [
      item('copy', 'Copy', CopyIcon),
      item('search', 'Search the web for “castling rights”', SearchIcon),
      item('select-all', 'Select all', TextCursorInputIcon),
    ],
  },
  PAGE,
  REPORT,
];

/** A right-click in a field a person types in. */
export const FIELD_MENU: readonly ContextMenuGroup[] = [
  {
    id: 'history',
    items: [item('undo', 'Undo', UndoIcon), item('redo', 'Redo', RedoIcon)],
  },
  {
    id: 'field',
    items: [
      item('cut', 'Cut', ScissorsIcon),
      item('copy', 'Copy', CopyIcon),
      item('paste', 'Paste', ClipboardPasteIcon),
      item('select-all', 'Select all', TextCursorInputIcon),
    ],
  },
  REPORT,
];

/** A right-click on a picture that is also a link. */
export const LINKED_IMAGE_MENU: readonly ContextMenuGroup[] = [
  {
    id: 'link',
    items: [
      item('open-link', 'Open link', LinkIcon),
      item('open-link-tab', 'Open link in new tab', ExternalLinkIcon),
      item('copy-link', 'Copy link address', CopyIcon),
    ],
  },
  {
    id: 'image',
    items: [
      item('open-image-tab', 'Open image in new tab', ImageIcon),
      item('copy-image', 'Copy image', CopyIcon),
      item('save-image', 'Save image', DownloadIcon),
    ],
  },
  REPORT,
];

export const PASTE_REFUSED =
  'This browser does not let the app paste. Press Ctrl+V (⌘V on a Mac) instead.';
