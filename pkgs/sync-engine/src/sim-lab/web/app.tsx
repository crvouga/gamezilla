import { useEffect, useState } from 'react';

import {
  type LabCommand,
  type LabSnapshot,
  postCommand,
  subscribeSnapshots,
} from './api';
import { Bench } from './components/bench';
import { ClockStrip } from './components/clock-strip';
import { Timeline } from './components/timeline';

const EMPTY: LabSnapshot = {
  open: false,
  seed: null,
  now: 0,
  rowImageFanout: true,
  liveResendOnReconnect: false,
  alice: null,
  bob: null,
  serverShapes: [],
  converged: null,
  lastError: null,
  actions: [],
};

export function App() {
  const [snap, setSnap] = useState<LabSnapshot>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [seedInput, setSeedInput] = useState('42');

  useEffect(() => subscribeSnapshots(setSnap), []);

  const run = async (cmd: LabCommand) => {
    setBusy(true);
    try {
      const next = await postCommand(cmd);
      setSnap(next);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const badgeClass =
    snap.converged === true
      ? 'badge ok'
      : snap.converged === false
        ? 'badge bad'
        : 'badge unknown';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">Sync Engine Sim Lab</div>
        <div className="meta">
          seed {snap.seed ?? '—'} · t={snap.now}
        </div>
        <span className={badgeClass}>
          {snap.converged === true
            ? 'Converged'
            : snap.converged === false
              ? 'Diverged'
              : 'Unknown'}
        </span>
        <label className="meta">
          Seed{' '}
          <input
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            style={{ width: 90 }}
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run({
              type: 'openWorld',
              seed: Number.isFinite(Number(seedInput))
                ? Number(seedInput)
                : seedInput,
            })
          }
        >
          New world
        </button>
        <button
          type="button"
          className={snap.rowImageFanout ? 'active' : ''}
          disabled={busy}
          onClick={() =>
            void run({
              type: 'openWorld',
              seed: snap.seed ?? 42,
              rowImageFanout: !snap.rowImageFanout,
              liveResendOnReconnect: snap.liveResendOnReconnect,
            })
          }
        >
          Row-image {snap.rowImageFanout ? 'on' : 'off'}
        </button>
        <button
          type="button"
          className={snap.liveResendOnReconnect ? 'active' : ''}
          disabled={busy}
          onClick={() =>
            void run({
              type: 'openWorld',
              seed: snap.seed ?? 42,
              rowImageFanout: snap.rowImageFanout,
              liveResendOnReconnect: !snap.liveResendOnReconnect,
            })
          }
        >
          Live resend {snap.liveResendOnReconnect ? 'on' : 'off'}
        </button>
        {snap.lastError !== null ? (
          <span className="badge bad">{snap.lastError}</span>
        ) : null}
      </header>
      <Bench
        snap={snap}
        busy={busy}
        onCommand={(cmd) => {
          if (typeof cmd['type'] !== 'string') return;
          void run(cmd as LabCommand);
        }}
      />
      <ClockStrip
        busy={busy}
        onCommand={(cmd) => {
          if (typeof cmd['type'] !== 'string') return;
          void run(cmd as LabCommand);
        }}
      />
      <Timeline actions={snap.actions} />
    </div>
  );
}
