// @io-wall-ok — this observer runs from document creation in a disposable Chrome tab.
export type OpeningControls = {
  readonly settings: string;
  readonly menu: string;
  readonly appearance: string;
  readonly spinner: string;
};

function findExposed(selector: string, interactive = true) {
  function visibleCenter(node: Element) {
    if (
      !node.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    )
      return null;
    const rect = node.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (
      !rect.width ||
      !rect.height ||
      rect.right <= 0 ||
      rect.bottom <= 0 ||
      rect.left >= innerWidth ||
      rect.top >= innerHeight
    )
      return null;
    return { x, y };
  }

  for (const node of document.querySelectorAll(selector)) {
    const point = visibleCenter(node);
    if (
      point &&
      (!interactive ||
        node.contains(document.elementFromPoint(point.x, point.y)))
    )
      return { node, point };
  }
  return null;
}

/** Serialized into the measured document. All durations use its navigation time origin. */
function observeOpening(
  controls: OpeningControls,
  exposed: typeof findExposed
): void {
  if (window.top !== window) return;
  const selector = (id: string) => `[data-testid="${id}"]`;
  let activated = false;
  document.addEventListener(
    'click',
    (event) => {
      if (
        event.isTrusted &&
        event.target instanceof Element &&
        event.target.closest(selector(controls.settings))
      )
        activated = true;
    },
    true
  );
  const result: {
    settingsAtMs: number | null;
    spinnerAtMs: number | null;
    spinnerFrames: number;
    runtimeSettingsVisible: boolean;
  } = {
    settingsAtMs: null,
    spinnerAtMs: null,
    spinnerFrames: 0,
    runtimeSettingsVisible: false,
  };
  let settingsOnPreviousFrame = false;
  let runtimeOnPreviousFrame = false;
  let target: { id: string; x: number; y: number } | null = null;
  function sample() {
    const now = performance.now();
    if (exposed(controls.spinner, false)) {
      result.spinnerFrames++;
      result.spinnerAtMs ??= now;
    }
    const settings = exposed(selector(controls.appearance));
    const arrived =
      activated && location.pathname === '/more' && settings !== null;
    if (arrived && settingsOnPreviousFrame) result.settingsAtMs ??= now;
    settingsOnPreviousFrame = arrived;
    const runtime =
      arrived &&
      !settings.node.closest('[data-startup-shell]') &&
      !document.querySelector('[data-startup-shell]');
    result.runtimeSettingsVisible = runtime && runtimeOnPreviousFrame;
    runtimeOnPreviousFrame = runtime;
    target = null;
    if (
      !activated &&
      performance.getEntriesByName('first-contentful-paint', 'paint').length > 0
    ) {
      for (const id of [controls.settings, controls.menu]) {
        const control = exposed(selector(id));
        if (control) {
          target = { id, ...control.point };
          break;
        }
      }
    }
    if (!result.runtimeSettingsVisible) requestAnimationFrame(sample);
  }
  Reflect.set(window, '__observedAppOpening', () => ({ target, result }));
  requestAnimationFrame(sample);
}

export function openingObserverScript(controls: OpeningControls): string {
  return `(${observeOpening.toString()})(${JSON.stringify(controls)}, ${findExposed.toString()})`;
}
