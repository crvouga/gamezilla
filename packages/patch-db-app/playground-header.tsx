import { useCallback, useState } from 'react';
import { SHAPE_ENTITY_TYPE } from '@gamezilla/patch-db/sim/playground-shapes';
import { IconClear, IconPlus } from './icons';
import { useSimContext } from './sim-context';

const LATENCY_BUCKETS: { value: number; label: string }[] = [
  { value: 0, label: '0 ms' },
  { value: 50, label: '50 ms' },
  { value: 150, label: '150 ms' },
  { value: 500, label: '500 ms' },
  { value: 1000, label: '1 s' },
  { value: 2000, label: '2 s' },
  { value: 5000, label: '5 s' },
];

export function PlaygroundHeader() {
  const { sim, addClient, reset } = useSimContext();
  const [globalLatency, setGlobalLatency] = useState(() =>
    sim.getGlobalLatency()
  );

  const handleGlobalLatencyChange = useCallback(
    (ms: number) => {
      setGlobalLatency(ms);
      sim.setGlobalLatency(ms);
    },
    [sim]
  );

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2">
      <h1 className="font-display text-lg font-semibold tracking-tight text-white/90">
        Patch DB simulator playground
      </h1>
      <span className="rounded bg-white/8 px-2 py-0.5 font-mono text-[0.65rem] text-white/50">
        {SHAPE_ENTITY_TYPE} / {sim.serverId}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-white/50">
          Latency
          <select
            value={globalLatency}
            onChange={(e) => handleGlobalLatencyChange(Number(e.target.value))}
            className="appearance-none cursor-pointer rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 pr-6 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white/90"
          >
            {LATENCY_BUCKETS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white/90"
          title="Clear saved state and start fresh"
        >
          <IconClear size={12} />
          Reset
        </button>
        <button
          type="button"
          onClick={addClient}
          className="flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-950/30 px-3 py-1.5 text-xs font-semibold text-teal-300 transition-colors hover:bg-teal-900/40"
        >
          <IconPlus size={14} />
          Add Client
        </button>
      </div>
    </header>
  );
}
