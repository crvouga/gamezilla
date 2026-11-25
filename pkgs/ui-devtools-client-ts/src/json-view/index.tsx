/** @jsxImportSource @solidjs/web */

import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { JsonPath } from '@pkgs/ui-devtools-shared-ts/json-view-logic';
import {
  classifyValue,
  collectAllContainerPaths,
  isContainer,
  safeStringify,
} from '@pkgs/ui-devtools-shared-ts/json-view-logic';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import { ChevronRightIcon, CopyIcon } from '@pkgs/ui-root-client-ts/icons';
import {
  type ScrollMaxHeight,
  ScrollView,
} from '@pkgs/ui-root-client-ts/scroll-view';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { dynamic, type JSX } from '@solidjs/web';
import {
  ToolbarButton as SdkToolbarButton,
  Toolbar,
} from '@ui-sdk/solid/toolbar';
import { Tree } from '@ui-sdk/solid/tree';
import { createMemo, createSignal, Show } from 'solid-js';
import type { JsonViewCopy } from '../json-view-node/index';
import { JsonViewNode, treeItemValue } from '../json-view-node/index';
import styles from './json-view.module.css';

const ROOT_PATH: JsonPath = [];

function expandedPaths(value: unknown, maxDepth: number): string[] {
  return collectAllContainerPaths(value, {
    maxDepth,
    formatPath: treeItemValue,
  });
}

export type JsonViewProps = {
  /** Any JS value. Objects and arrays expand; everything else renders as a leaf. */
  value: unknown;
  /** Depth at which nodes are expanded by default. Defaults to 1. */
  initialExpandDepth?: number | undefined;
  /** Cap for "expand all" — protects against deeply nested or huge payloads. Defaults to 8. */
  expandAllMaxDepth?: number | undefined;
  /** Optional label rendered above the tree (e.g. `space.attributes`). */
  label?: JSX.Element | undefined;
  /** Hide the toolbar (expand all / collapse all / reset / copy). Defaults to false. */
  hideToolbar?: boolean | undefined;
  /** Hide per-row copy buttons. Defaults to false. */
  hideRowCopy?: boolean | undefined;
  /**
   * Injected clipboard sink. When omitted, every copy affordance is hidden
   * (the design system never touches `navigator.clipboard` directly).
   */
  copy?: JsonViewCopy | undefined;
  /** Cap on inner scroll height. When omitted the tree grows naturally. */
  maxHeight?: ScrollMaxHeight | undefined;
  class?: string | undefined;
  style?: JSX.CSSProperties | string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function JsonViewLabel(props: { label: JSX.Element }): JSX.Element {
  return (
    <div class="box px-1 pt-1 pb-px border-b border-border">
      <p class="text textCaption text-text-secondary">{props.label}</p>
    </div>
  );
}

/**
 * `JsonView` — collapsible JSON tree explorer.
 *
 * Renders any JavaScript value as an inspectable tree with type-aware
 * coloring, per-node expand/collapse, copy-to-clipboard (through an injected
 * `copy` sink), and a toolbar with "expand all", "collapse all", and "copy".
 * Designed for debug surfaces where the developer wants to drill into a
 * payload without leaving the app.
 *
 * @example
 * ```tsx
 * <JsonView value={someEntity} initialExpandDepth={1} copy={clipboard.write} />
 * ```
 */
export function JsonView(props: JsonViewProps): JSX.Element {
  const { t } = useLingui();
  const [changedExpansion, setExpanded] = createSignal<string[]>();
  const expanded = createMemo(() => {
    const depth = props.initialExpandDepth ?? 1;
    return (
      changedExpansion() ??
      (depth > 0 ? expandedPaths(props.value, depth - 1) : [])
    );
  });
  const rootIsContainer = createMemo(() =>
    isContainer(classifyValue(props.value))
  );
  const rowCopy = () => (props.hideRowCopy === true ? undefined : props.copy);

  return (
    <div
      class={[
        'box bg-surface-muted border border-border rounded-control',
        props.class,
      ]}
      style={props.style}
      {...dataAttrs({ component: 'JsonView', ...props.dataSet })}
    >
      <Show when={props.label !== undefined}>
        <JsonViewLabel label={props.label} />
      </Show>
      <Show when={props.hideToolbar !== true}>
        <JsonViewToolbar
          rootIsContainer={rootIsContainer()}
          onExpandAll={() =>
            setExpanded(
              expandedPaths(props.value, props.expandAllMaxDepth ?? 8)
            )
          }
          onCollapseAll={() => setExpanded([])}
          onReset={() => setExpanded(undefined)}
          copy={props.copy}
          value={props.value}
        />
      </Show>
      <ScrollView
        flushEdge={false}
        tone="surface"
        maxHeight={props.maxHeight}
        paddingY="sm"
        paddingX="md"
      >
        <Tree
          mode="none"
          aria-label={
            typeof props.label === 'string' ? props.label : t`JSON value`
          }
          expanded={expanded()}
          onExpandedChange={setExpanded}
        >
          <JsonViewNode
            nodeKey={null}
            value={props.value}
            path={ROOT_PATH}
            depth={0}
            copy={rowCopy()}
          />
        </Tree>
      </ScrollView>
    </div>
  );
}

function JsonViewToolbar(props: {
  rootIsContainer: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onReset: () => void;
  copy: JsonViewCopy | undefined;
  value: unknown;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Toolbar
      class="box flex-row items-center gap-1 px-2 py-1 border-b border-border flex-wrap"
      aria-label={t`JSON actions`}
    >
      <ToolbarButton
        label={t`Expand all`}
        icon={ChevronRightIcon}
        iconRotated
        onClick={props.onExpandAll}
        disabled={!props.rootIsContainer}
      />
      <ToolbarButton
        label={t`Collapse all`}
        icon={ChevronRightIcon}
        onClick={props.onCollapseAll}
        disabled={!props.rootIsContainer}
      />
      <ToolbarButton
        label={t`Reset`}
        onClick={props.onReset}
        disabled={!props.rootIsContainer}
      />
      <div class="box flex-1" />
      <Show when={props.copy}>
        {(copy) => (
          <ToolbarButton
            label={t`Copy`}
            icon={CopyIcon}
            onClick={() => {
              void copy()(safeStringify(props.value));
            }}
          />
        )}
      </Show>
    </Toolbar>
  );
}

function ToolbarButton(props: {
  label: string;
  icon?: IconComponent | undefined;
  iconRotated?: boolean | undefined;
  onClick: () => void;
  disabled?: boolean | undefined;
}): JSX.Element {
  const Icon = dynamic(() => props.icon);
  return (
    <SdkToolbarButton
      focusableWhenDisabled={false}
      class="clickable clickableOpacity flex-row items-center gap-1 px-2 py-1 min-h-11 rounded-sm"
      type="button"
      style={{ opacity: props.disabled ? 0.4 : 1 }}
      onClick={() => props.onClick()}
      disabled={props.disabled ?? false}
    >
      <Show when={props.icon}>
        <div
          class={[
            'box',
            { [styles['rotated'] ?? '']: props.iconRotated === true },
          ]}
        >
          <Icon size={10} />
        </div>
      </Show>
      <p class="text textCaption text-tint">{props.label}</p>
    </SdkToolbarButton>
  );
}
