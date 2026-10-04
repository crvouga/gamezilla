/**
 * The dragged piece is drawn by an *avatar*: one element per board that lives
 * in the browser's top layer (Popover API), or — where that is missing — a
 * fixed element at the maximum z-index on `<body>`. So it is above
 * everything on the page and never clipped by the board or any scrolling /
 * `overflow: hidden` ancestor: a piece dragged off the board stays visible.
 *
 * The avatar is placed straight from the pointer's viewport position, so a
 * `pointermove` is one `transform` write with no layout math. The real piece
 * stays on its square, faded (`liftedClass`), as the origin marker; on
 * release it takes over from the avatar's exact spot and settles from there.
 *
 * Writes happen in the event handler, not a later animation frame: browsers
 * already deliver `pointermove` once per frame, so deferring to rAF would
 * only add a frame of latency between finger and piece.
 */

/**
 * Touch: the dragged piece is shown this much larger — a fingertip covers
 * about a square on a phone board, so a 1× piece would vanish under it.
 */
export const TOUCH_ZOOM = 1.8;
/**
 * Touch: where the finger holds the grown piece, as a fraction of its height
 * from the top — the base of the Cburnett art (its feet sit at ~39/45 of the
 * box). The whole piece shows above the finger and the drop square is the
 * one under the fingertip, right below the piece's base.
 */
export const TOUCH_BASE_ANCHOR = 0.88;

/** How the avatar sits on the pointer. */
export type DragGeometry = {
  /** One square in pixels. */
  readonly cellPx: number;
  /** Avatar size in squares. */
  readonly zoom: number;
  /** Pointer height inside the avatar, 0 (top) … 1 (bottom). */
  readonly anchorY: number;
};

/** Mouse / pen: the piece centred under the cursor, true size (chess.com). */
export function dragGeometry(cellPx: number, touch: boolean): DragGeometry {
  return touch
    ? { cellPx, zoom: TOUCH_ZOOM, anchorY: TOUCH_BASE_ANCHOR }
    : { cellPx, zoom: 1, anchorY: 0.5 };
}

/**
 * The avatar's transform for a pointer at (x, y). The avatar is *sized*
 * (not scaled) to its zoom, so a grown piece is drawn crisp.
 */
export function avatarTransform(x: number, y: number, g: DragGeometry): string {
  const side = g.cellPx * g.zoom;
  return `translate(${x - side / 2}px, ${y - side * g.anchorY}px)`;
}

/**
 * The real piece's transform that paints it exactly where the avatar is
 * (pointer at x, y in board pixels): same centre, grown by `scale` so its
 * settle animates the zoom away.
 */
export function handoverTransform(
  x: number,
  y: number,
  g: DragGeometry
): string {
  const side = g.cellPx * g.zoom;
  const cx = x;
  const cy = y - side * g.anchorY + side / 2;
  const translate = `translate(${cx - g.cellPx / 2}px, ${cy - g.cellPx / 2}px)`;
  return g.zoom === 1 ? translate : `${translate} scale(${g.zoom})`;
}

export type PieceDragClasses = {
  /** Draws a piece from `data-piece` (the board's piece class). */
  readonly piece: string;
  /** The avatar element. */
  readonly avatar: string;
  /** The avatar under a finger: see-through, so the target square shows. */
  readonly avatarTouch: string;
  /** The real piece while its avatar is out. */
  readonly lifted: string;
};

export type PieceDragBegin = {
  readonly element: HTMLElement;
  /** Pointer position (viewport pixels). */
  readonly clientX: number;
  readonly clientY: number;
  /** One square in pixels. */
  readonly cellPx: number;
  readonly touch: boolean;
};

export type PieceDrag = {
  readonly begin: (args: PieceDragBegin) => void;
  /** Follow the pointer (viewport pixels). */
  readonly move: (clientX: number, clientY: number) => void;
  /**
   * Release: the real piece is put exactly where the avatar was, in board
   * pixels from the board's *current* origin (viewport pixels — the page may
   * have scrolled mid-drag), and returned so a settle / spring-back can
   * start from there.
   */
  readonly end: (origin: {
    readonly left: number;
    readonly top: number;
  }) => HTMLElement | null;
  readonly element: () => HTMLElement | null;
  /** Remove the avatar from the page (board unmount). */
  readonly dispose: () => void;
};

function createAvatar(doc: Document, classes: PieceDragClasses): HTMLElement {
  const avatar = doc.createElement('div');
  avatar.className = `${classes.piece} ${classes.avatar}`;
  avatar.setAttribute('aria-hidden', 'true');
  avatar.dataset['dragAvatar'] = '';
  // Top layer where the engine has it (the DOM typings claim it always
  // does; older engines keep the fixed / max z-index fallback).
  if ('showPopover' in avatar) avatar.setAttribute('popover', 'manual');
  doc.body.append(avatar);
  return avatar;
}

/** Popover calls throw on a state mismatch (already open / closed). */
function togglePopover(avatar: HTMLElement, open: boolean): void {
  if (!avatar.hasAttribute('popover')) return;
  try {
    if (open) avatar.showPopover();
    else avatar.hidePopover();
  } catch {
    // Already in that state; the fixed / z-index fallback still applies.
  }
}

/**
 * Hidden means `display: none` (the popover's own closed state, or ours in
 * the fallback): no box and no compositor layer between drags.
 */
function showAvatar(avatar: HTMLElement): void {
  avatar.style.display = 'block';
  togglePopover(avatar, true);
}

function hideAvatar(avatar: HTMLElement): void {
  togglePopover(avatar, false);
  avatar.style.display = 'none';
}

export function createPieceDrag(classes: PieceDragClasses): PieceDrag {
  let avatar: HTMLElement | null = null;
  let element: HTMLElement | null = null;
  let geometry: DragGeometry | null = null;
  let x = 0;
  let y = 0;

  const write = (): void => {
    if (avatar === null || geometry === null) return;
    avatar.style.transform = avatarTransform(x, y, geometry);
  };

  return {
    begin(args) {
      avatar ??= createAvatar(args.element.ownerDocument, classes);
      element = args.element;
      geometry = dragGeometry(args.cellPx, args.touch);
      x = args.clientX;
      y = args.clientY;
      avatar.dataset['piece'] = args.element.dataset['piece'] ?? '';
      avatar.classList.toggle(classes.avatarTouch, args.touch);
      const side = `${geometry.cellPx * geometry.zoom}px`;
      avatar.style.width = side;
      avatar.style.height = side;
      write();
      showAvatar(avatar);
      args.element.classList.add(classes.lifted);
    },
    move(clientX, clientY) {
      if (element === null) return;
      x = clientX;
      y = clientY;
      write();
    },
    end(origin) {
      const released = element;
      const g = geometry;
      element = null;
      geometry = null;
      if (avatar !== null) hideAvatar(avatar);
      if (released === null || g === null) return released;
      // Hand over: the piece appears where the avatar was, in board pixels.
      released.style.transform = handoverTransform(
        x - origin.left,
        y - origin.top,
        g
      );
      released.classList.remove(classes.lifted);
      return released;
    },
    element: () => element,
    dispose() {
      avatar?.remove();
      avatar = null;
      element = null;
      geometry = null;
    },
  };
}

export type HoverSquare = {
  /** Ring the screen cell (col / row from the top-left, 0..7). */
  readonly show: (col: number, row: number) => void;
  readonly hide: () => void;
  /** Touch: a large halo (the finger hides the square itself). */
  readonly setTouch: (touch: boolean) => void;
};

/** The ring under a dragged piece; writes only when the cell changes. */
export function createHoverSquare(
  element: () => HTMLElement | undefined,
  touchClass: string
): HoverSquare {
  let shown = -1;
  return {
    show(col, row) {
      const node = element();
      const cell = row * 8 + col;
      if (node === undefined || cell === shown) return;
      if (shown < 0) node.style.visibility = 'visible';
      shown = cell;
      node.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
    },
    hide() {
      const node = element();
      if (node === undefined || shown < 0) return;
      shown = -1;
      node.style.visibility = 'hidden';
    },
    setTouch(touch) {
      element()?.classList.toggle(touchClass, touch);
    },
  };
}
