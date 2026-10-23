import type {
  EvidenceFile,
  ReproductionRecording,
} from '@pkgs/feedback-shared-ts/types';

export type VideoSession = {
  stop(): Promise<EvidenceFile>;
  dispose(): void;
};

export type RecordingPort = {
  start(): Promise<VideoSession>;
};

export type RecordingState = {
  readonly phase: 'idle' | 'starting' | 'recording' | 'stopping' | 'ready';
  readonly recording: ReproductionRecording | null;
  readonly video: EvidenceFile | null;
  readonly notice: string | null;
};
