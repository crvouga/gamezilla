/** @jsxImportSource solid-js */
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

import { useLingui } from '@lingui/solid/macro';
import type {
  JsonExpansionState,
  JsonPath,
} from '@pkgs/ui-devtools-shared-ts/json-view-logic';
import {
  classifyValue,
  collapseAllState,
  expandAllState,
  isContainer,
  JSON_EXPANSION_INITIAL,
  resolveExpanded,
  safeStringify,
  toggleExpansion,
} from '@pkgs/ui-devtools-shared-ts/json-view-logic';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import { ChevronRightIcon, CopyIcon } from '@pkgs/ui-root-client-ts/icons';
import {
  type ScrollMaxHeight,
  ScrollView,
} from '@pkgs/ui-root-client-ts/scroll-view';
import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, createSignal, type JSX, Show, splitProps } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { JsonViewCopy } from '../json-view-node/index';
import { JsonViewNode } from '../json-view-node/index';
import styles from './json-view.module.css';

const ROOT_PATH: JsonPath = [];

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

type ExpansionApi = {
  isExpanded: (path: JsonPath) => boolean;
  toggle: (path: JsonPath) => void;
  expandAll: () => void;
  collapseAll: () => void;
  reset: () => void;
};

function createJsonExpansion(args: {
  value: () => unknown;
  initialExpandDepth: () => number;
  expandAllMaxDepth: () => number;
}): ExpansionApi {
  const [state, setState] = createSignal<JsonExpansionState>(
    JSON_EXPANSION_INITIAL
  );
  return {
    isExpanded: (path) =>
      resolveExpanded(state(), path, args.initialExpandDepth()),
    toggle: (path) =>
      setState((prev) =>
        toggleExpansion(prev, path, args.initialExpandDepth())
      ),
    expandAll: () =>
      setState(expandAllState(args.value(), args.expandAllMaxDepth())),
    collapseAll: () => setState(collapseAllState()),
    reset: () => setState(JSON_EXPANSION_INITIAL),
  };
}

function JsonViewLabel(props: { label: JSX.Element }): JSX.Element {
  return (
    <div class="box px-1 pt-1 pb-px border-b border-border">
      <p class="text textCaption text-text-secondary">{props.label}</p>
    </div>
  );
}

export function JsonView(props: JsonViewProps): JSX.Element {
  const [local] = splitProps(props, [
    'value',
    'initialExpandDepth',
    'expandAllMaxDepth',
    'label',
    'hideToolbar',
    'hideRowCopy',
    'copy',
    'maxHeight',
    'class',
    'style',
    'dataSet',
  ]);
  const initialExpandDepth = () => local.initialExpandDepth ?? 1;
  const expandAllMaxDepth = () => local.expandAllMaxDepth ?? 8;
  const exp = createJsonExpansion({
    value: () => local.value,
    initialExpandDepth,
    expandAllMaxDepth,
  });
  const rootIsContainer = createMemo(() =>
    isContainer(classifyValue(local.value))
  );
  const rowCopy = () => (local.hideRowCopy === true ? undefined : local.copy);

  return (
    <div
      class="box bg-surface-muted border border-border rounded-control"
      classList={{ [String(local.class)]: true }}
      style={local.style}
      {...dataAttrs({ component: 'JsonView', ...local.dataSet })}
    >
      <Show when={local.label !== undefined}>
        <JsonViewLabel label={local.label} />
      </Show>
      <Show when={local.hideToolbar !== true}>
        <JsonViewToolbar
          rootIsContainer={rootIsContainer()}
          onExpandAll={exp.expandAll}
          onCollapseAll={exp.collapseAll}
          onReset={exp.reset}
          copy={local.copy}
          value={local.value}
        />
      </Show>
      <ScrollView
        role="tree"
        flushEdge={false}
        tone="surface"
        maxHeight={local.maxHeight}
        paddingY="sm"
        paddingX="md"
      >
        <JsonViewNode
          nodeKey={null}
          value={local.value}
          path={ROOT_PATH}
          depth={0}
          isExpanded={exp.isExpanded}
          onToggle={exp.toggle}
          copy={rowCopy()}
        />
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
    <div
      class="box flex-row items-center gap-1 px-2 py-1 border-b border-border flex-wrap"
      role="toolbar"
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
    </div>
  );
}

function ToolbarButton(props: {
  label: string;
  icon?: IconComponent | undefined;
  iconRotated?: boolean | undefined;
  onClick: () => void;
  disabled?: boolean | undefined;
}): JSX.Element {
  return (
    <button
      class="clickable clickableOpacity flex-row items-center gap-1 px-2 py-1 min-h-11 rounded-sm"
      type="button"
      style={{ opacity: props.disabled ? 0.4 : 1 }}
      onClick={() => props.onClick()}
      disabled={props.disabled ?? false}
    >
      <Show when={props.icon}>
        {(icon) => (
          <div
            class="box"
            classList={{
              [styles['rotated'] ?? '']: props.iconRotated === true,
            }}
          >
            <Dynamic component={icon()} size={10} />
          </div>
        )}
      </Show>
      <p class="text textCaption text-tint">{props.label}</p>
    </button>
  );
}
