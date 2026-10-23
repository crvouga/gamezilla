// @io-wall-ok — browser media composition root, invoked only by Record reproduction
import type { Timers } from '@pkgs/clock-shared-ts/types';
import type { EvidenceFile } from '@pkgs/feedback-shared-ts/types';
import type { RecordingPort, VideoSession } from './recording-types';

export function browserRecordingPort(timers: Timers): RecordingPort {
  return {
    async start(): Promise<VideoSession> {
      if (
        typeof (navigator.mediaDevices as MediaDevices | undefined)
          ?.getDisplayMedia !== 'function' ||
        typeof MediaRecorder === 'undefined'
      )
        throw new Error('Video unavailable');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
      const recorder = createMediaRecorder(stream);
      const chunks: Blob[] = [];
      let size = 0;
      let overflow = false;
      let resolve: ((file: EvidenceFile) => void) | undefined;
      let reject: ((error: Error) => void) | undefined;
      const result = new Promise<EvidenceFile>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      // A browser may end sharing before Stop is pressed; preserve that result.
      void result.catch(() => {
        /* Failure is consumed by Stop; never an unhandled rejection. */
      });
      recorder.addEventListener('dataavailable', (event) => {
        size += event.data.size;
        if (size > 12 * 1024 * 1024) {
          overflow = true;
          if (recorder.state !== 'inactive') recorder.stop();
        } else chunks.push(event.data);
      });
      recorder.addEventListener('error', () =>
        reject?.(new Error('Video unavailable'))
      );
      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach((track) => track.stop());
        if (overflow) {
          reject?.(new Error('Video exceeds 12 MB'));
          return;
        }
        const type = recorder.mimeType.split(';').at(0) ?? 'video/webm';
        const blob = new Blob(chunks, { type });
        void blob.arrayBuffer().then(
          (bytes) =>
            resolve?.({
              name: `reproduction.${type === 'video/mp4' ? 'mp4' : 'webm'}`,
              contentType: type,
              bytes: new Uint8Array(bytes),
            }),
          () => reject?.(new Error('Video unavailable'))
        );
      });
      stream.getVideoTracks().forEach((track) =>
        track.addEventListener('ended', () => {
          if (recorder.state !== 'inactive') recorder.stop();
        })
      );
      try {
        recorder.start(1000);
      } catch (error) {
        stream.getTracks().forEach((track) => track.stop());
        throw error;
      }
      return {
        async stop() {
          if (recorder.state !== 'inactive') recorder.stop();
          let handle: unknown;
          try {
            return await Promise.race([
              result,
              new Promise<never>((_, no) => {
                handle = timers.setTimeout(
                  () => no(new Error('Video did not finish')),
                  3000
                );
              }),
            ]);
          } finally {
            timers.clearTimeout(handle);
          }
        },
        dispose() {
          if (recorder.state !== 'inactive') recorder.stop();
          stream.getTracks().forEach((track) => track.stop());
        },
      };
    },
  };
}
function createMediaRecorder(stream: MediaStream): MediaRecorder {
  try {
    return new MediaRecorder(stream, { videoBitsPerSecond: 700_000 });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
}
