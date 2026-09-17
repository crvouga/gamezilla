import type { HtmlReportTest, ReportSnapshotBlob, ReportStep } from '@pkgs/sim';
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { useReport } from '../app/report-context';
import type { ReportNav } from '../app/use-report-nav';
import type { FlatFrame } from '../lib/frames';
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
    if (step.actorId && props.nodeId && step.actorId !== props.nodeId) {
      return null;
    }
    return step.hit;
  };
  return (
    <Show when={hit()}>
      {(h) => {
        const r = h().rect;
        if (!r) return null;
        const pr = h().point || { xRatio: 0.5, yRatio: 0.5 };
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
                left: `${r.x}px`,
                top: `${r.y}px`,
                width: `${r.width}px`,
                height: `${r.height}px`,
              }}
            />
            <div
              class="sr-press-point"
              style={{
                left: `${r.x + r.width * pr.xRatio}px`,
                top: `${r.y + r.height * pr.yRatio}px`,
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
  blob: ReportSnapshotBlob;
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
    if (!frameEl) return;
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
      const s = zoomScale(
        zoomMode(props.nav.route()),
        wrapEl.clientWidth,
        wrapEl.clientHeight
      );
      setScale(s);
      applyPhoneScale(frameEl, s);
    };
    fit();
    const ro =
      typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    if (ro && wrapEl) ro.observe(wrapEl);
    else window.addEventListener('resize', fit);
    onCleanup(() => {
      ro?.disconnect();
      window.removeEventListener('resize', fit);
    });
  });

  return (
    <div
      class="sr-client"
      classList={{ active: props.active, focused: props.focused }}
      onClick={() => props.onFocus()}
    >
      <div class="sr-client-label">
        <span class={`sr-dot ${props.active ? 'passed' : ''}`} />
        <span class="actor">{props.blob.nodeId || props.blob.name}</span>
      </div>
      <div class="sr-phone" ref={wrapEl}>
        <div class="frame" ref={frameEl}>
          <PressOverlay
            step={props.step}
            nodeId={props.blob.nodeId || ''}
            route={props.nav.route()}
            scale={scale()}
          />
        </div>
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
  blobs: ReportSnapshotBlob[];
}) {
  const list = () => {
    if (props.mode === 'single') {
      const one =
        props.blobs.find((b) => (b.nodeId || '') === (props.node || '')) ||
        props.blobs[0];
      return one ? [one] : [];
    }
    return props.blobs;
  };

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
      >
        <For each={list()}>
          {(blob) => {
            const active = () =>
              (blob.nodeId || '') === (props.node || '') ||
              props.selected?.step.actorId === blob.nodeId;
            const focused = () => (blob.nodeId || '') === (props.node || '');
            return (
              <PhonePanel
                test={props.test}
                blob={blob}
                step={props.selected?.step ?? null}
                nav={props.nav}
                active={active()}
                focused={focused()}
                onFocus={() =>
                  props.nav.goFrame(props.selected, blob.nodeId || '')
                }
              />
            );
          }}
        </For>
      </div>
    </Show>
  );
}
