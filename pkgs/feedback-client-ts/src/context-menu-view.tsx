/** @jsxImportSource solid-js */
import { ContextMenu } from '@pkgs/ui-root-client-ts/context-menu';
import type { ContextMenuControl, ContextMenuState } from './context-menu';
import { CONTEXT_MENU } from './copy';
import { useSource } from './use-bug-reports';

/** The app's right-click menu, as `installContextMenu` keeps it. */
export function BugReportContextMenu(props: { control: ContextMenuControl }) {
  const state = useSource<ContextMenuState>(() => props.control);
  return (
    <ContextMenu
      open={state().open}
      at={state().at}
      groups={state().groups}
      notice={state().notice}
      label={CONTEXT_MENU.label}
      onClose={() => props.control.close()}
      dataSet={{ testid: 'context-menu' }}
    />
  );
}
