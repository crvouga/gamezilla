// @io-wall-ok — this observer runs from document creation in a disposable Chrome tab.
export type OpeningControls = {
  readonly settings: string;
  readonly menu: string;
  readonly appearance: string;
  readonly spinner: string;
};

/** Serialized into the measured document. All durations use its navigation time origin. */
export function observeOpening(controls: OpeningControls): void {
  if (window.top !== window) return;
  const selector = (id: string) => `[data-testid="${id}"]`;
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
      !node.contains(document.elementFromPoint(x, y))
    )
      return null;
    return { x, y };
  }
  function exposed(selector: string) {
    for (const node of document.querySelectorAll(selector)) {
      const point = visibleCenter(node);
      if (point) return { node, point };
    }
    return null;
  }
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
  const result = {
    settingsAtMs: null as number | null,
    spinnerAtMs: null as number | null,
    runtimeSettingsVisible: false,
  };
  let runtimeOnPreviousFrame = false;
  let target: { id: string; x: number; y: number } | null = null;
  function sample() {
    const now = performance.now();
    if (result.spinnerAtMs === null && exposed(controls.spinner))
      result.spinnerAtMs = now;
    const settings = exposed(selector(controls.appearance));
    const arrived =
      activated && location.pathname === '/more' && settings !== null;
    if (arrived) result.settingsAtMs ??= now;
    const runtime =
      arrived &&
      !settings.node.closest('[data-startup-shell]') &&
      !document.querySelector('[data-startup-shell]');
    result.runtimeSettingsVisible = runtime && runtimeOnPreviousFrame;
    runtimeOnPreviousFrame = runtime;
    target = null;
    if (!activated) {
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
