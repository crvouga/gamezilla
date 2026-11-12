import type {
  ContextMenuGroup,
  ContextMenuItem,
} from '@pkgs/ui-root-client-ts/context-menu';
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
} from '@pkgs/ui-root-client-ts/icons';
import type { MenuTarget } from './context-menu-target';
import { CONTEXT_MENU, searchText } from './copy';
import type { BrowserPort } from './ports';

/** What the menu does beyond the browser: reporting, and saying what went wrong. */
export type ContextMenuActions = {
  readonly browser: BrowserPort;
  readonly report: () => void;
  /** An item could not do what it offered: the menu opens again saying so. */
  readonly refused: (notice: string) => void;
};

function item(
  id: string,
  label: string,
  icon: ContextMenuItem['icon'],
  onSelect: () => void
): ContextMenuItem {
  return { id, label, icon, onSelect };
}

/** An item there is nothing for right now: shown, but it cannot be chosen. */
function unless(available: boolean, offered: ContextMenuItem): ContextMenuItem {
  return available ? offered : { ...offered, disabled: true };
}

/** Copies, or says plainly that the browser would not let it. */
function copier(actions: ContextMenuActions, text: string): () => void {
  return () =>
    void actions.browser.writeText(text).then((copied) => {
      if (!copied) actions.refused(CONTEXT_MENU.copyFailed);
    });
}

function linkGroup(
  link: NonNullable<MenuTarget['link']>,
  actions: ContextMenuActions
): ContextMenuGroup {
  const { browser } = actions;
  return {
    id: 'link',
    items: [
      item('open-link', CONTEXT_MENU.openLink, LinkIcon, () =>
        browser.follow(link.element)
      ),
      item(
        'open-link-in-new-tab',
        CONTEXT_MENU.openLinkInNewTab,
        ExternalLinkIcon,
        () => browser.openInNewTab(link.href)
      ),
      item(
        'copy-link',
        CONTEXT_MENU.copyLink,
        CopyIcon,
        copier(actions, link.href)
      ),
    ],
  };
}

function imageGroup(
  src: string,
  actions: ContextMenuActions
): ContextMenuGroup {
  const { browser } = actions;
  return {
    id: 'image',
    items: [
      item(
        'open-image-in-new-tab',
        CONTEXT_MENU.openImageInNewTab,
        ImageIcon,
        () => browser.openInNewTab(src)
      ),
      item('copy-image', CONTEXT_MENU.copyImage, CopyIcon, () => {
        void browser.copyImage(src).then((copied) => {
          if (!copied) actions.refused(CONTEXT_MENU.copyFailed);
        });
      }),
      item('save-image', CONTEXT_MENU.saveImage, DownloadIcon, () =>
        browser.saveImage(src)
      ),
    ],
  };
}

function fieldGroups(
  field: NonNullable<MenuTarget['field']>,
  actions: ContextMenuActions
): ContextMenuGroup[] {
  const { browser } = actions;
  const selected = field.selected !== '';
  const edit = (command: 'cut' | 'copy', fallback: () => void) => () => {
    if (!browser.edit(command)) fallback();
  };
  return [
    {
      id: 'history',
      items: [
        item('undo', CONTEXT_MENU.undo, UndoIcon, () => browser.edit('undo')),
        item('redo', CONTEXT_MENU.redo, RedoIcon, () => browser.edit('redo')),
      ],
    },
    {
      id: 'field',
      items: [
        unless(
          selected,
          item(
            'cut',
            CONTEXT_MENU.cut,
            ScissorsIcon,
            edit('cut', () => {
              copier(actions, field.selected)();
              browser.insertText('');
            })
          )
        ),
        unless(
          selected,
          item(
            'copy',
            CONTEXT_MENU.copy,
            CopyIcon,
            edit('copy', copier(actions, field.selected))
          )
        ),
        item('paste', CONTEXT_MENU.paste, ClipboardPasteIcon, () => {
          void browser.readText().then((text) => {
            if (text === null) actions.refused(CONTEXT_MENU.pasteRefused);
            else browser.insertText(text);
          });
        }),
        item('select-all', CONTEXT_MENU.selectAll, TextCursorInputIcon, () =>
          browser.edit('selectAll')
        ),
      ],
    },
  ];
}

function selectionGroup(
  selected: string,
  actions: ContextMenuActions
): ContextMenuGroup {
  const { browser } = actions;
  return {
    id: 'selection',
    items: [
      item('copy', CONTEXT_MENU.copy, CopyIcon, copier(actions, selected)),
      item('search', searchText(selected), SearchIcon, () =>
        browser.search(selected)
      ),
      item('select-all', CONTEXT_MENU.selectAll, TextCursorInputIcon, () =>
        browser.edit('selectAll')
      ),
    ],
  };
}

function pageGroup(actions: ContextMenuActions): ContextMenuGroup {
  const { browser } = actions;
  const history = browser.history();
  return {
    id: 'page',
    items: [
      unless(
        history.back,
        item('back', CONTEXT_MENU.back, ArrowLeftIcon, () => browser.back())
      ),
      unless(
        history.forward,
        item('forward', CONTEXT_MENU.forward, ArrowRightIcon, () =>
          browser.forward()
        )
      ),
      item('reload', CONTEXT_MENU.reload, RefreshCwIcon, () =>
        browser.reload()
      ),
      item(
        'copy-page-link',
        CONTEXT_MENU.copyPageLink,
        LinkIcon,
        copier(actions, browser.pageUrl())
      ),
      item('print', CONTEXT_MENU.print, PrinterIcon, () => browser.print()),
    ],
  };
}

/** The shortcut that opens a bug report from anywhere, as the menu shows it. */
export const REPORT_SHORTCUT = 'mod+shift+b';

/**
 * What the menu offers for what is under the pointer, in the order a
 * browser offers it: a link, a picture, a field or selected words, and the
 * page itself only when it is none of those. Reporting a bug about the
 * thing is always last.
 */
export function contextMenuGroups(
  target: MenuTarget,
  actions: ContextMenuActions
): ContextMenuGroup[] {
  const groups: ContextMenuGroup[] = [];
  if (target.link) groups.push(linkGroup(target.link, actions));
  if (target.image) groups.push(imageGroup(target.image, actions));
  if (target.field) groups.push(...fieldGroups(target.field, actions));
  else if (target.selection)
    groups.push(selectionGroup(target.selection, actions));
  if (groups.length === 0) groups.push(pageGroup(actions));
  groups.push({
    id: 'report',
    items: [
      {
        ...item('report-bug', CONTEXT_MENU.reportBug, BugIcon, actions.report),
        shortcut: REPORT_SHORTCUT,
      },
    ],
  });
  return groups;
}
