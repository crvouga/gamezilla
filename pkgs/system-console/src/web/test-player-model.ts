import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  SimulationReportData,
  SimulationReportEvent,
  SimulationReportTopology,
} from '../types';
import { fetchTestEvents, fetchTestTopology } from './api-client';
import type { EventStripFilter } from './event-strip';
import { LONG_HOLD_PULSE_MS } from './frame-timeline';
import {
  type FlatFrame,
  flattenFrames,
  playheadFrameIndex,
  resolveSelectedFrameIndex,
} from './frames';
import { listReportNodes } from './node-workspace';
import type { ReportNavState } from './router';
import { navigateReport } from './router';
import {
  type PlayerActions,
  usePlayback,
  usePlayerActions,
  usePlayerCommands,
} from './test-player-hooks';
import { useHoldCountdown } from './use-hold-countdown';

export type TestPlayerModel = {
  readonly testId: string;
  readonly frames: readonly FlatFrame[];
  readonly selectedFrameIdx: number | null;
  readonly playheadIdx: number;
  readonly hoverFrameIdx: number | null;
  readonly previewIdx: number;
  readonly previewFrame: FlatFrame | null;
  readonly prevFrame: FlatFrame | null;
  readonly holdRemainingMs: number | null;
  readonly nodeId: string | null;
  readonly topology: SimulationReportTopology | null;
  readonly events: readonly SimulationReportEvent[];
  readonly eventFilter: EventStripFilter;
  readonly selectedEventId: string | null;
  readonly actions: PlayerActions;
  readonly registerCopyAction: (run: () => void) => void;
  readonly selectNode: (next: string | null) => void;
  readonly selectAttr: (attr: string) => void;
  readonly selectEvent: (event: SimulationReportEvent) => void;
  readonly setEventFilter: (filter: EventStripFilter) => void;
  readonly onHover: (idx: number | null) => void;
};

export function useTestPlayerModel(props: {
  readonly data: SimulationReportData;
  readonly nav: ReportNavState;
  readonly bucketId: string;
  readonly runId: string;
  readonly onNav: (nav: ReportNavState) => void;
}): TestPlayerModel {
  const { data, nav, onNav, bucketId, runId } = props;
  const testId = data.meta.testId;
  const frames = useMemo(() => flattenFrames(data.steps), [data.steps]);
  const selectedFrameIdx = resolveSelectedFrameIndex(frames, data.steps, nav);
  const playheadIdx = playheadFrameIndex(selectedFrameIdx, frames.length);
  const [hoverFrameIdx, setHoverFrameIdx] = useState<number | null>(null);
  const previewIdx =
    !nav.play && hoverFrameIdx != null ? hoverFrameIdx : playheadIdx;
  const previewFrame =
    previewIdx >= 0 && previewIdx < frames.length
      ? (frames[previewIdx] ?? null)
      : null;
  const prevFrame =
    previewIdx > 0 && previewIdx < frames.length
      ? (frames[previewIdx - 1] ?? null)
      : null;
  const holdRemainingMs = useHoldCountdown({
    nav,
    activeFrameIdx: playheadIdx,
    previewFrame,
    minHoldMs: LONG_HOLD_PULSE_MS,
  });
  usePlayback({ nav, frames, activeFrameIdx: playheadIdx, testId, onNav });
  const actions = usePlayerActions({
    nav,
    onNav,
    testId,
    frames,
    selectedFrameIdx,
    playheadIdx,
  });
  const reportSide = useReportSideData(bucketId, runId, testId);
  const navActions = useNodeNavActions(nav, onNav);
  const copy = useCopyLlmPromptBridge();
  usePlayerCommands({
    nav,
    frames,
    previewIdx,
    actions: { ...actions, copyLlmPrompt: copy.copyLlmPrompt },
    onNav,
  });

  return {
    testId,
    frames,
    selectedFrameIdx,
    playheadIdx,
    hoverFrameIdx: !nav.play ? hoverFrameIdx : null,
    previewIdx,
    previewFrame,
    prevFrame,
    holdRemainingMs,
    nodeId: resolveNodeId(data, previewFrame, nav.node, reportSide.topology),
    topology: reportSide.topology,
    events: reportSide.events,
    eventFilter: reportSide.eventFilter,
    selectedEventId: reportSide.selectedEventId,
    actions,
    registerCopyAction: copy.registerCopyAction,
    selectNode: navActions.selectNode,
    selectAttr: navActions.selectAttr,
    selectEvent: reportSide.selectEvent,
    setEventFilter: reportSide.setEventFilter,
    onHover: (idx) => {
      if (!nav.play) setHoverFrameIdx(idx);
    },
  };
}

function useReportSideData(bucketId: string, runId: string, testId: string) {
  const [topology, setTopology] = useState<SimulationReportTopology | null>(
    null
  );
  const [events, setEvents] = useState<readonly SimulationReportEvent[]>([]);
  const [eventFilter, setEventFilter] = useState<EventStripFilter>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [topo, evs] = await Promise.all([
          fetchTestTopology(bucketId, runId, testId),
          fetchTestEvents(bucketId, runId, testId),
        ]);
        if (!cancelled) {
          setTopology(topo);
          setEvents(evs);
        }
      } catch {
        if (!cancelled) {
          setTopology(null);
          setEvents([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bucketId, runId, testId]);

  return {
    topology,
    events,
    eventFilter,
    selectedEventId,
    setEventFilter,
    selectEvent: useCallback((event: SimulationReportEvent) => {
      setSelectedEventId(event.id);
    }, []),
  };
}

function useNodeNavActions(
  nav: ReportNavState,
  onNav: (nav: ReportNavState) => void
) {
  return {
    selectNode: useCallback(
      (next: string | null) => {
        onNav(navigateReport(nav, { node: next, attr: null }, 'replace'));
      },
      [nav, onNav]
    ),
    selectAttr: useCallback(
      (attr: string) => {
        onNav(navigateReport(nav, { attr }, 'replace'));
      },
      [nav, onNav]
    ),
  };
}

function useCopyLlmPromptBridge() {
  const copyActionRef = useRef<() => void>(() => undefined);
  const registerCopyAction = useCallback((run: () => void) => {
    copyActionRef.current = run;
  }, []);
  const copyLlmPrompt = useCallback(() => {
    copyActionRef.current();
  }, []);
  return { registerCopyAction, copyLlmPrompt };
}

function resolveNodeId(
  data: SimulationReportData,
  frame: FlatFrame | null,
  navNode: string | null,
  topology: SimulationReportTopology | null
): string | null {
  if (navNode == null) return null;
  const nodes = listReportNodes(data, frame, topology);
  if (nodes.includes(navNode)) return navNode;
  return null;
}
