import { type Camera, FIT, moveCamera, type Point } from './camera';
import { contactGesture, type ShipDrag } from './contact';

type GridPorts = {
  view: () => Camera;
  setView: (c: Camera) => void;
  pickup: (cell: string) => ShipDrag | undefined;
};
const point = (event: MouseEvent): Point => ({
  x: event.clientX,
  y: event.clientY,
});

function bindContacts(
  root: HTMLElement,
  gesture: ReturnType<typeof contactGesture>,
  opts: { signal: AbortSignal }
) {
  const doc = root.ownerDocument;
  const win = window;
  doc.addEventListener(
    'pointerdown',
    (e) => {
      if (!root.contains(e.target as Node)) gesture.cancel();
    },
    { ...opts, capture: true }
  );
  root.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button === 0)
        gesture.down(
          e.pointerId,
          point(e),
          (e.target as Element).closest<HTMLElement>('[data-cell]')?.dataset[
            'cell'
          ] ?? null
        );
    },
    opts
  );
  win.addEventListener(
    'pointermove',
    (e) => {
      if (!gesture.active(e.pointerId)) return;
      gesture.move(e.pointerId, point(e));
      if (
        gesture.suppressClick() &&
        e.isTrusted &&
        !root.hasPointerCapture(e.pointerId) &&
        e.buttons
      ) {
        root.setPointerCapture(e.pointerId);
      }
    },
    opts
  );
  win.addEventListener(
    'pointerup',
    (e) => gesture.up(e.pointerId, point(e)),
    opts
  );
  win.addEventListener(
    'pointercancel',
    (e) => {
      if (gesture.active(e.pointerId)) gesture.cancel();
    },
    opts
  );
  root.addEventListener(
    'lostpointercapture',
    (e) => {
      if (e.target === root && gesture.active(e.pointerId)) gesture.cancel();
    },
    opts
  );
  win.addEventListener('blur', gesture.cancel, opts);
  doc.addEventListener('visibilitychange', gesture.cancel, opts);
  root.addEventListener(
    'click',
    (e) => {
      if (gesture.suppressClick() && e.detail) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    { ...opts, capture: true }
  );
}

export function bindGrid(root: HTMLElement, ports: GridPorts) {
  const doc = root.ownerDocument;
  const win = window;
  const abort = new AbortController();
  const opts = { signal: abort.signal };
  const navigate = (from: Point, to: Point, factor: number) =>
    ports.setView(
      moveCamera(ports.view(), root.getBoundingClientRect(), {
        from,
        to,
        factor,
      })
    );
  const gesture = contactGesture({
    pickup: ports.pickup,
    navigate,
    magnified: () => ports.view().scale > 1,
    cellAt: ({ x, y }) => {
      const node = doc
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>('[data-cell]');
      return node && root.contains(node)
        ? (node.dataset['cell'] ?? null)
        : null;
    },
  });
  bindContacts(root, gesture, opts);
  root.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && ports.view().scale === 1) return;
      e.preventDefault();
      gesture.cancel();
      const p = point(e);
      const unit =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? root.clientHeight : 1;
      if (e.ctrlKey) navigate(p, p, Math.exp((-e.deltaY * unit) / 300));
      else
        navigate(p, { x: p.x - e.deltaX * unit, y: p.y - e.deltaY * unit }, 1);
    },
    { ...opts, passive: false }
  );
  root.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' || e.key === '0') {
        gesture.cancel();
        ports.setView(FIT);
        return;
      }
      if (!['+', '=', '-'].includes(e.key) || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const box = (e.target as HTMLElement).getBoundingClientRect();
      const at = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      navigate(at, at, e.key === '-' ? 1 / 1.5 : 1.5);
    },
    opts
  );
  const reset = () => {
    gesture.cancel();
    ports.setView(FIT);
  };
  win.addEventListener('resize', reset, opts);
  return () => {
    abort.abort();
    gesture.cancel();
  };
}
