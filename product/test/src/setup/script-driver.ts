/**
 * A {@link Driver} whose every step is a {@link Run} step: mutations are
 * `s.apply` checkpoints, waits are `s.until` / `s.elapse` wrapped in
 * `s.record`, reads are `s.read`. Nothing here touches the product surface —
 * that is the scenario system's job.
 */

import type { Run } from '@pkgs/sim';
import type {
  AssertionOptions,
  Driver,
  DriverKey,
  DriverNode,
  DriverWaitOptions,
  ScrollDirection,
  TapPosition,
  UiWaitOptions,
  WaitState,
  WaitTextCondition,
} from '@pkgs/ui-testing';
import { formatTestIdPath, isWaitTextCondition } from '@pkgs/ui-testing';

import {
  actorHtml,
  nodeLayout,
  nodeText,
  type ProductSim,
  type UiOp,
  uiOp,
  visible,
} from '../sim';

type Extra = UiOp['extra'];
type ProductScript = Run<ProductSim>;

const DEFAULT_UI_WAIT_MS = 5_000;
const UI_STEP_MS = 50;

function extraOf(opts?: UiWaitOptions, more?: Extra): Extra {
  const timeoutMs = opts?.timeoutMs;
  return {
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    ...more,
  };
}

function maxMsOf(options?: { readonly timeoutMs?: number }): number {
  return options?.timeoutMs ?? DEFAULT_UI_WAIT_MS;
}

async function waitVisible(
  s: ProductScript,
  actorId: string,
  path: readonly string[],
  options?: DriverWaitOptions
): Promise<void> {
  await s.until((s) => visible(s, actorId, path), {
    stepMs: UI_STEP_MS,
    maxMs: maxMsOf(options),
  });
}

async function waitHidden(
  s: ProductScript,
  actorId: string,
  path: readonly string[],
  options?: DriverWaitOptions
): Promise<void> {
  await s.until((s) => visible(s, actorId, path), {
    stepMs: UI_STEP_MS,
    maxMs: maxMsOf(options),
    pred: (v) => v === false,
  });
}

async function waitText(args: {
  readonly s: ProductScript;
  readonly actorId: string;
  readonly path: readonly string[];
  readonly expected: string;
  readonly exact: boolean;
  readonly options?: DriverWaitOptions;
}): Promise<void> {
  await args.s.until((s) => nodeText(s, args.actorId, args.path), {
    stepMs: UI_STEP_MS,
    maxMs: maxMsOf(args.options),
    pred: (v) => {
      if (typeof v !== 'string') return false;
      return args.exact ? v === args.expected : v.includes(args.expected);
    },
  });
}

function recordWait(
  s: ProductScript,
  meta: {
    readonly title: string;
    readonly actorId: string;
    readonly path: readonly string[];
    readonly detail: string;
  },
  fn: () => Promise<void>
): Promise<void> {
  return s.record(
    {
      kind: 'waitFor',
      title: meta.title,
      actorId: meta.actorId,
      selector: formatTestIdPath(meta.path),
      detail: meta.detail,
    },
    fn
  );
}

function nodeExpect(
  s: ProductScript,
  actorId: string,
  path: readonly string[]
): DriverNode['expect'] {
  const selector = formatTestIdPath(path);
  return {
    visible: (options?: AssertionOptions) =>
      recordWait(
        s,
        {
          title: `expect.visible ${selector}`,
          actorId,
          path,
          detail: 'visible',
        },
        () => waitVisible(s, actorId, path, options)
      ),
    hidden: (options?: AssertionOptions) =>
      recordWait(
        s,
        {
          title: `expect.hidden ${selector}`,
          actorId,
          path,
          detail: 'hidden',
        },
        () => waitHidden(s, actorId, path, options)
      ),
    text: (
      expected: string,
      options?: AssertionOptions & { exact?: boolean }
    ) =>
      recordWait(
        s,
        {
          title: `expect.text ${selector}`,
          actorId,
          path,
          detail: `text=${JSON.stringify(expected)}`,
        },
        () =>
          waitText({
            s,
            actorId,
            path,
            expected,
            exact: options?.exact ?? true,
            ...(options !== undefined ? { options } : {}),
          })
      ),
  };
}

function runWait(args: {
  readonly s: ProductScript;
  readonly actorId: string;
  readonly path: readonly string[];
  readonly state: WaitState | WaitTextCondition;
  readonly options?: DriverWaitOptions;
}): Promise<void> {
  const selector = formatTestIdPath(args.path);
  if (!isWaitTextCondition(args.state)) {
    if (args.state === 'visible') {
      return recordWait(
        args.s,
        {
          title: `waitFor visible ${selector}`,
          actorId: args.actorId,
          path: args.path,
          detail: 'visible',
        },
        () => waitVisible(args.s, args.actorId, args.path, args.options)
      );
    }
    return recordWait(
      args.s,
      {
        title: `waitFor hidden ${selector}`,
        actorId: args.actorId,
        path: args.path,
        detail: 'hidden',
      },
      () => waitHidden(args.s, args.actorId, args.path, args.options)
    );
  }
  const textState = args.state;
  return recordWait(
    args.s,
    {
      title: `waitFor text ${selector}`,
      actorId: args.actorId,
      path: args.path,
      detail: `text=${JSON.stringify(textState.text)}`,
    },
    () =>
      waitText({
        s: args.s,
        actorId: args.actorId,
        path: args.path,
        expected: textState.text,
        exact: textState.exact ?? true,
        ...(args.options !== undefined ? { options: args.options } : {}),
      })
  );
}

function wrapNode(
  s: ProductScript,
  actorId: string,
  path: readonly string[]
): DriverNode {
  const op = (name: string, extra: Extra) =>
    s.apply(uiOp, { actorId, op: name, path, extra });
  return {
    get: (testId) => wrapNode(s, actorId, [...path, testId]),
    tap: (options) => op('tap', extraOf(options)),
    tapAt: (position: TapPosition) =>
      op('tapAt', { xRatio: position.xRatio, yRatio: position.yRatio }),
    drag: (from, to) =>
      op('drag', {
        fromX: from.xRatio,
        fromY: from.yRatio,
        toX: to.xRatio,
        toY: to.yRatio,
      }),
    layout: () => s.read(nodeLayout, actorId, path),
    input: (text, options) => op('input', extraOf(options, { text })),
    clear: () => op('clear', {}),
    key: (key: DriverKey) => op('key', { key }),
    scroll: (direction: ScrollDirection, amount) =>
      op(
        'scroll',
        extraOf(undefined, {
          direction,
          ...(amount !== undefined ? { amount } : {}),
        })
      ),
    wait: (state, options) =>
      runWait({
        s,
        actorId,
        path,
        state,
        ...(options !== undefined ? { options } : {}),
      }),
    expect: nodeExpect(s, actorId, path),
    isVisible: () => s.read(visible, actorId, path),
    text: () => s.read(nodeText, actorId, path),
  };
}

/**
 * Build the actor-scoped driver. `launch` / `close` are no-ops: actor lifecycle
 * belongs to the `spawnActor` / `resetActor` actions.
 */
export function createScriptDriver(s: ProductScript, actorId: string): Driver {
  return {
    kind: 'dst-script',
    launch: async () => undefined,
    close: async () => undefined,
    get: (testId) => wrapNode(s, actorId, [testId]),
    key: (key) =>
      s.apply(uiOp, { actorId, op: 'key', path: [], extra: { key } }),
    // Memo keys fingerprint the args, so pass `stylesheetHref` only when set.
    snapshotHtml: (options) =>
      options?.stylesheetHref === undefined
        ? s.read(actorHtml, actorId)
        : s.read(actorHtml, actorId, options.stylesheetHref),
  };
}
