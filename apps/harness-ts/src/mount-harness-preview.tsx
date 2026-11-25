import {
  mountSystemHarness,
  type SystemHarness,
  type SystemSurface,
} from '@crvouga/mockingbird-ui/system';
import type { PreviewShellProps } from '@pkgs/harness-console-client-ts/product-harness-screen';
import { render } from '@solidjs/web';
import { createSignal, getOwner, onCleanup } from 'solid-js';
import { PreviewSurfacePicker } from './preview-surface-picker';

/** Mount each preview surface under the same Solid providers and running session. */
export function PreviewShell(props: PreviewShellProps) {
  const owner = getOwner();
  const [active, setActive] = createSignal(props.initial);
  let shell: SystemHarness | undefined;
  let observer: MutationObserver | undefined;
  const surfaces: SystemSurface[] = props.apps.map((app) => ({
    id: app.id,
    label: app.label,
    mount(host) {
      host.classList.add('harness-instances');
      return render(
        () => app.content(() => active() === app.id),
        host,
        undefined,
        { owner }
      );
    },
  }));
  const items = [
    { value: 'system', label: 'System' },
    ...surfaces.map(({ id, label }) => ({ value: id, label })),
  ];
  const mount = (root: HTMLDivElement) => {
    const mounted = mountSystemHarness(root, surfaces, {
      initial: props.initial,
      syncUrl: true,
    });
    shell = mounted;
    setActive(mounted.active());
    // The switcher, System screen and browser history can each change which panel is visible.
    observer = new MutationObserver(() => setActive(mounted.active()));
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['hidden'],
      subtree: true,
    });
  };
  onCleanup(() => {
    observer?.disconnect();
    shell?.destroy();
  });
  return (
    <PreviewSurfacePicker
      ref={mount}
      class="harness-preview"
      aria-label="Preview surfaces"
      items={items}
      value={active()}
      onValueChange={(id) => {
        if (shell) {
          void shell.show(id);
          setActive(shell.active());
        }
      }}
    />
  );
}
