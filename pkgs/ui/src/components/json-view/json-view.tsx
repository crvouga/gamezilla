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
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { ChevronRightIcon, CopyIcon, type IconComponent } from '../icons';
import { ScrollView } from '../scroll-view';
import { Text } from '../text';
import styles from './json-view.module.css';
import {
  classifyValue,
  collapseAllState,
  expandAllState,
  isContainer,
  JSON_EXPANSION_INITIAL,
  type JsonExpansionState,
  type JsonPath,
  resolveExpanded,
  safeStringify,
  toggleExpansion,
} from './json-view-logic';
import { type JsonViewCopy, JsonViewNode } from './json-view-node';

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
  /** Cap on inner scroll height (px). When omitted the tree grows naturally. */
  maxHeight?: number | undefined;
  /** Outer wrapper sx shorthand. */
  sx?: SxInput | undefined;
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
    <Box
      sx={{
        paddingHorizontal: 3,
        paddingTop: 2,
        paddingBottom: 1,
        borderBottomWidth: 1,
        borderColor: 'border',
      }}
    >
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={props.label}
      />
    </Box>
  );
}

export function JsonView(props: JsonViewProps): JSX.Element {
  const initialExpandDepth = () => props.initialExpandDepth ?? 1;
  const expandAllMaxDepth = () => props.expandAllMaxDepth ?? 8;
  const exp = createJsonExpansion({
    value: () => props.value,
    initialExpandDepth,
    expandAllMaxDepth,
  });
  const rootIsContainer = createMemo(() =>
    isContainer(classifyValue(props.value))
  );
  const rowCopy = () => (props.hideRowCopy === true ? undefined : props.copy);

  return (
    <Box
      dataSet={{ component: 'JsonView', ...props.dataSet }}
      sx={[
        {
          background: 'surfaceMuted',
          borderWidth: 1,
          borderColor: 'border',
          borderRadius: 'md',
        },
        props.sx,
      ]}
    >
      <Show when={props.label !== undefined}>
        <JsonViewLabel label={props.label} />
      </Show>
      <Show when={props.hideToolbar !== true}>
        <JsonViewToolbar
          rootIsContainer={rootIsContainer()}
          onExpandAll={exp.expandAll}
          onCollapseAll={exp.collapseAll}
          onReset={exp.reset}
          copy={props.copy}
          value={props.value}
        />
      </Show>
      <ScrollView
        role="tree"
        flushEdge={false}
        frameSx={[
          { background: 'surface' },
          props.maxHeight !== undefined && { maxHeight: props.maxHeight },
        ]}
        sx={{ paddingVertical: 2, paddingHorizontal: 3 }}
      >
        <JsonViewNode
          nodeKey={null}
          value={props.value}
          path={ROOT_PATH}
          depth={0}
          isExpanded={exp.isExpanded}
          onToggle={exp.toggle}
          copy={rowCopy()}
        />
      </ScrollView>
    </Box>
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
    <Box
      role="toolbar"
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        paddingHorizontal: 2,
        paddingVertical: 1,
        borderBottomWidth: 1,
        borderColor: 'border',
        flexWrap: 'wrap',
      }}
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
      <Box sx={{ flex: 1 }} />
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
    </Box>
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
    <Clickable
      onClick={() => props.onClick()}
      disabled={props.disabled ?? false}
      feedback="opacity"
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        minHeight: 44,
        borderRadius: 6,
        opacity: props.disabled ? 0.4 : 1,
      }}
    >
      <Show when={props.icon}>
        {(icon) => (
          <Box class={props.iconRotated ? styles['rotated'] : undefined}>
            <Dynamic component={icon()} size={10} />
          </Box>
        )}
      </Show>
      <Text variant="caption" sx={{ color: 'tint' }} label={props.label} />
    </Clickable>
  );
}
