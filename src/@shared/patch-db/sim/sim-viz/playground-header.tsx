import { SHAPE_ENTITY_TYPE } from '../playground-shapes';
import { IconClear, IconPlus } from './icons';
import { useSimContext } from './sim-context';

export function PlaygroundHeader() {
  const { sim, addClient, reset } = useSimContext();

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2">
      <h1 className="font-display text-lg font-semibold tracking-tight text-white/90">
        Patch Playground
      </h1>
      <span className="rounded bg-white/8 px-2 py-0.5 font-mono text-[0.65rem] text-white/50">
        {SHAPE_ENTITY_TYPE} / {sim.serverId}
      </span>
      <div className="ml-auto flex items-center gap-2">
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
