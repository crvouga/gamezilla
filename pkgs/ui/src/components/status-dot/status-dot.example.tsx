/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { StatusDot, type StatusDotStatus } from './status-dot';

const ROWS: readonly { status: StatusDotStatus; label: string }[] = [
  { status: 'online', label: 'Online' },
  { status: 'offline', label: 'Offline' },
  { status: 'warning', label: 'Warning' },
  { status: 'pending', label: 'Pending' },
];

export default function StatusDotExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box flex-col gap-3">
        <For each={ROWS}>
          {(row) => (
            <div class="box flex-row gap-2 items-center">
              <StatusDot status={row.status} />
              <label class="text textLabel">{row.label}</label>
            </div>
          )}
        </For>

        <div class="box flex-row gap-2 items-center">
          <StatusDot status="online" size={16} />
          <label class="text textLabel">{'Large (16px)'}</label>
        </div>
      </div>
    </ExampleRoot>
  );
}
