import type { DebuggerViewId } from '@pkgs/harness-console-shared-ts/debugger-views';
import type { HarnessChromeKind } from '@pkgs/harness-console-shared-ts/node';
import { coerceHarnessChromeKind } from '@pkgs/harness-console-shared-ts/node';
import { TabStrip } from '@pkgs/ui-devtools-client-ts/tab-strip';
import type { TabStripItem } from '@pkgs/ui-devtools-client-ts/tab-strip-types';
import { Pane } from '@pkgs/ui-root-client-ts/pane';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Toolbar } from '@pkgs/ui-root-client-ts/toolbar';
import { type JSX, mergeProps } from 'solid-js';
import {
  DEBUGGER_KIND_TABS,
  debuggerInstanceTabItem,
  debuggerViewTabItem,
} from './debugger-chrome';
import { showDebuggerInstanceTabs } from './layout';
import { useHarnessConsoleLayout } from './use-harness-console-layout';

export type DebuggerInstance = {
  readonly id: string;
  readonly kind: string;
};

export type DebuggerShellProps = {
  readonly header?: JSX.Element;
  /** Kind-strip trailing chrome (e.g. product-harness snapshot controls). */
  readonly kindTrailing?: JSX.Element;
  /**
   * Kind tabs. Default: client/server/events/room. Pass `[]` (or one item)
   * to hide the strip — trailing chrome still renders.
   */
  readonly kindTabs?: readonly TabStripItem[];
  /** Optional unified node strip (clients plus server/pubsub/room). */
  readonly unifiedNodes?: readonly TabStripItem[];
  readonly selectedNode?: string;
  readonly onNodeChange?: (id: string) => void;
  /** Fires on pointer-down on tab chrome (not the pane body). */
  readonly onChromePointerDown?: () => void;
  readonly kind: HarnessChromeKind;
  readonly onKindChange: (kind: HarnessChromeKind) => void;
  readonly instances: readonly DebuggerInstance[];
  readonly instanceId: string | null;
  readonly onInstanceChange: (id: string) => void;
  readonly views: readonly DebuggerViewId[];
  readonly view: DebuggerViewId | null;
  readonly onViewChange: (view: DebuggerViewId) => void;
  readonly children: JSX.Element;
};

export function DebuggerShell(input: DebuggerShellProps): JSX.Element {
  const props = mergeProps({ kindTabs: DEBUGGER_KIND_TABS }, input);
  const layout = useHarnessConsoleLayout();
  const showInstances = () =>
    showDebuggerInstanceTabs({
      kind: props.kind,
      instanceCount: props.instances.length,
      multiClientColumns: layout.multiClientColumns,
    });

  return (
    <StackVertical grow>
      {props.header}
      <Pane
        grow={false}
        clip={false}
        onActivate={() => props.onChromePointerDown?.()}
      >
        {layout.compactChrome &&
        props.kindTrailing !== undefined &&
        props.unifiedNodes === undefined ? (
          <ChromeTrailingBar>{props.kindTrailing}</ChromeTrailingBar>
        ) : null}
        {props.unifiedNodes !== undefined ? (
          <TabStrip
            aria-label="ProductHarness nodes"
            items={[...props.unifiedNodes]}
            selectedId={props.selectedNode ?? null}
            onSelect={(id) => props.onNodeChange?.(id)}
            trailing={!layout.compactChrome ? props.kindTrailing : undefined}
          />
        ) : (
          <>
            <KindChrome
              showStrip={props.kindTabs.length > 1}
              kindTabs={props.kindTabs}
              kind={props.kind}
              onKindChange={props.onKindChange}
              kindTrailing={
                !layout.compactChrome ? props.kindTrailing : undefined
              }
            />
            {showInstances() ? (
              <TabStrip
                aria-label="Node instances"
                items={props.instances.map((n) =>
                  debuggerInstanceTabItem({ id: n.id, kind: n.kind })
                )}
                selectedId={props.instanceId}
                onSelect={props.onInstanceChange}
              />
            ) : null}
          </>
        )}
        {props.views.length > 1 ? (
          <TabStrip
            aria-label="Views"
            items={props.views.map((v) => debuggerViewTabItem(v))}
            selectedId={props.view}
            onSelect={(id) => props.onViewChange(id as DebuggerViewId)}
          />
        ) : null}
      </Pane>
      <Pane tone="background">{props.children}</Pane>
    </StackVertical>
  );
}

/** Kind-strip trailing chrome when there is no tab strip to carry it. */
function ChromeTrailingBar(props: { readonly children: JSX.Element }) {
  return (
    <Toolbar density="regular" aria-label="Harness controls">
      {props.children}
    </Toolbar>
  );
}

function KindChrome(props: {
  readonly showStrip: boolean;
  readonly kindTabs: readonly TabStripItem[];
  readonly kind: HarnessChromeKind;
  readonly onKindChange: (kind: HarnessChromeKind) => void;
  readonly kindTrailing: JSX.Element;
}): JSX.Element {
  return (
    <>
      {props.showStrip ? (
        <TabStrip
          aria-label="Node kinds"
          items={[...props.kindTabs]}
          selectedId={props.kind}
          onSelect={(id) => props.onKindChange(coerceHarnessChromeKind(id))}
          keyboardScope
          trailing={props.kindTrailing}
        />
      ) : props.kindTrailing === undefined ? null : (
        <ChromeTrailingBar>{props.kindTrailing}</ChromeTrailingBar>
      )}
    </>
  );
}
