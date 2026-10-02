/** Browser reads of painted geometry and the native compositor timeline. */
export const frameRead = `(() => {
  const board = document.querySelector('[data-testid="browser-board"]');
  const attacker = board.querySelector('[data-piece-square="d5"]');
  const source = board.querySelector('[data-square="e4"]');
  const target = board.querySelector('[data-square="d5"]');
  const center = el => { const r = el.getBoundingClientRect(); return {x: r.left+r.width/2, y: r.top+r.height/2}; };
  const ghosts = [...board.querySelectorAll('[data-piece]:not([data-piece-square])')];
  return { attacker: center(attacker), source: center(source), target: center(target),
    pieces: board.querySelectorAll('[data-piece-square]').length,
    ghosts: ghosts.map(el => ({piece: el.dataset.piece, opacity: Number(getComputedStyle(el).opacity), center: center(el)})),
    animations: document.getAnimations().map(a => ({time: a.currentTime, state: a.playState,
      keys: a.effect.getKeyframes().map(f => Object.keys(f).filter(k => !['offset','easing','composite','computedOffset'].includes(k)))}))
  };
})()`;
export type Frame = {
  readonly attacker: { x: number; y: number };
  readonly source: { x: number; y: number };
  readonly target: { x: number; y: number };
  readonly pieces: number;
  readonly ghosts: readonly {
    piece: string;
    opacity: number;
    center: { x: number; y: number };
  }[];
  readonly animations: readonly {
    time: number;
    state: string;
    keys: readonly (readonly string[])[];
  }[];
};
