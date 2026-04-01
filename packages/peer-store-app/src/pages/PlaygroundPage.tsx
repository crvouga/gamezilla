import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import { EventLog } from '../components/EventLog'
import { MessageLog } from '../components/MessageLog'
import { NetworkControls } from '../components/NetworkControls'
import { PeerPanel } from '../components/PeerPanel'
import {
  PEERS,
  PlaygroundSimulator,
  type PeerId,
} from '../simulator/playground'

const scenarioBtnClass =
  'rounded-lg border border-white/15 bg-white/6 px-4 py-2 text-sm font-semibold text-white/60 transition-colors hover:bg-white/12 hover:text-white'

export function PlaygroundPage() {
  const simRef = useRef<PlaygroundSimulator | null>(null)
  if (!simRef.current) {
    simRef.current = new PlaygroundSimulator()
  }
  const sim = simRef.current

  const versionRef = useRef(0)
  const tick = useSyncExternalStore(
    useCallback((cb) => sim.subscribe(() => {
      versionRef.current += 1
      cb()
    }), [sim]),
    useCallback(() => versionRef.current, []),
  )
  void tick

  const disconnectedPeers = useRef(new Set<string>())
  const isPaused = useRef(false)

  const handleDispatch = useCallback(
    (peerId: PeerId, cell: number) => {
      const player = peerId === 'player-x' ? 'X' : 'O'
      try {
        sim.dispatch(peerId, {
          type: 'PLACE_MARK',
          payload: { cell, player },
        })
      } catch {
        /* error logged via onError callback */
      }
    },
    [sim],
  )

  const handlePause = useCallback(() => {
    try {
      sim.pauseDelivery()
      isPaused.current = true
    } catch { /* already paused */ }
  }, [sim])

  const handleResume = useCallback(() => {
    try {
      sim.resumeDelivery()
      isPaused.current = false
    } catch { /* not paused */ }
  }, [sim])

  const handleDrop = useCallback(() => {
    try { sim.dropNextMessage() } catch { /* no messages */ }
  }, [sim])

  const handleAdvance = useCallback(() => {
    try { sim.advanceTime(5001) } catch { /* ignore */ }
  }, [sim])

  const handleDisconnect = useCallback(
    (peerId: string) => {
      try {
        sim.disconnectPeer(peerId as PeerId)
        disconnectedPeers.current.add(peerId)
      } catch { /* already disconnected */ }
    },
    [sim],
  )

  const handleReconnect = useCallback(
    (peerId: string) => {
      try {
        sim.reconnectPeer(peerId as PeerId)
        disconnectedPeers.current.delete(peerId)
      } catch { /* not disconnected */ }
    },
    [sim],
  )

  const handleReset = useCallback(() => {
    sim.reset()
    disconnectedPeers.current.clear()
    isPaused.current = false
  }, [sim])

  const handleScenarioPartition = useCallback(() => {
    handleReset()
    setTimeout(() => {
      sim.disconnectPeer('player-o')
      disconnectedPeers.current.add('player-o')
      sim.dispatch('player-x', {
        type: 'PLACE_MARK',
        payload: { cell: 4, player: 'X' },
      })
    }, 50)
  }, [sim, handleReset])

  const handleScenarioTimeout = useCallback(() => {
    handleReset()
    setTimeout(() => {
      sim.disconnectPeer('player-o')
      sim.disconnectPeer('worker')
      disconnectedPeers.current.add('player-o')
      disconnectedPeers.current.add('worker')
      sim.dispatch('player-x', {
        type: 'PLACE_MARK',
        payload: { cell: 0, player: 'X' },
      })
      try { sim.advanceTime(5001) } catch { /* ignore */ }
    }, 50)
  }, [sim, handleReset])

  const badActorIds = useMemo(() => {
    return new Set(sim.getBadActorLog().map((e) => e.peerId))
  }, [tick, sim])

  const messageLog = sim.getMessageLog()
  const eventLog = sim.getEventLog('player-x')

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-5 overflow-y-auto p-6">
      <h2 className="font-display text-2xl font-bold">
        peer-store playground
      </h2>

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
        {PEERS.map((peerId) => {
          const player =
            peerId === 'player-x'
              ? ('X' as const)
              : peerId === 'player-o'
                ? ('O' as const)
                : null
          return (
            <PeerPanel
              key={peerId}
              peerId={peerId}
              displayState={sim.getState(peerId)}
              committedState={sim.getCommittedState(peerId)}
              events={sim.getEventLog(peerId)}
              isOnline={!disconnectedPeers.current.has(peerId)}
              isBadActor={badActorIds.has(peerId)}
              player={player}
              onCellClick={
                player
                  ? (cell) => handleDispatch(peerId, cell)
                  : undefined
              }
            />
          )
        })}
      </div>

      <NetworkControls
        onPause={handlePause}
        onResume={handleResume}
        onDrop={handleDrop}
        onAdvance={handleAdvance}
        onDisconnect={handleDisconnect}
        onReconnect={handleReconnect}
        isPaused={isPaused.current}
        disconnectedPeers={disconnectedPeers.current}
      />

      <div className="flex flex-wrap gap-2.5">
        <button type="button" className={scenarioBtnClass} onClick={handleReset}>
          Reset
        </button>
        <button
          type="button"
          className={scenarioBtnClass}
          onClick={handleScenarioPartition}
        >
          Partition
        </button>
        <button
          type="button"
          className={scenarioBtnClass}
          onClick={handleScenarioTimeout}
        >
          Timeout
        </button>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <MessageLog entries={messageLog} />
        <EventLog events={eventLog} />
      </div>
    </div>
  )
}
