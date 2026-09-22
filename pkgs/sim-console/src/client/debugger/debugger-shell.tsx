import { TabStrip, type TabStripItem } from '@pkgs/ui-devtools';
import { type JSX, mergeProps } from 'solid-js';
import type { DebuggerViewId } from '../../shared/debugger-views';
import { coerceSimChromeKind, type SimChromeKind } from '../../shared/sim-node';
import {
  DEBUGGER_KIND_TABS,
  debuggerInstanceTabItem,
  debuggerViewTabItem,
} from '../debugger-chrome';
import {
  showDebuggerInstanceTabs,
  useSimConsoleLayout,
} from './use-sim-console-layout';

export type DebuggerInstance = {
  readonly id: string;
  readonly kind: string;
};

export type DebuggerShellProps = {
  readonly header?: JSX.Element;
  /** Kind-strip trailing chrome (e.g. product-simulator snapshot controls). */
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
  readonly kind: SimChromeKind;
  readonly onKindChange: (kind: SimChromeKind) => void;
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
  const layout = useSimConsoleLayout();
  const showInstances = () =>
    showDebuggerInstanceTabs({
      kind: props.kind,
      instanceCount: props.instances.length,
      multiClientColumns: layout.multiClientColumns,
    });

  return (
    <div class="box" style={shellSx}>
      {props.header}
      <div class="box" onPointerDown={() => props.onChromePointerDown?.()}>
        {layout.compactChrome &&
        props.kindTrailing !== undefined &&
        props.unifiedNodes === undefined ? (
          <div class="box flex-row items-center px-4 py-2 border-b border-border bg-surface-muted min-w-0">
            {props.kindTrailing}
          </div>
        ) : null}
        {props.unifiedNodes !== undefined ? (
          <TabStrip
            aria-label="ProductSimulator nodes"
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
      </div>
      <div
        class="box flex-1 min-h-0 min-w-0 bg-background"
        style={{ overflow: 'clip' }}
      >
        {props.children}
      </div>
    </div>
  );
}

function KindChrome(props: {
  readonly showStrip: boolean;
  readonly kindTabs: readonly TabStripItem[];
  readonly kind: SimChromeKind;
  readonly onKindChange: (kind: SimChromeKind) => void;
  readonly kindTrailing: JSX.Element;
}): JSX.Element {
  return (
    <>
      {props.showStrip ? (
        <TabStrip
          aria-label="Node kinds"
          items={[...props.kindTabs]}
          selectedId={props.kind}
          onSelect={(id) => props.onKindChange(coerceSimChromeKind(id))}
          keyboardScope
          trailing={props.kindTrailing}
        />
      ) : props.kindTrailing === undefined ? null : (
        <div class="box flex-row items-center px-4 py-2 border-b border-border bg-surface-muted min-w-0">
          {props.kindTrailing}
        </div>
      )}
    </>
  );
}

const shellSx = {
  flex: 1,
  'flex-direction': 'column',
  'min-height': 0,
} as const;
