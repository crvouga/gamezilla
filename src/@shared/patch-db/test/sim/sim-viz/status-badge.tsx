import { STATUS_MAP } from './constants';
import type { ConsistencyStatus } from './types';

export function StatusBadge({ status }: { status: ConsistencyStatus }) {
  const s = STATUS_MAP[status] || STATUS_MAP.idle;
  return (
    <div
      className="flex items-center gap-1.5 rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-[0.65rem] font-medium"
      style={{ color: s.color }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: s.dot }}
      />
      {s.label}
    </div>
  );
}
