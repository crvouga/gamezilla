import { fonts as fontStacks } from '@pkgs/ui-root-shared-ts/fonts';
import { fontWeight } from '@pkgs/ui-root-shared-ts/scale';
import { finishOpeningGesture } from './finish-opening-gesture';

type OpeningFonts = Pick<FontFaceSet, 'load' | 'ready'>;

/** Keep the interactive document until the app's text has its final metrics. */
export function finishOpeningAfterFonts(options: {
  readonly opening: HTMLElement;
  readonly fonts: OpeningFonts | undefined;
  readonly finish: () => void;
}): void | (() => void) {
  if (options.fonts === undefined)
    return finishOpeningGesture(options.opening, options.finish);
  const faces = options.fonts;
  let cancelled = false;
  let releaseGesture: void | (() => void);
  const finish = (): void => {
    if (!cancelled)
      releaseGesture = finishOpeningGesture(options.opening, options.finish);
  };
  // Explicit loads also work when fonts.ready resolved before CSS/layout
  // requested a face. Failed faces settle to the browser's fallback.
  const loads = Object.values(fontWeight).map((weight) =>
    faces.load(`${weight} 16px ${fontStacks.sans}`)
  );
  void Promise.allSettled(loads)
    .then(() => faces.ready)
    .then(finish, finish);
  return () => {
    cancelled = true;
    releaseGesture?.();
  };
}
