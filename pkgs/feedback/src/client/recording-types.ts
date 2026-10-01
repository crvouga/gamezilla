import type { EvidenceFile, ReproductionRecording } from '../shared/types';

export interface VideoSession {
  stop(): Promise<EvidenceFile>;
  dispose(): void;
}

export interface RecordingPort {
  start(): Promise<VideoSession>;
}

export type RecordingState = {
  readonly phase: 'idle' | 'starting' | 'recording' | 'stopping' | 'ready';
  readonly recording: ReproductionRecording | null;
  readonly video: EvidenceFile | null;
  readonly notice: string | null;
};
