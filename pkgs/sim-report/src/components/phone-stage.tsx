import type { HtmlReportTest, ReportSnapshotBlob, ReportStep } from '@pkgs/sim';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { useReport } from '../app/report-context';
import type { ReportNav } from '../app/use-report-nav';
import type { FlatFrame } from '../lib/frames';
import { orderedUiBlobs } from '../lib/frames';
import { showPress, zoomMode } from '../lib/hash';
import { PHONE_H, PHONE_W, zoomScale } from '../lib/phone';
import {
  applyPhoneScale,
  type PhoneLayers,
  paintPhoneBlob,
} from '../lib/phone-paint';

function PressOverlay(props: {
  step: ReportStep | null;
  nodeId: string;
  route: ReturnType<ReportNav['route']>;
  scale: number;
}) {
  const hit = () => {
    const step = props.step;
    if (!showPress(props.route) || !step?.hit?.rect) return null;
    if (step.actorId && props.nodeId && step.actorId !== props.nodeId)
      return null;
    return step.hit;
  };
  return (
    <Show when={hit()}>
      {(h) => {
        const rect = h().rect;
        if (!rect) return null;
        const point = h().point || { xRatio: 0.5, yRatio: 0.5 };
        return (
          <div
            class="sr-press-overlay"
            style={{
              transform: `scale(${props.scale})`,
              'transform-origin': 'top left',
              width: `${PHONE_W}px`,
              height: `${PHONE_H}px`,
            }}
          >
            <div
              class="sr-press-ring"
              style={{
                left: `${rect.x}px`,
                top: `${rect.y}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
              }}
            />
            <div
              class="sr-press-point"
              style={{
                left: `${rect.x + rect.width * point.xRatio}px`,
                top: `${rect.y + rect.height * point.yRatio}px`,
              }}
            />
          </div>
        );
      }}
    </Show>
  );
}

function PhonePanel(props: {
  test: HtmlReportTest;
  blob: ReportSnapshotBlob | null;
  nodeId: string;
  step: ReportStep | null;
  nav: ReportNav;
  active: boolean;
  focused: boolean;
  onFocus: () => void;
}) {
  const report = useReport();
  let wrapEl: HTMLDivElement | undefined;
  let frameEl: HTMLDivElement | undefined;
  const [scale, setScale] = createSignal(0.4);
  const layers: PhoneLayers = {
    frameEl: document.createElement('div'),
    paintGen: 0,
  };

  createEffect(() => {
    if (!frameEl || !props.blob) return;
    layers.frameEl = frameEl;
    paintPhoneBlob({
      layers,
      test: props.test,
      blob: props.blob,
      route: props.nav.route(),
      stepActorId: props.step?.actorId,
      hit: props.step?.hit,
      frameCss: report.frameCss,
    });
  });

  createEffect(() => {
    if (frameEl) applyPhoneScale(frameEl, scale());
  });

  onMount(() => {
    const fit = () => {
      if (!wrapEl || !frameEl) return;
      const nextScale = zoomScale(
        zoomMode(props.nav.route()),
        wrapEl.clientWidth,
        wrapEl.clientHeight
      );
      setScale(nextScale);
      applyPhoneScale(frameEl, nextScale);
    };
    fit();
    const resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    if (resizeObserver && wrapEl) resizeObserver.observe(wrapEl);
    else window.addEventListener('resize', fit);
    onCleanup(() => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', fit);
    });
  });

  const activate = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    props.onFocus();
  };

  return (
    <div
      class="sr-client"
      classList={{
        active: props.active,
        focused: props.focused,
        empty: !props.blob,
      }}
      role="button"
      tabindex="0"
      aria-label={`Focus ${props.nodeId}`}
      aria-current={props.focused ? 'true' : undefined}
      onClick={() => props.onFocus()}
      onKeyDown={activate}
    >
      <div class="sr-client-label">
        <span class={`sr-dot ${props.active ? 'passed' : ''}`} />
        <span class="actor">{props.nodeId}</span>
      </div>
      <div class="sr-phone" ref={wrapEl}>
        <Show
          when={props.blob}
          fallback={
            <div class="sr-client-empty">No snapshot in this frame</div>
          }
        >
          <div class="frame" ref={frameEl}>
            <PressOverlay
              step={props.step}
              nodeId={props.nodeId}
              route={props.nav.route()}
              scale={scale()}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}

export function PhoneStage(props: {
  test: HtmlReportTest;
  selected: FlatFrame | null;
  nav: ReportNav;
  mode: 'single' | 'multi';
  node: string | null;
}) {
  const list = createMemo(() => {
    const ordered = orderedUiBlobs(props.selected, props.test);
    if (props.mode === 'single') {
      const one =
        ordered.find((entry) => entry.nodeId === (props.node || '')) ||
        ordered.find((entry) => entry.blob) ||
        ordered[0];
      return one ? [one] : [];
    }
    return ordered;
  });

  return (
    <Show
      when={list().length > 0}
      fallback={
        <div class="sr-nodata">
          {props.selected
            ? 'No UI snapshot in this frame'
            : 'This test captured no frames'}
        </div>
      }
    >
      <div
        class="sr-stage"
        classList={{
          single: props.mode === 'single',
          multi: props.mode === 'multi',
        }}
        aria-label={
          props.mode === 'multi' ? 'Client snapshots' : 'Client snapshot'
        }
      >
        <For each={list()}>
          {(entry) => {
            const active = () =>
              entry.nodeId === (props.node || '') ||
              props.selected?.step.actorId === entry.nodeId;
            const focused = () => entry.nodeId === (props.node || '');
            return (
              <PhonePanel
                test={props.test}
                blob={entry.blob}
                nodeId={entry.nodeId}
                step={props.selected?.step ?? null}
                nav={props.nav}
                active={active()}
                focused={focused()}
                onFocus={() => props.nav.goFrame(props.selected, entry.nodeId)}
              />
            );
          }}
        </For>
      </div>
    </Show>
  );
}
