import { mountSystemHarness } from '@crvouga/mockingbird-ui/system';
import { render } from 'solid-js/web';

export function mountHarnessPreview(
  root: HTMLElement,
  load = () => import('./harness-boot')
) {
  return mountSystemHarness(
    root,
    [
      {
        id: 'instances',
        label: 'Instances',
        async mount(host, signal) {
          const { HarnessBoot } = await load();
          signal.throwIfAborted();
          host.classList.add('harness-instances');
          return render(() => <HarnessBoot />, host);
        },
      },
    ],
    { initial: 'instances', syncUrl: true }
  );
}
