import {
  mountSystemHarness,
  type SystemSurface,
} from '@crvouga/mockingbird-ui/system';
import type { PreviewShellProps } from '@pkgs/harness-console-client-ts/product-harness-screen';
import { render } from '@solidjs/web';
import { getOwner, onCleanup } from 'solid-js';

/** Mount each preview surface under the same Solid providers and running session. */
export function PreviewShell(props: PreviewShellProps) {
  const owner = getOwner();
  const root = document.createElement('div');
  root.className = 'harness-preview';
  const surfaces: SystemSurface[] = props.apps.map((app) => ({
    id: app.id,
    label: app.label,
    mount(host) {
      host.classList.add('harness-instances');
      return render(
        () => app.content(() => shell.active() === app.id),
        host,
        undefined,
        { owner }
      );
    },
  }));
  const shell = mountSystemHarness(root, surfaces, {
    initial: props.initial,
    syncUrl: true,
  });
  onCleanup(() => shell.destroy());
  return root;
}
