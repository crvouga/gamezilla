import type { BoardWorld } from './board-world';
export const readOptions = (w: BoardWorld) => {
  const footprint = w.app.footprint();
  const labels = [
    ...w.app.host.querySelectorAll(
      '[data-testid="example-board-layer-squares"] svg text'
    ),
  ].map((el) => el.textContent);
  return {
    frame: (() => {
      const host = w.app.root.querySelector(
        '[data-component="ChessBoardFrame"]'
      );
      return host === null
        ? null
        : {
            edge: host.getAttribute('data-board-gutter'),
            labels: [
              ...host.querySelectorAll(
                ':scope > [data-ranks] > [aria-hidden="true"]'
              ),
            ].map((edge) =>
              [...edge.children].map((label) => label.textContent)
            ),
          };
    })(),
    width: footprint.width,
    height: footprint.height,
    suppliedWidth: w.app.config().size,
    availableWidth: w.app.availableWidth(),
    measuredWidth: w.app.probe().size,
    coordinates: labels,
    marks: w.app.layer(),
    light: w.app.host.style.getPropertyValue('--chess-sq-light'),
    dark: w.app.host.style.getPropertyValue('--chess-sq-dark'),
    grabColors: w.app.host.getAttribute('data-grab') ?? '',
    config: w.app.config(),
  };
};
