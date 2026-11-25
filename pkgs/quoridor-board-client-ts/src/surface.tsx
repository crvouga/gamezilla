import type { JSX } from '@solidjs/web';
import { createEffect, createSignal } from 'solid-js';
import { BoardCamera } from './board-camera';
import { BoardContacts, type BoardInput } from './contacts';
import './board.css';

type SurfaceProps = BoardInput & {
  readonly children: JSX.Element;
  readonly zoomLabel: string;
  readonly fitLabel: string;
  readonly revision: string;
  readonly syncKey: number;
};

function bindContacts(
  board: HTMLElement,
  contacts: BoardContacts,
  options: AddEventListenerOptions
) {
  board.addEventListener('pointerdown', (e) => contacts.down(e), options);
  board.addEventListener('pointermove', (e) => contacts.move(e), options);
  board.addEventListener('pointerup', (e) => contacts.up(e), options);
  board.addEventListener(
    'lostpointercapture',
    (e) => contacts.lost(e),
    options
  );
  board.addEventListener('pointercancel', () => contacts.cancel(), options);
  board.addEventListener(
    'click',
    (e) => {
      if (e.detail && contacts.suppressClick) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    options
  );
  board.ownerDocument.addEventListener(
    'pointerdown',
    (event) => {
      if (event.target instanceof Node && !board.contains(event.target))
        contacts.cancel();
    },
    options
  );
  board.ownerDocument.defaultView?.addEventListener(
    'blur',
    () => contacts.cancel(),
    { ...options, capture: false }
  );
  board.ownerDocument.addEventListener(
    'visibilitychange',
    () => contacts.cancel(),
    options
  );
}

function connect(
  host: HTMLElement,
  board: HTMLElement,
  props: SurfaceProps,
  onZoom: (zoomed: boolean) => void
) {
  const camera = new BoardCamera(host, board, onZoom);
  const contacts = new BoardContacts(camera, props);
  const scope = new AbortController();
  const options = { signal: scope.signal, capture: true };
  bindContacts(board, contacts, options);
  board.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey && camera.scale === 1) return;
      e.preventDefault();
      contacts.cancel();
      const at = { x: e.clientX, y: e.clientY };
      const unit =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? board.offsetHeight : 1;
      if (e.ctrlKey || e.metaKey)
        camera.move(at, at, Math.exp((-e.deltaY * unit) / 240));
      else
        camera.move(
          at,
          { x: at.x - e.deltaX * unit, y: at.y - e.deltaY * unit },
          1
        );
    },
    { ...options, passive: false }
  );
  host.addEventListener(
    'keydown',
    (e) => {
      if (
        e.key === 'Escape' ||
        e.key.startsWith('Arrow') ||
        e.key === 'Home' ||
        e.key === 'End'
      ) {
        contacts.cancel();
        camera.fit();
      }
    },
    options
  );
  const zoom = host.querySelector<HTMLButtonElement>('[data-zoom-control]');
  zoom?.addEventListener(
    'click',
    () => {
      contacts.cancel();
      if (camera.scale > 1) camera.fit();
      else camera.move(camera.center(), camera.center(), 2);
    },
    options
  );
  camera.resize();
  const observer =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
          contacts.cancel();
          camera.resize();
        });
  observer?.observe(board);
  return {
    cancel: () => contacts.cancel(),
    dispose() {
      scope.abort();
      contacts.cancel();
      observer?.disconnect();
    },
  };
}

/** Owns only the playable grid and its fitted viewing window. */
export function QuoridorSurface(props: SurfaceProps): JSX.Element {
  const [host, setHost] = createSignal<HTMLDivElement>();
  const [zoomed, setZoomed] = createSignal(false);
  let controls: ReturnType<typeof connect> | undefined;
  createEffect(host, (element) => {
    const board = element?.querySelector<HTMLElement>(
      '[data-board-theme="quoridor"]'
    );
    if (!element || !board) return;
    controls = connect(element, board, props, setZoomed);
    return () => controls?.dispose();
  });
  createEffect(
    () => [props.revision, props.syncKey, props.interactive, props.tool],
    () => controls?.cancel()
  );
  return (
    <div
      data-component="QuoridorSurface"
      data-quoridor-surface=""
      ref={setHost}
    >
      {props.children}
      <button
        type="button"
        data-zoom-control=""
        aria-label={zoomed() ? props.fitLabel : props.zoomLabel}
        title={zoomed() ? props.fitLabel : props.zoomLabel}
      >
        <span data-zoom-in="" aria-hidden="true">
          ＋
        </span>
        <span data-zoom-out="" aria-hidden="true">
          ↙
        </span>
      </button>
    </div>
  );
}
