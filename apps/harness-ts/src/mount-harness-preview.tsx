import {
  mountSystemHarness,
  type SystemSurface,
} from '@crvouga/mockingbird-ui/system';
import type { PreviewShellProps } from '@pkgs/harness-console-client-ts/product-harness-screen';
import { getOwner, onCleanup } from 'solid-js';
import { render } from 'solid-js/web';

/** Mount each Gamezilla view under the same Solid providers and running session. */
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
