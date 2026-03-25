import { C, nodeColor, STEP_MS } from './constants';
import { sortRecordings, getOrderedEvents, replayNodeStates, checkConsistency } from './data';
import { buildLayout, edgeGeo } from './layout';
import { story, shortDesc } from './narration';
import { buildEventAnim } from './animation';
import { StatusBadge } from './status-badge';
import { DiffPanel } from './diff-panel';
import { Inspector } from './inspector';
import type { SimRecording } from './types';

const { useState, useMemo, useEffect, useRef } = React;

/* ── URL hash persistence ── */

function readHash() {
  const h = location.hash.replace('#', '');
  const p = new URLSearchParams(h);
  return { sim: p.get('sim') || null, step: parseInt(p.get('step')!, 10) || 0 };
}

function writeHash(simId: string, step: number) {
  const p = new URLSearchParams();
  if (simId) p.set('sim', simId);
  if (step > 0) p.set('step', String(step));
  const h = p.toString();
  history.replaceState(null, '', h ? '#' + h : location.pathname);
}

/* ── App ── */

export function App() {
  const recordings: SimRecording[] = useMemo(() => sortRecordings(RAW), []);
  const initialState = useMemo(() => {
    const h = readHash();
    let idx = 0;
    if (h.sim) {
      const i = recordings.findIndex((r) => r.id === h.sim);
      if (i >= 0) idx = i;
    }
    return { idx, step: h.step };
  }, []);

  const [idx, setIdx] = useState(initialState.idx);
  const [step, setStep] = useState(initialState.step);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [sel, setSel] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(true);

  const animLayerRef = useRef<SVGGElement>(null);
  const tlRef = useRef<GsapTimeline | null>(null);
  const prevStepRef = useRef(step);

  const rec = recordings[idx];
  const ordered = useMemo(() => (rec ? getOrderedEvents(rec) : []), [rec]);
  const total = ordered.length;
  const layout = useMemo(() => (rec ? buildLayout(rec.topology, 1100, 580) : null), [rec]);
  const snapshot = useMemo(() => (rec ? replayNodeStates(rec, step) : null), [rec, step]);
  const partMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    if (snapshot) snapshot.clients.forEach((c) => { m[c.id] = c.partitioned; });
    return m;
  }, [snapshot]);
  const latestEv = step > 0 ? ordered[step - 1] ?? null : null;
  const metaTitle = rec ? rec.meta?.title || rec.id : '';
  const consistency = useMemo(() => (rec ? checkConsistency(rec, step) : 'idle' as const), [rec, step]);
  const allNodeIds = useMemo(() => {
    if (!rec) return [] as string[];
    return [...rec.topology.servers.map((s) => 's:' + s.id), ...rec.topology.clients.map((c) => 'c:' + c.id)];
  }, [rec]);

  useEffect(() => { if (rec) writeHash(rec.id, step); }, [rec, step]);

  useEffect(() => {
    const prev = prevStepRef.current;
    prevStepRef.current = step;
    if (tlRef.current) { tlRef.current.kill(); tlRef.current = null; }
    const layer = animLayerRef.current;
    if (layer) while (layer.firstChild) layer.removeChild(layer.firstChild);
    if (step === prev + 1 && step > 0 && layer && layout && rec) {
      const ev = ordered[step - 1];
      if (ev) tlRef.current = buildEventAnim(ev, layer, layout, rec.topology);
    }
  }, [step, layout, rec, ordered]);

  useEffect(() => { setStep(0); setSel(null); setPlaying(false); }, [idx]);

  useEffect(() => {
    if (!playing || !rec || total === 0) return;
    const ms = Math.max(160, STEP_MS / speed);
    const id = setInterval(() => {
      setStep((s) => {
        if (s >= total) { if (loop) return 0; setPlaying(false); return s; }
        return s + 1;
      });
    }, ms);
    return () => clearInterval(id);
  }, [playing, rec, total, loop, speed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':  e.preventDefault(); setPlaying((p) => !p); break;
        case 'Escape': setSel(null); break;
        case 'ArrowRight': e.preventDefault(); setPlaying(false); setStep((s) => Math.min(s + 1, total)); break;
        case 'ArrowLeft':  e.preventDefault(); setPlaying(false); setStep((s) => Math.max(s - 1, 0)); break;
        case 'Home': e.preventDefault(); setPlaying(false); setStep(0); break;
        case 'End':  e.preventDefault(); setPlaying(false); setStep(total); break;
        case 'l': case 'L': setLoop((l) => !l); break;
        case 'd': case 'D': setShowDiff((d) => !d); break;
        case '1': setSpeed(0.25); break;
        case '2': setSpeed(0.5); break;
        case '3': setSpeed(1); break;
        case '4': setSpeed(2); break;
        case '5': setSpeed(4); break;
        case '[': { e.preventDefault(); const ni = Math.max(0, idx - 1); setIdx(ni); setPlaying(false); break; }
        case ']': { e.preventDefault(); const ni = Math.min(recordings.length - 1, idx + 1); setIdx(ni); setPlaying(false); break; }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [total, idx, recordings.length]);

  if (!recordings.length) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        <p>No recordings. Run <code className="rounded bg-neutral-800 px-2 py-0.5 text-amber-400">bun run test:viz</code></p>
      </div>
    );
  }

  const svgW = layout?.W || 1100, svgH = layout?.H || 580;
  const srvBoxW = 58, srvBoxH = 40, cliBoxW = 50, cliBoxH = 36;

  return (
    <div className="flex h-full flex-col" style={{ background: C.bg }}>
      {/* header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-3 py-1.5">
        <span className="text-[0.7rem] font-semibold tracking-wide text-neutral-500">PATCH DB</span>
        <select
          value={idx}
          onChange={(e: any) => { setIdx(Number(e.target.value)); setPlaying(false); }}
          className="max-w-[min(340px,50vw)] flex-1 rounded border border-neutral-800 bg-neutral-900 py-1 pl-2 pr-6 text-[0.75rem] text-neutral-300"
        >
          {recordings.map((r, i) => (
            <option key={r.id} value={i}>{r.meta?.title || r.id}</option>
          ))}
        </select>
        <StatusBadge status={consistency} />
        <button
          type="button"
          onClick={() => setShowDiff((d) => !d)}
          className={`rounded border px-2 py-1 text-[0.65rem] font-medium ${showDiff ? 'border-neutral-700 bg-neutral-800 text-neutral-300' : 'border-neutral-800 bg-neutral-900 text-neutral-500'} hover:bg-neutral-800`}
        >
          Diff <kbd className="ml-1 text-neutral-600">D</kbd>
        </button>
      </header>

      {rec && rec.meta?.intent && (
        <div className="shrink-0 border-b border-neutral-800/50 px-3 py-1 text-center text-[0.7rem] text-neutral-500">{rec.meta.intent}</div>
      )}

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          <div className="pointer-events-none absolute right-3 top-3 z-10 flex gap-3 text-[0.58rem] text-neutral-500">
            <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: C.blue }} />write</span>
            <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: C.orange }} />push</span>
            <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: C.green }} />poll/read</span>
            <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: C.violet }} />invalidation</span>
            <span><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: C.red }} />error</span>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-14 z-10 flex justify-center px-4">
            <div key={step + '-' + (latestEv?.seq ?? 'x')} className="caption-in max-w-lg rounded-lg border border-neutral-800 bg-neutral-950/95 px-4 py-2 shadow-lg backdrop-blur">
              <p className="text-center text-[0.8rem] leading-snug text-neutral-200">
                {latestEv ? story(latestEv) : 'Press Space or \u2192 to begin.'}
              </p>
            </div>
          </div>

          {layout && rec && (
            <svg className="h-full w-full" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet" onClick={() => setSel(null)}>
              <rect width={svgW} height={svgH} fill={C.bg} />

              {layout.links.map((L, i) => {
                const a = layout.pos[L.s], b = layout.pos[L.c];
                if (!a || !b) return null;
                const broken = !!partMap[L.clientId];
                const { d, mid } = edgeGeo(a, b);
                return (
                  <g key={i}>
                    <path d={d} fill="none" stroke={broken ? C.edgeBroken : C.edge} strokeWidth={broken ? 0.8 : 1.2} strokeLinecap="round" opacity={broken ? 0.35 : 0.65} className={broken ? 'edge-dead' : 'edge-live'} style={broken ? undefined : { animationDelay: i * 0.12 + 's' }} />
                    {broken && (
                      <>
                        <line x1={mid.x - 6} y1={mid.y - 6} x2={mid.x + 6} y2={mid.y + 6} stroke={C.red} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
                        <line x1={mid.x + 6} y1={mid.y - 6} x2={mid.x - 6} y2={mid.y + 6} stroke={C.red} strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
                      </>
                    )}
                  </g>
                );
              })}

              {rec.topology.servers.map((s) => {
                const k = 's:' + s.id, p = layout.pos[k];
                if (!p) return null;
                const isSel = sel === k, dim = !!sel && sel !== k;
                const col = nodeColor(allNodeIds, k);
                return (
                  <g key={k} style={{ opacity: dim ? 0.25 : 1, cursor: 'pointer' }} onClick={(e: any) => { e.stopPropagation(); setSel(k); }}>
                    <rect x={p.x - srvBoxW / 2 - 4} y={p.y - srvBoxH / 2 - 4} width={srvBoxW + 8} height={srvBoxH + 8} rx={8} fill="transparent" />
                    <rect x={p.x - srvBoxW / 2} y={p.y - srvBoxH / 2} width={srvBoxW} height={srvBoxH} rx={6} fill={isSel ? C.nodeSelBg : C.node} stroke={isSel ? C.nodeSelBorder : C.nodeBorder} strokeWidth={isSel ? 2 : 1} />
                    <g transform={`translate(${p.x - 14},${p.y - 12})`}>
                      <rect x="0" y="0" width="28" height="7" rx="1.5" fill="#222" stroke="#444" strokeWidth="0.5" />
                      <rect x="0" y="9" width="28" height="7" rx="1.5" fill="#222" stroke="#444" strokeWidth="0.5" />
                      <circle cx="23" cy="3.5" r="1.8" fill={C.green} opacity="0.9" />
                      <circle cx="23" cy="12.5" r="1.8" fill={C.blue} opacity="0.9" />
                      <rect x="3" y="2" width="8" height="3" rx="0.5" fill="#333" opacity="0.7" />
                      <rect x="3" y="11" width="8" height="3" rx="0.5" fill="#333" opacity="0.7" />
                    </g>
                    <text x={p.x} y={p.y + srvBoxH / 2 + 16} textAnchor="middle" fill={C.textLight} fontSize="11" fontWeight="600" fontFamily="'IBM Plex Mono', monospace">server:{s.id}</text>
                    <line x1={p.x - 12} y1={p.y + srvBoxH / 2 + 19} x2={p.x + 12} y2={p.y + srvBoxH / 2 + 19} stroke={col} strokeWidth="2" opacity="0.6" strokeLinecap="round" />
                  </g>
                );
              })}

              {rec.topology.clients.map((c) => {
                const k = 'c:' + c.id, p = layout.pos[k];
                if (!p) return null;
                const part = !!partMap[c.id], isSel = sel === k, dim = !!sel && sel !== k;
                const col = nodeColor(allNodeIds, k);
                return (
                  <g key={k} style={{ opacity: dim ? 0.25 : 1, cursor: 'pointer' }} onClick={(e: any) => { e.stopPropagation(); setSel(k); }}>
                    <rect x={p.x - cliBoxW / 2 - 4} y={p.y - cliBoxH / 2 - 4} width={cliBoxW + 8} height={cliBoxH + 8} rx={7} fill="transparent" />
                    <rect x={p.x - cliBoxW / 2} y={p.y - cliBoxH / 2} width={cliBoxW} height={cliBoxH} rx={5} fill={isSel ? C.nodeSelBg : part ? '#1a0a0a' : C.node} stroke={isSel ? C.nodeSelBorder : part ? C.red : C.nodeBorder} strokeWidth={isSel ? 2 : part ? 1.5 : 1} />
                    <g transform={`translate(${p.x - 12},${p.y - 10})`}>
                      <rect x="0" y="0" width="24" height="15" rx="2" fill="#222" stroke="#444" strokeWidth="0.5" />
                      <rect x="2" y="2" width="20" height="10" rx="1" fill={part ? '#2a1515' : '#181830'} opacity="0.95" />
                      {!part && <rect x="5" y="5" width="14" height="3" rx="0.5" fill={C.blue} opacity="0.2" />}
                      <rect x="4" y="16.5" width="16" height="2.5" rx="1" fill="#282828" stroke="#3a3a3a" strokeWidth="0.3" />
                    </g>
                    <text x={p.x} y={p.y + cliBoxH / 2 + 14} textAnchor="middle" fill={part ? C.red : C.textLight} fontSize="11" fontWeight="600" fontFamily="'IBM Plex Mono', monospace">client:{c.id}</text>
                    <line x1={p.x - 10} y1={p.y + cliBoxH / 2 + 17} x2={p.x + 10} y2={p.y + cliBoxH / 2 + 17} stroke={col} strokeWidth="2" opacity="0.6" strokeLinecap="round" />
                    {part && <text x={p.x} y={p.y + cliBoxH / 2 + 26} textAnchor="middle" fill={C.red} fontSize="8" fontWeight="600" fontFamily="'IBM Plex Mono', monospace" opacity="0.6">PARTITIONED</text>}
                  </g>
                );
              })}

              <g ref={animLayerRef} />
            </svg>
          )}

          <Inspector selectedKey={sel} snapshot={snapshot} title={metaTitle} onClose={() => setSel(null)} />
        </div>

        {showDiff && (
          <div className="hidden w-[280px] shrink-0 border-l border-neutral-800 bg-neutral-950 md:block lg:w-[320px]">
            <DiffPanel snapshot={snapshot} topo={rec?.topology} allNodeIds={allNodeIds} />
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-neutral-800 px-3 py-1.5">
        <button type="button" onClick={() => setPlaying((p) => !p)} className="rounded border border-neutral-800 bg-neutral-900 px-3 py-1 text-[0.7rem] font-medium text-neutral-300 hover:bg-neutral-800">
          {playing ? 'Pause' : 'Play'} <kbd className="ml-1 text-neutral-600">Space</kbd>
        </button>
        <button type="button" onClick={() => { setPlaying(false); setStep((s) => Math.max(s - 1, 0)); }} className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-[0.7rem] text-neutral-400 hover:bg-neutral-800">{'\u2190'}</button>
        <button type="button" onClick={() => { setPlaying(false); setStep((s) => Math.min(s + 1, total)); }} className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-[0.7rem] text-neutral-400 hover:bg-neutral-800">{'\u2192'}</button>
        <input type="range" min={0} max={total} step={1} value={Math.min(step, total)} className="h-1 min-w-[80px] flex-1 accent-neutral-500" aria-label="Step" onChange={(e: any) => { setPlaying(false); setStep(Number(e.target.value)); }} />
        <label className="flex items-center gap-1 text-[0.65rem] text-neutral-500">
          <input type="checkbox" checked={loop} onChange={(e: any) => setLoop(e.target.checked)} className="accent-neutral-500" /> loop <kbd className="text-neutral-700">L</kbd>
        </label>
        <select value={String(speed)} onChange={(e: any) => setSpeed(Number(e.target.value))} className="rounded border border-neutral-800 bg-neutral-900 py-0.5 pl-1.5 pr-5 text-[0.65rem] text-neutral-400">
          <option value="0.25">0.25{'\u00d7'}</option>
          <option value="0.5">0.5{'\u00d7'}</option>
          <option value="1">1{'\u00d7'}</option>
          <option value="2">2{'\u00d7'}</option>
          <option value="4">4{'\u00d7'}</option>
        </select>
        <span className="font-mono text-[0.6rem] text-neutral-600 tabular-nums">{step}/{total}</span>
        {latestEv && <span className="hidden truncate text-[0.6rem] text-neutral-600 sm:inline">{shortDesc(latestEv)}</span>}
        <span className="hidden text-[0.55rem] text-neutral-700 lg:inline">1-5 speed {'\u00b7'} Home/End {'\u00b7'} [ ] scenario {'\u00b7'} D diff</span>
      </footer>
    </div>
  );
}
