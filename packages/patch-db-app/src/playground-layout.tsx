import { useMemo } from 'react';
import type { PlaygroundSim } from '@gamezilla/patch-db/sim/playground-sim';
import { ClientNodePanel } from './client-node-panel';
import { ServerNodePanel } from './server-node-panel';

function ConnectionLines({
  sim,
  linkEpoch,
}: {
  sim: PlaygroundSim;
  linkEpoch: number;
}) {
  void linkEpoch;
  const srvDown = sim.isServerPartitioned();
  const clients = sim.clients;
  const n = clients.length;
  if (n === 0) return null;

  const colW = 19; // 18rem panel + 1rem gap
  const totalW = n * colW - 1;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-10 shrink-0"
      style={{ width: `${totalW}rem`, maxWidth: '100%' }}
    >
      {clients.map((c, i) => {
        const broken = c.link.isPartitioned() || srvDown;
        const x = n === 1 ? 50 : ((i * colW + 9) / totalW) * 100;
        return (
          <line
            key={c.id}
            x1={50}
            y1={0}
            x2={x}
            y2={100}
            stroke={
              broken
                ? 'rgba(229, 72, 77, 0.5)'
                : 'rgba(54, 197, 160, 0.35)'
            }
            vectorEffect="non-scaling-stroke"
            strokeWidth={broken ? 1.5 : 2}
            strokeDasharray={broken ? '6 4' : undefined}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export function PlaygroundLayout({
  sim,
  pulseKey,
  linkEpoch,
}: {
  sim: PlaygroundSim;
  pulseKey: number;
  linkEpoch: number;
}) {
  const clients = useMemo(
    () => [...sim.clients],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim, pulseKey]
  );

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-8">
      <div className="w-72">
        <ServerNodePanel />
      </div>

      {clients.length > 0 && (
        <>
          <ConnectionLines sim={sim} linkEpoch={linkEpoch} />
          <div className="flex flex-wrap justify-center gap-4">
            {clients.map((c) => (
              <div key={c.id} className="w-72">
                <ClientNodePanel client={c} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
